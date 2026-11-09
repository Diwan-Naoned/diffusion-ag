"""Stub of the web app for local relay tests (stands in for remote-participation-app).

- GET /auth/media     ForwardAuth target: 200 with cookie ag_access=ok, else 401
- GET /login, /logout set / clear that cookie
- GET /               listening page using MediaMTX's reader.js on /media/trad/whep
- GET /reader.js      MediaMTX reader (copied from MediaMTX v1.21.3, MIT)
- /speed/ip, /speed/down?bytes=N, POST /speed/up   throughput test (venue-test tool)
- POST /results/<id>  store a venue-test report (header X-Results-Token)
- POST /results/<id>/live  live progress of a running test (same token)
- POST /telecharger/<test-connexion-AG.exe|CONSIGNES.txt>   upload the venue-test
                      program / instructions (token + X-Download-Key header)
- GET /telecharger?cle=<key>  download page (French) with two buttons:
  /telecharger/consignes?cle=<key> (instructions page) and
  /telecharger/test-connexion-AG.exe?cle=<key>; 404 without the key
- GET /results?token=..., /results/<id>?token=...   view the reports (auto-refresh)
- anything else       404 (like the real app for unknown /media/* paths)
"""

import hmac
import html
import http.server
import json
import os
import pathlib
import re
import time
import urllib.parse

HERE = pathlib.Path(__file__).parent
COOKIE = "ag_access=ok"
RESULTS_TOKEN = os.environ.get("RESULTS_TOKEN", "")
RESULTS_DIR = pathlib.Path(os.environ.get("RESULTS_DIR", "/data/results"))
DOWNLOAD_DIR = pathlib.Path(os.environ.get("DOWNLOAD_DIR", str(RESULTS_DIR.parent / "download")))
EXE_NAME = "test-connexion-AG.exe"
GUIDE_NAME = "CONSIGNES.txt"
UPLOADS = {EXE_NAME, GUIDE_NAME}
REPORT_ID = re.compile(r"^[0-9A-Za-z-]{1,64}$")
KEY_RE = re.compile(r"^[0-9A-Za-z]{16,64}$")

PAGE_STYLE = """<meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<style>body{font:17px/1.5 system-ui,sans-serif;max-width:680px;margin:24px auto;padding:0 16px;color:#222}
a.btn{display:block;text-align:center;color:#fff;padding:16px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:19px;margin:12px 0}
a.prog{background:#1b5e20} a.guide{background:#0d47a1}
li{margin:6px 0} .small{color:#666;font-size:14px}
pre{white-space:pre-wrap;font:16px/1.5 system-ui,sans-serif}
@media print{.noprint{display:none}}</style>"""

DOWNLOAD_PAGE = """<!doctype html><html lang=fr>{style}<title>Test de connexion AG</title>
<h1>Test de la connexion pour l'AG</h1>
<a class="btn guide" href="/telecharger/consignes?cle={key}">1. Lire les consignes</a>
<a class="btn prog" href="/telecharger/{exe}?cle={key}">2. Télécharger le programme</a>
<p class=small>Programme pour ordinateur Windows ({size} Mo), version du {date}.</p>
<h2>Après le téléchargement</h2>
<ol>
<li>Si le navigateur indique que le fichier « n'est pas couramment téléchargé » ou est « dangereux » :
choisissez de le <b>conserver</b> (dans Edge : « … » puis <b>Conserver</b>, puis <b>Conserver quand même</b>).
Le programme a été fait spécialement pour ce test.</li>
<li>Ouvrez le dossier <b>Téléchargements</b> et double-cliquez sur <b>test-connexion-AG</b>.</li>
<li>Si un écran bleu « Windows a protégé votre ordinateur » apparaît : cliquez sur
<b>Informations complémentaires</b>, puis <b>Exécuter quand même</b>.</li>
<li>Tapez <b>1</b> puis Entrée pour la <b>vérification rapide</b> à la maison (environ 1 minute, très peu de connexion).
Dans la salle, tapez <b>2</b> pour le test complet.</li>
</ol>
</html>"""

GUIDE_PAGE = """<!doctype html><html lang=fr>{style}<title>Consignes : test de connexion AG</title>
<p class=noprint><a href="/telecharger?cle={key}">← Retour au téléchargement</a> · Vous pouvez imprimer cette page.</p>
<pre>{text}</pre>
<p class=noprint><a class="btn prog" href="/telecharger/{exe}?cle={key}">Télécharger le programme</a></p>
</html>"""
CHUNK = os.urandom(64 * 1024)

PAGE = b"""<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Relay test player</title>
<h1>Interpretation feed (test)</h1>
<p><a href="/login">set access cookie</a> | <a href="/logout">clear access cookie</a></p>
<button id="play">Play</button> <button id="stop">Stop</button>
<pre id="log"></pre>
<audio id="audio" autoplay></audio>
<script src="/reader.js"></script>
<script>
const log = (m) => { document.getElementById('log').textContent += new Date().toISOString().slice(11, 23) + ' ' + m + '\\n'; console.log('[player] ' + m); };
let reader = null;
window.playerState = { tracks: 0, errors: [] };
document.getElementById('play').onclick = () => {
  if (reader) return;
  log('connecting');
  reader = new MediaMTXWebRTCReader({
    url: new URL('/media/trad/whep', location.href).toString(),
    onError: (err) => { log('error: ' + err); window.playerState.errors.push(err); },
    onTrack: (evt) => {
      log('track: ' + evt.track.kind);
      window.playerState.tracks++;
      document.getElementById('audio').srcObject = evt.streams[0];
    },
  });
};
document.getElementById('stop').onclick = () => { if (reader) { reader.close(); reader = null; log('stopped'); } };
</script>
"""


class Handler(http.server.BaseHTTPRequestHandler):
    def _send(self, code, body=b"", ctype="text/plain", headers=()):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        for k, v in headers:
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _query(self):
        return urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)

    def _token_ok(self, given):
        return bool(RESULTS_TOKEN) and bool(given) and hmac.compare_digest(given, RESULTS_TOKEN)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/speed/ip":
            ip = self.headers.get("X-Real-Ip") or (self.headers.get("X-Forwarded-For") or "").split(",")[0].strip() or self.client_address[0]
            return self._send(200, ip.encode(), headers=[("Cache-Control", "no-store")])
        if path == "/speed/down":
            n = min(int((self._query().get("bytes") or ["10000000"])[0]), 2_000_000_000)
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(n))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            try:
                while n > 0:
                    k = min(n, len(CHUNK))
                    self.wfile.write(CHUNK[:k])
                    n -= k
            except (BrokenPipeError, ConnectionResetError):
                pass
            return
        if path in ("/telecharger", "/telecharger/consignes", "/telecharger/" + EXE_NAME):
            return self._download(path)
        if path == "/results" or path.startswith("/results/"):
            if not self._token_ok((self._query().get("token") or [""])[0]):
                return self._send(403, b"forbidden")
            return self._results_page(path[len("/results/"):] if path.startswith("/results/") else "")
        if path == "/auth/media":
            ok = COOKIE in (self.headers.get("Cookie") or "")
            self.log_message("auth %s %s -> %s", self.headers.get("X-Forwarded-Method"),
                             self.headers.get("X-Forwarded-Uri"), 200 if ok else 401)
            return self._send(200 if ok else 401, b"ok" if ok else b"unauthorized")
        if path == "/login":
            return self._send(302, headers=[("Set-Cookie", COOKIE + "; Path=/; HttpOnly; SameSite=Lax"), ("Location", "/")])
        if path == "/logout":
            return self._send(302, headers=[("Set-Cookie", "ag_access=; Path=/; Max-Age=0"), ("Location", "/")])
        if path == "/":
            return self._send(200, PAGE, "text/html; charset=utf-8")
        if path == "/reader.js":
            return self._send(200, (HERE / "reader.js").read_bytes(), "text/javascript")
        return self._send(404, b"not found (app)")

    do_HEAD = do_GET

    def do_POST(self):
        path = self.path.split("?")[0]
        if path == "/speed/up":
            n = 0
            length = self.headers.get("Content-Length")
            try:
                if length is not None:
                    left = int(length)
                    while left > 0:
                        b = self.rfile.read(min(left, 1 << 16))
                        if not b:
                            break
                        n += len(b)
                        left -= len(b)
                elif "chunked" in (self.headers.get("Transfer-Encoding") or "").lower():
                    while True:
                        size = int(self.rfile.readline().split(b";")[0].strip() or b"0", 16)
                        if size == 0:
                            self.rfile.readline()
                            break
                        left = size
                        while left > 0:
                            b = self.rfile.read(min(left, 1 << 16))
                            if not b:
                                raise ConnectionResetError
                            n += len(b)
                            left -= len(b)
                        self.rfile.readline()
            except (ConnectionResetError, ValueError):
                self.close_connection = True
                return
            return self._send(200, str(n).encode())
        if path.startswith("/telecharger/") and path[len("/telecharger/"):] in UPLOADS:
            name = path[len("/telecharger/"):]
            if not self._token_ok(self.headers.get("X-Results-Token")):
                return self._send(403, b"forbidden")
            key = self.headers.get("X-Download-Key") or ""
            if not KEY_RE.match(key):
                return self._send(400, b"bad key")
            left = int(self.headers.get("Content-Length") or 0)
            if not 0 < left <= 200_000_000:
                return self._send(400, b"bad size")
            DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
            tmp = DOWNLOAD_DIR / (name + ".part")
            with open(tmp, "wb") as out:
                while left > 0:
                    b = self.rfile.read(min(left, 1 << 16))
                    if not b:
                        return self._send(400, b"truncated")
                    out.write(b)
                    left -= len(b)
            tmp.replace(DOWNLOAD_DIR / name)
            (DOWNLOAD_DIR / "key").write_text(key)
            (DOWNLOAD_DIR / "test-connexion-AG.zip").unlink(missing_ok=True)  # former format
            self.log_message("download %s updated (%d bytes)", name, (DOWNLOAD_DIR / name).stat().st_size)
            return self._send(200, b"ok")
        if path.startswith("/results/") and path.endswith("/live"):
            rid = path[len("/results/"):-len("/live")]
            if not self._token_ok(self.headers.get("X-Results-Token")):
                return self._send(403, b"forbidden")
            if not REPORT_ID.match(rid):
                return self._send(400, b"bad id")
            body = self.rfile.read(min(int(self.headers.get("Content-Length") or 0), 100_000))
            try:
                json.loads(body)
            except ValueError:
                return self._send(400, b"bad json")
            RESULTS_DIR.mkdir(parents=True, exist_ok=True)
            (RESULTS_DIR / f"{rid}.live").write_bytes(body)
            return self._send(200, b"ok")
        if path.startswith("/results/"):
            rid = path[len("/results/"):]
            if not self._token_ok(self.headers.get("X-Results-Token")):
                return self._send(403, b"forbidden")
            if not REPORT_ID.match(rid):
                return self._send(400, b"bad id")
            body = self.rfile.read(min(int(self.headers.get("Content-Length") or 0), 20_000_000))
            try:
                rep = json.loads(body)
            except ValueError:
                return self._send(400, b"bad json")
            RESULTS_DIR.mkdir(parents=True, exist_ok=True)
            (RESULTS_DIR / f"{rid}.json").write_bytes(body)
            self.log_message("results %s status=%s phases=%s", rid, rep.get("status"),
                             [(p.get("name"), p.get("verdict")) for p in rep.get("phases") or []])
            return self._send(200, b"ok")
        return self._not_found()

    def _download(self, path):
        exe, guide, kf = DOWNLOAD_DIR / EXE_NAME, DOWNLOAD_DIR / GUIDE_NAME, DOWNLOAD_DIR / "key"
        given = (self._query().get("cle") or [""])[0]
        if not (exe.exists() and guide.exists() and kf.exists() and given
                and hmac.compare_digest(given, kf.read_text().strip())):
            return self._send(404, b"not found (app)")
        key = urllib.parse.quote(given)
        no_store = [("Cache-Control", "no-store")]
        if path == "/telecharger":
            st = exe.stat()
            page = DOWNLOAD_PAGE.format(style=PAGE_STYLE, exe=EXE_NAME, key=key, size=round(st.st_size / 1e6),
                                        date=time.strftime("%d/%m/%Y", time.gmtime(st.st_mtime)))
            return self._send(200, page.encode(), "text/html; charset=utf-8", no_store)
        if path == "/telecharger/consignes":
            page = GUIDE_PAGE.format(style=PAGE_STYLE, exe=EXE_NAME, key=key,
                                     text=html.escape(guide.read_text(encoding="utf-8")))
            return self._send(200, page.encode(), "text/html; charset=utf-8", no_store)
        self.send_response(200)
        self.send_header("Content-Type", "application/vnd.microsoft.portable-executable")
        self.send_header("Content-Length", str(exe.stat().st_size))
        self.send_header("Content-Disposition", f'attachment; filename="{EXE_NAME}"')
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command == "HEAD":
            return
        self.log_message("download exe by %s", self.headers.get("X-Real-Ip") or self.client_address[0])
        with open(exe, "rb") as f:
            try:
                while b := f.read(1 << 16):
                    self.wfile.write(b)
            except (BrokenPipeError, ConnectionResetError):
                pass

    def _results_page(self, rid):
        token = urllib.parse.quote(RESULTS_TOKEN)
        if rid.endswith(".json") and REPORT_ID.match(rid[:-5]):
            f = RESULTS_DIR / rid
            return self._send(200, f.read_bytes(), "application/json") if f.exists() else self._send(404, b"not found")
        if not rid:
            files = sorted(RESULTS_DIR.glob("*.json"), reverse=True) if RESULTS_DIR.exists() else []
            def item(f):
                lf = f.with_suffix(".live")
                extra = ""
                if lf.exists():
                    age = time.time() - lf.stat().st_mtime
                    try:
                        step = json.loads(lf.read_bytes()).get("step", "")
                    except ValueError:
                        step = ""
                    extra = f" — {'🟢' if age < 20 else '⚪'} {html.escape(step)} ({fmt_age(age)})"
                return f'<li><a href="/results/{f.stem}?token={token}">{f.stem}</a>{extra}</li>'
            rows = "".join(item(f) for f in files)
            return self._send(200, f"<!doctype html><meta charset=utf-8><meta http-equiv=refresh content=10><title>Venue tests</title><h1>Venue tests</h1><ul>{rows or '<li>none yet</li>'}</ul>".encode(), "text/html; charset=utf-8")
        f = RESULTS_DIR / f"{rid}.json"
        if not REPORT_ID.match(rid) or not f.exists():
            return self._send(404, b"not found")
        lf = RESULTS_DIR / f"{rid}.live"
        live = None
        if lf.exists():
            try:
                live = (json.loads(lf.read_bytes()), time.time() - lf.stat().st_mtime)
            except ValueError:
                pass
        return self._send(200, render_report(json.loads(f.read_bytes()), rid, token, live).encode(), "text/html; charset=utf-8")

    def _not_found(self):
        self._send(404, b"not found (app)")

    do_PATCH = do_DELETE = do_OPTIONS = do_PUT = _not_found


def fmt_age(sec):
    sec = int(sec)
    if sec < 60:
        return f"{sec} s ago"
    if sec < 3600:
        return f"{sec // 60} min ago"
    return f"{sec // 3600} h ago"


def render_live(live):
    d, age = live
    e = lambda v: html.escape(str(v))
    fresh = age < 20
    out = [f"<div class=live style='border:2px solid {'#2a2' if fresh else '#aaa'};padding:8px 12px;margin:8px 0;max-width:720px'>"
           f"<b>{'🟢 LIVE' if fresh else '⚪ no update for ' + fmt_age(age).replace(' ago', '')}</b> — "
           f"phase <b>{e(d.get('phase') or '-')}</b>, last update {fmt_age(age)}"
           f"<h2 style='margin:6px 0'>{e(d.get('step'))}</h2>"]
    if d.get("prompt"):
        out.append(f"<p style='background:#fff3c4;padding:4px 6px'>⌨ waiting for her answer: <i>{e(d['prompt'])}</i></p>")
    if d.get("fields"):
        out.append("<table>" + "".join(f"<tr><th style='text-align:left'>{e(k)}</th><td>{e(v)}</td></tr>" for k, v in d["fields"]) + "</table>")
    out.append("</div>")
    return "".join(out)


def render_report(r, rid, token, live=None):
    e = lambda v: html.escape(str(v))
    out = [f"<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'>"
           f"<title>Venue test {e(rid)}</title>"
           "<style>body{font:14px system-ui;margin:16px}table{border-collapse:collapse;margin:8px 0}"
           "td,th{border:1px solid #ccc;padding:3px 6px;text-align:right}th{background:#eee}"
           ".ok{background:#d4f7d4}.warn{background:#fff3c4}.fail{background:#ffd6d6}pre{background:#f6f6f6;padding:8px;overflow:auto}</style>"]
    if r.get("status") == "running" or (live and live[1] < 60):
        out.append("<meta http-equiv=refresh content=5>")
    out.append(f"<h1>Venue test {e(rid)}</h1><p>status <b>{e(r.get('status'))}</b>, updated {e(r.get('updated'))}, {e(r.get('os'))}, "
               f"<a href='/results/{e(rid)}.json?token={token}'>JSON</a></p>")
    if live:
        out.append(render_live(live))
    for n in r.get("notes") or []:
        out.append(f"<p>note: {e(n)}</p>")
    for ph in r.get("phases") or []:
        sp = ph.get("speed") or {}
        out.append(f"<h2 class={e(ph.get('verdict') or '')}>{e(ph.get('name'))}: {e(ph.get('verdict'))} — {e(ph.get('summary'))}</h2>")
        out.append(f"<p>local IP {e(ph.get('local_ip'))}, public IP {e(sp.get('public_ip'))} — HTTP up {sp.get('up_mbps', 0):.1f} Mb/s, "
                   f"down {sp.get('down_mbps', 0):.1f} Mb/s, ping {sp.get('http_ping_ms', 0):.0f} ms {e(sp.get('error') or '')}</p>")
        if ph.get("error"):
            out.append(f"<p class=fail>error: {e(ph['error'])}</p>")
        out.append("<table><tr><th>profile</th><th>listeners</th><th>verdict</th><th>SRT Mb/s avg/min</th><th>RTT avg/max</th>"
                   "<th>retrans %</th><th>dropped</th><th>reconn.</th><th>open</th><th>conn. fail</th><th>drops</th><th>silent</th>"
                   "<th>loss % (worst)</th><th>jitter ms</th><th>latency p50/p95/max ms (n)</th><th>rx Mb/s</th><th>mono</th></tr>")
        for s in ph.get("stages") or []:
            l, t = s.get("listeners") or {}, s.get("srt") or {}
            out.append(f"<tr class={e(s.get('verdict'))}><td>{e(s.get('profile'))}</td><td>{l.get('target')}</td><td>{e(s.get('verdict'))}</td>"
                       f"<td>{t.get('avg_mbps', 0):.2f} / {t.get('min_mbps', 0):.2f}</td><td>{t.get('avg_rtt_ms', 0):.0f} / {t.get('max_rtt_ms', 0):.0f}</td>"
                       f"<td>{t.get('retrans_pct', 0):.1f}</td><td>{t.get('dropped')}</td><td>{t.get('reconnects')}</td>"
                       f"<td>{l.get('open')}</td><td>{l.get('conn_failures')}</td><td>{l.get('dropped')}</td><td>{l.get('silent')}</td>"
                       f"<td>{l.get('loss_pct', 0):.2f} ({l.get('worst_loss_pct', 0):.1f})</td><td>{l.get('jitter_ms', 0):.1f}</td>"
                       f"<td>{l.get('latency_p50_ms', 0):.0f} / {l.get('latency_p95_ms', 0):.0f} / {l.get('latency_max_ms', 0):.0f} ({l.get('latency_samples')})</td>"
                       f"<td>{l.get('down_mbps', 0):.1f}</td><td>{e(l.get('opus_mono'))}</td></tr>")
            for p in s.get("problems") or []:
                out.append(f"<tr><td colspan=17 style='text-align:left'>! {e(p)}</td></tr>")
        out.append("</table>")
        if ph.get("conn_errors"):
            out.append(f"<p>connection errors: {e(' / '.join(ph['conn_errors']))}</p>")
        out.append(f"<details><summary>Wi-Fi info</summary><pre>{e(ph.get('wifi_info'))}</pre></details>")
    return "".join(out)


if __name__ == "__main__":
    http.server.ThreadingHTTPServer(("0.0.0.0", 8000), Handler).serve_forever()
