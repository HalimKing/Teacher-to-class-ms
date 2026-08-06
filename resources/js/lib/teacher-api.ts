import { apiJsonRequest, getApiErrorMessage } from '@/lib/http';

export { getApiErrorMessage };

export async function teacherJsonRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
    return apiJsonRequest<T>(url, options);
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
