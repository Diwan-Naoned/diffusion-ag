#!/bin/sh
# Build the Windows venue test tool from the spike environment (relay/.env).
#
#   relay/venue-test/build.sh            -> dist/test-connexion-AG/{test-connexion-AG.exe,CONSIGNES.txt}
#   relay/venue-test/build.sh --upload   same, then upload both to the stub's
#                                        download page (/telecharger?cle=…)
#
# The executable embeds the SRT publish credentials of the spike stack and the
# results token: rotate RELAY_PUBLISH_PASS after the venue test (runbook).
# Env overrides: SRT_HOST (default dokploy.cocaud.dev), ENV_FILE,
# ZIP_PASSWORD (password of the protected zip, shown on the download page;
# it only stops browsers/antivirus from inspecting the .exe at download time).
set -eu
cd "$(dirname "$0")"
ENV_FILE=${ENV_FILE:-../.env}
[ -f "$ENV_FILE" ] || { echo "missing $ENV_FILE (spike environment)" >&2; exit 1; }
# shellcheck disable=SC1090
. "$ENV_FILE"
: "${RELAY_PUBLISH_USER:?}" "${RELAY_PUBLISH_PASS:?}" "${APP_HOST:?}"
if [ -z "${RESULTS_TOKEN:-}" ]; then
  RESULTS_TOKEN=$(openssl rand -hex 16)
  printf '\n# venue-test reports (stub /results), also set in Dokploy\nRESULTS_TOKEN=%s\n' "$RESULTS_TOKEN" >> "$ENV_FILE"
  echo "Added RESULTS_TOKEN to $ENV_FILE: copy it into the Dokploy environment and redeploy." >&2
fi
if [ -z "${DOWNLOAD_KEY:-}" ]; then
  DOWNLOAD_KEY=$(openssl rand -hex 12)
  printf '# key of the venue-test download page (/telecharger?cle=...)\nDOWNLOAD_KEY=%s\n' "$DOWNLOAD_KEY" >> "$ENV_FILE"
fi
SRT_HOST=${SRT_HOST:-dokploy.cocaud.dev}
ZIP_PASSWORD=${ZIP_PASSWORD:-ag2026}

[ -f media/test1080.ts ] && [ -f media/test720.ts ] && [ -f media/testcheck.ts ] || ./gen-media.sh

cat > config.json <<JSON
{
  "srt_addr": "${SRT_HOST}:8890",
  "srt_streamid": "publish:ag:${RELAY_PUBLISH_USER}:${RELAY_PUBLISH_PASS}",
  "srt_latency_ms": 200,
  "whep_url": "https://${APP_HOST}/media/trad/whep",
  "cookie": "ag_access=ok",
  "base_url": "https://${APP_HOST}",
  "results_token": "${RESULTS_TOKEN}",
  "phone_page": "${APP_HOST}/login",
  "connect_rate": 20,
  "speed_seconds": 8,
  "wifi_stages": [
    {"listeners": 1, "seconds": 45},
    {"listeners": 10, "seconds": 60},
    {"listeners": 50, "seconds": 60},
    {"listeners": 100, "seconds": 60},
    {"listeners": 200, "seconds": 90},
    {"listeners": 300, "seconds": 60}
  ],
  "mobile_stages": [
    {"listeners": 1, "seconds": 60},
    {"listeners": 3, "seconds": 150}
  ],
  "mobile_720_stages": [
    {"listeners": 3, "seconds": 120}
  ]
}
JSON

mkdir -p dist/test-connexion-AG
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" \
  -o dist/test-connexion-AG/test-connexion-AG.exe .
cp CONSIGNES.txt dist/test-connexion-AG/
rm -f dist/test-connexion-AG.zip dist/test-connexion-AG-protege.zip
# ZipCrypto (zip -P), not AES: Windows Explorer's "Extraire tout" only opens ZipCrypto.
(cd dist/test-connexion-AG && zip -q -P "$ZIP_PASSWORD" ../test-connexion-AG-protege.zip test-connexion-AG.exe CONSIGNES.txt)
ls -l dist/test-connexion-AG/ dist/test-connexion-AG-protege.zip
if [ "${1:-}" = "--upload" ]; then
  for f in test-connexion-AG/CONSIGNES.txt test-connexion-AG/test-connexion-AG.exe test-connexion-AG-protege.zip; do
    curl -fsS -X POST -H "X-Results-Token: ${RESULTS_TOKEN}" -H "X-Download-Key: ${DOWNLOAD_KEY}" \
      -H "X-Zip-Password: ${ZIP_PASSWORD}" \
      -H "Content-Type: application/octet-stream" --data-binary "@dist/$f" \
      "https://${APP_HOST}/telecharger/$(basename "$f")" >/dev/null
  done
  echo "Uploaded. Download page: https://${APP_HOST}/telecharger?cle=${DOWNLOAD_KEY}"
fi
echo "Results: https://${APP_HOST}/results?token=${RESULTS_TOKEN}"
