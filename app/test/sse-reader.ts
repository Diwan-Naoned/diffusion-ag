import { parseSse } from '../src/events/sse.ts';

export interface SseMessage {
  event?: string;
  id?: string;
  data?: unknown;
  comment?: string;
}

/** Reads an event-stream Response incrementally. */
export class SseReader {
  readonly #reader: ReadableStreamDefaultReader<Uint8Array>;
  readonly #decoder = new TextDecoder();
  #buffer = '';
  readonly messages: SseMessage[] = [];

  constructor(res: Response) {
    this.#reader = res.body!.getReader();
  }

  /** Waits until `predicate` matches a message received after index `from`, and returns it. */
  async waitFor(predicate: (m: SseMessage) => boolean, timeoutMs = 1000): Promise<SseMessage> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const found = this.messages.find(predicate);
      if (found) return found;
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error(`timeout; got ${JSON.stringify(this.messages)}`);
      const chunk = await Promise.race([
        this.#reader.read(),
        new Promise<null>((r) => setTimeout(() => r(null), remaining)),
      ]);
      if (chunk === null) continue;
      if (chunk.done) throw new Error(`stream ended; got ${JSON.stringify(this.messages)}`);
      this.#buffer += this.#decoder.decode(chunk.value, { stream: true });
      const end = this.#buffer.lastIndexOf('\n\n');
      if (end >= 0) {
        for (const m of parseSse(this.#buffer.slice(0, end + 2))) {
          this.messages.push({ ...m, data: m.data === undefined ? undefined : JSON.parse(m.data) });
        }
        this.#buffer = this.#buffer.slice(end + 2);
      }
    }
  }

  /** Collects messages for `ms` milliseconds. */
  async drain(ms: number): Promise<SseMessage[]> {
    try {
      await this.waitFor(() => false, ms);
    } catch {
      // timeout expected
    }
    return this.messages;
  }

  ofType(event: string): SseMessage[] {
    return this.messages.filter((m) => m.event === event);
  }

  async close(): Promise<void> {
    await this.#reader.cancel();
  }
}
