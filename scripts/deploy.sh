#!/usr/bin/env bash
# Repeatable redeploy of testora.asafarim.com. Run as root on the VPS:
#
#   bash /var/repos/e2e-testora/scripts/deploy.sh
#
# or trigger it from your laptop in one line:
#
#   ssh vps 'bash /var/repos/e2e-testora/scripts/deploy.sh'
#
set -euo pipefail

REPO_DIR=/var/repos/e2e-testora
cd "$REPO_DIR"

echo "==> Pull latest (if a git checkout)"
if [ -d "$REPO_DIR/.git" ]; then
  git fetch --all --prune
  git reset --hard origin/main
else
  echo "    Not a git checkout — using files already on disk."
fi

echo "==> Ensure Postgres is up"
docker compose -f deploy/docker-compose.prod.yml up -d

echo "==> Install + build"
pnpm install --frozen-lockfile
pnpm build

echo "==> Migrate"
pnpm db:migrate

echo "==> Restart service"
systemctl restart e2e-testora
sleep 2
systemctl --no-pager --lines=10 status e2e-testora || true

echo
echo "Deployed. curl -I https://testora.asafarim.com"
