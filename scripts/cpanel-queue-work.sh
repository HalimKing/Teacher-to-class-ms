#!/bin/bash
# cPanel cron helper — processes queued jobs (session reminders, etc.).
#
# In cPanel → Cron Jobs, set schedule to: * * * * * (every minute)
# Command example:
#   /bin/bash /home/USERNAME/teacher-to-class-ms/scripts/cpanel-queue-work.sh
#
# Requires QUEUE_CONNECTION=database (or redis) in .env

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

PHP_BIN="${PHP_BIN:-php}"
LOG_FILE="${APP_DIR}/storage/logs/queue-worker.log"
mkdir -p "$(dirname "$LOG_FILE")"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] queue:work starting" >> "$LOG_FILE"

"$PHP_BIN" artisan queue:work --stop-when-empty --sleep=3 --tries=3 --max-time=55 >> "$LOG_FILE" 2>&1
EXIT_CODE=$?

echo "[$(date '+%Y-%m-%d %H:%M:%S')] queue:work finished (exit ${EXIT_CODE})" >> "$LOG_FILE"

exit $EXIT_CODE
