import { type FaceCaptureResult, type FaceDetectionIssue, type FaceFrameAssessment } from '@/lib/face-recognition';
import { apiJsonRequest } from '@/lib/http';
import { buildFaceVerificationRequest } from '@/lib/teacher-api';

export type FaceEngine = 'face_api' | 'arcface';

export interface FaceVerificationResult {
    verified: boolean;
    matchScore: number;
    threshold: number;
    livenessPassed: boolean;
    qualityScore: number;
    processingTimeMs: number;
    reason?: string;
}

const POSE_GUIDANCE = [
    'Look directly at the camera and hold still.',
    'Turn your head slightly left and hold still.',
    'Turn your head slightly right and hold still.',
];

export function resolveFaceEngine(explicit?: string | null, settingsValue?: unknown): FaceEngine {
    const value = explicit || settingsValue;

    return value === 'arcface' ? 'arcface' : 'face_api';
}

export function poseGuidance(sampleIndex: number): string {
    return POSE_GUIDANCE[sampleIndex] ?? 'Hold still.';
}

export function staffMessageForStatus(status: string | null | undefined): string {
    switch (status) {
        case 'NO_FACE':
            return 'No face detected. Please position your face inside the guide.';
        case 'MULTIPLE_FACES':
            return 'Multiple faces detected. Please ensure only you are visible.';
        case 'FACE_TOO_DARK':
            return 'The lighting is too low. Move to a brighter location.';
        case 'FACE_TOO_BLURRY':
            return 'The image is not clear enough. Hold still and try again.';
        case 'FACE_TOO_SMALL':
            return 'Move closer to the camera.';
        case 'FACE_POOR_POSITION':
            return 'Look directly at the camera and center your face in the guide.';
        case 'LIVENESS_FAILED':
            return 'A live face could not be verified. Please try again.';
        case 'PRESENTATION_ATTACK':
            return 'A possible photograph or screen presentation was detected.';
        case 'LIVENESS_UNAVAILABLE':
            return 'Face verification is temporarily unavailable. Please try again shortly.';
        case 'NOT_ENROLLED':
        case 'MIGRATION_REQUIRED':
            return 'Face verification is not available for your account. Please contact an administrator.';
        case 'NOT_MATCHED':
            return 'Face not recognized. Please try again.';
        default:
            return 'Face verification is temporarily unavailable. Please try again shortly.';
    }
}

export function captureVideoFrame(video: HTMLVideoElement, maxWidth = 640): string {
    const sourceWidth = video.videoWidth || 640;
    const sourceHeight = video.videoHeight || 480;
    const scale = Math.min(1, maxWidth / sourceWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Face capture failed. Please try again.');
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const encoded = dataUrl.split(',')[1];

    if (!encoded) {
        throw new Error('Face capture failed. Please try again.');
    }

    return encoded;
}

export async function captureLivenessBurst(video: HTMLVideoElement): Promise<{ image: string; frames: string[] }> {
    const frames: string[] = [];
    for (let index = 0; index < 3; index += 1) {
        frames.push(captureVideoFrame(video));
        if (index < 2) {
            await wait(120);
        }
    }

    return {
        image: frames[1] ?? frames[0],
        frames,
    };
}

export async function assessLocalFrame(video: HTMLVideoElement): Promise<FaceFrameAssessment> {
    if (!video || video.readyState < 2 || video.videoWidth === 0) {
        return {
            issue: 'camera_not_ready',
            guidance: 'Starting camera…',
            confidence: null,
            faceBox: null,
        };
    }

    const detector = createFaceDetector();
    if (detector) {
        try {
            const faces = await detector.detect(video);
            return assessmentFromBoxes(faces, video.videoWidth, video.videoHeight);
        } catch {
            // Fall through to a lightweight brightness check. The server remains the authority.
        }
    }

    const brightness = sampleCenterBrightness(video);
    if (brightness === null) {
        return {
            issue: 'camera_not_ready',
            guidance: 'Starting camera…',
            confidence: null,
            faceBox: null,
        };
    }

    if (brightness < 35) {
        return {
            issue: 'low_confidence',
            guidance: 'The lighting is too low. Move to a brighter location.',
            confidence: null,
            faceBox: null,
        };
    }

    return {
        issue: 'ok',
        guidance: 'Hold still.',
        confidence: null,
        faceBox: null,
    };
}

function createFaceDetector(): { detect: (input: HTMLVideoElement) => Promise<Array<{ boundingBox: DOMRectReadOnly }>> } | null {
    const Detector = (window as Window & { FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => { detect: (input: HTMLVideoElement) => Promise<Array<{ boundingBox: DOMRectReadOnly }>> } }).FaceDetector;
    if (!Detector) {
        return null;
    }

    return new Detector({ fastMode: true, maxDetectedFaces: 2 });
}

function assessmentFromBoxes(
    faces: Array<{ boundingBox: DOMRectReadOnly }>,
    frameWidth: number,
    frameHeight: number,
): FaceFrameAssessment {
    if (faces.length === 0) {
        return { issue: 'no_face', guidance: 'Position your face inside the guide.', confidence: null, faceBox: null };
    }

    if (faces.length > 1) {
        return { issue: 'multiple_faces', guidance: 'Only one person should be visible.', confidence: null, faceBox: null };
    }

    const box = faces[0].boundingBox;
    const faceBox = { x: box.x, y: box.y, width: box.width, height: box.height };
    let issue: FaceDetectionIssue = 'ok';

    if (box.width < 90 || box.height < 90) {
        issue = 'too_small';
    } else if (box.width > frameWidth * 0.85 || box.height > frameHeight * 0.9) {
        issue = 'too_large';
    } else {
        const offsetX = Math.abs(box.x + box.width / 2 - frameWidth / 2) / frameWidth;
        const offsetY = Math.abs(box.y + box.height / 2 - frameHeight / 2) / frameHeight;
        if (offsetX > 0.22) {
            issue = 'off_center';
        } else if (offsetY > 0.22) {
            issue = 'off_center';
        }
    }

    const guidance =
        issue === 'too_small'
            ? 'Move closer.'
            : issue === 'too_large'
              ? 'Move farther away.'
              : issue === 'off_center'
                ? box.x + box.width / 2 < frameWidth / 2
                    ? 'Move slightly right.'
                    : 'Move slightly left.'
                : 'Look directly at the camera.';

    return {
        issue,
        guidance: issue === 'ok' ? 'Hold still.' : guidance,
        confidence: null,
        faceBox,
    };
}

function sampleCenterBrightness(video: HTMLVideoElement): number | null {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 24;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
        return null;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(8, 4, 16, 16).data;
    let total = 0;
    let count = 0;
    for (let index = 0; index < pixels.length; index += 4) {
        total += (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3;
        count += 1;
    }

    return count === 0 ? null : total / count;
}

function wait(milliseconds: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export async function enrollFace(teacherId: number, result: FaceCaptureResult): Promise<{ message?: string; face_enrollment_status?: string; face_registered_at?: string }> {
    const body = result.image
        ? { images: result.images && result.images.length > 0 ? result.images : [result.image] }
        : { face_descriptor: result.descriptor, quality: result.quality };

    return apiJsonRequest(route('admin.teachers.face-enrollment.store', teacherId), {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export async function verifyFace<T>(url: string, timetableId: number, result: FaceCaptureResult): Promise<T> {
    return apiJsonRequest<T>(url, {
        method: 'POST',
        body: JSON.stringify(buildFaceVerificationRequest(timetableId, result)),
    });
}

export async function checkLiveness(frames: string[]): Promise<{ liveness?: boolean; message?: string }> {
    return { liveness: frames.length >= 2 };
}

export async function detectFace(video: HTMLVideoElement): Promise<FaceFrameAssessment> {
    return assessLocalFrame(video);
}
