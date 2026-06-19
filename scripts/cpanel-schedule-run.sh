#!/bin/bash
# cPanel cron helper — runs Laravel's task scheduler every minute.
#
# In cPanel → Cron Jobs, set schedule to: * * * * * (every minute)
# Command example (replace paths with yours):
#   /bin/bash /home/USERNAME/teacher-to-class-ms/scripts/cpanel-schedule-run.sh
#
# Find your PHP path in cPanel → "Select PHP Version" or run: which php

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

# Override in cPanel cron if your host uses a different PHP binary:
PHP_BIN="${PHP_BIN:-php}"

LOG_FILE="${APP_DIR}/storage/logs/scheduler.log"
mkdir -p "$(dirname "$LOG_FILE")"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] schedule:run starting" >> "$LOG_FILE"

"$PHP_BIN" artisan schedule:run >> "$LOG_FILE" 2>&1
EXIT_CODE=$?

echo "[$(date '+%Y-%m-%d %H:%M:%S')] schedule:run finished (exit ${EXIT_CODE})" >> "$LOG_FILE"

exit $EXIT_CODE
