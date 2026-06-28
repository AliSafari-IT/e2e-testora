#!/usr/bin/env bash
# One-time provisioning for testora.asafarim.com on the VPS.
# Idempotent — safe to re-run. Run as root on the VPS:
#
#   bash /var/repos/e2e-testora/scripts/server-setup.sh
#
set -euo pipefail

APP=e2e-testora
DOMAIN=testora.asafarim.com
PORT=3007
EMAIL=asafarim@gmail.com
REPO_DIR=/var/repos/$APP

cd "$REPO_DIR"

echo "==> [1/7] Production .env"
if [ ! -f "$REPO_DIR/.env" ]; then
  cp "$REPO_DIR/.env.production.example" "$REPO_DIR/.env"
  echo "    Created .env from template. Fill WEBAPP_ADMIN_* before running suites."
else
  echo "    .env already present — leaving it untouched."
fi

echo "==> [2/7] Postgres (docker, 127.0.0.1:55434)"
docker compose -f deploy/docker-compose.prod.yml up -d
echo -n "    waiting for postgres health"
for _ in $(seq 1 30); do
  if [ "$(docker inspect -f '{{.State.Health.Status}}' e2e-testora-db 2>/dev/null)" = "healthy" ]; then
    echo " — healthy"; break
  fi
  echo -n "."; sleep 2
done

echo "==> [3/7] Install deps + build"
pnpm install --frozen-lockfile
pnpm build

echo "==> [4/7] Migrate + seed"
pnpm db:migrate
pnpm db:seed || echo "    (seed skipped/failed — non-fatal)"

echo "==> [5/7] systemd service"
cp deploy/e2e-testora.service /etc/systemd/system/e2e-testora.service
systemctl daemon-reload
systemctl enable --now e2e-testora
sleep 2
systemctl --no-pager --lines=0 status e2e-testora || true

echo "==> [6/7] nginx (HTTP bootstrap for ACME)"
cat > /etc/nginx/sites-available/$DOMAIN.conf <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
ln -sf ../sites-available/$DOMAIN.conf /etc/nginx/sites-enabled/$DOMAIN.conf
nginx -t && systemctl reload nginx

echo "==> [7/7] TLS certificate + final nginx config"
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  certbot certonly --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL"
fi
# Swap in the full version-controlled TLS config.
cp deploy/nginx/$DOMAIN.conf /etc/nginx/sites-available/$DOMAIN.conf
nginx -t && systemctl reload nginx

echo
echo "Done. https://$DOMAIN should now be live."
echo "Check:  systemctl status e2e-testora   and   curl -I https://$DOMAIN"
