/**
 * Live updates over Server-Sent Events (D6), shared by the participant and Bureau pages.
 *
 * - The server sends a `snapshot` (full state) on connect, then `delta` events.
 * - EventSource reconnects by itself and sends Last-Event-ID; the server answers with a fresh
 *   snapshot when anything changed, so the page catches up without a reload.
 * - When the browser gives up (readyState CLOSED, e.g. after an HTTP error), we check access:
 *   401 reloads the page (code entry or login page), anything else retries with backoff.
 * - The "Reconnexion…" banner shows while disconnected (after a short grace delay, to avoid
 *   flashing on quick reconnects).
 */
export interface LiveOptions<S, D> {
  url: string;
  /** Endpoint answering 204 with access, 401 without. */
  pingUrl: string;
  onSnapshot: (data: S) => void;
  onDelta: (data: D) => void;
  onUnauthorized?: () => void;
}

const SHOW_BANNER_AFTER_MS = 1500;

export function connectLive<S, D>(options: LiveOptions<S, D>): { close(): void } {
  const banner = document.querySelector<HTMLElement>('[data-connection-banner]');
  let source: EventSource | null = null;
  let retryMs = 1000;
  let retryTimer: number | undefined;
  let bannerTimer: number | undefined;
  let stopped = false;

  const setConnected = (connected: boolean) => {
    window.clearTimeout(bannerTimer);
    if (connected) {
      if (banner) banner.hidden = true;
      document.documentElement.dataset.live = 'connected';
    } else {
      document.documentElement.dataset.live = 'reconnecting';
      bannerTimer = window.setTimeout(() => {
        if (banner) banner.hidden = false;
      }, SHOW_BANNER_AFTER_MS);
    }
  };

  const open = () => {
    if (stopped) return;
    window.clearTimeout(retryTimer);
    source?.close();
    const es = new EventSource(options.url);
    source = es;
    es.addEventListener('open', () => {
      retryMs = 1000;
      setConnected(true);
    });
    es.addEventListener('snapshot', (e) => {
      setConnected(true);
      options.onSnapshot(JSON.parse((e as MessageEvent<string>).data) as S);
    });
    es.addEventListener('delta', (e) => options.onDelta(JSON.parse((e as MessageEvent<string>).data) as D));
    es.addEventListener('error', () => {
      setConnected(false);
      if (es.readyState === EventSource.CLOSED) void recover();
    });
  };

  const recover = async () => {
    try {
      const res = await fetch(options.pingUrl, { credentials: 'same-origin', cache: 'no-store' });
      if (res.status === 401) {
        stopped = true;
        source?.close();
        (options.onUnauthorized ?? (() => window.location.reload()))();
        return;
      }
    } catch {
      // offline: retry below
    }
    retryTimer = window.setTimeout(open, retryMs);
    retryMs = Math.min(retryMs * 2, 10_000);
  };

  // Come back as soon as the network or the tab does, instead of waiting for the backoff.
  const wake = () => {
    if (!stopped && (!source || source.readyState === EventSource.CLOSED)) open();
  };
  window.addEventListener('online', wake);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') wake();
  });

  open();
  return {
    close() {
      stopped = true;
      source?.close();
    },
  };
}
