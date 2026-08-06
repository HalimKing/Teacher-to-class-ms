let cachedToken: string | null = null;

function readMetaToken(): string {
    return (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)?.content || '';
}

/**
 * Prefer the Inertia-shared / meta CSRF token.
 * Do not read the XSRF-TOKEN cookie — Laravel encrypts it, and Axios/Inertia
 * already handle X-XSRF-TOKEN decryption on the server for those requests.
 */
export function getCsrfToken(): string {
    if (cachedToken) {
        return cachedToken;
    }

    cachedToken = readMetaToken();
    return cachedToken;
}

export function setCsrfToken(token: string): void {
    if (!token) {
        return;
    }

    cachedToken = token;

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
    }
}

export async function refreshCsrfToken(): Promise<string> {
    const response = await fetch('/csrf-token', {
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
    });

    if (!response.ok) {
        throw new Error('Unable to refresh security token. Please reload the page and try again.');
    }

    const payload = (await response.json()) as { token?: string };

    if (!payload.token) {
        throw new Error('Unable to refresh security token. Please reload the page and try again.');
    }

    setCsrfToken(payload.token);

    return payload.token;
}
