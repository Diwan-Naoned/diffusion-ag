package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/pion/ice/v4"
	"github.com/pion/interceptor"
	"github.com/pion/webrtc/v4"
)

// listener is one simulated phone reading the interpretation feed over WHEP.
type listener struct {
	id      int
	pc      *webrtc.PeerConnection
	session string // WHEP session URL (for DELETE)
	beeps   *beepLog

	connected atomic.Bool
	failed    atomic.Bool
	closing   atomic.Bool

	mu        sync.Mutex
	c         rxCounters
	loudRun   int
	latencies []time.Duration
	stereo    int
	mono      int
}

// rxCounters are cumulative, snapshotted at stage boundaries.
type rxCounters struct {
	received    uint64
	expected    uint64 // from RTP sequence numbers
	jitterSum   float64
	jitterN     uint64
	firstSeq    int64
	maxSeq      int64 // extended
	lastTransit float64
	jitter      float64
	hasTransit  bool
	bytes       uint64
}

type whepClient struct {
	api    *webrtc.API
	url    string
	cookie string
	http   *http.Client
	beeps  *beepLog
}

// localIPTowards returns the local address the OS uses to reach host.
func localIPTowards(host string) net.IP {
	c, err := net.Dial("udp4", net.JoinHostPort(host, "9"))
	if err != nil {
		return nil
	}
	defer c.Close()
	return c.LocalAddr().(*net.UDPAddr).IP
}

func newWHEPClient(whepURL, cookie string, beeps *beepLog) (*whepClient, error) {
	u, err := url.Parse(whepURL)
	if err != nil {
		return nil, err
	}
	m := &webrtc.MediaEngine{}
	if err := m.RegisterDefaultCodecs(); err != nil {
		return nil, err
	}
	reg := &interceptor.Registry{}
	if err := webrtc.RegisterDefaultInterceptors(m, reg); err != nil {
		return nil, err
	}
	se := webrtc.SettingEngine{}
	se.SetNetworkTypes([]webrtc.NetworkType{webrtc.NetworkTypeUDP4})
	se.SetICEMulticastDNSMode(ice.MulticastDNSModeDisabled)
	// Only use the interface that carries the default route (the Wi-Fi or the
	// phone hotspot), not VPN/virtual adapters.
	if ip := localIPTowards(u.Hostname()); ip != nil {
		se.SetIPFilter(func(c net.IP) bool { return c.Equal(ip) })
	}
	api := webrtc.NewAPI(webrtc.WithMediaEngine(m), webrtc.WithInterceptorRegistry(reg), webrtc.WithSettingEngine(se))
	return &whepClient{api: api, url: whepURL, cookie: cookie, beeps: beeps,
		http: &http.Client{Timeout: 15 * time.Second}}, nil
}

// errStreamNotReady is returned while the relay has no interpretation feed yet.
var errStreamNotReady = errors.New("flux d'interprétation pas encore disponible")

func (w *whepClient) connect(ctx context.Context, id int) (*listener, error) {
	pc, err := w.api.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		return nil, err
	}
	l := &listener{id: id, pc: pc, beeps: w.beeps}
	l.c.firstSeq = -1
	if _, err := pc.AddTransceiverFromKind(webrtc.RTPCodecTypeAudio,
		webrtc.RTPTransceiverInit{Direction: webrtc.RTPTransceiverDirectionRecvonly}); err != nil {
		pc.Close()
		return nil, err
	}
	pc.OnConnectionStateChange(func(s webrtc.PeerConnectionState) {
		switch s {
		case webrtc.PeerConnectionStateConnected:
			l.connected.Store(true)
		case webrtc.PeerConnectionStateFailed:
			l.failed.Store(true)
		case webrtc.PeerConnectionStateClosed:
			if !l.closing.Load() { // closed by the server (e.g. the stream restarted)
				l.failed.Store(true)
			}
		}
	})
	pc.OnTrack(func(tr *webrtc.TrackRemote, _ *webrtc.RTPReceiver) { go l.read(tr) })

	offer, err := pc.CreateOffer(nil)
	if err != nil {
		pc.Close()
		return nil, err
	}
	gathered := webrtc.GatheringCompletePromise(pc)
	if err := pc.SetLocalDescription(offer); err != nil {
		pc.Close()
		return nil, err
	}
	select {
	case <-gathered:
	case <-ctx.Done():
		pc.Close()
		return nil, ctx.Err()
	}

	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, w.url, strings.NewReader(pc.LocalDescription().SDP))
	req.Header.Set("Content-Type", "application/sdp")
	if w.cookie != "" {
		req.Header.Set("Cookie", w.cookie)
	}
	res, err := w.http.Do(req)
	if err != nil {
		pc.Close()
		return nil, fmt.Errorf("requête WHEP: %w", err)
	}
	body, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	res.Body.Close()
	switch {
	case res.StatusCode == http.StatusCreated:
	case res.StatusCode == http.StatusNotFound:
		pc.Close()
		return nil, errStreamNotReady
	case res.StatusCode == http.StatusUnauthorized:
		pc.Close()
		return nil, errors.New("accès refusé (401) : le cookie de test n'est pas accepté")
	default:
		pc.Close()
		return nil, fmt.Errorf("réponse WHEP %d: %s", res.StatusCode, strings.TrimSpace(string(body)))
	}
	if loc := res.Header.Get("Location"); loc != "" {
		if u, err := res.Request.URL.Parse(loc); err == nil {
			l.session = u.String()
		}
	}
	if err := pc.SetRemoteDescription(webrtc.SessionDescription{Type: webrtc.SDPTypeAnswer, SDP: string(body)}); err != nil {
		l.close(w)
		return nil, err
	}
	return l, nil
}

func (l *listener) read(tr *webrtc.TrackRemote) {
	clock := float64(tr.Codec().ClockRate)
	if clock == 0 {
		clock = 48000
	}
	t0 := time.Now()
	var cycles int64
	var lastSeq uint16
	first := true
	for {
		pkt, _, err := tr.ReadRTP()
		if err != nil {
			return
		}
		now := time.Now()
		l.mu.Lock()
		c := &l.c
		// Extended sequence number.
		if first {
			first = false
			lastSeq = pkt.SequenceNumber
			c.firstSeq = int64(pkt.SequenceNumber)
			c.maxSeq = c.firstSeq
		} else {
			if pkt.SequenceNumber < 0x1000 && lastSeq > 0xf000 {
				cycles += 1 << 16
			}
			ext := cycles + int64(pkt.SequenceNumber)
			if pkt.SequenceNumber > 0xf000 && lastSeq < 0x1000 {
				ext -= 1 << 16 // late packet from the previous cycle
			}
			if ext > c.maxSeq {
				c.maxSeq = ext
			}
			lastSeq = pkt.SequenceNumber
		}
		c.received++
		c.bytes += uint64(len(pkt.Payload))
		// RFC 3550 interarrival jitter.
		arrival := now.Sub(t0).Seconds() * clock
		transit := arrival - float64(pkt.Timestamp)
		if c.hasTransit {
			d := transit - c.lastTransit
			if d < 0 {
				d = -d
			}
			if d < clock { // ignore timestamp jumps (publisher restart)
				c.jitter += (d - c.jitter) / 16
				c.jitterSum += c.jitter / clock * 1000
				c.jitterN++
			}
		}
		c.lastTransit = transit
		c.hasTransit = true

		// Opus TOC byte: stereo flag (bit 2).
		if len(pkt.Payload) > 0 {
			if pkt.Payload[0]&0x04 != 0 {
				l.stereo++
			} else {
				l.mono++
			}
		}
		if debugSizes {
			fmt.Fprintf(os.Stderr, "L%d %s seq=%d size=%d\n", l.id, now.Format("15:04:05.000"), pkt.SequenceNumber, len(pkt.Payload))
		}
		// Marker detection: the noise makes Opus frames large; the silence
		// every 2 s makes them tiny. The first tiny frame after a run of large
		// ones is the marker.
		quiet := len(pkt.Payload) < quietThreshold
		if quiet && l.loudRun >= 10 {
			if d, ok := l.beeps.latencyFor(now); ok {
				l.latencies = append(l.latencies, d)
			}
		}
		if quiet {
			l.loudRun = 0
		} else {
			l.loudRun++
		}
		l.mu.Unlock()
	}
}

var debugSizes = os.Getenv("VT_DEBUG_SIZES") != ""

// quietThreshold separates silence frames (a few bytes) from noise frames
// (about 120 bytes at 48 kb/s), in bytes of Opus payload.
var quietThreshold = 20

func (l *listener) snapshot() (rxCounters, []time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()
	c := l.c
	if c.firstSeq >= 0 {
		c.expected = uint64(c.maxSeq - c.firstSeq + 1)
	}
	lat := append([]time.Duration(nil), l.latencies...)
	return c, lat
}

func (l *listener) close(w *whepClient) {
	l.closing.Store(true)
	l.pc.Close()
	if l.session != "" {
		req, _ := http.NewRequest(http.MethodDelete, l.session, nil)
		if w.cookie != "" {
			req.Header.Set("Cookie", w.cookie)
		}
		if res, err := w.http.Do(req); err == nil {
			res.Body.Close()
		}
	}
}

// pool manages the simulated listeners. Like the real player (reader.js),
// a listener that loses its connection is replaced.
type pool struct {
	w         *whepClient
	mu        sync.Mutex
	listeners []*listener
	connErrs  []string
	nextID    int
	failures  int // connection attempts that never connected (cumulative)
	dropped   int // listeners lost after connecting (cumulative)
	pending   atomic.Int32
}

// reap removes listeners whose connection failed.
func (p *pool) reap() {
	p.mu.Lock()
	var keep, dead []*listener
	for _, l := range p.listeners {
		if l.failed.Load() {
			dead = append(dead, l)
		} else {
			keep = append(keep, l)
		}
	}
	p.listeners = keep
	p.dropped += len(dead)
	p.mu.Unlock()
	for _, l := range dead {
		go l.close(p.w)
	}
}

func (p *pool) open() int {
	p.mu.Lock()
	defer p.mu.Unlock()
	return len(p.listeners)
}

// grow starts connection attempts until n listeners are open or pending, at
// most rate per second, and waits for them to finish.
func (p *pool) grow(ctx context.Context, n int, rate int) {
	interval := time.Second / time.Duration(rate)
	var wg sync.WaitGroup
	for ctx.Err() == nil && p.open()+int(p.pending.Load()) < n {
		p.mu.Lock()
		p.nextID++
		id := p.nextID
		p.mu.Unlock()
		p.pending.Add(1)
		wg.Add(1)
		go func() {
			defer wg.Done()
			defer p.pending.Add(-1)
			cctx, cancel := context.WithTimeout(ctx, 15*time.Second)
			defer cancel()
			l, err := p.w.connect(cctx, id)
			if err == nil {
				deadline := time.Now().Add(12 * time.Second)
				for !l.connected.Load() && !l.failed.Load() && time.Now().Before(deadline) && ctx.Err() == nil {
					time.Sleep(50 * time.Millisecond)
				}
				if !l.connected.Load() || l.failed.Load() {
					l.close(p.w)
					err = errors.New("connexion WebRTC (ICE/DTLS) non établie")
				}
			}
			p.mu.Lock()
			defer p.mu.Unlock()
			if err != nil {
				if !errors.Is(err, context.Canceled) {
					p.failures++
					if len(p.connErrs) < 20 {
						p.connErrs = append(p.connErrs, err.Error())
					}
				}
				return
			}
			p.listeners = append(p.listeners, l)
		}()
		time.Sleep(interval)
	}
	wg.Wait()
}

func (p *pool) counters() (failures, dropped int) {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.failures, p.dropped
}

func (p *pool) closeAll() {
	p.mu.Lock()
	ls := p.listeners
	p.listeners = nil
	p.mu.Unlock()
	var wg sync.WaitGroup
	sem := make(chan struct{}, 32)
	for _, l := range ls {
		wg.Add(1)
		sem <- struct{}{}
		go func(l *listener) {
			defer wg.Done()
			l.close(p.w)
			<-sem
		}(l)
	}
	wg.Wait()
}

type poolSnap struct {
	per map[int]rxCounters
	lat map[int]int // number of latencies already counted per listener
}

func (p *pool) snap() poolSnap {
	p.mu.Lock()
	ls := append([]*listener(nil), p.listeners...)
	p.mu.Unlock()
	s := poolSnap{per: map[int]rxCounters{}, lat: map[int]int{}}
	for _, l := range ls {
		c, lat := l.snapshot()
		s.per[l.id] = c
		s.lat[l.id] = len(lat)
	}
	return s
}

// listenerStats aggregates one stage for the report.
type listenerStats struct {
	Target       int     `json:"target"`
	Open         int     `json:"open"`            // connected at stage end
	ConnFailures int     `json:"conn_failures"`   // attempts that never connected
	Dropped      int     `json:"dropped"`         // connected then lost during the stage
	Silent       int     `json:"silent"`          // connected but received nothing during the stage
	LossPct      float64 `json:"loss_pct"`        // all listeners together
	WorstLossPct float64 `json:"worst_loss_pct"`  // worst listener
	JitterMs     float64 `json:"jitter_ms"`       // mean
	LatencyP50ms float64 `json:"latency_p50_ms"`  //
	LatencyP95ms float64 `json:"latency_p95_ms"`  //
	LatencyMaxms float64 `json:"latency_max_ms"`  //
	LatencyN     int     `json:"latency_samples"` //
	DownMbps     float64 `json:"down_mbps"`       // audio payload received by all listeners
	OpusMono     *bool   `json:"opus_mono,omitempty"`
}

func (p *pool) stats(from poolSnap, seconds float64, target, connFailures, dropped int) listenerStats {
	p.mu.Lock()
	ls := append([]*listener(nil), p.listeners...)
	p.mu.Unlock()
	r := listenerStats{Target: target, ConnFailures: connFailures, Dropped: dropped}
	var exp, rec, bytes uint64
	var jit float64
	var jitN int
	var lats []float64
	var mono, stereo int
	for _, l := range ls {
		if l.failed.Load() {
			continue
		}
		r.Open++
		c, lat := l.snapshot()
		b := from.per[l.id] // zero value if the listener joined during the stage
		e := c.expected - b.expected
		g := c.received - b.received
		if g == 0 {
			r.Silent++
		}
		exp += e
		rec += g
		bytes += c.bytes - b.bytes
		if e > 0 {
			loss := 100 * float64(int64(e)-int64(g)) / float64(e)
			if loss > r.WorstLossPct {
				r.WorstLossPct = loss
			}
		}
		if n := c.jitterN - b.jitterN; n > 0 {
			jit += (c.jitterSum - b.jitterSum) / float64(n)
			jitN++
		}
		for _, d := range lat[from.lat[l.id]:] {
			lats = append(lats, float64(d.Milliseconds()))
		}
		l.mu.Lock()
		mono += l.mono
		stereo += l.stereo
		l.mu.Unlock()
	}
	if exp > 0 {
		r.LossPct = 100 * float64(int64(exp)-int64(rec)) / float64(exp)
		if r.LossPct < 0 {
			r.LossPct = 0
		}
	}
	if jitN > 0 {
		r.JitterMs = jit / float64(jitN)
	}
	if seconds > 0 {
		r.DownMbps = float64(bytes*8) / seconds / 1e6
	}
	if len(lats) > 0 {
		sort.Float64s(lats)
		r.LatencyN = len(lats)
		r.LatencyP50ms = lats[len(lats)/2]
		r.LatencyP95ms = lats[len(lats)*95/100]
		r.LatencyMaxms = lats[len(lats)-1]
	}
	if mono+stereo > 0 {
		m := stereo == 0
		r.OpusMono = &m
	}
	return r
}
