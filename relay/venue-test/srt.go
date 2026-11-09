package main

import (
	"fmt"
	"net"
	"sync"
	"time"

	srt "github.com/datarhei/gosrt"
)

// srtSample is one per-second measurement of the outgoing SRT stream.
type srtSample struct {
	T          float64 `json:"t"`           // seconds since stream start
	Connected  bool    `json:"connected"`   //
	MbpsSent   float64 `json:"mbps_sent"`   // incl. retransmissions and headers
	RTTms      float64 `json:"rtt_ms"`      //
	Sent       uint64  `json:"sent"`        // data packets this second (incl. retrans)
	Retrans    uint64  `json:"retrans"`     // retransmitted packets this second
	Dropped    uint64  `json:"dropped"`     // packets dropped by the sender (too late, never delivered)
	SendBufMs  uint64  `json:"send_buf_ms"` // unacknowledged data in the sender buffer
	QueueFull  uint64  `json:"queue_full"`  // writes refused because the local queue was full
	Reconnects int     `json:"reconnects"`  // cumulative
}

type srtPublisher struct {
	addr, streamID string
	latency        time.Duration
	clip           *tsClip
	beeps          *beepLog

	mu         sync.Mutex
	samples    []srtSample
	reconnects int
	lastErr    string
	everUp     bool
	queueFull  uint64

	stop chan struct{}
	done chan struct{}
}

func newSRTPublisher(addr, streamID string, latency time.Duration, clip *tsClip, beeps *beepLog) *srtPublisher {
	return &srtPublisher{addr: addr, streamID: streamID, latency: latency, clip: clip, beeps: beeps,
		stop: make(chan struct{}), done: make(chan struct{})}
}

func (p *srtPublisher) dial() (srt.Conn, error) {
	cfg := srt.DefaultConfig()
	cfg.StreamId = p.streamID
	cfg.Latency = p.latency
	cfg.PeerLatency = p.latency
	cfg.ReceiverLatency = p.latency
	cfg.PayloadSize = 7 * tsPacketSize
	cfg.ConnectionTimeout = 5 * time.Second
	return srt.Dial("srt", p.addr, cfg)
}

// start connects once synchronously (to report a clear error), then keeps the
// stream running in the background, reconnecting like OBS does.
func (p *srtPublisher) start() error {
	if _, err := net.ResolveUDPAddr("udp", p.addr); err != nil {
		return fmt.Errorf("adresse du serveur introuvable (%v)", err)
	}
	conn, err := p.dial()
	if err != nil {
		return err
	}
	go p.loop(conn)
	return nil
}

func (p *srtPublisher) loop(conn srt.Conn) {
	defer close(p.done)
	t0 := time.Now()
	var cur struct {
		sync.Mutex
		c srt.Conn
	}
	cur.c = conn
	p.mu.Lock()
	p.everUp = true
	p.mu.Unlock()

	// Sampler: per-second stats of the current connection.
	samplerDone := make(chan struct{})
	go func() {
		defer close(samplerDone)
		tick := time.NewTicker(time.Second)
		defer tick.Stop()
		var prev srt.Statistics
		var prevConn srt.Conn
		var prevQF uint64
		for {
			select {
			case <-p.stop:
				return
			case <-tick.C:
			}
			cur.Lock()
			c := cur.c
			cur.Unlock()
			s := srtSample{T: time.Since(t0).Seconds()}
			p.mu.Lock()
			s.Reconnects = p.reconnects
			qf := p.queueFull
			p.mu.Unlock()
			s.QueueFull = qf - prevQF
			prevQF = qf
			if c != nil {
				var st srt.Statistics
				c.Stats(&st)
				if c != prevConn {
					prev = srt.Statistics{}
					prevConn = c
				}
				s.Connected = true
				s.MbpsSent = st.Instantaneous.MbpsSentRate
				s.RTTms = st.Instantaneous.MsRTT
				s.Sent = st.Accumulated.PktSent - prev.Accumulated.PktSent
				s.Retrans = st.Accumulated.PktRetrans - prev.Accumulated.PktRetrans
				s.Dropped = st.Accumulated.PktSendDrop - prev.Accumulated.PktSendDrop
				s.SendBufMs = st.Instantaneous.MsSendBuf
				prev = st
			}
			p.mu.Lock()
			p.samples = append(p.samples, s)
			p.mu.Unlock()
		}
	}()

	for {
		closed := make(chan struct{})
		c := cur.c
		go func() { // the relay never sends data: Read returns when the connection dies
			buf := make([]byte, 1500)
			for {
				if _, err := c.Read(buf); err != nil {
					close(closed)
					return
				}
			}
		}()
		looper := newLooper(p.clip, p.beeps.add)
		loopStop := make(chan struct{})
		go func() {
			select {
			case <-closed:
			case <-p.stop:
			}
			close(loopStop)
		}()
		looper.run(loopStop, func(b []byte) error {
			if _, err := c.Write(b); err != nil {
				// Queue full (congestion) or closed; the Read goroutine tells which.
				p.mu.Lock()
				p.queueFull++
				p.mu.Unlock()
			}
			return nil
		})
		c.Close()
		select {
		case <-p.stop:
			<-samplerDone
			return
		default:
		}
		// Connection lost: reconnect every 2 s like OBS.
		cur.Lock()
		cur.c = nil
		cur.Unlock()
		for {
			select {
			case <-p.stop:
				<-samplerDone
				return
			case <-time.After(2 * time.Second):
			}
			nc, err := p.dial()
			if err != nil {
				p.mu.Lock()
				p.lastErr = err.Error()
				p.mu.Unlock()
				continue
			}
			p.mu.Lock()
			p.reconnects++
			p.mu.Unlock()
			cur.Lock()
			cur.c = nc
			cur.Unlock()
			break
		}
	}
}

func (p *srtPublisher) close() {
	select {
	case <-p.stop:
	default:
		close(p.stop)
	}
	<-p.done
}

// window returns the samples with from <= T < to.
func (p *srtPublisher) window(from, to float64) []srtSample {
	p.mu.Lock()
	defer p.mu.Unlock()
	var out []srtSample
	for _, s := range p.samples {
		if s.T >= from && s.T < to {
			out = append(out, s)
		}
	}
	return out
}

func (p *srtPublisher) elapsed() float64 {
	p.mu.Lock()
	defer p.mu.Unlock()
	if len(p.samples) == 0 {
		return 0
	}
	return p.samples[len(p.samples)-1].T
}

// srtSummary aggregates samples for the report.
type srtSummary struct {
	Seconds        int     `json:"seconds"`
	ConnectedPct   float64 `json:"connected_pct"`
	AvgMbps        float64 `json:"avg_mbps"`
	MinMbps        float64 `json:"min_mbps"`
	AvgRTTms       float64 `json:"avg_rtt_ms"`
	MaxRTTms       float64 `json:"max_rtt_ms"`
	RetransPct     float64 `json:"retrans_pct"`
	Dropped        uint64  `json:"dropped"`
	DroppedPct     float64 `json:"dropped_pct"`
	MaxSendBufMs   uint64  `json:"max_send_buf_ms"`
	QueueFull      uint64  `json:"queue_full"`
	Reconnects     int     `json:"reconnects"`
	SecondsWithErr int     `json:"seconds_with_drops"`
}

func summarizeSRT(ss []srtSample) srtSummary {
	var r srtSummary
	if len(ss) == 0 {
		return r
	}
	var sent, retrans uint64
	var conn, rttN int
	var sumMbps, sumRTT float64
	r.MinMbps = 1e9
	for _, s := range ss {
		r.Seconds++
		sent += s.Sent
		retrans += s.Retrans
		r.Dropped += s.Dropped
		r.QueueFull += s.QueueFull
		if s.Dropped > 0 || s.QueueFull > 0 || !s.Connected {
			r.SecondsWithErr++
		}
		if s.Connected {
			conn++
			sumMbps += s.MbpsSent
			if s.MbpsSent < r.MinMbps {
				r.MinMbps = s.MbpsSent
			}
			if s.RTTms > 0 {
				sumRTT += s.RTTms
				rttN++
				if s.RTTms > r.MaxRTTms {
					r.MaxRTTms = s.RTTms
				}
			}
			if s.SendBufMs > r.MaxSendBufMs {
				r.MaxSendBufMs = s.SendBufMs
			}
		}
	}
	r.Reconnects = ss[len(ss)-1].Reconnects - ss[0].Reconnects
	r.ConnectedPct = 100 * float64(conn) / float64(len(ss))
	if conn > 0 {
		r.AvgMbps = sumMbps / float64(conn)
	} else {
		r.MinMbps = 0
	}
	if rttN > 0 {
		r.AvgRTTms = sumRTT / float64(rttN)
	}
	if sent > 0 {
		r.RetransPct = 100 * float64(retrans) / float64(sent)
		r.DroppedPct = 100 * float64(r.Dropped) / float64(sent)
	}
	return r
}

// beepLog keeps the recent beep emission times shared with the listeners.
type beepLog struct {
	mu    sync.Mutex
	times []time.Time
}

func (b *beepLog) add(e beepEvent) {
	b.mu.Lock()
	b.times = append(b.times, e.at)
	if len(b.times) > 64 {
		b.times = b.times[len(b.times)-64:]
	}
	b.mu.Unlock()
}

// latencyFor returns the delay between the latest beep emitted before t and t.
func (b *beepLog) latencyFor(t time.Time) (time.Duration, bool) {
	b.mu.Lock()
	defer b.mu.Unlock()
	for i := len(b.times) - 1; i >= 0; i-- {
		if !b.times[i].After(t) {
			d := t.Sub(b.times[i])
			if d < 1900*time.Millisecond {
				return d, true
			}
			return 0, false
		}
	}
	return 0, false
}
