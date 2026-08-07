# CSRF Token Sync — Face Recognition Attendance

## Root cause

Face attendance (verify → check-in / check-out) uses `fetch` with the `X-CSRF-TOKEN` header via `apiJsonRequest`. The SPA often sits idle for minutes inside the camera modal. During that idle window the client can keep a **stale cached CSRF token** after:

- session regenerate on login / logout
- attendance portal timeout (`regenerateToken()`)
- another tab signing out

A secondary issue was concurrent 419 retries racing multiple `/csrf-token` refreshes, and caller `headers` being able to override a freshly refreshed `X-CSRF-TOKEN`.

CSRF protection itself was **not** disabled and routes were **not** excluded.

## Permanent fix

1. **`resources/js/lib/csrf.ts`**
   - Single-flight `refreshCsrfToken()` mutex
   - `ensureFreshCsrfToken()` revalidates when missing/stale (>5 minutes) or forced
   - Documented sync strategy (meta / Inertia shared `csrf_token`, never encrypted cookie)

2. **`resources/js/lib/http.ts`**
   - Proactive `ensureFreshCsrfToken()` before mutating methods
   - Always set `X-CSRF-TOKEN` **after** merging caller headers (fresh token wins)
   - One forced refresh + retry on 419
   - Clearer 401 handling with redirect to `/attendance` or `/login`

3. **`resources/js/components/face/FaceCaptureModal.tsx`**
   - Force CSRF refresh when the modal opens and again immediately before capture submit

4. **`resources/js/app.tsx`**
   - Sync token from initial Inertia props / navigation
   - Refresh on `visibilitychange` when the tab becomes visible again

5. **`CsrfTokenController`**
   - `Cache-Control: no-store` so CDNs/browsers cannot cache `/csrf-token`

6. **Portal expiry**
   - `EnsureAttendancePortalSession` returns JSON **401** for AJAX instead of an HTML redirect (avoids confusing “CSRF”/parse errors after idle portal sessions)

## Maintenance notes

- Do not add attendance routes to CSRF `$except`.
- Prefer `apiJsonRequest` / `teacherJsonRequest` for all face attendance POSTs.
- Laravel skips CSRF checks under `runningUnitTests()`; feature tests assert token endpoint + portal 401 behavior instead of 419.
