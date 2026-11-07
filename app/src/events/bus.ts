import { EventEmitter } from 'node:events';

/**
 * Something changed for an AG. Streams re-read what they need from the database, so events
 * carry identifiers only. `version` is the AG version after the change (the SSE event id).
 */
export type BusEvent =
  | { kind: 'assembly'; assemblyId: number; version: number }
  | { kind: 'settings'; assemblyId: number; version: number }
  | { kind: 'intervention'; assemblyId: number; version: number; interventionId: number; deviceId: string }
  | { kind: 'deleted'; assemblyId: number; version: number };

/** In-process event bus (one app instance, D6). Publish only after the transaction has committed. */
export class EventBus {
  readonly #emitter = new EventEmitter().setMaxListeners(0);

  publish(event: BusEvent): void {
    this.#emitter.emit('event', event);
  }

  subscribe(listener: (event: BusEvent) => void): () => void {
    this.#emitter.on('event', listener);
    return () => this.#emitter.off('event', listener);
  }

  get listenerCount(): number {
    return this.#emitter.listenerCount('event');
  }
}
