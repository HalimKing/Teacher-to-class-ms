import { type FaceCaptureResult } from '@/lib/face-recognition';
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

export function buildFaceVerificationRequest(timetableId: number, result: FaceCaptureResult): Record<string, unknown> {
    if (result.image) {
        return {
            timetable_id: timetableId,
            image: result.image,
            liveness_frames: result.livenessFrames ?? [],
        };
    }

    if (!result.descriptor) {
        throw new Error('Face capture failed. Please try again.');
    }

    return buildFaceVerificationPayload(timetableId, result.descriptor, result.quality);
}

export function buildFaceAttendanceProof(result: FaceCaptureResult, token: string): Record<string, unknown> {
    if (result.image) {
        return {
            face_verification_token: token,
        };
    }

    return {
        face_descriptor: result.descriptor,
        face_verification_token: token,
        quality: result.quality,
    };
}
