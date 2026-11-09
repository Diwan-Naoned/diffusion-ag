package main

import (
	"errors"
	"os"
	"testing"
)

// TestLoopTimestamps writes 3 loops of the clip to $LOOP_OUT for inspection
// with ffprobe (continuity of PTS/DTS across loop boundaries, beep positions).
func TestLoopTimestamps(t *testing.T) {
	c, err := loadClip(clip1080)
	if err != nil {
		t.Fatal(err)
	}
	var out []byte
	beeps := 0
	l := newLooper(c, func(beepEvent) { beeps++ })
	l.noPace = true
	stop := errors.New("stop")
	limit := 3 * len(clip1080)
	l.run(make(chan struct{}), func(b []byte) error {
		out = append(out, b...)
		if len(out) >= limit {
			return stop
		}
		return nil
	})
	if beeps < 23 || beeps > 25 {
		t.Errorf("beeps over ~48 s = %d, want ~24", beeps)
	}
	if p := os.Getenv("LOOP_OUT"); p != "" {
		os.WriteFile(p, out, 0o644)
	}
	t.Logf("bitrate %.2f Mb/s, beeps %d", c.bitrate/1e6, beeps)
}
