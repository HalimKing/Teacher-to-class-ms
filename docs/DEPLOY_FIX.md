# Deployment fix guide (419 / login not working)

Both **Render** and **cPanel** fail the same way: the server never sends **session cookies**, so login returns **419 Page Expired**.

This is not a password problem. The browser never receives `teacher_to_class_ms_session` or `XSRF-TOKEN`.

---

## Step 1 — Deploy the latest code (required)

Configuration alone is not enough. You must upload/deploy the **current repository**, including:

- `bootstrap/app.php` (proxy trust)
- `app/Providers/AppServiceProvider.php` (APP_URL fix)
- `config/session.php`
- `public/.htaccess` (StackCDN no-cache headers)
- `routes/web.php` (`/deploy-check` route)
- `docker/entrypoint.sh` (Render)

**Render:** push to Git → Manual Deploy → **Clear build cache**

**cPanel:** upload changed files via FTP/Git, or pull on server, then:

```bash
composer install --no-dev --optimize-autoloader
php artisan config:clear
php artisan migrate --force
chmod -R ug+rwx storage bootstrap/cache
```

**Do not run `php artisan config:cache` on cPanel** until login works.

---

## Step 2 — Run the deploy check

Open in your browser (or Network tab):

| Platform | URL |
|----------|-----|
| Render | https://teacher-to-class-ms-4.onrender.com/deploy-check |
| cPanel | https://teacher-to-class-attendance-app.maaliyiri.com/deploy-check |

### What you should see

**JSON body** with `"session_id": "..."` and `"app_url"` matching your domain.

**Response headers** must include:

```
Set-Cookie: XSRF-TOKEN=...
Set-Cookie: teacher_to_class_ms_session=...
```

### If JSON works but NO Set-Cookie

| Host | Fix |
|------|-----|
| **cPanel / maaliyiri.com** | Disable **StackCDN / StackCache** → uncheck “Remove PHP Session Cookies From All Pages” → purge cache |
| **Render** | Set `APP_URL` exactly → redeploy with clear cache → check deploy logs for `session:diagnose` |

---

## Step 3 — Environment (copy exactly)

### Render

```env
APP_URL=https://teacher-to-class-ms-4.onrender.com
APP_NAME=Teacher-to-Class-MS
APP_ENV=production
APP_DEBUG=false
DB_CONNECTION=pgsql
DB_URL=<Internal PostgreSQL URL>
SESSION_DRIVER=database
CACHE_STORE=database
LOG_CHANNEL=stderr
```

Do **not** set `SESSION_DOMAIN`.

### cPanel

```env
APP_URL=https://teacher-to-class-attendance-app.maaliyiri.com
APP_NAME=Teacher-to-Class-MS
APP_ENV=production
APP_DEBUG=false
DB_CONNECTION=mysql
DB_HOST=localhost
DB_DATABASE=...
DB_USERNAME=...
DB_PASSWORD=...
SESSION_DRIVER=database
CACHE_STORE=database
```

Do **not** use SQLite. Do **not** set `SESSION_DOMAIN`.

---

## Step 4 — cPanel only: disable StackCDN

Your responses include `x-provided-by: StackCDN`. That CDN **removes session cookies** by default.

In **StackCP / 20i** → **StackCache**:

1. Uncheck **Remove PHP Session Cookies From All Pages**
2. Purge CDN cache
3. Or disable StackCDN for this site

---

## Step 5 — Test login

1. Private/incognito window
2. Open `/login`
3. DevTools → Network → GET `login` → confirm **Set-Cookie**
4. Log in

---

## Still stuck?

Run on the server:

```bash
php artisan session:diagnose
php artisan migrate:status
```

Temporarily set `APP_DEBUG=true`, reload `/deploy-check`, check `storage/logs/laravel.log`.

Share the **JSON from `/deploy-check`** and whether **Set-Cookie** appears (yes/no) — that pinpoints the fix in one step.

---

## Recommendation

Fix **one platform first** (cPanel is your production URL). Once `/deploy-check` shows Set-Cookie and login works, apply the same pattern to Render.
