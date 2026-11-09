// Command venue-test checks, from a laptop at the venue, that the venue
// network can carry the AG stream: SRT ingest to the relay on the VPS plus
// many simultaneous WebRTC listeners of the interpretation feed, on the venue
// Wi-Fi then on a 4G/5G phone hotspot. Results are uploaded to the test stub
// on the VPS and saved next to the executable.
//
// The user is non-technical: everything on screen is in French, the program
// needs no arguments and runs the whole test on its own.
package main

import (
	"bufio"
	"context"
	_ "embed"
	"encoding/json"
	"flag"
	"fmt"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"
)

//go:embed config.json
var embeddedConfig []byte

//go:embed media/test1080.ts
var clip1080 []byte

//go:embed media/test720.ts
var clip720 []byte

//go:embed media/testcheck.ts
var clipCheck []byte

const version = "1.0"

type stageConf struct {
	Listeners int `json:"listeners"`
	Seconds   int `json:"seconds"`
}

type config struct {
	SRTAddr      string      `json:"srt_addr"`     // host:port
	SRTStreamID  string      `json:"srt_streamid"` // publish:ag:<user>:<pass>
	SRTLatencyMs int         `json:"srt_latency_ms"`
	WHEPURL      string      `json:"whep_url"`
	Cookie       string      `json:"cookie"`
	BaseURL      string      `json:"base_url"` // test stub: /speed/*, /results
	ResultsToken string      `json:"results_token"`
	PhonePage    string      `json:"phone_page"`   // test player URL for the phone check (empty: skipped)
	ConnectRate  int         `json:"connect_rate"` // listeners opened per second
	SpeedSeconds int         `json:"speed_seconds"`
	WifiStages   []stageConf `json:"wifi_stages"`
	MobileStages []stageConf `json:"mobile_stages"`
	Mobile720    []stageConf `json:"mobile_720_stages"`
}

// ---------------------------------------------------------------- report

type stageResult struct {
	Profile   string        `json:"profile"`
	Listeners listenerStats `json:"listeners"`
	SRT       srtSummary    `json:"srt"`
	Verdict   string        `json:"verdict"` // ok | warn | fail
	Problems  []string      `json:"problems,omitempty"`
	LoadFail  bool          `json:"load_fail,omitempty"` // failed because of the load: higher stages are pointless
}

type phaseResult struct {
	Name       string                 `json:"name"` // wifi | mobile
	Started    time.Time              `json:"started"`
	WifiInfo   string                 `json:"wifi_info"`
	LocalIP    string                 `json:"local_ip"`
	Speed      speedResult            `json:"speed"`
	Stages     []stageResult          `json:"stages"`
	Error      string                 `json:"error,omitempty"`
	ConnErrors []string               `json:"conn_errors,omitempty"`
	SRTSamples map[string][]srtSample `json:"srt_samples"` // per profile
	Verdict    string                 `json:"verdict"`
	Summary    string                 `json:"summary"`
}

type report struct {
	ID      string         `json:"id"`
	Version string         `json:"version"`
	Started time.Time      `json:"started"`
	Updated time.Time      `json:"updated"`
	Status  string         `json:"status"` // running | done | interrupted
	Mode    string         `json:"mode"`   // check | full
	OS      string         `json:"os"`
	Phases  []*phaseResult `json:"phases"`
	Answers []answer       `json:"answers,omitempty"`
	Notes   []string       `json:"notes,omitempty"`
	mu      sync.Mutex
}

type answer struct {
	Q string `json:"q"`
	A string `json:"a"`
}

func (r *report) addAnswer(q, a string) {
	r.mu.Lock()
	r.Answers = append(r.Answers, answer{q, a})
	r.mu.Unlock()
}

// ---------------------------------------------------------------- UI helpers

const (
	cReset  = "\033[0m"
	cBold   = "\033[1m"
	cGreen  = "\033[32m"
	cYellow = "\033[33m"
	cRed    = "\033[31m"
	cCyan   = "\033[36m"
	cGrey   = "\033[90m"
)

// Console input is read in the background so that a prompt can give up when
// the user presses Ctrl-C (promptAbort is closed).
var (
	lines       = make(chan string)
	promptAbort <-chan struct{}
	stdinClosed bool
)

func init() {
	go func() {
		r := bufio.NewReader(os.Stdin)
		for {
			line, err := r.ReadString('\n')
			if line != "" || err == nil {
				lines <- line
			}
			if err != nil {
				close(lines)
				return
			}
		}
	}()
}

// readLine returns the next line, or "" if the prompt was aborted or stdin closed.
func readLine() string {
	select {
	case l, ok := <-lines:
		if !ok { // stdin closed (only when piped): behave like an empty answer
			stdinClosed = true
			return ""
		}
		return l
	case <-promptAbort:
		fmt.Println()
		return ""
	}
}

func aborted() bool {
	select {
	case <-promptAbort:
		return promptAbort != nil
	default:
		return false
	}
}

func say(format string, a ...any) { fmt.Printf(format+"\n", a...) }

func title(s string) {
	say("")
	say(cBold+cCyan+"=== %s ==="+cReset, s)
}

func ask(prompt string) string {
	return strings.ToUpper(askRaw(prompt))
}

func askRaw(prompt string) string {
	if aborted() {
		return ""
	}
	fmt.Print(cBold + prompt + cReset + " ")
	livePrompt(prompt)
	defer livePrompt("")
	return strings.TrimSpace(readLine())
}

// askYN asks a yes/no question (O/N, or ? for "don't know") and records it.
func askYN(rep *report, q string) string {
	for {
		a := ask(q + " (O = oui, N = non, ? = je ne sais pas)")
		if aborted() {
			return ""
		}
		switch a {
		case "O", "OUI", "Y":
			rep.addAnswer(q, "oui")
			return "oui"
		case "N", "NON":
			rep.addAnswer(q, "non")
			return "non"
		case "?":
			rep.addAnswer(q, "?")
			return "?"
		}
		say("Tapez O, N ou ? puis Entrée.")
	}
}

func verdictLabel(v string) string {
	switch v {
	case "ok":
		return cGreen + "[ OK ]" + cReset
	case "warn":
		return cYellow + "[ ATTENTION ]" + cReset
	case "interrupted":
		return cGrey + "[ INTERROMPU ]" + cReset
	default:
		return cRed + "[ PROBLÈME ]" + cReset
	}
}

// ---------------------------------------------------------------- main

func main() {
	setupConsole()
	cfgPath := flag.String("config", "", "fichier de configuration (par défaut : celui intégré)")
	quick := flag.Bool("quick", false, "étapes courtes (pour tester l'outil)")
	only := flag.String("only", "", "wifi | mobile : ne lancer qu'une étape")
	checkFlag := flag.Bool("check", false, "vérification rapide sans passer par le menu")
	flag.Parse()

	cfg, err := loadConfig(*cfgPath)
	if err != nil {
		fatal("Configuration invalide : %v", err)
	}
	if *quick {
		for _, st := range []*[]stageConf{&cfg.WifiStages, &cfg.MobileStages, &cfg.Mobile720} {
			for i := range *st {
				(*st)[i].Seconds = min((*st)[i].Seconds, 15)
			}
		}
		cfg.SpeedSeconds = 3
	}
	c1080, err := loadClip(clip1080)
	if err != nil {
		fatal("Vidéo de test 1080p invalide : %v", err)
	}
	c720, err := loadClip(clip720)
	if err != nil {
		fatal("Vidéo de test 720p invalide : %v", err)
	}
	cCheck, err := loadClip(clipCheck)
	if err != nil {
		fatal("Vidéo de test légère invalide : %v", err)
	}
	keepAwake()

	rep := &report{ID: time.Now().Format("20060102-150405") + "-" + randHex(3), Version: version,
		Started: time.Now(), Status: "running", OS: osName()}

	liveStep("", "Programme lancé")
	startLive(cfg, rep.ID)
	uploadReportAsync(cfg, rep) // so the test shows up in the list right away

	ctx, cancel := context.WithCancel(context.Background())
	promptAbort = ctx.Done()
	// Ctrl-C: stop cleanly (close connections, save and upload the report).
	// A second Ctrl-C quits at once. Closing the window (SIGTERM on Windows,
	// with a few seconds before the process is killed): upload what we have.
	sig := make(chan os.Signal, 2)
	signal.Notify(sig, os.Interrupt, syscall.SIGTERM)
	go func() {
		first := true
		for s := range sig {
			if s == syscall.SIGTERM {
				rep.mu.Lock()
				rep.Status = "closed"
				rep.mu.Unlock()
				liveStep("", "Fenêtre fermée par l'utilisatrice")
				postLive(cfg, rep.ID)
				uploadReport(cfg, rep)
				os.Exit(1)
			}
			if !first {
				say("\n" + cRed + "Arrêt immédiat." + cReset)
				os.Exit(130)
			}
			first = false
			liveStep("", "Arrêt demandé (Ctrl-C), fermeture des connexions")
			say("\n" + cYellow + "Arrêt demandé, fermeture des connexions… (Ctrl-C encore une fois pour quitter tout de suite)" + cReset)
			cancel()
		}
	}()

	say(cBold+"Test de la connexion pour l'AG"+cReset+cGrey+" (version %s)"+cReset, version)
	say("")
	say("Ce programme vérifie que la connexion internet de la salle permet de diffuser")
	say("l'AG et la traduction. Il fonctionne tout seul : suivez simplement les consignes.")
	say("Ne fermez pas cette fenêtre pendant le test.")
	say("")
	say(cYellow + "Si Windows demande d'autoriser l'accès au réseau, cliquez sur « Autoriser »." + cReset)

	check := *checkFlag
	if !check && *only == "" {
		say("")
		liveStep("menu", "Choix du mode (1 = vérification rapide, 2 = test complet)")
		say(cBold + "Que voulez-vous faire ?" + cReset)
		say("  1 : Vérification rapide, à la maison (1 minute, utilise très peu de connexion)")
		say("  2 : Test complet, dans la salle (environ 30 minutes)")
		for {
			a := ask("Tapez 1 ou 2 puis Entrée :")
			if ctx.Err() != nil || stdinClosed {
				os.Exit(130)
			}
			if a == "1" || a == "2" {
				check = a == "1"
				break
			}
		}
	}
	if check {
		rep.Mode = "check"
		runCheck(ctx, cfg, rep, cCheck)
		if ctx.Err() != nil {
			rep.Status = "interrupted"
		} else {
			rep.Status = "done"
		}
		finish(cfg, rep)
		return
	}
	rep.Mode = "full"

	runWifi := *only == "" || *only == "wifi"
	runMobile := *only == "" || *only == "mobile"
	var wifiIP string

	if runWifi && ctx.Err() == nil {
		title("ÉTAPE 1 sur 2 : Wi-Fi de la salle")
		liveStep("wifi", "Préparation : ordinateur à la régie, sur secteur, connecté au Wi-Fi de la salle")
		say("1. Placez cet ordinateur à l'endroit où sera l'ordinateur de diffusion")
		say("   (là où se trouvera la régie, près de la scène).")
		say("2. Branchez-le sur secteur.")
		say("3. Connectez-le au Wi-Fi de la salle.")
		say("4. Fermez les autres programmes (navigateur, OneDrive, mises à jour…).")
		say("")
		ask("Quand c'est prêt, appuyez sur Entrée.")
		ph := runPhase(ctx, cfg, rep, "wifi", c1080, c720)
		wifiIP = ph.Speed.PublicIP
	}

	if runMobile && ctx.Err() == nil {
		title("ÉTAPE 2 sur 2 : 4G/5G (partage de connexion du téléphone)")
		liveStep("mobile", "Passage de l'ordinateur sur le partage de connexion du téléphone")
		say("1. Sur le téléphone Android, activez le point d'accès mobile :")
		say("   Paramètres > Connexions > Point d'accès mobile et modem > Point d'accès mobile.")
		say("2. Sur cet ordinateur, quittez le Wi-Fi de la salle et connectez-vous")
		say("   au point d'accès du téléphone.")
		say("3. Posez le téléphone à côté de l'ordinateur (branché sur secteur si possible).")
		say("")
		for ctx.Err() == nil {
			a := ask("Appuyez sur Entrée quand c'est fait (ou tapez P puis Entrée pour passer cette étape).")
			if a == "P" {
				rep.addNote("étape 4G/5G passée par l'utilisatrice")
				runMobile = false
				break
			}
			if a != "C" && wifiIP != "" {
				if ip := publicIP(cfg.BaseURL); ip == wifiIP {
					say(cYellow + "L'ordinateur semble toujours connecté au Wi-Fi de la salle." + cReset)
					say("Vérifiez qu'il est bien connecté au point d'accès du téléphone,")
					say("ou tapez C puis Entrée pour continuer quand même.")
					rep.addNote("même IP publique qu'en Wi-Fi au début de l'étape 4G/5G")
					continue
				}
			}
			break
		}
		if runMobile && ctx.Err() == nil {
			runPhase(ctx, cfg, rep, "mobile", c1080, c720)
		}
	}

	if ctx.Err() == nil {
		venueQuestions(cfg, rep)
	}
	if ctx.Err() != nil {
		rep.Status = "interrupted"
	} else {
		rep.Status = "done"
	}
	finish(cfg, rep)
}

func finish(cfg *config, rep *report) {
	promptAbort = nil // the last prompt waits for Enter even after Ctrl-C
	defer func() {
		var parts []string
		for _, ph := range rep.Phases {
			parts = append(parts, ph.Name+" : "+ph.Verdict)
		}
		status := map[string]string{"done": "terminé", "interrupted": "interrompu par Ctrl-C"}[rep.Status]
		liveStep("", "Fin du test ("+status+") : "+strings.Join(parts, ", "))
		postLive(cfg, rep.ID)
	}()
	title("RÉSULTAT")
	for _, ph := range rep.Phases {
		name := "Wi-Fi de la salle"
		switch ph.Name {
		case "mobile":
			name = "4G/5G"
		case "check":
			name = "Vérification rapide"
		}
		say("%s %s : %s", verdictLabel(ph.Verdict), name, ph.Summary)
	}
	if len(rep.Phases) == 0 {
		say("Aucune étape n'a été réalisée.")
	}
	say("")
	files := saveReport(rep)
	if err := uploadReport(cfg, rep); err != nil {
		say(cYellow+"Les résultats n'ont pas pu être envoyés automatiquement (%v)."+cReset, err)
		say("Merci d'envoyer ce fichier par e-mail ou WhatsApp :")
	} else {
		say(cGreen + "Les résultats ont été envoyés automatiquement. Merci !" + cReset)
		say(cGrey + "Une copie est aussi enregistrée ici :" + cReset)
	}
	for _, f := range files {
		say("  %s", f)
	}
	say("")
	ask("Appuyez sur Entrée pour fermer cette fenêtre.")
}

func fatal(format string, a ...any) {
	say(cRed+format+cReset, a...)
	ask("Appuyez sur Entrée pour fermer cette fenêtre.")
	os.Exit(1)
}

func loadConfig(path string) (*config, error) {
	raw := embeddedConfig
	if path == "" {
		// A config.json next to the executable overrides the embedded one.
		if exe, err := os.Executable(); err == nil {
			p := filepath.Join(filepath.Dir(exe), "config.json")
			if _, err := os.Stat(p); err == nil {
				path = p
			}
		}
	}
	if path != "" {
		b, err := os.ReadFile(path)
		if err != nil {
			return nil, err
		}
		raw = b
	}
	cfg := &config{SRTLatencyMs: 200, ConnectRate: 20, SpeedSeconds: 8}
	if err := json.Unmarshal(raw, cfg); err != nil {
		return nil, err
	}
	if cfg.SRTAddr == "" || cfg.WHEPURL == "" || cfg.BaseURL == "" {
		return nil, fmt.Errorf("srt_addr, whep_url et base_url sont obligatoires")
	}
	return cfg, nil
}

// ---------------------------------------------------------------- phases

// runCheck verifies that the tool works on this computer and network (SmartScreen,
// firewall, outgoing SRT and WebRTC UDP, results upload) with a tiny stream
// (~0.3 Mb/s, about 2 MB in total) and one listener, without load.
func runCheck(ctx context.Context, cfg *config, rep *report, clip *tsClip) {
	title("Vérification rapide")
	liveStep("check", "Connexion au serveur")
	ph := &phaseResult{Name: "check", Started: time.Now(), SRTSamples: map[string][]srtSample{}}
	rep.mu.Lock()
	rep.Phases = append(rep.Phases, ph)
	rep.mu.Unlock()
	ph.WifiInfo = wifiInfo()
	if u, err := url.Parse(cfg.BaseURL); err == nil {
		if ip := localIPTowards(u.Hostname()); ip != nil {
			ph.LocalIP = ip.String()
		}
	}
	say("Connexion au serveur…")
	ph.Speed = speedTest(ctx, cfg.BaseURL, 0, 0)
	if ctx.Err() != nil {
		ph.Verdict, ph.Summary = "interrupted", "vérification interrompue"
		return
	}
	if ph.Speed.Error != "" {
		ph.Error = ph.Speed.Error
		ph.Verdict, ph.Summary = "fail", "impossible de joindre le serveur ("+ph.Speed.Error+")"
		say(cRed+"Impossible de joindre le serveur : %s"+cReset, ph.Speed.Error)
		say("Vérifiez que l'ordinateur est bien connecté à internet (ouvrez un site web).")
		return
	}
	say("  Serveur joint, temps de réponse %.0f ms", ph.Speed.PingMs)
	runProfile(ctx, cfg, rep, ph, "léger", clip, []stageConf{{Listeners: 1, Seconds: 20}}, nil)
	ph.Verdict, ph.Summary = "fail", "la vérification a échoué"
	if ctx.Err() != nil {
		ph.Verdict, ph.Summary = "interrupted", "vérification interrompue"
		return
	}
	if len(ph.Stages) > 0 {
		s := ph.Stages[len(ph.Stages)-1]
		if s.SRT.Seconds > 0 && s.SRT.ConnectedPct > 0 && s.Listeners.Open >= 1 && s.Listeners.Silent == 0 {
			ph.Verdict, ph.Summary = "ok", "l'envoi de la vidéo et l'écoute de la traduction fonctionnent sur cet ordinateur"
		}
	}
	say("")
	say("%s %s", verdictLabel(ph.Verdict), ph.Summary)
	if ph.Verdict == "ok" {
		say(cGreen + "Tout est prêt pour le test complet dans la salle." + cReset)
	} else {
		say(cYellow + "Prévenez Valentin : il verra les détails de son côté." + cReset)
	}
}

func runPhase(ctx context.Context, cfg *config, rep *report, name string, c1080, c720 *tsClip) *phaseResult {
	if ctx.Err() != nil {
		return &phaseResult{Name: name}
	}
	ph := &phaseResult{Name: name, Started: time.Now(), SRTSamples: map[string][]srtSample{}}
	rep.mu.Lock()
	rep.Phases = append(rep.Phases, ph)
	rep.mu.Unlock()
	defer func() { go uploadReport(cfg, rep) }()

	ph.WifiInfo = wifiInfo()
	if u, err := url.Parse(cfg.BaseURL); err == nil {
		if ip := localIPTowards(u.Hostname()); ip != nil {
			ph.LocalIP = ip.String()
		}
	}
	if ssid := wifiField(ph.WifiInfo, "SSID"); ssid != "" {
		say("Réseau : %s   Signal : %s", ssid, orDash(wifiField(ph.WifiInfo, "Signal")))
	}

	// 1. Raw throughput.
	say("")
	say(cBold + "Mesure du débit…" + cReset)
	liveStep(name, fmt.Sprintf("Mesure du débit (%d s)", 2*cfg.SpeedSeconds))
	liveFields("Réseau", orDash(wifiField(ph.WifiInfo, "SSID")), "Signal Wi-Fi", orDash(wifiField(ph.WifiInfo, "Signal")), "IP locale", ph.LocalIP)
	ph.Speed = speedTest(ctx, cfg.BaseURL, time.Duration(cfg.SpeedSeconds)*time.Second, 4)
	if ctx.Err() != nil {
		ph.Verdict, ph.Summary = "interrupted", "test interrompu"
		return ph
	}
	if ph.Speed.Error != "" {
		ph.Error = ph.Speed.Error
		ph.Verdict = "fail"
		ph.Summary = "impossible de joindre le serveur (" + ph.Speed.Error + ")"
		say(cRed+"Impossible de joindre le serveur : %s"+cReset, ph.Speed.Error)
		say("Vérifiez que l'ordinateur est bien connecté à internet (ouvrez un site web).")
		return ph
	}
	say("  Envoi : %.1f Mb/s   Réception : %.1f Mb/s   Temps de réponse : %.0f ms",
		ph.Speed.UpMbps, ph.Speed.DownMbps, ph.Speed.PingMs)
	uploadReportAsync(cfg, rep)

	stages := cfg.WifiStages
	if name == "mobile" {
		stages = cfg.MobileStages
	}
	var during func()
	if name == "wifi" && cfg.PhonePage != "" {
		during = func() { phoneCheck(ctx, cfg, rep) }
	}
	ok := runProfile(ctx, cfg, rep, ph, "1080p", c1080, stages, during)
	if name == "mobile" && !ok && ctx.Err() == nil && len(cfg.Mobile720) > 0 {
		say("")
		say(cYellow + "Nouvel essai avec une qualité vidéo réduite (720p)…" + cReset)
		runProfile(ctx, cfg, rep, ph, "720p", c720, cfg.Mobile720, nil)
	}
	ph.Verdict, ph.Summary = phaseVerdict(ph)
	say("")
	say("%s %s", verdictLabel(ph.Verdict), ph.Summary)
	return ph
}

// runProfile streams one clip and runs the listener stages. It returns true if
// every stage passed.
// during, if set, runs after the stages while the stream is still on.
func runProfile(ctx context.Context, cfg *config, rep *report, ph *phaseResult, profile string, clip *tsClip, stages []stageConf, during func()) bool {
	say("")
	say(cBold+"Démarrage de la diffusion de test (%s, %.1f Mb/s)…"+cReset, profile, clip.bitrate/1e6)
	liveStep("", fmt.Sprintf("Démarrage de la diffusion de test (%s, %.1f Mb/s)", profile, clip.bitrate/1e6))
	beeps := &beepLog{}
	pub := newSRTPublisher(cfg.SRTAddr, cfg.SRTStreamID, time.Duration(cfg.SRTLatencyMs)*time.Millisecond, clip, beeps)
	if err := pub.start(); err != nil {
		ph.Error = "SRT: " + err.Error()
		ph.Stages = append(ph.Stages, stageResult{Profile: profile, Verdict: "fail",
			Problems: []string{"connexion SRT impossible : " + err.Error()}})
		say(cRed+"Impossible d'envoyer la vidéo au serveur : %v"+cReset, err)
		return false
	}
	defer func() {
		pub.close()
		ph.SRTSamples[profile] = pub.window(0, 1e9)
	}()

	w, err := newWHEPClient(cfg.WHEPURL, cfg.Cookie, beeps)
	if err != nil {
		ph.Error = "WebRTC: " + err.Error()
		return false
	}
	p := &pool{w: w}
	defer p.closeAll()

	// Wait for the relay to publish the interpretation feed.
	say("Attente du flux de traduction…")
	liveStep("", "Attente du flux de traduction sur le relais")
	deadline := time.Now().Add(60 * time.Second)
	for p.open() == 0 && time.Now().Before(deadline) && ctx.Err() == nil {
		p.grow(ctx, 1, 1)
		if p.open() == 0 {
			time.Sleep(2 * time.Second)
		}
	}
	if p.open() == 0 {
		msg := "aucun auditeur n'a pu se connecter au flux de traduction"
		if len(p.connErrs) > 0 {
			msg += " (" + p.connErrs[len(p.connErrs)-1] + ")"
		}
		ph.ConnErrors = append(ph.ConnErrors, p.connErrs...)
		ph.Stages = append(ph.Stages, stageResult{Profile: profile, Verdict: "fail", Problems: []string{msg}})
		say(cRed+"%s"+cReset, msg)
		return false
	}
	p.mu.Lock()
	ph.ConnErrors = append(ph.ConnErrors, p.connErrs...)
	p.connErrs, p.failures = nil, 0
	p.mu.Unlock()

	allOK := true
	for i, st := range stages {
		if ctx.Err() != nil {
			break
		}
		say("")
		say(cBold+"Palier %d/%d : diffusion + %d auditeurs simulés (%d s)"+cReset, i+1, len(stages), st.Listeners, st.Seconds)
		liveStep("", fmt.Sprintf("Palier %d/%d (%s) : connexion de %d auditeurs", i+1, len(stages), profile, st.Listeners))
		growDone := make(chan struct{})
		go func() { // live progress of the ramp-up
			fb, db := p.counters()
			for {
				f, d := p.counters()
				ss := summarizeSRT(pub.window(pub.elapsed()-5, 1e9))
				liveFields("Auditeurs connectés", fmt.Sprintf("%d / %d", p.open(), st.Listeners),
					"En cours de connexion", fmt.Sprint(p.pending.Load()),
					"Échecs de connexion", fmt.Sprint(f-fb), "Déconnexions", fmt.Sprint(d-db),
					"Envoi vidéo", fmt.Sprintf("%.1f Mb/s", ss.AvgMbps))
				select {
				case <-growDone:
					return
				case <-time.After(time.Second):
				}
			}
		}()
		p.grow(ctx, st.Listeners, cfg.ConnectRate)
		close(growDone)
		liveStep("", fmt.Sprintf("Palier %d/%d (%s) : mesure avec %d auditeurs pendant %d s", i+1, len(stages), profile, st.Listeners, st.Seconds))
		f0, d0 := p.counters()
		snap := p.snap()
		t0 := pub.elapsed()
		start := time.Now()
		end := start.Add(time.Duration(st.Seconds) * time.Second)
		lastPrint := time.Time{}
		for time.Now().Before(end) && ctx.Err() == nil {
			time.Sleep(time.Second)
			p.reap()
			if p.open()+int(p.pending.Load()) < st.Listeners {
				go p.grow(ctx, st.Listeners, cfg.ConnectRate)
			}
			f, d := p.counters()
			ls := p.stats(snap, time.Since(start).Seconds(), st.Listeners, f-f0, d-d0)
			ss := summarizeSRT(pub.window(pub.elapsed()-5, 1e9))
			left := int(time.Until(end).Seconds())
			lat, lat95 := "-", "-"
			if ls.LatencyN > 0 {
				lat = fmt.Sprintf("%.0f ms", ls.LatencyP50ms)
				lat95 = fmt.Sprintf("%.0f ms", ls.LatencyP95ms)
			}
			srtState := "connectée"
			if ss.ConnectedPct < 100 {
				srtState = "COUPÉE"
			}
			liveFields("Temps restant", fmt.Sprintf("%d s", max(left, 0)),
				"Diffusion (SRT)", srtState,
				"Envoi vidéo (5 dernières s)", fmt.Sprintf("%.2f Mb/s", ss.AvgMbps),
				"Aller-retour (RTT)", fmt.Sprintf("%.0f ms", ss.AvgRTTms),
				"Paquets vidéo renvoyés", fmt.Sprintf("%.1f %%", ss.RetransPct),
				"Paquets vidéo perdus (palier)", fmt.Sprint(summarizeSRT(pub.window(t0, 1e9)).Dropped),
				"Reconnexions SRT (palier)", fmt.Sprint(summarizeSRT(pub.window(t0, 1e9)).Reconnects),
				"Auditeurs connectés", fmt.Sprintf("%d / %d", ls.Open, st.Listeners),
				"En cours de connexion", fmt.Sprint(p.pending.Load()),
				"Échecs / déconnexions", fmt.Sprintf("%d / %d", ls.ConnFailures, ls.Dropped),
				"Auditeurs sans son", fmt.Sprint(ls.Silent),
				"Pertes audio (palier)", fmt.Sprintf("%.2f %% (pire %.1f %%)", ls.LossPct, ls.WorstLossPct),
				"Délai traduction médian / p95", lat+" / "+lat95,
				"Réception audio totale", fmt.Sprintf("%.1f Mb/s", ls.DownMbps))
			if time.Since(lastPrint) >= 5*time.Second {
				lastPrint = time.Now()
				conn := "connecté"
				if ss.ConnectedPct < 100 {
					conn = cRed + "coupé" + cReset
				}
				say(cGrey+"  encore %3d s"+cReset+" | envoi %s %.1f Mb/s, perdus %d | auditeurs %d/%d, pertes %.1f %%, délai %s",
					left, conn, ss.AvgMbps, ss.Dropped, ls.Open, st.Listeners, ls.LossPct, lat)
			}
		}
		f, d := p.counters()
		sr := stageResult{Profile: profile,
			Listeners: p.stats(snap, time.Since(start).Seconds(), st.Listeners, f-f0, d-d0),
			SRT:       summarizeSRT(pub.window(t0, 1e9))}
		sr.Verdict, sr.Problems, sr.LoadFail = stageVerdict(sr)
		if ctx.Err() != nil { // cut short by Ctrl-C: not judged
			sr.Verdict, sr.Problems, sr.LoadFail = "interrupted", nil, false
		}
		p.mu.Lock()
		ph.ConnErrors = append(ph.ConnErrors, p.connErrs...)
		p.connErrs = nil
		p.mu.Unlock()
		rep.mu.Lock()
		ph.Stages = append(ph.Stages, sr)
		ph.SRTSamples[profile] = pub.window(0, 1e9)
		rep.mu.Unlock()
		say("%s %d auditeurs connectés sur %d, pertes audio %.1f %%, délai %s, envoi vidéo %.1f Mb/s",
			verdictLabel(sr.Verdict), sr.Listeners.Open, st.Listeners, sr.Listeners.LossPct,
			latText(sr.Listeners), sr.SRT.AvgMbps)
		for _, pr := range sr.Problems {
			say("    - %s", pr)
		}
		uploadReportAsync(cfg, rep)
		if sr.Verdict != "ok" {
			allOK = false
		}
		if sr.LoadFail {
			if i < len(stages)-1 {
				say(cYellow + "Paliers suivants annulés (inutile d'aller plus loin)." + cReset)
			}
			break
		}
	}
	say("Fermeture des auditeurs simulés…")
	p.closeAll()
	if during != nil && ctx.Err() == nil {
		during()
	}
	return allOK
}

// phoneCheck guides a real listening test on the Android phone while the test
// stream (noise with a silence every 2 s on the interpreter track) is still running.
func phoneCheck(ctx context.Context, cfg *config, rep *report) {
	title("Test du téléphone (environ 3 minutes)")
	liveStep("", "Test du téléphone (la diffusion de test continue)")
	say("La diffusion de test continue. Le son de la traduction est remplacé par un")
	say("souffle (comme un bruit de pluie) qui se coupe brièvement toutes les 2 secondes.")
	say("Nous allons vérifier qu'on l'entend sur le téléphone.")
	say("")
	say("1. Connectez le téléphone au Wi-Fi de la salle.")
	say("2. Ouvrez Chrome sur le téléphone et tapez cette adresse :")
	say("      " + cBold + cfg.PhonePage + cReset)
	say("3. Appuyez sur le bouton « Play ». Montez le volume.")
	say("")
	if askYN(rep, "Wi-Fi : entendez-vous le souffle, coupé toutes les 2 secondes ?") == "oui" {
		say("Verrouillez l'écran du téléphone (bouton marche/arrêt) et attendez 30 secondes.")
		askYN(rep, "Wi-Fi : écran verrouillé, le souffle continue-t-il ?")
		say("Déverrouillez le téléphone.")
	}
	if ctx.Err() != nil {
		return
	}
	say("")
	say("Maintenant, " + cBold + "désactivez le Wi-Fi du téléphone" + cReset + " (il passe en 4G/5G).")
	say("Rechargez la page dans Chrome (flèche ronde) puis appuyez à nouveau sur « Play ».")
	say("")
	rep.addAnswer("Réseau mobile affiché en haut de l'écran (5G, 4G, 4G+, H…)", askRaw("Quel réseau est affiché en haut de l'écran du téléphone (5G, 4G, 4G+, H…) ?"))
	rep.addAnswer("Opérateur du téléphone", askRaw("Quel est l'opérateur du téléphone (Orange, SFR, Bouygues, Free…) ?"))
	if askYN(rep, "4G/5G : entendez-vous le souffle, coupé toutes les 2 secondes ?") == "oui" {
		say("Verrouillez l'écran du téléphone et attendez 30 secondes.")
		askYN(rep, "4G/5G : écran verrouillé, le souffle continue-t-il ?")
	}
	say("Vous pouvez fermer la page sur le téléphone et réactiver son Wi-Fi.")
	uploadReportAsync(cfg, rep)
}

// venueQuestions records a few facts only someone on site can check.
func venueQuestions(cfg *config, rep *report) {
	title("Quelques questions sur la salle")
	liveStep("questions", "Questions sur la salle")
	askYN(rep, "Y a-t-il une prise réseau (câble Ethernet) utilisable près de la régie ?")
	askYN(rep, "Y a-t-il une prise électrique près de la régie ?")
	askYN(rep, "Faut-il accepter une page de connexion (conditions, e-mail…) pour avoir internet sur le Wi-Fi ?")
	say("")
	say("Si vous avez pu poser la question au responsable de la salle :")
	rep.addAnswer("Nombre maximum d'appareils sur le Wi-Fi (réponse de la salle)",
		askRaw("Combien d'appareils (téléphones) le Wi-Fi peut-il accepter en même temps ? (Entrée si inconnu)"))
	rep.addAnswer("Remarques", askRaw("Une remarque (bruit, emplacement, problème…) ? (Entrée pour terminer)"))
	uploadReportAsync(cfg, rep)
}

func latText(l listenerStats) string {
	if l.LatencyN == 0 {
		return "non mesuré"
	}
	return fmt.Sprintf("%.0f ms", l.LatencyP50ms)
}

// stageVerdict applies the pass criteria of one stage. loadFail is set when
// the failure comes from the load (not from a one-off network cut), so that
// higher stages can be skipped.
func stageVerdict(s stageResult) (v string, probs []string, loadFail bool) {
	v = "ok"
	cut := false
	worse := func(n string) {
		if n == "fail" && !cut {
			loadFail = true
		}
		if n == "fail" || v == "ok" {
			v = n
		}
	}
	l, r := s.Listeners, s.SRT
	if r.ConnectedPct < 100 || r.Reconnects > 0 {
		probs = append(probs, fmt.Sprintf("la diffusion vidéo a été coupée (%d reconnexions)", r.Reconnects))
		// After a cut, the relay restarts the feed and every listener
		// reconnects: listener problems are a consequence, not a load issue.
		cut = true
		worse("fail")
	}
	switch {
	case r.DroppedPct >= 0.5:
		probs = append(probs, fmt.Sprintf("vidéo : %.2f %% des paquets perdus définitivement", r.DroppedPct))
		worse("fail")
	case r.Dropped > 0 || r.QueueFull > 0:
		probs = append(probs, fmt.Sprintf("vidéo : %d paquets perdus définitivement, %d envois en attente", r.Dropped, r.QueueFull))
		worse("warn")
	}
	if r.RetransPct >= 10 {
		probs = append(probs, fmt.Sprintf("vidéo : %.1f %% de paquets renvoyés (connexion instable)", r.RetransPct))
		worse("warn")
	}
	if missing := l.Target - l.Open; missing > 0 {
		probs = append(probs, fmt.Sprintf("%d auditeurs sur %d n'ont pas pu rester connectés", missing, l.Target))
		if float64(missing) > 0.05*float64(l.Target) {
			worse("fail")
		} else {
			worse("warn")
		}
	}
	if l.Dropped > 0 {
		probs = append(probs, fmt.Sprintf("%d auditeurs ont été déconnectés puis reconnectés", l.Dropped))
		worse("warn")
	}
	if l.Silent > 0 {
		probs = append(probs, fmt.Sprintf("%d auditeurs connectés n'ont reçu aucun son", l.Silent))
		worse("fail")
	}
	switch {
	case l.LossPct >= 3:
		probs = append(probs, fmt.Sprintf("son de la traduction : %.1f %% de pertes", l.LossPct))
		worse("fail")
	case l.LossPct >= 1 || l.WorstLossPct >= 5:
		probs = append(probs, fmt.Sprintf("son de la traduction : %.1f %% de pertes (pire auditeur %.1f %%)", l.LossPct, l.WorstLossPct))
		worse("warn")
	}
	switch {
	case l.LatencyN == 0:
		probs = append(probs, "délai de la traduction non mesuré")
		worse("warn")
	case l.LatencyP95ms >= 1500:
		probs = append(probs, fmt.Sprintf("délai de la traduction trop long (%.0f ms pour 95 %% des mesures)", l.LatencyP95ms))
		worse("fail")
	case l.LatencyP95ms >= 1000:
		probs = append(probs, fmt.Sprintf("délai de la traduction élevé (%.0f ms pour 95 %% des mesures)", l.LatencyP95ms))
		worse("warn")
	}
	return v, probs, loadFail
}

func phaseVerdict(ph *phaseResult) (string, string) {
	interrupted := false
	var judged []stageResult
	for _, s := range ph.Stages {
		if s.Verdict == "interrupted" {
			interrupted = true
		} else {
			judged = append(judged, s)
		}
	}
	if interrupted && len(judged) == 0 {
		return "interrupted", "test interrompu"
	}
	saved := ph.Stages
	ph.Stages = judged
	defer func() { ph.Stages = saved }()
	v, sum := phaseVerdictJudged(ph)
	if interrupted {
		sum += " (test interrompu)"
	}
	return v, sum
}

func phaseVerdictJudged(ph *phaseResult) (string, string) {
	if len(ph.Stages) == 0 {
		if ph.Error != "" {
			return "fail", ph.Error
		}
		return "fail", "test interrompu"
	}
	best := map[string]int{} // profile -> most listeners in an ok stage
	warnBest := map[string]int{}
	for _, s := range ph.Stages {
		if s.Verdict == "ok" && s.Listeners.Target > best[s.Profile] {
			best[s.Profile] = s.Listeners.Target
		}
		if s.Verdict != "fail" && s.Listeners.Target > warnBest[s.Profile] {
			warnBest[s.Profile] = s.Listeners.Target
		}
	}
	cuts := 0
	for _, s := range ph.Stages {
		cuts += s.SRT.Reconnects
	}
	v, sum := phaseVerdictLoad(ph, best, warnBest)
	if cuts > 0 {
		sum += fmt.Sprintf(" ; la diffusion a été coupée %d fois pendant le test", cuts)
		if v == "ok" {
			v = "warn"
		}
	}
	return v, sum
}

func phaseVerdictLoad(ph *phaseResult, best, warnBest map[string]int) (string, string) {
	last := ph.Stages[len(ph.Stages)-1]
	switch {
	case ph.Name == "mobile" && best["1080p"] > 0 && last.Profile == "1080p" && last.Verdict == "ok":
		return "ok", "la diffusion 1080p passe en 4G/5G"
	case ph.Name == "mobile" && best["720p"] > 0:
		return "warn", "la 1080p ne passe pas bien en 4G/5G, la 720p passe"
	case ph.Name == "mobile":
		return "fail", "la diffusion ne passe pas correctement en 4G/5G"
	case last.Verdict == "ok":
		return "ok", fmt.Sprintf("diffusion + %d auditeurs sans problème", best["1080p"])
	case best["1080p"] > 0:
		return "warn", fmt.Sprintf("diffusion + %d auditeurs sans problème, problèmes au-delà", best["1080p"])
	case warnBest["1080p"] > 0:
		return "warn", fmt.Sprintf("diffusion + %d auditeurs avec quelques défauts", warnBest["1080p"])
	default:
		return "fail", "la diffusion ne passe pas correctement"
	}
}

// ---------------------------------------------------------------- helpers

func wifiField(info, key string) string {
	for _, line := range strings.Split(info, "\n") {
		k, v, ok := strings.Cut(line, ":")
		if ok && strings.TrimSpace(k) == key {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func orDash(s string) string {
	if s == "" {
		return "-"
	}
	return s
}

func publicIP(base string) string {
	res, err := netClient().Get(base + "/speed/ip")
	if err != nil {
		return ""
	}
	defer res.Body.Close()
	var b [64]byte
	n, _ := res.Body.Read(b[:])
	return strings.TrimSpace(string(b[:n]))
}
