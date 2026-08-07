type FaceApi = typeof import('face-api.js');

export type FaceDetectionIssue =
    | 'ok'
    | 'no_face'
    | 'multiple_faces'
    | 'too_small'
    | 'too_large'
    | 'off_center'
    | 'low_confidence'
    | 'unstable'
    | 'camera_not_ready';

export interface FaceCaptureResult {
    descriptor: number[];
    quality: {
        detection_confidence: number;
        face_width: number;
        face_height: number;
        frame_count: number;
        descriptor_variance: number;
    };
}

export interface FaceFrameAssessment {
    issue: FaceDetectionIssue;
    guidance: string;
    confidence: number | null;
    faceBox: { x: number; y: number; width: number; height: number } | null;
}

export class FaceCaptureError extends Error {
    constructor(
        message: string,
        public readonly code: FaceDetectionIssue,
        public readonly title: string = 'Face Not Detected',
        public readonly tips: string[] = DEFAULT_NO_FACE_TIPS,
    ) {
        super(message);
        this.name = 'FaceCaptureError';
    }
}

export const DEFAULT_NO_FACE_TIPS = [
    'Move to a well-lit area or increase the lighting.',
    'Ensure your entire face is visible within the camera frame.',
    'Look directly at the camera.',
    'Remove anything covering your face, such as sunglasses or a face mask (if applicable).',
    'Hold the device steady and avoid excessive movement.',
    'Move slightly closer to the camera if necessary, then try again.',
];

const MODEL_URL = '/models/face-api';

/** Frames averaged into the final descriptor. */
const FRAME_COUNT = 4;
/** Consecutive good frames required before a sample is accepted. */
const STABLE_FRAMES_REQUIRED = 2;
/** Max detection attempts before giving up with guidance. */
const MAX_DETECTION_ATTEMPTS = 10;
/** Slightly lower than before to reduce false “no face” in dim light. */
const DETECT_MIN_CONFIDENCE = 0.5;
/** Quality gate for accepted frames — keeps false positives in check. */
const ACCEPT_MIN_CONFIDENCE = 0.62;
const IDEAL_MIN_FACE_SIZE = 100;
const MAX_FACE_SIZE = 320;
const MAX_DESCRIPTOR_VARIANCE = 0.16;
const FRAME_INTERVAL_MS = 220;

let faceApiPromise: Promise<FaceApi> | null = null;
let modelsLoaded = false;

export async function loadFaceApiModels(): Promise<FaceApi> {
    if (!faceApiPromise) {
        faceApiPromise = import('face-api.js');
    }

    const faceapi = await faceApiPromise;
    if (!modelsLoaded) {
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        modelsLoaded = true;
    }

    return faceapi;
}

/**
 * Lightweight live assessment for camera coaching (no descriptor required).
 */
export async function assessVideoFrame(video: HTMLVideoElement): Promise<FaceFrameAssessment> {
    if (!video || video.readyState < 2 || video.videoWidth === 0) {
        return {
            issue: 'camera_not_ready',
            guidance: 'Starting camera…',
            confidence: null,
            faceBox: null,
        };
    }

    const faceapi = await loadFaceApiModels();
    const detections = await faceapi.detectAllFaces(
        video,
        new faceapi.SsdMobilenetv1Options({ minConfidence: DETECT_MIN_CONFIDENCE }),
    );

    if (detections.length === 0) {
        return {
            issue: 'no_face',
            guidance: 'Center your face in the frame and improve lighting.',
            confidence: null,
            faceBox: null,
        };
    }

    if (detections.length > 1) {
        return {
            issue: 'multiple_faces',
            guidance: 'Only one face should be in the frame.',
            confidence: null,
            faceBox: null,
        };
    }

    const detection = detections[0];
    const box = detection.box;
    const confidence = Number(detection.score);
    const faceBox = {
        x: Number(box.x),
        y: Number(box.y),
        width: Number(box.width),
        height: Number(box.height),
    };

    const issue = classifyFaceBox(faceBox, confidence, video.videoWidth, video.videoHeight);

    return {
        issue,
        guidance: guidanceForIssue(issue),
        confidence,
        faceBox,
    };
}

export async function captureDescriptorFromVideo(
    video: HTMLVideoElement,
    onProgress?: (message: string) => void,
): Promise<FaceCaptureResult> {
    const faceapi = await loadFaceApiModels();
    const captures: Array<{ descriptor: number[]; confidence: number; width: number; height: number }> = [];
    let stableStreak = 0;
    let attempts = 0;
    let lastIssue: FaceDetectionIssue = 'no_face';

    onProgress?.('Looking for a clear face… Hold still.');

    while (captures.length < FRAME_COUNT && attempts < MAX_DETECTION_ATTEMPTS) {
        attempts += 1;
        await wait(FRAME_INTERVAL_MS);

        const detections = await faceapi
            .detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: DETECT_MIN_CONFIDENCE }))
            .withFaceLandmarks()
            .withFaceDescriptors();

        if (detections.length === 0) {
            stableStreak = 0;
            lastIssue = 'no_face';
            onProgress?.(guidanceForIssue('no_face'));
            continue;
        }

        if (detections.length > 1) {
            stableStreak = 0;
            lastIssue = 'multiple_faces';
            onProgress?.(guidanceForIssue('multiple_faces'));
            continue;
        }

        const detection = detections[0];
        const box = detection.detection.box;
        const confidence = Number(detection.detection.score);
        const faceBox = {
            x: Number(box.x),
            y: Number(box.y),
            width: Number(box.width),
            height: Number(box.height),
        };

        const issue = classifyFaceBox(faceBox, confidence, video.videoWidth, video.videoHeight);
        if (issue !== 'ok') {
            stableStreak = 0;
            lastIssue = issue;
            onProgress?.(guidanceForIssue(issue));
            continue;
        }

        stableStreak += 1;
        onProgress?.(
            stableStreak < STABLE_FRAMES_REQUIRED
                ? 'Face detected. Hold still while we lock on…'
                : `Capturing frame ${captures.length + 1} of ${FRAME_COUNT}…`,
        );

        if (stableStreak < STABLE_FRAMES_REQUIRED) {
            continue;
        }

        captures.push({
            descriptor: Array.from(detection.descriptor).map(Number),
            confidence,
            width: faceBox.width,
            height: faceBox.height,
        });

        // Require stability again between accepted samples.
        stableStreak = 0;
    }

    if (captures.length < FRAME_COUNT) {
        throw faceErrorForIssue(lastIssue);
    }

    onProgress?.('Validating capture quality…');

    return buildCaptureResult(captures);
}

export async function captureDescriptorFromImage(file: File): Promise<FaceCaptureResult> {
    const faceapi = await loadFaceApiModels();
    const image = await fileToImage(file);
    const detections = await faceapi
        .detectAllFaces(image, new faceapi.SsdMobilenetv1Options({ minConfidence: DETECT_MIN_CONFIDENCE }))
        .withFaceLandmarks()
        .withFaceDescriptors();

    if (detections.length === 0) {
        throw faceErrorForIssue('no_face', 'We couldn’t clearly detect a face in the uploaded image.');
    }

    if (detections.length > 1) {
        throw faceErrorForIssue('multiple_faces', 'Multiple faces were found in the uploaded image.');
    }

    const detection = detections[0];
    const box = detection.detection.box;
    const confidence = Number(detection.detection.score);
    const faceBox = {
        x: Number(box.x),
        y: Number(box.y),
        width: Number(box.width),
        height: Number(box.height),
    };

    const issue = classifyFaceBox(faceBox, confidence, image.width, image.height, false);
    if (issue !== 'ok') {
        throw faceErrorForIssue(issue);
    }

    const sample = {
        descriptor: Array.from(detection.descriptor).map(Number),
        confidence,
        width: faceBox.width,
        height: faceBox.height,
    };

    return buildCaptureResult([sample, sample, sample, sample]);
}

export function isFaceCaptureError(error: unknown): error is FaceCaptureError {
    return error instanceof FaceCaptureError;
}

export function isFaceMismatchMessage(message: string | null | undefined): boolean {
    if (!message) {
        return false;
    }

    const normalized = message.toLowerCase();

    return (
        normalized.includes('not recognized') ||
        normalized.includes('does not match') ||
        normalized.includes('face verification failed') ||
        normalized.includes('no match')
    );
}

function classifyFaceBox(
    box: { x: number; y: number; width: number; height: number },
    confidence: number,
    frameWidth: number,
    frameHeight: number,
    checkCenter = true,
): FaceDetectionIssue {
    if (confidence < ACCEPT_MIN_CONFIDENCE) {
        return 'low_confidence';
    }

    if (box.width < IDEAL_MIN_FACE_SIZE || box.height < IDEAL_MIN_FACE_SIZE) {
        return 'too_small';
    }

    if (box.width > MAX_FACE_SIZE || box.height > MAX_FACE_SIZE) {
        return 'too_large';
    }

    if (checkCenter && frameWidth > 0 && frameHeight > 0) {
        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;
        const offsetX = Math.abs(centerX - frameWidth / 2) / frameWidth;
        const offsetY = Math.abs(centerY - frameHeight / 2) / frameHeight;

        if (offsetX > 0.28 || offsetY > 0.28) {
            return 'off_center';
        }
    }

    return 'ok';
}

function guidanceForIssue(issue: FaceDetectionIssue): string {
    switch (issue) {
        case 'ok':
            return 'Looking good. Hold still while we verify your identity.';
        case 'no_face':
            return 'Center your face in the frame and improve lighting.';
        case 'multiple_faces':
            return 'Only one face should be in the frame.';
        case 'too_small':
            return 'Move closer to the camera.';
        case 'too_large':
            return 'Move a little farther from the camera.';
        case 'off_center':
            return 'Center your face in the oval guide.';
        case 'low_confidence':
            return 'Improve lighting and face the camera directly.';
        case 'unstable':
            return 'Hold still while we capture your face.';
        case 'camera_not_ready':
            return 'Starting camera…';
        default:
            return 'Adjust your position and try again.';
    }
}

function faceErrorForIssue(issue: FaceDetectionIssue, overrideMessage?: string): FaceCaptureError {
    switch (issue) {
        case 'multiple_faces':
            return new FaceCaptureError(
                overrideMessage || 'Multiple faces were detected. Please ensure only you are visible.',
                'multiple_faces',
                'Multiple Faces Detected',
                [
                    'Make sure only one person is in the camera frame.',
                    'Step away from others before capturing again.',
                    'Check that photos or posters with faces are not behind you.',
                ],
            );
        case 'too_small':
            return new FaceCaptureError(
                overrideMessage || 'Your face appears too small in the frame.',
                'too_small',
                'Move Closer',
                [
                    'Move slightly closer to the camera.',
                    'Ensure your entire face fills more of the oval guide.',
                    'Hold the device steady and try again.',
                ],
            );
        case 'too_large':
            return new FaceCaptureError(
                overrideMessage || 'Your face is too close to the camera.',
                'too_large',
                'Move Back a Little',
                [
                    'Move slightly farther from the camera.',
                    'Keep your full face visible inside the frame.',
                    'Hold steady and try again.',
                ],
            );
        case 'off_center':
            return new FaceCaptureError(
                overrideMessage || 'Please center your face in the camera frame.',
                'off_center',
                'Center Your Face',
                [
                    'Align your face with the oval guide.',
                    'Look directly at the camera.',
                    'Keep your head level and try again.',
                ],
            );
        case 'low_confidence':
            return new FaceCaptureError(
                overrideMessage || 'We couldn’t clearly see your face.',
                'low_confidence',
                'Improve Lighting',
                DEFAULT_NO_FACE_TIPS,
            );
        case 'unstable':
            return new FaceCaptureError(
                overrideMessage || 'Face capture was inconsistent. Please keep your head steady and try again.',
                'unstable',
                'Hold Still',
                [
                    'Hold the device steady.',
                    'Avoid moving your head during capture.',
                    'Use steady lighting and try again.',
                ],
            );
        case 'no_face':
        default:
            return new FaceCaptureError(
                overrideMessage ||
                    'We couldn’t clearly detect your face. Please follow the tips below and try again.',
                'no_face',
                'Face Not Detected',
                DEFAULT_NO_FACE_TIPS,
            );
    }
}

function buildCaptureResult(
    captures: Array<{ descriptor: number[]; confidence: number; width: number; height: number }>,
): FaceCaptureResult {
    const descriptor = averageDescriptors(captures.map((capture) => capture.descriptor));
    const variance = descriptorVariance(captures.map((capture) => capture.descriptor));

    if (variance > MAX_DESCRIPTOR_VARIANCE) {
        throw faceErrorForIssue('unstable');
    }

    return {
        descriptor,
        quality: {
            detection_confidence: Math.min(...captures.map((capture) => capture.confidence)),
            face_width: Math.min(...captures.map((capture) => capture.width)),
            face_height: Math.min(...captures.map((capture) => capture.height)),
            frame_count: captures.length,
            descriptor_variance: variance,
        },
    };
}

function averageDescriptors(descriptors: number[][]): number[] {
    return descriptors[0].map((_, index) => descriptors.reduce((sum, descriptor) => sum + descriptor[index], 0) / descriptors.length);
}

function descriptorVariance(descriptors: number[][]): number {
    if (descriptors.length < 2) {
        return 0;
    }

    let total = 0;
    let comparisons = 0;
    for (let left = 0; left < descriptors.length; left += 1) {
        for (let right = left + 1; right < descriptors.length; right += 1) {
            total += euclideanDistance(descriptors[left], descriptors[right]);
            comparisons += 1;
        }
    }

    return total / comparisons;
}

function euclideanDistance(left: number[], right: number[]): number {
    return Math.sqrt(left.reduce((sum, value, index) => sum + (value - right[index]) ** 2, 0));
}

function fileToImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Unable to read uploaded image.'));
        image.src = URL.createObjectURL(file);
    });
}

function wait(milliseconds: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
