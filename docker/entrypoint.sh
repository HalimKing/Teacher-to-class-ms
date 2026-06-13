#!/bin/bash
set -euo pipefail

PORT="${PORT:-8080}"

# Render injects a dynamic PORT; Apache must listen on it.
if grep -q "^Listen " /etc/apache2/ports.conf; then
    sed -i "s/^Listen .*/Listen ${PORT}/" /etc/apache2/ports.conf
else
    echo "Listen ${PORT}" >> /etc/apache2/ports.conf
fi

sed -i "s/<VirtualHost \*:8080>/<VirtualHost *:${PORT}>/" /etc/apache2/sites-available/000-default.conf

mkdir -p storage/framework/{cache,sessions,views} storage/logs bootstrap/cache

chown -R www-data:www-data storage bootstrap/cache
chmod -R ug+rwx storage bootstrap/cache

if [ ! -e public/storage ]; then
    php artisan storage:link --force >/dev/null 2>&1 || true
fi

if [ -n "${APP_KEY:-}" ] && [ "${APP_ENV:-local}" = "production" ]; then
    php artisan config:cache || true
    php artisan route:cache || true
    php artisan view:cache || true
fi

exec "$@"
