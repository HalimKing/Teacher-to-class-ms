import { ensureFreshCsrfToken, getCsrfToken, refreshCsrfToken } from '@/lib/csrf';

export class HttpError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly payload?: unknown,
    ) {
        super(message);
        this.name = 'HttpError';
    }
}

const CSRF_RETRY_FAILED_MESSAGE =
    'Security token expired. Please refresh the page and try again.';

function requestMethod(options: RequestInit): string {
    return (options.method || 'GET').toUpperCase();
}

function isMutatingMethod(method: string): boolean {
    return !['GET', 'HEAD', 'OPTIONS'].includes(method);
}

function resolveLoginRedirect(): string {
    const path = window.location.pathname || '';

    if (path.startsWith('/attendance')) {
        return '/attendance';
    }

    return '/login';
}

function isCsrfMismatchMessage(message: string | null | undefined): boolean {
    if (!message) {
        return false;
    }

    const normalized = message.toLowerCase();

    return (
        normalized.includes('csrf') ||
        normalized.includes('token mismatch') ||
        normalized.includes('page expired')
    );
}

export async function apiJsonRequest<T>(url: string, options: RequestInit = {}, retried = false): Promise<T> {
    const method = requestMethod(options);

    if (isMutatingMethod(method)) {
        // Proactively sync before POSTs (face verify / check-in often follow long camera idle).
        try {
            await ensureFreshCsrfToken({ force: retried });
        } catch {
            throw new HttpError(CSRF_RETRY_FAILED_MESSAGE, 419);
        }
    }

    const headers = new Headers(options.headers || {});
    headers.set('Accept', 'application/json');
    headers.set('X-Requested-With', 'XMLHttpRequest');
    // Always set after merging caller headers so a stale X-CSRF-TOKEN cannot win.
    headers.set('X-CSRF-TOKEN', getCsrfToken());

    if (options.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, {
        credentials: 'same-origin',
        ...options,
        cache: 'no-store',
        headers,
    });

    if (response.status === 419 && !retried) {
        try {
            await refreshCsrfToken();
        } catch {
            throw new HttpError(CSRF_RETRY_FAILED_MESSAGE, 419);
        }

        return apiJsonRequest<T>(url, options, true);
    }

    let payload: Record<string, unknown> = {};

    try {
        payload = (await response.json()) as Record<string, unknown>;
    } catch {
        payload = {};
    }

    if (!response.ok) {
        if (response.status === 419 || isCsrfMismatchMessage(typeof payload.message === 'string' ? payload.message : null)) {
            throw new HttpError(CSRF_RETRY_FAILED_MESSAGE, response.status === 419 ? 419 : response.status, payload);
        }

        if (response.status === 401) {
            const message =
                (typeof payload.message === 'string' && payload.message) ||
                'Your session expired. Please sign in again.';

            // Soft redirect for attendance/API flows after auth loss.
            if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
                window.setTimeout(() => {
                    window.location.assign(resolveLoginRedirect());
                }, 1500);
            }

            throw new HttpError(message, 401, payload);
        }

        const errors = payload.errors as Record<string, string[]> | undefined;
        const message =
            (typeof payload.message === 'string' && payload.message) ||
            (errors ? Object.values(errors).flat()[0] : null) ||
            'Something went wrong. Please try again.';

        throw new HttpError(message, response.status, payload);
    }

    return payload as T;
}

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
    if (error instanceof HttpError) {
        if (error.status === 419 || isCsrfMismatchMessage(error.message)) {
            return CSRF_RETRY_FAILED_MESSAGE;
        }

        return error.message;
    }

    if (error instanceof Error && error.message) {
        if (isCsrfMismatchMessage(error.message)) {
            return CSRF_RETRY_FAILED_MESSAGE;
        }

        return error.message;
    }

    return fallback;
}
