package main

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

func randHex(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func osName() string { return runtime.GOOS + "/" + runtime.GOARCH }

func netClient() *http.Client { return &http.Client{Timeout: 20 * time.Second} }

func (r *report) addNote(s string) {
	r.mu.Lock()
	r.Notes = append(r.Notes, s)
	r.mu.Unlock()
}

func (r *report) json() []byte {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Updated = time.Now()
	b, _ := json.MarshalIndent(r, "", "  ")
	return b
}

func uploadReport(cfg *config, r *report) error {
	if cfg.ResultsToken == "" {
		return fmt.Errorf("pas de jeton d'envoi configuré")
	}
	req, _ := http.NewRequest(http.MethodPost, strings.TrimRight(cfg.BaseURL, "/")+"/results/"+r.ID, bytes.NewReader(r.json()))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Results-Token", cfg.ResultsToken)
	res, err := netClient().Do(req)
	if err != nil {
		return err
	}
	res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("réponse %d", res.StatusCode)
	}
	return nil
}

// uploadReportAsync sends intermediate results so they can be followed live.
func uploadReportAsync(cfg *config, r *report) { go uploadReport(cfg, r) }

// saveReport writes the JSON report and a readable summary next to the
// executable and on the desktop. It returns the paths written.
func saveReport(r *report) []string {
	var dirs []string
	if exe, err := os.Executable(); err == nil {
		dirs = append(dirs, filepath.Dir(exe))
	}
	if d := desktopDir(); d != "" {
		dirs = append(dirs, d)
	}
	name := "test-connexion-AG-" + r.ID
	data := r.json()
	text := []byte(r.text())
	var out []string
	seen := map[string]bool{}
	for _, d := range dirs {
		if seen[d] || strings.Contains(strings.ToLower(d), strings.ToLower(os.TempDir())) {
			continue
		}
		seen[d] = true
		if os.WriteFile(filepath.Join(d, name+".json"), data, 0o644) == nil {
			os.WriteFile(filepath.Join(d, name+".txt"), text, 0o644)
			out = append(out, filepath.Join(d, name+".json"))
		}
	}
	return out
}

// text renders a plain summary (also useful for whoever reads it first).
func (r *report) text() string {
	r.mu.Lock()
	defer r.mu.Unlock()
	var b strings.Builder
	fmt.Fprintf(&b, "Test de connexion AG %s (%s), statut %s\n\n", r.ID, r.OS, r.Status)
	for _, ph := range r.Phases {
		fmt.Fprintf(&b, "== %s: %s (%s)\n", ph.Name, ph.Verdict, ph.Summary)
		fmt.Fprintf(&b, "IP locale %s, IP publique %s\n", ph.LocalIP, ph.Speed.PublicIP)
		fmt.Fprintf(&b, "Débit HTTP: envoi %.1f Mb/s, réception %.1f Mb/s, ping %.0f ms\n",
			ph.Speed.UpMbps, ph.Speed.DownMbps, ph.Speed.PingMs)
		for _, s := range ph.Stages {
			l, t := s.Listeners, s.SRT
			fmt.Fprintf(&b, "- %s %d auditeurs: %s | SRT %.2f Mb/s (min %.2f), RTT %.0f/%.0f ms, retrans %.1f%%, perdus %d, reco %d | auditeurs %d ouverts, %d échecs, %d décos, %d muets, pertes %.2f%% (pire %.2f%%), gigue %.1f ms, délai p50 %.0f / p95 %.0f / max %.0f ms (%d mesures), %.1f Mb/s reçus\n",
				s.Profile, l.Target, s.Verdict, t.AvgMbps, t.MinMbps, t.AvgRTTms, t.MaxRTTms, t.RetransPct, t.Dropped, t.Reconnects,
				l.Open, l.ConnFailures, l.Dropped, l.Silent, l.LossPct, l.WorstLossPct, l.JitterMs,
				l.LatencyP50ms, l.LatencyP95ms, l.LatencyMaxms, l.LatencyN, l.DownMbps)
			for _, p := range s.Problems {
				fmt.Fprintf(&b, "    ! %s\n", p)
			}
		}
		if ph.Error != "" {
			fmt.Fprintf(&b, "Erreur: %s\n", ph.Error)
		}
		if len(ph.ConnErrors) > 0 {
			fmt.Fprintf(&b, "Erreurs de connexion (extrait): %s\n", strings.Join(ph.ConnErrors, " / "))
		}
		fmt.Fprintf(&b, "Wi-Fi:\n%s\n\n", strings.TrimSpace(ph.WifiInfo))
	}
	for _, a := range r.Answers {
		fmt.Fprintf(&b, "Q: %s\nR: %s\n", a.Q, a.A)
	}
	for _, n := range r.Notes {
		fmt.Fprintf(&b, "Note: %s\n", n)
	}
	return b.String()
}
