import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { migrate, openDb } from "./db/index.ts";
import { startDeletionJob } from "./jobs/deletion.ts";
import { systemClock } from "./lib/clock.ts";

const config = loadConfig();
const db = openDb(config.dbPath);
const applied = migrate(db);
if (applied.length) console.log(`Applied migrations: ${applied.join(", ")}`);

const app = createApp({ config, clock: systemClock, db });
const deletionJob = startDeletionJob(app.ctx.store);

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`AG app listening on ${info.address}${info.port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    deletionJob.stop();
    server.close();
    db.close();
    process.exit(0);
  });
}
