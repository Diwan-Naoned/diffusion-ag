/**
 * Listening page (D9): minimal WHEP client for the interpretation feed.
 *
 * - recvonly audio RTCPeerConnection, non-trickle: wait for ICE gathering, then one POST of the
 *   SDP offer to /media/trad/whep; the session URL from Location is deleted on stop.
 * - Reconnects with backoff (1 s → 10 s) when the connection fails; a 404 means the path is not
 *   published ("not broadcast"), retried every 5 s.
 * - Audio interrupted by the phone (call, alarm, other app) pauses the <audio> element while the
 *   WebRTC session may stay up: we show "Reprendre l'écoute", since iOS needs a tap to restart.
 * - Wake lock while listening, where supported; Media Session title.
 */
import type { Lang } from '../i18n/core.ts';
import type { SalleData } from '../views/salle.tsx';
import { $, pageData, translatorFrom } from './_page.ts';

type State = 'idle' | 'connecting' | 'playing' | 'reconnecting' | 'offline' | 'paused';

const data = pageData<SalleData>();
const tr = translatorFrom(data.lang as Lang, data.strings);
const audio = $<HTMLAudioElement>('[data-audio]');
const stateEl = $('[data-listen-state]');
const listenButton = $<HTMLButtonElement>('[data-listen]');
const listenLabel = $('[data-listen-label]');
const stopButton = $<HTMLButtonElement>('[data-stop]');

let pc: RTCPeerConnection | null = null;
let sessionUrl: string | null = null;
let wanted = false; // the listener pressed "Écouter" and not "Arrêter"
let retryMs = 1000;
let retryTimer: number | undefined;
let disconnectTimer: number | undefined;
let wakeLock: { release(): Promise<void> } | null = null;
let attempt = 0;

function setState(state: State) {
  stateEl.dataset.state = state;
  stateEl.textContent = tr.t(`salle.state.${state}`);
  listenButton.hidden = wanted && state !== 'paused';
  listenLabel.textContent = tr.t(state === 'paused' ? 'salle.resume' : 'salle.listen');
  stopButton.hidden = !wanted;
  document.documentElement.dataset.listenStatus = state;
}

async function requestWakeLock() {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } };
    if (nav.wakeLock && document.visibilityState === 'visible') wakeLock = await nav.wakeLock.request('screen');
  } catch {
    // not supported or refused: the guidance text covers it
  }
}

function releaseWakeLock() {
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}

function teardown() {
  window.clearTimeout(disconnectTimer);
  if (sessionUrl) {
    // keepalive: the DELETE still goes out when the page is closing.
    fetch(sessionUrl, { method: 'DELETE', credentials: 'same-origin', keepalive: true }).catch(() => {});
    sessionUrl = null;
  }
  if (pc) {
    pc.ontrack = null;
    pc.onconnectionstatechange = null;
    pc.close();
    pc = null;
  }
}

function waitForIceGathering(conn: RTCPeerConnection, timeoutMs = 3000): Promise<void> {
  if (conn.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      conn.removeEventListener('icegatheringstatechange', check);
      window.clearTimeout(timer);
      resolve();
    };
    const check = () => conn.iceGatheringState === 'complete' && done();
    const timer = window.setTimeout(done, timeoutMs);
    conn.addEventListener('icegatheringstatechange', check);
  });
}

function scheduleRetry(state: 'reconnecting' | 'offline') {
  teardown();
  if (!wanted) return;
  setState(state);
  const delay = state === 'offline' ? 5000 : retryMs;
  retryMs = Math.min(retryMs * 2, 10_000);
  window.clearTimeout(retryTimer);
  retryTimer = window.setTimeout(() => void connect(state), delay);
}

async function connect(state: 'connecting' | 'reconnecting' | 'offline' = 'connecting') {
  teardown();
  if (!wanted) return;
  const mine = ++attempt;
  if (state !== 'offline') setState(state);
  const conn = new RTCPeerConnection();
  pc = conn;
  conn.addTransceiver('audio', { direction: 'recvonly' });
  conn.ontrack = (e) => {
    audio.srcObject = e.streams[0] ?? new MediaStream([e.track]);
    audio.play().catch(() => setState('paused'));
  };
  conn.onconnectionstatechange = () => {
    if (mine !== attempt) return;
    const s = conn.connectionState;
    if (s === 'connected') {
      window.clearTimeout(disconnectTimer);
      retryMs = 1000;
      setState(audio.paused && audio.srcObject ? 'paused' : 'playing');
    } else if (s === 'failed') {
      scheduleRetry('reconnecting');
    } else if (s === 'disconnected') {
      // Often recovers by itself (network switch); give it a moment before rebuilding.
      setState('reconnecting');
      window.clearTimeout(disconnectTimer);
      disconnectTimer = window.setTimeout(() => {
        if (mine === attempt && conn.connectionState !== 'connected') scheduleRetry('reconnecting');
      }, 4000);
    }
  };

  try {
    await conn.setLocalDescription(await conn.createOffer());
    await waitForIceGathering(conn);
    if (mine !== attempt) return;
    const res = await fetch(data.whepUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: conn.localDescription!.sdp,
      credentials: 'same-origin',
    });
    if (mine !== attempt) return;
    if (res.status === 401) {
      // The feed is refused both when access is lost and while the AG is not open yet
      // (participant access starts in preparation, media access only in progress, D10).
      // Only reload (to show the code page) when the participant access itself is gone.
      const ping = await fetch('/api/ping', { credentials: 'same-origin', cache: 'no-store' }).catch(() => null);
      if (mine !== attempt) return;
      if (ping?.status === 401) {
        window.location.reload();
        return;
      }
      return scheduleRetry('offline');
    }
    if (res.status === 404) return scheduleRetry('offline'); // path not published
    if (res.status !== 201) return scheduleRetry('reconnecting');
    const location = res.headers.get('Location');
    sessionUrl = location ? new URL(location, window.location.href).toString() : null;
    await conn.setRemoteDescription({ type: 'answer', sdp: await res.text() });
  } catch {
    if (mine === attempt) scheduleRetry('reconnecting');
  }
}

function start() {
  wanted = true;
  retryMs = 1000;
  // Calling play() inside the tap unlocks audio on iOS; the stream is attached later.
  audio.play().catch(() => {});
  void requestWakeLock();
  if ('mediaSession' in navigator && 'MediaMetadata' in window) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: tr.t('salle.mediaTitle'), artist: data.agName });
  }
  if (pc && pc.connectionState === 'connected' && audio.srcObject) {
    // Resume after an interruption: the session is still up, only the audio was paused.
    audio.play().then(() => setState('playing'), () => setState('paused'));
    return;
  }
  void connect();
}

function stop() {
  wanted = false;
  attempt++;
  window.clearTimeout(retryTimer);
  teardown();
  audio.pause();
  audio.srcObject = null;
  releaseWakeLock();
  setState('idle');
}

listenButton.addEventListener('click', start);
stopButton.addEventListener('click', stop);

// The phone paused our audio (call, alarm, other media app).
audio.addEventListener('pause', () => {
  if (wanted && audio.srcObject) setState('paused');
});
audio.addEventListener('playing', () => {
  if (wanted && pc?.connectionState === 'connected') setState('playing');
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !wanted) return;
  void requestWakeLock(); // released automatically when the page was hidden
  if (audio.paused && audio.srcObject) setState('paused');
  if (!pc || pc.connectionState === 'failed' || pc.connectionState === 'closed') void connect('reconnecting');
});
window.addEventListener('online', () => {
  if (wanted && (!pc || pc.connectionState !== 'connected')) void connect('reconnecting');
});
window.addEventListener('pagehide', teardown);

if (!('RTCPeerConnection' in window)) {
  listenButton.disabled = true;
  stateEl.textContent = tr.t('salle.unsupported');
} else {
  setState('idle');
}
