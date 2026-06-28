# Deploying e2e-testora to testora.asafarim.com

The app runs on the VPS at `/var/repos/e2e-testora`:

- **App** — `next start` under systemd unit `e2e-testora` on `127.0.0.1:3007`
- **Database** — Postgres in a docker container `e2e-testora-db`, published on `127.0.0.1:55434` only
- **Web** — nginx `testora.asafarim.com` → `127.0.0.1:3007`, TLS via Let's Encrypt
- **Test runs** — in-process TestCafe drives the host's Google Chrome (`E2E_BROWSER`)

This is independent of the unrelated `dotnet-testora` / `nodejs-testora` services
already on the host (different names, ports, and code).

## Files

| File | Purpose |
|------|---------|
| `deploy/docker-compose.prod.yml` | Postgres, bound to localhost only |
| `deploy/e2e-testora.service` | systemd unit for the Next.js app |
| `deploy/nginx/testora.asafarim.com.conf` | nginx vhost (final TLS version) |
| `.env.production.example` | production env template (copy to `.env`) |
| `scripts/server-setup.sh` | one-time provisioning (idempotent) |
| `scripts/deploy.sh` | repeatable redeploy |

## First-time setup

```bash
# on the VPS, with the repo present at /var/repos/e2e-testora
bash /var/repos/e2e-testora/scripts/server-setup.sh
# then fill the target creds and restart:
nano /var/repos/e2e-testora/.env      # WEBAPP_ADMIN_EMAIL / WEBAPP_ADMIN_PASSWORD
systemctl restart e2e-testora
```

## Redeploy after changes

```bash
ssh vps 'bash /var/repos/e2e-testora/scripts/deploy.sh'
```

## Handy ops

```bash
systemctl status e2e-testora          # service health
journalctl -u e2e-testora -f          # live logs
docker logs -f e2e-testora-db         # database logs
curl -I https://testora.asafarim.com  # public check
```
