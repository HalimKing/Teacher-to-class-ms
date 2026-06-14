# Deploying to Render.com (Docker)

This guide deploys **teacher-to-class-ms** (Laravel 12 + Inertia + React) to [Render](https://render.com) using the included **Dockerfile**. Use Docker instead of Render's native PHP environment — native PHP on Render does **not** include Composer, which causes:

```text
composer: command not found
```

The Docker image includes **PHP 8.3**, **Apache**, **Composer**, **Node.js/npm build**, Laravel extensions, and correct **storage permissions**.

---

## What the Docker image does

| Stage | Purpose |
|-------|---------|
| **vendor** | `composer install --no-dev --optimize-autoloader` |
| **assets** | `npm ci && npm run build` (Vite → `public/build`) |
| **runtime** | PHP 8.3 + Apache, copies app + vendor + built assets |

Runtime features:

- Apache `DocumentRoot` → `public/`
- `mod_rewrite` enabled (Laravel `.htaccess`)
- Face-api models served from `public/models/face-api`
- Entrypoint sets Render **`PORT`**, fixes **`storage/`** permissions, runs `storage:link`
- Health check: `GET /up`

---

## Prerequisites

1. GitHub/GitLab repo with this project pushed
2. [Render account](https://dashboard.render.com)
3. (Recommended) Render **PostgreSQL** database — Render does not offer managed MySQL

---

## Quick deploy (Blueprint)

1. Push this repo to GitHub.
2. In Render Dashboard → **New** → **Blueprint**.
3. Connect the repo — Render detects `render.yaml`.
4. Review services:
   - **teacher-to-class-web** (Web Service, Docker)
   - **teacher-to-class-worker** (Background Worker, queue)
   - **teacher-to-class-scheduler** (Cron, every minute)
   - **teacher-to-class-db** (PostgreSQL)
5. Set **`APP_URL`** on the web service after first deploy:
   ```env
   APP_URL=https://teacher-to-class-web.onrender.com
   ```
   (Use your actual Render URL or custom domain.)
6. Deploy.

The Blueprint runs migrations on each web deploy:

```bash
php artisan migrate --force --no-interaction
```

---

## Manual setup (Dashboard)

### 1. Create PostgreSQL

1. **New** → **PostgreSQL**
2. Name: `teacher-to-class-db`
3. Copy the **Internal Database URL**

### 2. Create Web Service (Docker)

1. **New** → **Web Service**
2. Connect repository
3. **Runtime:** Docker
4. **Dockerfile path:** `./Dockerfile`
5. **Health Check Path:** `/up`

**Environment variables:**

| Variable | Value |
|----------|-------|
| `APP_ENV` | `production` |
| `APP_DEBUG` | `false` |
| `APP_KEY` | Generate (`php artisan key:generate --show` locally) |
| `APP_URL` | `https://YOUR-SERVICE.onrender.com` |
| `LOG_CHANNEL` | `stderr` |
| `INERTIA_SSR_ENABLED` | `false` |
| `DB_CONNECTION` | `pgsql` |
| `DB_URL` | Paste Render Postgres **Internal** URL |
| `SESSION_DRIVER` | `database` |
| `SESSION_SECURE_COOKIE` | `true` |
| `CACHE_STORE` | `database` |
| `QUEUE_CONNECTION` | `database` |
| `FILESYSTEM_DISK` | `local` |

**Optional build arguments** (Settings → Build → Docker Build Args):

| Build Arg | Purpose |
|-----------|---------|
| `VITE_APP_NAME` | App name in frontend bundle |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps (or set in System Settings DB) |
| `VITE_DEFAULT_CAMPUS_LAT` | Default map latitude |
| `VITE_DEFAULT_CAMPUS_LNG` | Default map longitude |

**Pre-Deploy Command** (recommended):

```bash
php artisan migrate --force --no-interaction
```

### 3. Create Background Worker (required)

Session reminders use the queue (`SendSessionReminderJob`).

1. **New** → **Background Worker**
2. Same repo, **Docker** runtime, same `Dockerfile`
3. **Docker Command:**

```bash
php artisan queue:work --sleep=3 --tries=3 --max-time=3600
```

4. Copy the **same env vars** as the web service (`APP_KEY`, `DB_URL`, etc.).

### 4. Create Cron Job (required)

Scheduled tasks in `routes/console.php`:

- `attendance:process` — every 10 minutes
- `reminders:process` — every minute
- `activity-logs:prune` — daily at 02:00

1. **New** → **Cron Job**
2. **Schedule:** `* * * * *` (every minute)
3. **Docker Command:**

```bash
php artisan schedule:run
```

4. Same env vars as web service.

---

## First-time database setup

After the first successful deploy, open **Render Shell** on the web service:

```bash
php artisan db:seed --class=PermissionSeeder --force
php artisan db:seed --class=SystemSettingsSeeder --force
```

Run any other seeders your environment needs (roles, admin user, etc.).

Create an admin user if you don't have a seeder:

```bash
php artisan tinker
# User::factory()->create([...]);
```

---

## Environment variables reference

### Required

```env
APP_ENV=production
APP_DEBUG=false
APP_KEY=base64:...
APP_URL=https://your-app.onrender.com
DB_CONNECTION=pgsql
DB_URL=postgresql://user:pass@host/dbname
LOG_CHANNEL=stderr
INERTIA_SSR_ENABLED=false
SESSION_DRIVER=database
SESSION_SECURE_COOKIE=true
QUEUE_CONNECTION=database
CACHE_STORE=database
```

### Mail (session reminders)

```env
MAIL_MAILER=smtp
MAIL_HOST=smtp.mailgun.org
MAIL_PORT=587
MAIL_USERNAME=...
MAIL_PASSWORD=...
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=noreply@yourdomain.com
MAIL_FROM_NAME="Teacher-to-Class MS"
```

Or use [Resend](https://resend.com), Postmark, or SendGrid.

### SMS (optional)

```env
SMS_DRIVER=twilio
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM=+1...
```

---

## Build locally (verify before deploy)

```bash
docker build -t teacher-to-class-ms .
```

Run locally:

```bash
docker run --rm -p 8080:8080 \
  -e PORT=8080 \
  -e APP_KEY=base64:YOUR_KEY_HERE \
  -e APP_ENV=local \
  -e APP_DEBUG=true \
  -e DB_CONNECTION=sqlite \
  -e DB_DATABASE=/var/www/html/database/database.sqlite \
  teacher-to-class-ms
```

For PostgreSQL locally, pass `-e DB_CONNECTION=pgsql -e DB_URL=...`.

Open: http://localhost:8080/up (health) and http://localhost:8080/login

---

## Render-specific notes

### HTTPS, camera, and geolocation

Facial recognition and geolocation require **HTTPS**. Render provides free TLS on `*.onrender.com`. Set:

```env
APP_URL=https://your-exact-render-url.onrender.com
SESSION_SECURE_COOKIE=true
```

`TrustProxies` is configured in `bootstrap/app.php` for Render's load balancer.

### Face-api.js models

Models live in `public/models/face-api/` (~12 MB) and are included in the Docker image. They are loaded from `/models/face-api` when a user enrolls or verifies. No GPU is required — processing is client-side.

### Persistent storage

Render web service disks are **ephemeral**. Uploaded files in `storage/app` may be lost on redeploy. For production file persistence:

- Use **Render Disk** (paid) mounted to `storage/app`, or
- Set `FILESYSTEM_DISK=s3` with AWS S3 / compatible object storage

Face descriptors are stored in the **database** (encrypted), not on disk.

### Free tier limitations

- Web service **spins down** after inactivity (slow cold starts during check-in)
- Cron and worker may require **paid plans** for reliable every-minute scheduling
- PostgreSQL free tier has storage/connection limits

For pilot/production use, upgrade web + worker + cron to **Starter** plans.

### Logs

Use `LOG_CHANNEL=stderr` so logs appear in the Render dashboard.

---

## Troubleshooting

### `composer install` fails during Docker build (exit code 2)

The `composer:2` build image does not include PHP extensions such as `ext-zip`, `ext-gd`, and `ext-dom` that **PhpSpreadsheet** and **DomPDF** require. The Dockerfile uses `--ignore-platform-reqs` in the vendor stage (extensions are installed in the final Apache/PHP stage).

If it still fails:

1. Ensure **`composer.lock` is committed** and matches `composer.json` (run `composer update` locally, commit both files).
2. Check Render build logs for `Your lock file does not contain a compatible set of packages`.

### `composer: command not found`

You are on Render **Native** PHP runtime. Switch the service to **Docker** and set Dockerfile path to `./Dockerfile`.

### 500 error after deploy

**Quick check:** open `https://your-app.onrender.com/up`

| `/up` | `/` (home) | Likely cause |
|-------|------------|--------------|
| 200 OK | 500 | Missing `APP_KEY`, database not linked, or migrations not run (sessions table missing) |
| 500 | 500 | Bootstrap/config issue — check `APP_KEY`, corrupt config cache |

#### Fix checklist (Render dashboard → Environment)

1. **`APP_KEY`** — must be set (32-char base64 string). Generate locally:
   ```bash
   php artisan key:generate --show
   ```
2. **`APP_URL`** — exact public URL, e.g. `https://teacher-to-class-ms-4.onrender.com` (no trailing slash)
3. **`DB_CONNECTION`** = `pgsql`
4. **`DB_URL`** — paste the PostgreSQL **Internal** connection string from your Render database (not External)
5. If Render only shows `DATABASE_URL`, set **`DB_URL`** to the same Internal URL (the app reads both for PostgreSQL)
6. **`SESSION_DRIVER`** = `database`, **`CACHE_STORE`** = `database`, **`QUEUE_CONNECTION`** = `database`
7. **`LOG_CHANNEL`** = `stderr` (so errors appear in Render logs)

#### Run migrations

Shell tab on the web service (or redeploy after linking DB):

```bash
php artisan migrate --force --no-interaction
php artisan db:seed --class=PermissionSeeder --force
php artisan db:seed --class=SystemSettingsSeeder --force
```

#### See the actual error

Temporarily set **`APP_DEBUG=true`**, reload `/`, then check **Logs**. Set back to `false` after fixing.

Also run:

```bash
php artisan config:clear
php artisan migrate:status
```

#### Apache `AH00558 ServerName` warning

Harmless. The Dockerfile sets `ServerName localhost` to suppress it on newer deploys.

### 419 Page Expired on login

Laravel returns **419** when the CSRF token or session cookie is missing on POST (common behind Render’s HTTPS proxy or on cPanel with wrong `APP_URL`).

See also: [CPANEL_DEPLOYMENT.md](./CPANEL_DEPLOYMENT.md#419-page-expired-on-login)

#### Quick fix (Render dashboard)

1. **`APP_URL`** must be `https://your-app.onrender.com` (https, no trailing slash)
2. **`SESSION_SECURE_COOKIE`** — leave unset (auto) or set `true` for HTTPS
3. **Do not set `SESSION_DOMAIN`** — leave it empty. If you set it to the literal word `null`, cookies break.
4. Redeploy, then in Shell:
   ```bash
   php artisan config:clear
   php artisan config:cache
   ```
5. Hard-refresh the browser (Ctrl+Shift+R) or use a private window before logging in again.

#### Quick fix (cPanel)

1. **`APP_URL`** must match the browser URL exactly (including `www` vs non-`www`)
2. **Remove `SESSION_DOMAIN`** from `.env` if present
3. **HTTPS**: leave `SESSION_SECURE_COOKIE` unset; if site has no SSL yet, set `SESSION_SECURE_COOKIE=false`
4. Document root must point to **`public/`**
5. Run `php artisan config:clear && php artisan config:cache` over SSH

#### Code fix (included in repo)

- Trust proxy headers (`X-Forwarded-Proto`, etc.)
- `URL::forceRootUrl()` from `APP_URL` (fixes host mismatch on cPanel)
- Session cookie secure flag auto-detected when `SESSION_SECURE_COOKIE` is unset
- Ignore `SESSION_DOMAIN=null` string
- `/` redirects to `/login` for a consistent session/CSRF flow

### Assets missing / blank page

Ensure the Docker build completed the **assets** stage (`npm run build`). Check build logs for Node errors. Rebuild with cache cleared if needed.

### Excel export fails

The image includes PHP **`gd`** for PhpSpreadsheet. If you customize the Dockerfile, keep `gd` installed.

### Queue / reminders not sending

1. Confirm **Background Worker** is running
2. Confirm `QUEUE_CONNECTION=database`
3. Check `jobs` table for failed jobs: `php artisan queue:failed`

### Scheduler not running

1. Confirm **Cron Job** exists with schedule `* * * * *`
2. Command must be: `php artisan schedule:run`

### Permission denied on `storage/`

The entrypoint runs:

```bash
chown -R www-data:www-data storage bootstrap/cache
chmod -R ug+rwx storage bootstrap/cache
```

If issues persist, Shell:

```bash
chmod -R ug+rwx storage bootstrap/cache
php artisan storage:link --force
```

---

## CI/CD with GitHub

Render auto-deploys on push when enabled in service settings. Your repo already has GitHub Actions for tests (`.github/workflows/tests.yml`). Recommended flow:

1. Push to `main`
2. GitHub Actions runs Pest + `npm run build`
3. Render builds Docker image and deploys
4. Pre-deploy runs migrations

Optional: add a deploy workflow that only triggers Render after CI passes (Render deploy hook URL).

---

## Cost estimate (Render)

| Service | Plan | Approx. cost |
|---------|------|--------------|
| Web (Docker) | Starter | $7/mo |
| Worker | Starter | $7/mo |
| Cron | Starter | $1/mo |
| PostgreSQL | Starter | $7/mo |
| **Total** | | **~$22/mo** |

Free tier is possible for demos but **not recommended** for attendance check-in windows (cold starts + cron limits).

---

## File reference

| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage build (Composer + Node + Apache/PHP) |
| `.dockerignore` | Keeps image small |
| `docker/entrypoint.sh` | PORT, permissions, caches |
| `docker/apache/000-default.conf` | Apache vhost → `public/` |
| `docker/php/conf.d/laravel.ini` | PHP limits & opcache |
| `render.yaml` | Infrastructure-as-code Blueprint |

---

## Checklist before go-live

- [ ] Web service uses **Docker** runtime
- [ ] PostgreSQL connected via `DB_URL`
- [ ] `APP_URL` set to HTTPS URL
- [ ] `APP_DEBUG=false`
- [ ] Migrations run
- [ ] Seeders run (permissions, settings)
- [ ] Background worker running
- [ ] Cron job `* * * * *` → `schedule:run`
- [ ] Mail configured (reminders)
- [ ] `public/models/face-api` present in deployed image
- [ ] Test login, attendance check-in, face verification over HTTPS
