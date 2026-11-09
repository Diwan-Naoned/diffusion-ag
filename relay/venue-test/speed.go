package main

import (
	"context"
	"crypto/rand"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// HTTP throughput to the VPS (through Traefik, like the WHEP signaling).
type speedResult struct {
	UpMbps   float64 `json:"up_mbps"`
	DownMbps float64 `json:"down_mbps"`
	PingMs   float64 `json:"http_ping_ms"`
	PublicIP string  `json:"public_ip"`
	Error    string  `json:"error,omitempty"`
}

type countingReader struct {
	n    *atomic.Int64
	buf  []byte
	stop <-chan struct{}
}

func (r countingReader) Read(p []byte) (int, error) {
	select {
	case <-r.stop:
		return 0, io.EOF
	default:
	}
	n := copy(p, r.buf)
	r.n.Add(int64(n))
	return n, nil
}

func speedTest(base string, dur time.Duration, streams int) speedResult {
	var r speedResult
	cl := &http.Client{Timeout: dur + 15*time.Second}

	// Latency and public IP.
	var pings []time.Duration
	for i := 0; i < 5; i++ {
		t := time.Now()
		res, err := cl.Get(base + "/speed/ip")
		if err != nil {
			r.Error = fmt.Sprintf("serveur injoignable: %v", err)
			return r
		}
		b, _ := io.ReadAll(res.Body)
		res.Body.Close()
		if res.StatusCode != 200 {
			r.Error = fmt.Sprintf("serveur de test: réponse %d", res.StatusCode)
			return r
		}
		if i > 0 { // the first request includes the TLS handshake
			pings = append(pings, time.Since(t))
		}
		r.PublicIP = strings.TrimSpace(string(b))
	}
	var sum time.Duration
	for _, p := range pings {
		sum += p
	}
	r.PingMs = float64(sum.Milliseconds()) / float64(len(pings))
	if dur <= 0 { // latency and public IP only
		return r
	}

	// Download.
	{
		var n atomic.Int64
		ctx, cancel := context.WithTimeout(context.Background(), dur)
		var wg sync.WaitGroup
		t := time.Now()
		for i := 0; i < streams; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				req, _ := http.NewRequestWithContext(ctx, http.MethodGet, base+"/speed/down?bytes=500000000", nil)
				res, err := cl.Do(req)
				if err != nil {
					return
				}
				defer res.Body.Close()
				buf := make([]byte, 64<<10)
				for {
					k, err := res.Body.Read(buf)
					n.Add(int64(k))
					if err != nil {
						return
					}
				}
			}()
		}
		wg.Wait()
		cancel()
		r.DownMbps = float64(n.Load()*8) / time.Since(t).Seconds() / 1e6
	}

	// Upload.
	{
		var n atomic.Int64
		stop := make(chan struct{})
		buf := make([]byte, 64<<10)
		rand.Read(buf)
		var wg sync.WaitGroup
		t := time.Now()
		for i := 0; i < streams; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				req, _ := http.NewRequest(http.MethodPost, base+"/speed/up", countingReader{n: &n, buf: buf, stop: stop})
				req.Header.Set("Content-Type", "application/octet-stream")
				res, err := cl.Do(req)
				if err == nil {
					io.Copy(io.Discard, res.Body)
					res.Body.Close()
				}
			}()
		}
		time.Sleep(dur)
		close(stop)
		elapsed := time.Since(t)
		wg.Wait()
		r.UpMbps = float64(n.Load()*8) / elapsed.Seconds() / 1e6
	}
	return r
}
