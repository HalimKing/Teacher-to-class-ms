# cPanel Deployment Guide

Deploy **teacher-to-class-ms** on shared cPanel hosting (Apache/LiteSpeed + PHP 8.3+ + MySQL/MariaDB).

---

## 1. Server requirements

| Requirement | Minimum |
|-------------|---------|
| PHP | 8.3+ |
| Extensions | `bcmath`, `ctype`, `curl`, `dom`, `fileinfo`, `gd`, `json`, `mbstring`, `openssl`, `pdo`, `pdo_mysql`, `tokenizer`, `xml`, `zip` |
| Database | MySQL 8+ or MariaDB 10.6+ |
| Composer | Available via SSH or locally before upload |
| Node.js | Build assets **locally** (`npm run build`); upload `public/build` |

---

## 2. Recommended folder layout

**Option A — document root = `public/` (best)**

Point the domain’s document root to:

```
/home/username/teacher-to-class-ms/public
```

**Option B — app inside `public_html`**

If you must use `public_html`, either:

- Symlink `public_html` → `teacher-to-class-ms/public`, or
- Copy only `public/*` into `public_html` and adjust `index.php` paths (not recommended)

Never expose `storage/`, `.env`, or `vendor/` as web-accessible.

---

## 3. Environment (`.env` on server)

```env
APP_NAME="Teacher-to-Class-MS"
APP_ENV=production
APP_DEBUG=false
APP_KEY=base64:...your-key...
APP_URL=https://yourdomain.com

DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=your_db_name
DB_USERNAME=your_db_user
DB_PASSWORD=your_db_password

SESSION_DRIVER=database
SESSION_LIFETIME=120
# Leave SESSION_DOMAIN unset (do NOT set to the word "null")
# Leave SESSION_SECURE_COOKIE unset — Laravel auto-detects HTTPS

CACHE_STORE=database
QUEUE_CONNECTION=database
LOG_CHANNEL=single
```

### Critical: `APP_URL` must match how users open the site

| You open in browser | `APP_URL` |
|---------------------|-----------|
| `https://example.com` | `https://example.com` |
| `https://www.example.com` | `https://www.example.com` |

**www and non-www are different sites for cookies.** Pick one and redirect the other in cPanel or `.htaccess`.

---

## 4. Deploy steps (SSH)

```bash
cd ~/teacher-to-class-ms

composer install --no-dev --optimize-autoloader
npm ci && npm run build   # or build locally and upload public/build

php artisan key:generate   # once, if APP_KEY empty
php artisan migrate --force
php artisan db:seed --class=PermissionSeeder --force
php artisan db:seed --class=SystemSettingsSeeder --force
php artisan storage:link
php artisan config:cache
php artisan view:cache
```

### Permissions

```bash
chmod -R ug+rwx storage bootstrap/cache
```

---

## 5. Cron (scheduler)

cPanel → **Cron Jobs** → every minute:

```bash
cd /home/username/teacher-to-class-ms && /usr/local/bin/php artisan schedule:run >> /dev/null 2>&1
```

Use **Setup Cron Job** path from cPanel (PHP binary path varies by host).

---

## 6. Queue worker (optional)

Shared hosting often has no long-running workers. Options:

- Use `QUEUE_CONNECTION=database` and a cron every minute: `php artisan queue:work --stop-when-empty`
- Or use an external worker / VPS for production reminders

---

## Troubleshooting

### 419 Page Expired on login

Laravel could not match the CSRF token because the **session cookie was not sent** on POST.

#### Checklist (most common on cPanel)

1. **`APP_URL`** — exact match including `https://` and **www vs non-www**
2. **`SESSION_DOMAIN`** — **remove** this variable entirely (empty). Never set it to the literal string `null`.
3. **`SESSION_SECURE_COOKIE`**
   - Site on **HTTPS** → leave unset (auto) or set `true`
   - Site on **HTTP only** (no SSL) → set `false`
4. **Document root** must be the `public/` folder
5. **Subfolder install** (e.g. `example.com/app/`) — set `SESSION_PATH=/app/` and update `.env` `APP_URL` accordingly
6. After any `.env` change:
   ```bash
   php artisan config:clear
   php artisan config:cache
   ```
7. Hard-refresh browser or use a private window
8. **Cloudflare** — SSL mode “Full” or “Full (strict)”; app already trusts proxy headers

#### Verify session cookie in browser

1. Open DevTools → Application → Cookies
2. Load `/login`
3. Confirm a cookie like `teacher_to_class_ms_session` exists
4. Submit login — same cookie must still be sent on the POST request

If the cookie is missing after step 2, fix `APP_URL` / `SESSION_DOMAIN` / HTTPS settings first.

#### No `Set-Cookie` header at all (Network tab)

If the **login page HTML loads** but Response Headers have **no `Set-Cookie`**, Laravel is not starting a session. Common on cPanel:

1. **Inspect the correct request** — click the **document** row (`login`, type `document`), not JS/CSS files.
2. **LiteSpeed cache** — cPanel may serve a cached HTML page without cookies. Disable **LiteSpeed Cache** for this domain, or deploy the repo `.htaccess` (`CacheDisable` + `DirectoryIndex index.php`).
3. **Stale config cache** after `.env` edits:
   ```bash
   php artisan config:clear
   php artisan config:cache
   ```
4. **Run diagnostics** (after uploading latest code):
   ```bash
   php artisan session:diagnose
   ```
5. **`sessions` table missing** (when `SESSION_DRIVER=database`):
   ```bash
   php artisan migrate --force
   ```
6. **Test with file sessions** temporarily:
   ```env
   SESSION_DRIVER=file
   ```
   Then `config:clear`, reload `/login`. If `Set-Cookie` appears, fix database/migrations.

7. **Delete `public/index.html`** if it exists on the server — Apache serves it instead of `index.php`, bypassing Laravel entirely.

#### www redirect (example)

In `public/.htaccess` **before** other rules (only if you standardize on non-www):

```apache
RewriteCond %{HTTP_HOST} ^www\.(.+)$ [NC]
RewriteRule ^ https://%1%{REQUEST_URI} [L,R=301]
```

### 500 Server Error

- Check `storage/logs/laravel.log`
- Run `php artisan migrate:status`
- Ensure `storage/` and `bootstrap/cache/` are writable
- Temporarily set `APP_DEBUG=true` to see the error (disable after fixing)

### Blank page / missing CSS

- Run `npm run build` and upload `public/build/`
- Run `php artisan view:clear`

### Permission denied / 403

- Document root should be `public/`, not project root
- Check folder permissions on `storage/` and `bootstrap/cache/`
