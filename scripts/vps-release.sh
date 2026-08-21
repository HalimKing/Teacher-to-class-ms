#!/usr/bin/env bash
set -euo pipefail

# Runs on the VPS after GitHub Actions has synced application files.
# Usage: bash scripts/vps-release.sh /var/www/teacher-to-class-ms

APP_DIR="${1:-${VPS_APP_DIR:-}}"
PHP_BIN="${PHP_BIN:-php}"

if [ -z "$APP_DIR" ]; then
    echo "App directory is required (pass it as the first argument or set VPS_APP_DIR)."
    exit 1
fi

if [ ! -d "$APP_DIR" ]; then
    echo "App directory does not exist: $APP_DIR"
    exit 1
fi

cd "$APP_DIR"

if [ ! -f .env ]; then
    echo "Missing .env in $APP_DIR. Copy .env.example, set production values, then retry."
    exit 1
fi

mkdir -p \
    storage/framework/cache \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs \
    storage/app/public \
    bootstrap/cache

rm -f public/hot

if [ -f composer.phar ]; then
    composer_cmd=("$PHP_BIN" composer.phar)
elif command -v composer >/dev/null 2>&1; then
    composer_cmd=(composer)
else
    echo "Composer is not installed. Install composer or place composer.phar in $APP_DIR."
    exit 1
fi

"${composer_cmd[@]}" install \
    --no-dev \
    --no-interaction \
    --prefer-dist \
    --optimize-autoloader

"$PHP_BIN" artisan down --retry=60 --no-interaction || true
"$PHP_BIN" artisan migrate --force --no-interaction
"$PHP_BIN" artisan storage:link --force
"$PHP_BIN" artisan optimize
"$PHP_BIN" artisan queue:restart
"$PHP_BIN" artisan up

chmod -R ug+rwx storage bootstrap/cache

echo "Release complete in $APP_DIR"
