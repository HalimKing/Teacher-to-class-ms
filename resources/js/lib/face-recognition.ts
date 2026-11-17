type FaceApi = typeof import('face-api.js');

/**
 * Live coaching uses TinyFaceDetector on a small input.
 * The 128-number descriptor is still produced by SSD MobileNet + the 68-point
 * landmark net + the recognition net, which is the same pipeline used when
 * faces were enrolled. Do not lower the match threshold to compensate.
 */
export const FACE_PIPELINE = {
    modelUrl: '/models/face-api',
    cameraWidth: 640,
    cameraHeight: 480,
    tinyInputSize: 224,
    tinyScoreThreshold: 0.5,
    detectMinConfidence: 0.5,
    /** Matches the backend quality gate (detection_confidence min 0.7). */
    acceptMinConfidence: 0.7,
    minFaceSize: 90,
    maxFaceSize: 520,
    centerTolerance: 0.28,
    /** Consecutive suitable live frames before automatic capture. */
    stableDetections: 2,
    /** Backend rejects fewer than 3 real samples. */
    descriptorSamples: 3,
    maxDescriptorAttempts: 6,
    sampleGapMs: 80,
    /** Pause between live checks. A new check never starts while one is running. */
    coachingGapMs: 280,
    detectionTimeoutMs: 20_000,
    minLuminance: 38,
    minSharpness: 10,
    minAspect: 0.55,
    maxAspect: 1.45,
    maxDescriptorVariance: 0.16,
} as const;

export type FaceDetectionIssue =
    | 'ok'
    | 'no_face'
    | 'multiple_faces'
    | 'too_small'
    | 'too_large'
    | 'off_center'
    | 'low_confidence'
    | 'too_dark'
    | 'blurry'
    | 'not_frontal'
    | 'unstable'
    | 'camera_not_ready';

export interface FaceTimings {
    model_init_ms?: number;
    camera_init_ms?: number;
    first_detection_ms?: number;
    quality_eval_ms?: number;
    capture_ms?: number;
    descriptor_ms?: number;
    total_ms?: number;
}

export interface FaceCaptureResult {
    descriptor: number[];
    quality: {
        detection_confidence: number;
        face_width: number;
        face_height: number;
        frame_count: number;
        descriptor_variance: number;
    };
    timings: FaceTimings;
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

let faceApiPromise: Promise<FaceApi> | null = null;
let modelsPromise: Promise<FaceApi> | null = null;
let tinyReady = false;
let captureInFlight = false;
const faceTimings: FaceTimings = {};
let sessionStartedAt = 0;
let firstDetectionMarked = false;
let sampleCanvas: HTMLCanvasElement | null = null;

export function preloadFaceModels(): Promise<void> {
    return loadFaceApiModels().then(() => undefined);
}

export function loadFaceApiModels(): Promise<FaceApi> {
    if (!modelsPromise) {
        const started = performance.now();
        modelsPromise = (async () => {
            if (!faceApiPromise) {
                faceApiPromise = import('face-api.js');
            }

            const faceapi = await faceApiPromise;
            await Promise.all([
                faceapi.nets.ssdMobilenetv1.loadFromUri(FACE_PIPELINE.modelUrl),
                faceapi.nets.faceLandmark68Net.loadFromUri(FACE_PIPELINE.modelUrl),
                faceapi.nets.faceRecognitionNet.loadFromUri(FACE_PIPELINE.modelUrl),
            ]);

            try {
                await faceapi.nets.tinyFaceDetector.loadFromUri(FACE_PIPELINE.modelUrl);
                tinyReady = faceapi.nets.tinyFaceDetector.isLoaded;
            } catch {
                tinyReady = false;
            }

            noteFaceTiming('model_init_ms', performance.now() - started);

            return faceapi;
        })().catch((error: unknown) => {
            modelsPromise = null;
            tinyReady = false;
            throw error;
        });
    }

    return modelsPromise;
}

/** Starts the clock used for first-detection timing. Models stay loaded. */
export function beginFaceSession(): void {
    sessionStartedAt = performance.now();
    firstDetectionMarked = false;
    delete faceTimings.first_detection_ms;
    delete faceTimings.quality_eval_ms;
    delete faceTimings.capture_ms;
    delete faceTimings.descriptor_ms;
    delete faceTimings.total_ms;
}

export function noteFaceTiming(key: keyof FaceTimings, milliseconds: number): void {
    faceTimings[key] = Math.round(milliseconds);
    if (import.meta.env.DEV) {
        console.info(`[face] ${key}=${faceTimings[key]}`);
    }
}

export function getFaceTimings(): FaceTimings {
    return { ...faceTimings };
}

export function cameraConstraints(): MediaTrackConstraints {
    return {
        facingMode: { ideal: 'user' },
        width: { ideal: FACE_PIPELINE.cameraWidth },
        height: { ideal: FACE_PIPELINE.cameraHeight },
    };
}

/**
 * Lightweight live assessment. Does not compute a recognition descriptor.
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
    const detections = tinyReady
        ? await faceapi.detectAllFaces(
              video,
              new faceapi.TinyFaceDetectorOptions({
                  inputSize: FACE_PIPELINE.tinyInputSize,
                  scoreThreshold: FACE_PIPELINE.tinyScoreThreshold,
              }),
          )
        : await faceapi.detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: FACE_PIPELINE.detectMinConfidence }));

    if (detections.length === 0) {
        return {
            issue: 'no_face',
            guidance: guidanceForIssue('no_face'),
            confidence: null,
            faceBox: null,
        };
    }

    if (detections.length > 1) {
        return {
            issue: 'multiple_faces',
            guidance: guidanceForIssue('multiple_faces'),
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
    const qualityStarted = performance.now();
    const issue = classifyFaceBox(faceBox, confidence, video.videoWidth, video.videoHeight, true, tinyReady ? FACE_PIPELINE.tinyScoreThreshold : FACE_PIPELINE.acceptMinConfidence);
    const appearance = issue === 'ok' ? sampleAppearance(video, faceBox) : null;
    noteFaceTiming('quality_eval_ms', performance.now() - qualityStarted);
    const resolved = appearance?.dark ? 'too_dark' : appearance?.blurry ? 'blurry' : issue;

    if (resolved === 'ok' && !firstDetectionMarked && sessionStartedAt > 0) {
        firstDetectionMarked = true;
        noteFaceTiming('first_detection_ms', performance.now() - sessionStartedAt);
    }

    return {
        issue: resolved,
        guidance: guidanceForIssue(resolved),
        confidence,
        faceBox,
    };
}

export async function captureDescriptorFromVideo(video: HTMLVideoElement, onProgress?: (message: string) => void): Promise<FaceCaptureResult> {
    if (captureInFlight) {
        throw new FaceCaptureError('A face capture is already in progress.', 'unstable', 'Please Wait', ['Wait for the current attempt to finish, then try again.']);
    }

    captureInFlight = true;
    const started = performance.now();

    try {
        const faceapi = await loadFaceApiModels();
        const captures: Array<{ descriptor: number[]; confidence: number; width: number; height: number }> = [];
        let attempts = 0;
        let lastIssue: FaceDetectionIssue = 'no_face';
        let descriptorMs = 0;

        onProgress?.('Capturing face...');

        while (captures.length < FACE_PIPELINE.descriptorSamples && attempts < FACE_PIPELINE.maxDescriptorAttempts) {
            attempts += 1;
            if (attempts > 1) {
                await wait(FACE_PIPELINE.sampleGapMs);
            }

            const inferenceStarted = performance.now();
            const detections = await faceapi
                .detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: FACE_PIPELINE.detectMinConfidence }))
                .withFaceLandmarks()
                .withFaceDescriptors();
            descriptorMs += performance.now() - inferenceStarted;

            if (detections.length === 0) {
                lastIssue = 'no_face';
                onProgress?.(guidanceForIssue('no_face'));
                continue;
            }

            if (detections.length > 1) {
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
            const issue = classifyCapturedFace(video, faceBox, confidence);

            if (issue !== 'ok') {
                lastIssue = issue;
                onProgress?.(guidanceForIssue(issue));
                continue;
            }

            captures.push({
                descriptor: Array.from(detection.descriptor).map(Number),
                confidence,
                width: faceBox.width,
                height: faceBox.height,
            });
            onProgress?.(`Capturing face... ${captures.length} of ${FACE_PIPELINE.descriptorSamples}`);
        }

        noteFaceTiming('descriptor_ms', descriptorMs);

        if (captures.length < FACE_PIPELINE.descriptorSamples) {
            throw faceErrorForIssue(lastIssue);
        }

        onProgress?.('Verifying your identity...');
        const result = buildCaptureResult(captures);
        noteFaceTiming('capture_ms', performance.now() - started);
        noteFaceTiming('total_ms', (faceTimings.model_init_ms ?? 0) + (faceTimings.camera_init_ms ?? 0) + (performance.now() - (sessionStartedAt || started)));
        result.timings = getFaceTimings();

        return result;
    } finally {
        captureInFlight = false;
    }
}

export async function captureDescriptorFromImage(file: File): Promise<FaceCaptureResult> {
    const faceapi = await loadFaceApiModels();
    const image = await fileToImage(file);
    const detections = await faceapi
        .detectAllFaces(image, new faceapi.SsdMobilenetv1Options({ minConfidence: FACE_PIPELINE.detectMinConfidence }))
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
    const issue = classifyFaceBox(faceBox, confidence, image.width, image.height, false, FACE_PIPELINE.acceptMinConfidence);

    if (issue !== 'ok') {
        throw faceErrorForIssue(issue);
    }

    const sample = {
        descriptor: Array.from(detection.descriptor).map(Number),
        confidence,
        width: faceBox.width,
        height: faceBox.height,
    };

    return buildCaptureResult([sample, sample, sample]);
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

/**
 * Detects the backend responses raised when the account has no usable face descriptor,
 * so the UI can point the user at enrollment instead of asking them to retry blindly.
 */
export function isFaceEnrollmentRequiredMessage(message: string | null | undefined): boolean {
    if (!message) {
        return false;
    }

    const normalized = message.toLowerCase();

    return (
        normalized.includes('face enrollment is required') ||
        normalized.includes('enrollment is required') ||
        normalized.includes('not enrolled') ||
        normalized.includes('no enrolled face') ||
        normalized.includes('face is not registered')
    );
}

function classifyCapturedFace(
    video: HTMLVideoElement,
    faceBox: { x: number; y: number; width: number; height: number },
    confidence: number,
): FaceDetectionIssue {
    const issue = classifyFaceBox(faceBox, confidence, video.videoWidth, video.videoHeight, true, FACE_PIPELINE.acceptMinConfidence);
    if (issue !== 'ok') {
        return issue;
    }

    const appearance = sampleAppearance(video, faceBox);
    if (appearance.dark) {
        return 'too_dark';
    }
    if (appearance.blurry) {
        return 'blurry';
    }

    return 'ok';
}

function classifyFaceBox(
    box: { x: number; y: number; width: number; height: number },
    confidence: number,
    frameWidth: number,
    frameHeight: number,
    checkCenter: boolean,
    minimumConfidence: number,
): FaceDetectionIssue {
    if (confidence < minimumConfidence) {
        return 'low_confidence';
    }

    const aspect = box.height > 0 ? box.width / box.height : 0;
    if (aspect < FACE_PIPELINE.minAspect || aspect > FACE_PIPELINE.maxAspect) {
        return 'not_frontal';
    }

    if (box.width < FACE_PIPELINE.minFaceSize || box.height < FACE_PIPELINE.minFaceSize) {
        return 'too_small';
    }

    const minDim = Math.min(frameWidth, frameHeight);
    const maxFace = frameWidth > 0 && frameHeight > 0 ? Math.max(FACE_PIPELINE.maxFaceSize, minDim * 0.88) : FACE_PIPELINE.maxFaceSize;

    if (box.width > maxFace || box.height > maxFace) {
        return 'too_large';
    }

    if (checkCenter && frameWidth > 0 && frameHeight > 0) {
        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;
        const offsetX = Math.abs(centerX - frameWidth / 2) / frameWidth;
        const offsetY = Math.abs(centerY - frameHeight / 2) / frameHeight;

        if (offsetX > FACE_PIPELINE.centerTolerance || offsetY > FACE_PIPELINE.centerTolerance) {
            return 'off_center';
        }
    }

    return 'ok';
}

function sampleAppearance(video: HTMLVideoElement, box: { x: number; y: number; width: number; height: number }): { dark: boolean; blurry: boolean } {
    const size = 32;
    const canvas = sampleCanvas ?? document.createElement('canvas');
    sampleCanvas = canvas;
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context || box.width < 8 || box.height < 8) {
        return { dark: false, blurry: false };
    }

    context.drawImage(video, box.x, box.y, box.width, box.height, 0, 0, size, size);
    const pixels = context.getImageData(0, 0, size, size).data;
    const gray = new Float32Array(size * size);
    let sum = 0;

    for (let index = 0, pixel = 0; index < pixels.length; index += 4, pixel += 1) {
        const value = 0.299 * pixels[index] + 0.587 * pixels[index + 1] + 0.114 * pixels[index + 2];
        gray[pixel] = value;
        sum += value;
    }

    const mean = sum / gray.length;
    let energy = 0;
    let count = 0;

    for (let y = 1; y < size - 1; y += 1) {
        for (let x = 1; x < size - 1; x += 1) {
            const offset = y * size + x;
            const lap = 4 * gray[offset] - gray[offset - 1] - gray[offset + 1] - gray[offset - size] - gray[offset + size];
            energy += lap * lap;
            count += 1;
        }
    }

    return {
        dark: mean < FACE_PIPELINE.minLuminance,
        blurry: energy / count < FACE_PIPELINE.minSharpness,
    };
}

function guidanceForIssue(issue: FaceDetectionIssue): string {
    switch (issue) {
        case 'ok':
            return 'Face detected. Hold still...';
        case 'no_face':
            return 'No face detected. Position your face within the camera.';
        case 'multiple_faces':
            return 'Only one face should be in the frame.';
        case 'too_small':
            return 'Move closer to the camera.';
        case 'too_large':
            return 'Move a little farther from the camera.';
        case 'off_center':
            return 'Position your face in the camera.';
        case 'low_confidence':
        case 'too_dark':
            return 'Face not clear. Improve lighting and try again.';
        case 'blurry':
            return 'Hold still. The image is not clear yet.';
        case 'not_frontal':
            return 'Look directly at the camera.';
        case 'unstable':
            return 'Hold still while we capture your face.';
        case 'camera_not_ready':
            return 'Initializing camera...';
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
            return new FaceCaptureError(overrideMessage || 'Your face appears too small in the frame.', 'too_small', 'Move Closer', [
                'Move slightly closer to the camera.',
                'Ensure your entire face fills more of the oval guide.',
                'Hold the device steady and try again.',
            ]);
        case 'too_large':
            return new FaceCaptureError(overrideMessage || 'Your face is too close to the camera.', 'too_large', 'Move Back a Little', [
                'Move slightly farther from the camera.',
                'Keep your full face visible inside the frame.',
                'Hold steady and try again.',
            ]);
        case 'off_center':
            return new FaceCaptureError(overrideMessage || 'Please center your face in the camera frame.', 'off_center', 'Center Your Face', [
                'Align your face with the oval guide.',
                'Look directly at the camera.',
                'Keep your head level and try again.',
            ]);
        case 'too_dark':
        case 'low_confidence':
            return new FaceCaptureError(
                overrideMessage || 'Face not clear. Improve lighting and try again.',
                issue,
                'Improve Lighting',
                DEFAULT_NO_FACE_TIPS,
            );
        case 'blurry':
            return new FaceCaptureError(overrideMessage || 'The image is not clear. Hold still and try again.', 'blurry', 'Hold Still', [
                'Hold the device steady.',
                'Wait until your face is in focus.',
                'Improve the lighting and try again.',
            ]);
        case 'not_frontal':
            return new FaceCaptureError(overrideMessage || 'Look directly at the camera.', 'not_frontal', 'Face the Camera', [
                'Look straight into the camera.',
                'Keep your head level.',
                'Remove anything covering the sides of your face.',
            ]);
        case 'unstable':
            return new FaceCaptureError(
                overrideMessage || 'Face capture was inconsistent. Please keep your head steady and try again.',
                'unstable',
                'Hold Still',
                ['Hold the device steady.', 'Avoid moving your head during capture.', 'Use steady lighting and try again.'],
            );
        case 'no_face':
        default:
            return new FaceCaptureError(
                overrideMessage || 'No face detected. Position your face within the camera.',
                'no_face',
                'Face Not Detected',
                DEFAULT_NO_FACE_TIPS,
            );
    }
}

function buildCaptureResult(captures: Array<{ descriptor: number[]; confidence: number; width: number; height: number }>): FaceCaptureResult {
    const descriptor = averageDescriptors(captures.map((capture) => capture.descriptor));
    const variance = descriptorVariance(captures.map((capture) => capture.descriptor));

    if (variance > FACE_PIPELINE.maxDescriptorVariance) {
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
        timings: getFaceTimings(),
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
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Unable to read uploaded image.'));
        };
        image.src = url;
    });
}

function wait(milliseconds: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
