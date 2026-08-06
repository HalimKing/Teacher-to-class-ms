import { getCsrfToken, refreshCsrfToken } from '@/lib/csrf';

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

export async function apiJsonRequest<T>(url: string, options: RequestInit = {}, retried = false): Promise<T> {
    const response = await fetch(url, {
        credentials: 'same-origin',
        ...options,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': getCsrfToken(),
            'X-Requested-With': 'XMLHttpRequest',
            ...(options.headers || {}),
        },
    });

    if (response.status === 419 && !retried) {
        await refreshCsrfToken();
        return apiJsonRequest<T>(url, options, true);
    }

    let payload: Record<string, unknown> = {};

    try {
        payload = (await response.json()) as Record<string, unknown>;
    } catch {
        payload = {};
    }

    if (!response.ok) {
        const errors = payload.errors as Record<string, string[]> | undefined;
        const message =
            (typeof payload.message === 'string' && payload.message) ||
            (errors ? Object.values(errors).flat()[0] : null) ||
            (response.status === 419
                ? 'Your session expired. Please reload the page and try again.'
                : 'Something went wrong. Please try again.');

        throw new HttpError(message, response.status, payload);
    }

    return payload as T;
}

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
    if (error instanceof HttpError) {
        return error.message;
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }

    return fallback;
}
