const csrfToken = () => (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
    if (error && typeof error === 'object' && 'response' in error) {
        const response = (error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response;
        const data = response?.data;

        if (data?.message) {
            return data.message;
        }

        if (data?.errors) {
            const firstError = Object.values(data.errors).flat()[0];
            if (firstError) {
                return firstError;
            }
        }
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }

    return fallback;
}

export async function teacherJsonRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
        credentials: 'same-origin',
        ...options,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrfToken(),
            'X-Requested-With': 'XMLHttpRequest',
            ...(options.headers || {}),
        },
    });

    const payload = await response.json();

    if (!response.ok) {
        const message =
            payload.message ||
            (payload.errors ? Object.values(payload.errors).flat()[0] : null) ||
            'Something went wrong. Please try again.';

        throw new Error(message);
    }

    return payload as T;
}

export function buildFaceVerificationPayload(
    timetableId: number,
    descriptor: number[],
    quality: Record<string, unknown>,
): Record<string, unknown> {
    if (!Array.isArray(descriptor) || descriptor.length !== 128) {
        throw new Error('Face capture failed to produce a valid descriptor. Please try again.');
    }

    return {
        timetable_id: timetableId,
        face_descriptor: descriptor,
        quality,
    };
}
