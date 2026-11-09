package main

import (
	"errors"
	"fmt"
	"time"
)

// MPEG-TS looping: the embedded clip is played forever as one continuous live
// stream. Each loop shifts PCR/PTS/DTS by the clip duration and rewrites the
// continuity counters, so the relay sees an unbroken stream (like OBS).

const (
	tsPacketSize = 188
	clockHz      = 90000
	// Clip duration in 90 kHz ticks. The clips are generated with exactly 16 s
	// of video (480 frames at 30 fps); audio frames past that are dropped.
	loopTicks = 16 * clockHz
	// The interpreter track (3rd audio track) is pink noise with a silence
	// every 2 s, starting at content time 0, i.e. at the first video PTS. The
	// start of each silence is the latency marker (called "beep" below).
	beepPeriodTicks = 2 * clockHz
	aacFrameTicks   = 1024 * clockHz / 48000
	pidTrad         = 0x103 // 3rd audio stream PID as written by ffmpeg
)

type tsPacket struct {
	data     [tsPacketSize]byte
	pid      uint16
	pcr      int64 // -1 if none (27 MHz base*300+ext is not needed: base only)
	pesStart bool
	pts, dts int64 // -1 if none
}

type tsClip struct {
	packets   []tsPacket
	firstPCR  int64
	firstPTS  map[uint16]int64 // first DTS (or PTS) per PES PID
	videoPTS0 int64            // first video PTS: content time 0
	bitrate   float64          // bits per second, for display
}

func parsePTS(b []byte) int64 {
	return int64(b[0]>>1&0x07)<<30 | int64(b[1])<<22 | int64(b[2]>>1)<<15 | int64(b[3])<<7 | int64(b[4]>>1)
}

func writePTS(b []byte, v int64) {
	v &= (1 << 33) - 1
	b[0] = b[0]&0xf1 | byte(v>>29)&0x0e
	b[1] = byte(v >> 22)
	b[2] = b[2]&0x01 | byte(v>>14)&0xfe
	b[3] = byte(v >> 7)
	b[4] = b[4]&0x01 | byte(v<<1)&0xfe
}

// payloadOffset returns the offset of the payload in the packet, or -1.
func payloadOffset(p []byte) int {
	afc := p[3] >> 4 & 3
	off := 4
	if afc&2 != 0 {
		off += 1 + int(p[4])
	}
	if afc&1 == 0 || off >= tsPacketSize {
		return -1
	}
	return off
}

func loadClip(raw []byte) (*tsClip, error) {
	if len(raw)%tsPacketSize != 0 || len(raw) == 0 {
		return nil, errors.New("clip size is not a multiple of 188")
	}
	c := &tsClip{firstPCR: -1, firstPTS: map[uint16]int64{}, videoPTS0: -1}
	var lastPCR int64 = -1
	for i := 0; i < len(raw); i += tsPacketSize {
		var pk tsPacket
		copy(pk.data[:], raw[i:i+tsPacketSize])
		p := pk.data[:]
		if p[0] != 0x47 {
			return nil, fmt.Errorf("lost sync at byte %d", i)
		}
		pk.pid = uint16(p[1]&0x1f)<<8 | uint16(p[2])
		pk.pcr, pk.pts, pk.dts = -1, -1, -1
		if p[3]>>4&2 != 0 && p[4] > 0 && p[5]&0x10 != 0 {
			pk.pcr = int64(p[6])<<25 | int64(p[7])<<17 | int64(p[8])<<9 | int64(p[9])<<1 | int64(p[10]>>7)
			if c.firstPCR < 0 {
				c.firstPCR = pk.pcr
			}
			lastPCR = pk.pcr
		}
		if p[1]&0x40 != 0 {
			if off := payloadOffset(p); off >= 0 && off+14 <= tsPacketSize &&
				p[off] == 0 && p[off+1] == 0 && p[off+2] == 1 {
				sid := p[off+3]
				if sid >= 0xc0 && sid <= 0xef { // audio or video PES with optional header
					pk.pesStart = true
					flags := p[off+7] >> 6
					if flags&2 != 0 {
						pk.pts = parsePTS(p[off+9:])
					}
					if flags == 3 {
						pk.dts = parsePTS(p[off+14:])
					}
					t := pk.dts
					if t < 0 {
						t = pk.pts
					}
					if _, ok := c.firstPTS[pk.pid]; !ok && t >= 0 {
						c.firstPTS[pk.pid] = t
					}
					if sid >= 0xe0 && c.videoPTS0 < 0 {
						c.videoPTS0 = pk.pts
					}
				}
			}
		}
		c.packets = append(c.packets, pk)
	}
	if c.firstPCR < 0 || c.videoPTS0 < 0 {
		return nil, errors.New("clip has no PCR or no video")
	}
	if _, ok := c.firstPTS[pidTrad]; !ok {
		return nil, errors.New("clip has no interpreter track")
	}
	span := float64(lastPCR-c.firstPCR) / clockHz
	c.bitrate = float64(len(raw)*8) / span
	return c, nil
}

// beepEvent is the wall-clock time at which the start of a beep left the laptop.
type beepEvent struct {
	at time.Time
}

// tsLooper produces the endless stream. emit is called with 7-packet chunks
// (1316 bytes, one SRT payload) once their send time is reached.
type tsLooper struct {
	noPace bool // tests only
	clip   *tsClip
	cc     map[uint16]byte
	onBeep func(beepEvent)
}

func newLooper(c *tsClip, onBeep func(beepEvent)) *tsLooper {
	return &tsLooper{clip: c, cc: map[uint16]byte{}, onBeep: onBeep}
}

// run streams until stop is closed or emit returns an error.
func (l *tsLooper) run(stop <-chan struct{}, emit func([]byte) error) error {
	c := l.clip
	start := time.Now()
	chunk := make([]byte, 0, 7*tsPacketSize)
	dropping := map[uint16]bool{}
	for loop := int64(0); ; loop++ {
		offset := loop * loopTicks
		for k := range dropping {
			delete(dropping, k)
		}
		for i := range c.packets {
			src := &c.packets[i]
			if src.pesStart {
				t := src.dts
				if t < 0 {
					t = src.pts
				}
				dropping[src.pid] = t >= c.firstPTS[src.pid]+loopTicks
			}
			if dropping[src.pid] {
				continue
			}
			pk := src.data // copy
			p := pk[:]
			if src.pcr >= 0 {
				// Pace on PCR: wait until this packet's time is reached.
				due := start.Add(time.Duration(src.pcr-c.firstPCR+offset) * time.Second / clockHz)
				if d := time.Until(due); d > 0 && !l.noPace {
					select {
					case <-stop:
						return nil
					case <-time.After(d):
					}
				}
				v := (src.pcr + offset) & (1<<33 - 1)
				p[6] = byte(v >> 25)
				p[7] = byte(v >> 17)
				p[8] = byte(v >> 9)
				p[9] = byte(v >> 1)
				p[10] = p[10]&0x7f | byte(v<<7)&0x80
			}
			if src.pesStart {
				off := payloadOffset(p)
				if src.pts >= 0 {
					writePTS(p[off+9:], src.pts+offset)
				}
				if src.dts >= 0 {
					writePTS(p[off+14:], src.dts+offset)
				}
				if src.pid == pidTrad && l.onBeep != nil && src.pts >= 0 {
					// Beep onsets are at videoPTS0 + k*2s. Report the frame that
					// contains an onset, corrected by the onset's position in it.
					rel := src.pts - c.videoPTS0
					onset := (rel + beepPeriodTicks - 1) / beepPeriodTicks * beepPeriodTicks
					if rel >= 0 && onset-rel < aacFrameTicks {
						l.onBeep(beepEvent{at: time.Now().Add(time.Duration(onset-rel) * time.Second / clockHz)})
					} else if rel < 0 && -rel < aacFrameTicks {
						l.onBeep(beepEvent{at: time.Now().Add(time.Duration(-rel) * time.Second / clockHz)})
					}
				}
			}
			// Continuity counter: continuous per PID across loops.
			if p[3]>>4&1 != 0 {
				prev, seen := l.cc[src.pid]
				next := p[3] & 0x0f
				if seen {
					next = (prev + 1) & 0x0f
				}
				l.cc[src.pid] = next
				p[3] = p[3]&0xf0 | next
			}
			chunk = append(chunk, p...)
			if len(chunk) == cap(chunk) {
				if err := emit(chunk); err != nil {
					return err
				}
				chunk = chunk[:0]
			}
		}
		select {
		case <-stop:
			return nil
		default:
		}
	}
}
