# Laravel Cloud — scheduled commands & queues

Your app defines scheduled tasks in `routes/console.php`:

| Command | Frequency | Purpose |
|---------|-----------|---------|
| `attendance:process` | Every 10 minutes | Finalize teacher/administrator attendance |
| `reminders:process` | Every minute | Dispatch due session reminder emails |
| `activity-logs:prune` | Daily at 02:00 | Prune old activity logs |

Laravel **does not** run these by itself in production. Something must invoke `php artisan schedule:run` every minute.

## 1. Enable the scheduler (required)

On [Laravel Cloud](https://cloud.laravel.com/docs/scheduled-tasks):

1. Open your project → environment (e.g. `main`).
2. Click the **App** compute cluster on the infrastructure canvas.
3. Turn **Scheduler** **ON**.
4. **Save** and **re-deploy**.

After deploy, Cloud runs `php artisan schedule:run` every minute and your scheduled commands will fire on their defined intervals.

> Schedule changes only take effect after the next deployment (Cloud reads `php artisan schedule:list` at deploy time).

## 2. Enable a queue worker (required for reminders)

`reminders:process` dispatches `SendSessionReminderJob` to the queue. Without a worker, reminder emails will not send.

### Laravel Cloud managed queue

If you attach a **managed queue** in Laravel Cloud, the platform uses SQS. The app must include:

```bash
composer require aws/aws-sdk-php
```

(This is already in `composer.json` — commit and redeploy after adding it.)

Laravel Cloud will set `QUEUE_CONNECTION=sqs` and related env vars automatically. Add a **Worker** cluster with:

```bash
php artisan queue:work --sleep=3 --tries=3 --max-time=3600
```

### Database queue (alternative)

If you are **not** using Laravel Cloud's managed queue:

1. Set env var: `QUEUE_CONNECTION=database`
2. Add a **Worker** cluster (or cron-based `queue:work --stop-when-empty`)
3. Run migrations so the `jobs` table exists: `php artisan migrate --force`

`attendance:process` runs directly in the scheduler and does **not** need a queue worker.

## 3. Verify after deploy

From Laravel Cloud **Commands** (or local):

```bash
php artisan schedule:list
php artisan attendance:process
php artisan reminders:process
```

Check logs for `Attendance processor completed` or reminder dispatch output.

## 4. Environment checklist

```env
APP_ENV=production
APP_TIMEZONE=Africa/Accra   # or your institution timezone
QUEUE_CONNECTION=database
```

Wrong `APP_TIMEZONE` can make `dailyAt('02:00')` and attendance windows run at unexpected times.

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| No attendance finalization | Scheduler toggle off, or environment hibernated without scheduler enabled |
| Reminders never email | No queue worker, or `QUEUE_CONNECTION=sync` in production |
| Schedule changes ignored | Redeploy after editing `routes/console.php` |
| Command works manually but not on schedule | Scheduler not enabled on the Cloud cluster |
