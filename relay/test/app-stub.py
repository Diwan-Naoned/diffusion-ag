"""Stub of the web app for local relay tests (stands in for remote-participation-app).

- GET /auth/media     ForwardAuth target: 200 with cookie ag_access=ok, else 401
- GET /login, /logout set / clear that cookie
- GET /               listening page using MediaMTX's reader.js on /media/trad/whep
- GET /reader.js      MediaMTX reader (copied from MediaMTX v1.21.3, MIT)
- anything else       404 (like the real app for unknown /media/* paths)
"""

import http.server
import pathlib

HERE = pathlib.Path(__file__).parent
COOKIE = "ag_access=ok"

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

    def do_GET(self):
        path = self.path.split("?")[0]
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

    def _not_found(self):
        self._send(404, b"not found (app)")

    do_POST = do_PATCH = do_DELETE = do_OPTIONS = do_PUT = _not_found


if __name__ == "__main__":
    http.server.ThreadingHTTPServer(("0.0.0.0", 8000), Handler).serve_forever()
