package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Live progress: a small status (under 1 KB) posted every 5 s to
// /results/<id>/live, shown at the top of the results page, so the test can be
// followed remotely as it happens. The full report is still uploaded at the
// end of each step.

type liveState struct {
	mu      sync.Mutex
	Phase   string      `json:"phase"`
	Step    string      `json:"step"`
	Prompt  string      `json:"prompt,omitempty"` // question waiting for an answer
	Fields  [][2]string `json:"fields,omitempty"`
	Since   time.Time   `json:"since"` // when the step started
	Sent    time.Time   `json:"sent"`
	Started time.Time   `json:"started"`
}

var live = &liveState{Started: time.Now(), Since: time.Now()}

// liveKick asks for an immediate post (new step or question).
var liveKick = make(chan struct{}, 1)

func kick() {
	select {
	case liveKick <- struct{}{}:
	default:
	}
}

// liveStep starts a new step and clears its fields.
func liveStep(phase, step string) {
	live.mu.Lock()
	if phase != "" {
		live.Phase = phase
	}
	live.Step = step
	live.Fields = nil
	live.Since = time.Now()
	live.mu.Unlock()
	kick()
}

// liveFields replaces the step's fields: key, value, key, value…
func liveFields(kv ...string) {
	f := make([][2]string, 0, len(kv)/2)
	for i := 0; i+1 < len(kv); i += 2 {
		f = append(f, [2]string{kv[i], kv[i+1]})
	}
	live.mu.Lock()
	live.Fields = f
	live.mu.Unlock()
}

func livePrompt(p string) {
	live.mu.Lock()
	live.Prompt = p
	live.mu.Unlock()
	if p != "" {
		kick()
	}
}

var liveClient = &http.Client{Timeout: 8 * time.Second} // keep-alive: one TLS handshake

func postLive(cfg *config, id string) {
	if cfg.ResultsToken == "" {
		return
	}
	live.mu.Lock()
	live.Sent = time.Now()
	b, _ := json.Marshal(live)
	live.mu.Unlock()
	req, _ := http.NewRequest(http.MethodPost, strings.TrimRight(cfg.BaseURL, "/")+"/results/"+id+"/live", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Results-Token", cfg.ResultsToken)
	if res, err := liveClient.Do(req); err == nil {
		res.Body.Close()
	}
}

// startLive posts the live status every 5 s, and right away (at most once per
// second) when the step or the question changes, until the process exits.
func startLive(cfg *config, id string) {
	go func() {
		for {
			postLive(cfg, id)
			time.Sleep(time.Second)
			select {
			case <-liveKick:
			case <-time.After(4 * time.Second):
			}
		}
	}()
}
