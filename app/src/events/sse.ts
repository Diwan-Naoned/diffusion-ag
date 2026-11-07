import type { Context } from 'hono';
import type { BusEvent, EventBus } from './bus.ts';

export interface SseStreamOptions {
  bus: EventBus;
  /** Comment sent on idle connections so carriers, NAT and Traefik keep them open (D6: 20 s). */
  keepAliveMs: number;
  /** The AG version now: the id of the snapshot. */
  version: () => number;
  /** Full state for this client. */
  snapshot: () => unknown;
  /** The delta to forward for a bus event, or null when it doesn't concern this client. */
  delta: (event: BusEvent) => unknown | null;
}

const encoder = new TextEncoder();

export function formatEvent(event: string, id: number | null, data: unknown): string {
  const lines = JSON.stringify(data).split('\n'); // JSON has no raw newlines, but stay safe
  return `event: ${event}\n${id === null ? '' : `id: ${id}\n`}${lines.map((l) => `data: ${l}`).join('\n')}\n\n`;
}

export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  'X-Accel-Buffering': 'no',
} as const;

/**
 * Server-Sent Events response (D6): a `snapshot` on connect — skipped when the client's
 * Last-Event-ID is already the current version — then `delta` events from the bus, each with
 * the AG version as id, and a `: ping` comment every keepAliveMs.
 */
export function sseResponse(c: Context, options: SseStreamOptions): Response {
  const lastEventId = c.req.header('last-event-id') ?? null;
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (text: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          cleanup();
        }
      };

      // Subscribe before reading the snapshot, so no change can fall between the two.
      const unsubscribe = options.bus.subscribe((event) => {
        const data = options.delta(event);
        if (data !== null) send(formatEvent('delta', event.version, data));
      });
      const ping = setInterval(() => send(': ping\n\n'), options.keepAliveMs);

      cleanup = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        clearInterval(ping);
        c.req.raw.signal.removeEventListener('abort', cleanup);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      c.req.raw.signal.addEventListener('abort', cleanup);

      send('retry: 3000\n\n');
      const version = options.version();
      if (lastEventId !== String(version)) send(formatEvent('snapshot', version, options.snapshot()));
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, { status: 200, headers: SSE_HEADERS });
}

/** Parses an SSE byte stream into events (used by tests). */
export function parseSse(text: string): { event?: string; id?: string; data?: string; comment?: string }[] {
  return text
    .split('\n\n')
    .filter((block) => block.trim() !== '')
    .map((block) => {
      const out: { event?: string; id?: string; data?: string; comment?: string } = {};
      for (const line of block.split('\n')) {
        if (line.startsWith(':')) out.comment = line.slice(1).trim();
        else {
          const i = line.indexOf(':');
          const field = line.slice(0, i);
          const value = line.slice(i + 1).replace(/^ /, '');
          if (field === 'data') out.data = out.data === undefined ? value : `${out.data}\n${value}`;
          else if (field === 'event' || field === 'id') out[field] = value;
        }
      }
      return out;
    });
}
