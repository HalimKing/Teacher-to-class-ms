# Deploy to a VPS from GitHub Actions

Pushes to `main` run tests, then GitHub Actions rsyncs the app to your VPS and runs Composer, migrations, and Laravel caches. Render stays optional: it deploys only if `RENDER_DEPLOY_HOOK_URL` is set.

The VPS keeps its own `.env`, uploaded files, and logs. Frontend assets are built in CI (`public/build` is gitignored).

## One-time server setup

1. Create the app directory (GitHub Actions will upload the code):

```bash
sudo mkdir -p /var/www/teacher-to-class-ms
sudo chown -R "$USER":"$USER" /var/www/teacher-to-class-ms
```

2. After the first rsync (or after cloning once), create production `.env` on the server. GitHub Actions never overwrites this file:

```bash
cp /var/www/teacher-to-class-ms/.env.example /var/www/teacher-to-class-ms/.env
# set APP_KEY, APP_URL, database, mail, etc.
php /var/www/teacher-to-class-ms/artisan key:generate --force
```

3. Point the web server document root at `public/` (Nginx/Apache/Caddy).
4. Install PHP 8.3+, Composer, PostgreSQL PHP extensions, and `rsync`.
5. Keep a scheduler and queue worker running (systemd, Supervisor, or cron). Deploy only runs `php artisan queue:restart`.

## SSH key for GitHub Actions

On your laptop (or GitHub’s runner is not needed for this step):

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f github-actions-vps -N ""
```

On the VPS, append the **public** key to the deploy user’s `~/.ssh/authorized_keys`.

In GitHub: **Settings → Secrets and variables → Actions**:

| Secret | Required | Example |
|--------|----------|---------|
| `VPS_HOST` | yes | `192.0.2.10` or `vps.example.com` |
| `VPS_USERNAME` | yes | `deploy` |
| `VPS_SSH_PRIVATE_KEY` | yes | Full private key, including `BEGIN/END` lines |
| `VPS_APP_DIR` | yes | `/var/www/teacher-to-class-ms` |
| `VPS_PORT` | no | `22` |
| `VPS_PHP_BIN` | no | `php` or `/usr/bin/php8.3` |
| `VPS_SSH_KNOWN_HOSTS` | no | Output of `ssh-keyscan -p 22 your.vps.host` |

Optional Render secrets are listed in `docs/RENDER_DEPLOYMENT.md`. If they are absent, the Render job is skipped.

## What each deploy does

1. Pest tests + `npm run build` on GitHub
2. `rsync` application files to `VPS_APP_DIR` (does **not** overwrite `.env` or `storage/`)
3. On the server: `scripts/vps-release.sh`
   - `composer install --no-dev`
   - `php artisan migrate --force`
   - `php artisan optimize`
   - `php artisan queue:restart`

## Manual deploy

Actions tab → **tests** → **Run workflow** (branch `main`).
