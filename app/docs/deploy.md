# Deploying the app (Dokploy)

Compose app `ag-app` in Dokploy project `AG`, next to the relay (`ag-relay`,
see `relay/docs/runbook.md`).

| Setting | Value |
|---|---|
| Type | Docker Compose |
| Repo / branch | `Diwan-Naoned/diffusion-ag`, `main` |
| Compose path | `./app/docker-compose.yml` |
| Isolated Deployment / Randomize Compose | **off** (the relay reaches the app as `ag-app` on `dokploy-network`) |
| Domains tab | empty: routing comes from the compose labels |

Environment (template: `app/.env.example`):

```
APP_HOST=age.dokploy.cocaud.dev
SESSION_SECRET=<openssl rand -base64 48>
BUREAU_PASSWORD=<new password for each AG>
```

Environment changes only apply after **Redeploy**. Changing `SESSION_SECRET`
logs everyone out (participants re-enter through the link or code).

The relay must use the same host and point its ForwardAuth at the app:

```
APP_HOST=age.dokploy.cocaud.dev
RELAY_AUTH_URL=http://ag-app:3000/auth/media
```

Deploy the relay with its **production** compose (`./relay/docker-compose.yml`):
the spike compose has its own catch-all router for the same host.

## Data

The SQLite database is the named volume `ag-data` (mounted at `/data`). It
holds the AG's personal data until the Bureau's scheduled deletion, so:

- do **not** add it to Dokploy volume backups (or keep retention under 7 days);
- it survives redeploys; removing the volume deletes everything.

## Checks after a deploy

1. `https://<APP_HOST>/healthz` answers `ok`; `http://` redirects to `https://`.
2. `https://<APP_HOST>/media/trad/whep` without a cookie answers 401 (relay + ForwardAuth).
3. Bureau login, create a test AG, open it, join with the participant link on a phone.

**Auto-deploy**: a push to `main` restarts the app (a few seconds; open pages
reconnect by themselves). Turn it off for `ag-app` during the AG, like `ag-relay`.
