/**
 * CSRF token sync for Inertia + fetch-based APIs (face attendance, etc.).
 *
 * Root cause of prior mismatches:
 * - Face capture keeps the SPA idle for minutes without Inertia navigation,
 *   so the cached/meta token can drift after session regenerate (login, portal
 *   timeout, another tab logout).
 * - Concurrent 419 responses each called refresh without a mutex.
 * - Callers could override X-CSRF-TOKEN via options.headers after refresh.
 *
 * Strategy:
 * - Prefer Inertia-shared / meta token; refresh via GET /csrf-token.
 * - Single-flight refresh; proactive refresh for stale/idle mutating requests.
 * - Never disable VerifyCsrfToken.
 */

let cachedToken: string | null = null;
let lastSyncedAt = 0;
let refreshInFlight: Promise<string> | null = null;

/** Re-validate with the server if the client token is older than this. */
const CSRF_MAX_AGE_MS = 5 * 60 * 1000;

function readMetaToken(): string {
    return (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)?.content || '';
}

/**
 * Prefer the Inertia-shared / meta CSRF token.
 * Do not read the XSRF-TOKEN cookie — Laravel encrypts it for Axios/Inertia
 * X-XSRF-TOKEN decryption; fetch clients should use the plain token instead.
 */
export function getCsrfToken(): string {
    if (cachedToken) {
        return cachedToken;
    }

    cachedToken = readMetaToken();
    return cachedToken;
}

export function clearCsrfTokenCache(): void {
    cachedToken = null;
    lastSyncedAt = 0;
}

export function setCsrfToken(token: string): void {
    if (!token) {
        return;
    }

    cachedToken = token;
    lastSyncedAt = Date.now();

    const meta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null;
    if (meta) {
        meta.content = token;
    }
}

export function syncCsrfToken(token?: string | null): void {
    if (token) {
        setCsrfToken(token);
        return;
    }

    const fromMeta = readMetaToken();
    if (fromMeta) {
        cachedToken = fromMeta;
        if (!lastSyncedAt) {
            lastSyncedAt = Date.now();
        }
    }
}

export function isCsrfTokenStale(maxAgeMs = CSRF_MAX_AGE_MS): boolean {
    if (!getCsrfToken()) {
        return true;
    }

    if (!lastSyncedAt) {
        return true;
    }

    return Date.now() - lastSyncedAt >= maxAgeMs;
}

/**
 * Fetch a token that matches the current server session.
 * Concurrent callers share one in-flight request.
 */
export async function refreshCsrfToken(): Promise<string> {
    if (refreshInFlight) {
        return refreshInFlight;
    }

    refreshInFlight = (async () => {
        clearCsrfTokenCache();

        const response = await fetch('/csrf-token', {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store',
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
        });

        if (!response.ok) {
            throw new Error('Security token expired. Please refresh the page and try again.');
        }

        const payload = (await response.json()) as { token?: string };

        if (!payload.token) {
            throw new Error('Security token expired. Please refresh the page and try again.');
        }

        setCsrfToken(payload.token);

        return payload.token;
    })().finally(() => {
        refreshInFlight = null;
    });

    return refreshInFlight;
}

/**
 * Ensure the client holds a usable CSRF token before mutating requests.
 * Forces a server round-trip when missing, stale, or explicitly requested
 * (e.g. immediately before face verify / check-in after camera idle).
 */
export async function ensureFreshCsrfToken(options: { force?: boolean } = {}): Promise<string> {
    if (!options.force && !isCsrfTokenStale()) {
        return getCsrfToken();
    }

    return refreshCsrfToken();
}
