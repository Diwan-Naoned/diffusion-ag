import type { Store } from '../domain/store.ts';

/**
 * Scheduled deletion (D13): runs once at startup — so a deletion due while the app was stopped
 * happens as soon as it starts again, never earlier — then every minute.
 */
export function startDeletionJob(store: Store, options: { intervalMs?: number; log?: (msg: string) => void } = {}) {
  const log = options.log ?? ((msg: string) => console.log(msg));
  const run = () => {
    try {
      const deleted = store.runDueDeletions();
      if (deleted.length) log(`Deleted the data of AG ${deleted.join(', ')} (scheduled deletion).`);
      return deleted;
    } catch (err) {
      log(`Deletion job failed: ${(err as Error).message}`);
      return [];
    }
  };
  run();
  const timer = setInterval(run, options.intervalMs ?? 60_000);
  timer.unref();
  return { run, stop: () => clearInterval(timer) };
}
