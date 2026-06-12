type FaceApi = typeof import('face-api.js');

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

const MODEL_URL = '/models/face-api';
const FRAME_COUNT = 3;
const MIN_CONFIDENCE = 0.7;
const MIN_FACE_SIZE = 80;
const MAX_DESCRIPTOR_VARIANCE = 0.18;

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

export async function captureDescriptorFromVideo(video: HTMLVideoElement): Promise<FaceCaptureResult> {
    const faceapi = await loadFaceApiModels();
    const captures = [];

    for (let index = 0; index < FRAME_COUNT; index += 1) {
        await wait(250);
        const detections = await faceapi
            .detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: MIN_CONFIDENCE }))
            .withFaceLandmarks()
            .withFaceDescriptors();

        if (detections.length === 0) {
            throw new Error('No face found. Please face the camera clearly.');
        }

        if (detections.length > 1) {
            throw new Error('Multiple faces found. Please ensure only one lecturer is visible.');
        }

        captures.push(validateDetection(detections[0]));
    }

    return buildCaptureResult(captures);
}

export async function captureDescriptorFromImage(file: File): Promise<FaceCaptureResult> {
    const faceapi = await loadFaceApiModels();
    const image = await fileToImage(file);
    const detections = await faceapi
        .detectAllFaces(image, new faceapi.SsdMobilenetv1Options({ minConfidence: MIN_CONFIDENCE }))
        .withFaceLandmarks()
        .withFaceDescriptors();

    if (detections.length === 0) {
        throw new Error('No face found in the uploaded image.');
    }

    if (detections.length > 1) {
        throw new Error('Multiple faces found in the uploaded image.');
    }

    const detection = validateDetection(detections[0]);
    return buildCaptureResult([detection, detection, detection]);
}

function validateDetection(detection: any) {
    const confidence = Number(detection.detection.score);
    const box = detection.detection.box;

    if (confidence < MIN_CONFIDENCE) {
        throw new Error('Face detection confidence is too low. Please improve lighting and try again.');
    }

    if (box.width < MIN_FACE_SIZE || box.height < MIN_FACE_SIZE) {
        throw new Error('Face is too small. Please move closer to the camera.');
    }

    return {
        descriptor: Array.from(detection.descriptor).map(Number),
        confidence,
        width: Number(box.width),
        height: Number(box.height),
    };
}

function buildCaptureResult(captures: Array<{ descriptor: number[]; confidence: number; width: number; height: number }>): FaceCaptureResult {
    const descriptor = averageDescriptors(captures.map((capture) => capture.descriptor));
    const variance = descriptorVariance(captures.map((capture) => capture.descriptor));

    if (variance > MAX_DESCRIPTOR_VARIANCE) {
        throw new Error('Face capture was inconsistent. Please keep your head steady and try again.');
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
