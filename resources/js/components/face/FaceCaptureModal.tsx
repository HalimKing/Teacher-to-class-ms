import AttendanceRangeMap from '@/components/attendance/AttendanceRangeMap';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ensureFreshCsrfToken } from '@/lib/csrf';
import {
    assessVideoFrame,
    captureDescriptorFromImage,
    captureDescriptorFromVideo,
    DEFAULT_NO_FACE_TIPS,
    isFaceCaptureError,
    isFaceEnrollmentRequiredMessage,
    isFaceMismatchMessage,
    type FaceCaptureResult,
    type FaceDetectionIssue,
} from '@/lib/face-recognition';
import { acquireFreshDeviceLocation, cancelDeviceLocation, LocationRequestError } from '@/lib/device-location';
import { distanceInMeters, evaluateAttendanceLocation, formatLocationDiagnostics } from '@/lib/geo';
import { getApiErrorMessage } from '@/lib/http';
import { Camera, ImageUp, Loader2, MapPin, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import FaceVerificationStatus, { type FaceStatus } from './FaceVerificationStatus';

/** Consecutive “ok” coaching ticks required before auto-verification starts. */
const AUTO_VERIFY_STABLE_TICKS = 3;

export type FaceLocationGate = {
    /** Decimal columns reach the frontend as strings, so both shapes are accepted. */
    latitude: number | string | null;
    longitude: number | string | null;
    radiusMeters: number | string | null;
    venueName?: string;
};

type VenueGate = {
    latitude: number;
    longitude: number;
    radiusMeters: number;
    venueName?: string;
};

function distanceFromGate(latitude: number, longitude: number, gate: VenueGate): number {
    return distanceInMeters(latitude, longitude, gate.latitude, gate.longitude);
}

function toFiniteNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
}

function normalizeLocationGate(gate: FaceLocationGate | null | undefined): VenueGate | null {
    if (!gate) {
        return null;
    }

    const latitude = toFiniteNumber(gate.latitude);
    const longitude = toFiniteNumber(gate.longitude);
    const radiusMeters = toFiniteNumber(gate.radiusMeters);

    if (latitude === null || longitude === null || radiusMeters === null || radiusMeters <= 0) {
        return null;
    }

    return { latitude, longitude, radiusMeters, venueName: gate.venueName };
}

type LocationPhase = 'skipped' | 'checking' | 'allowed' | 'blocked';

type LocationBlock = {
    title: string;
    message: string;
    tips?: string[];
};

interface FaceCaptureModalProps {
    open: boolean;
    title: string;
    description: string;
    allowUpload?: boolean;
    /** When true (default), verification starts automatically once the face is stable and well positioned. */
    autoCapture?: boolean;
    captureLabel?: string;
    /** When true, location must be confirmed before the camera starts. */
    requireLocation?: boolean;
    /** Venue coordinates used when requireLocation is true. */
    locationGate?: FaceLocationGate | null;
    onOpenChange: (open: boolean) => void;
    onCapture: (result: FaceCaptureResult) => Promise<void> | void;
}

export default function FaceCaptureModal({
    open,
    title,
    description,
    allowUpload = false,
    autoCapture = true,
    captureLabel = 'Capture Face',
    requireLocation = false,
    locationGate = null,
    onOpenChange,
    onCapture,
}: FaceCaptureModalProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const coachingTimerRef = useRef<number | null>(null);
    const processingRef = useRef(false);
    const locationBlockedRef = useRef(false);
    const successRef = useRef(false);
    const goodFrameStreakRef = useRef(0);
    const handleCaptureRef = useRef<() => Promise<void>>(async () => undefined);
    const locationGateRef = useRef<VenueGate | null>(null);
    /** Set once a verification attempt fails so nothing re-verifies until the user retries. */
    const haltedRef = useRef(false);
    const cameraStartingRef = useRef(false);
    const retryingRef = useRef(false);
    const [status, setStatus] = useState<FaceStatus>('idle');
    const [statusTitle, setStatusTitle] = useState<string | undefined>();
    const [statusMessage, setStatusMessage] = useState<string | undefined>();
    const [statusTips, setStatusTips] = useState<string[] | undefined>();
    const [liveGuidance, setLiveGuidance] = useState('Center your face in the oval guide.');
    const [guidanceTone, setGuidanceTone] = useState<'neutral' | 'good' | 'warn'>('neutral');
    const [processing, setProcessing] = useState(false);
    const [halted, setHalted] = useState(false);
    const [locationPhase, setLocationPhase] = useState<LocationPhase>(requireLocation ? 'checking' : 'skipped');
    const [locationBlock, setLocationBlock] = useState<LocationBlock | null>(null);
    const [devicePosition, setDevicePosition] = useState<{ lat: number; lng: number } | null>(null);
    const [deviceDistance, setDeviceDistance] = useState<number | null>(null);
    const [locationHint, setLocationHint] = useState('Getting your location...');

    const venueGate = normalizeLocationGate(locationGate);
    locationGateRef.current = venueGate;

    const locationEnabled = Boolean(requireLocation);
    const gateKey = venueGate ? `${venueGate.latitude},${venueGate.longitude},${venueGate.radiusMeters}` : '';

    useEffect(() => {
        if (!open) {
            cancelDeviceLocation();
            stopCoaching();
            stopCamera();
            resetStatus();
            setLocationPhase(locationEnabled ? 'checking' : 'skipped');
            setLocationBlock(null);
            setDevicePosition(null);
            setDeviceDistance(null);
            locationBlockedRef.current = false;
            successRef.current = false;
            return;
        }

        let cancelled = false;
        void ensureFreshCsrfToken({ force: true }).catch(() => undefined);

        const boot = async () => {
            const allowed = await confirmLocation();
            if (cancelled) {
                return;
            }
            if (!allowed) {
                return;
            }
            await startCamera();
        };

        void boot();

        return () => {
            cancelled = true;
            cancelDeviceLocation();
            stopCoaching();
            stopCamera();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, locationEnabled, gateKey]);

    const resetStatus = () => {
        setStatus('idle');
        setStatusTitle(undefined);
        setStatusMessage(undefined);
        setStatusTips(undefined);
        setLiveGuidance('Center your face in the oval guide.');
        setGuidanceTone('neutral');
        setProcessing(false);
        processingRef.current = false;
        goodFrameStreakRef.current = 0;
        successRef.current = false;
        haltedRef.current = false;
        setHalted(false);
    };

    const setProcessingState = (value: boolean) => {
        processingRef.current = value;
        setProcessing(value);
    };

    /**
     * Stops the detection loop after a failed attempt. The camera stream stays open so
     * the user can reposition and restart verification from the Try Again button.
     */
    const haltVerification = () => {
        haltedRef.current = true;
        setHalted(true);
        stopCoaching();
        setProcessingState(false);
    };

    const blockLocation = (block: LocationBlock) => {
        locationBlockedRef.current = true;
        setLocationPhase('blocked');
        setLocationBlock(block);
        setProcessingState(false);
        stopCoaching();
        stopCamera();
        cancelDeviceLocation();
    };

    const confirmLocation = async (): Promise<boolean> => {
        if (!locationEnabled) {
            locationBlockedRef.current = false;
            setLocationPhase('skipped');
            setLocationBlock(null);
            return true;
        }

        const gate = locationGateRef.current;
        if (!gate) {
            blockLocation({
                title: 'Location Not Configured',
                message: 'This session does not have a valid attendance location configured. Contact an administrator if this continues.',
            });
            return false;
        }

        setLocationPhase('checking');
        setLocationHint('Getting your location...');
        setLocationBlock(null);
        setDevicePosition(null);
        setDeviceDistance(null);
        locationBlockedRef.current = false;

        try {
            const fix = await acquireFreshDeviceLocation();
            if (locationBlockedRef.current) {
                return false;
            }

            setLocationHint('Checking distance from venue...');
            setDevicePosition({ lat: fix.latitude, lng: fix.longitude });
            const verdict = evaluateAttendanceLocation({
                latitude: fix.latitude,
                longitude: fix.longitude,
                accuracy: fix.accuracy,
                capturedAt: fix.timestamp,
                venueLatitude: gate.latitude,
                venueLongitude: gate.longitude,
                radiusMeters: gate.radiusMeters,
            });
            setDeviceDistance(verdict.distanceMeters);

            if (verdict.status !== 'verified') {
                const diagnostics =
                    verdict.distanceMeters == null
                        ? []
                        : formatLocationDiagnostics(verdict.distanceMeters, gate.radiusMeters, fix.accuracy);
                blockLocation({
                    title: verdict.status === 'out_of_range' ? 'Outside Permitted Location' : 'Location Needs Another Try',
                    message: verdict.message,
                    tips: [
                        ...diagnostics,
                        gate.venueName ? `Stay at ${gate.venueName} and tap Try Again.` : 'Stay at the attendance venue and tap Try Again.',
                    ],
                });
                return false;
            }

            locationBlockedRef.current = false;
            setLocationBlock(null);
            setLocationPhase('allowed');
            return true;
        } catch (error) {
            if (error instanceof LocationRequestError && error.code === 'cancelled') {
                return false;
            }

            const fix = error instanceof LocationRequestError ? error.fix : null;
            if (fix) {
                setDevicePosition({ lat: fix.latitude, lng: fix.longitude });
            }
            const diagnostics =
                fix == null ? [] : formatLocationDiagnostics(distanceFromGate(fix.latitude, fix.longitude, gate), gate.radiusMeters, fix.accuracy);

            blockLocation({
                title: error instanceof LocationRequestError && error.code === 'denied' ? 'Location Permission Needed' : 'Location Needs Another Try',
                message: getApiErrorMessage(error, 'Location could not be determined. Please try again.'),
                tips: [...diagnostics, 'Turn on GPS, allow location access, then tap Try Again.'],
            });
            return false;
        }
    };

    const startCamera = async () => {
        if (locationBlockedRef.current || cameraStartingRef.current) {
            return;
        }

        if (streamRef.current) {
            // A live stream already exists; never open a second camera session.
            return;
        }

        cameraStartingRef.current = true;
        setStatus('camera_initializing');
        setStatusTitle(undefined);
        setStatusMessage('Please allow camera access if prompted.');
        setStatusTips(undefined);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
                audio: false,
            });

            if (locationBlockedRef.current) {
                stream.getTracks().forEach((track) => track.stop());
                return;
            }

            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setStatus('idle');
            setStatusMessage(
                autoCapture
                    ? 'Location confirmed. Center your face in the oval — verification starts automatically.'
                    : 'Location confirmed. Center your face, then capture.',
            );
            startCoaching();
        } catch {
            setStatus('failed');
            setStatusTitle('Camera Unavailable');
            setStatusMessage('Camera permission was denied or the camera is unavailable.');
            setStatusTips([
                'Allow camera access in your browser settings.',
                'Close other apps that may be using the camera.',
                'Reconnect your camera and try again.',
            ]);
            haltVerification();
        } finally {
            cameraStartingRef.current = false;
        }
    };

    const stopCamera = () => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    };

    const startCoaching = () => {
        stopCoaching();

        const tick = async () => {
            if (!videoRef.current || processingRef.current || locationBlockedRef.current || haltedRef.current) {
                return;
            }

            try {
                const assessment = await assessVideoFrame(videoRef.current);
                if (processingRef.current || locationBlockedRef.current || haltedRef.current) {
                    return;
                }

                applyLiveGuidance(assessment.issue, assessment.guidance);

                if (assessment.issue !== 'ok') {
                    goodFrameStreakRef.current = 0;
                    setStatus('coaching');
                    setStatusTitle(undefined);
                    setStatusMessage(assessment.guidance);
                    setStatusTips(undefined);
                    return;
                }

                goodFrameStreakRef.current += 1;
                const streak = goodFrameStreakRef.current;
                const readyForAuto = autoCapture && streak >= AUTO_VERIFY_STABLE_TICKS;

                setStatus('face_detected');
                setStatusTitle(undefined);
                setStatusTips(undefined);

                if (autoCapture && !readyForAuto) {
                    setStatusMessage('Face positioned correctly. Hold still…');
                    setLiveGuidance('Hold still — verifying automatically…');
                    setGuidanceTone('good');
                } else if (autoCapture && readyForAuto) {
                    setStatusMessage('Starting verification…');
                    setLiveGuidance('Hold still while we verify your identity.');
                    setGuidanceTone('good');
                    void handleCaptureRef.current();
                } else {
                    setStatusMessage(assessment.guidance);
                }
            } catch {
                // Keep last guidance if a single assessment frame fails.
            }
        };

        void tick();
        coachingTimerRef.current = window.setInterval(() => {
            void tick();
        }, 700);
    };

    const stopCoaching = () => {
        if (coachingTimerRef.current) {
            window.clearInterval(coachingTimerRef.current);
            coachingTimerRef.current = null;
        }
    };

    const applyLiveGuidance = (issue: FaceDetectionIssue, guidance: string) => {
        setLiveGuidance(guidance);
        if (issue === 'ok') {
            setGuidanceTone('good');
        } else if (issue === 'camera_not_ready') {
            setGuidanceTone('neutral');
        } else {
            setGuidanceTone('warn');
        }
    };

    const handleCapture = async () => {
        if (locationBlockedRef.current || locationPhase === 'blocked' || locationPhase === 'checking') {
            return;
        }

        // A halted attempt must be restarted from Try Again, never by the detection loop.
        if (haltedRef.current || successRef.current) {
            return;
        }

        if (!videoRef.current || processingRef.current) {
            if (!videoRef.current) {
                setStatus('failed');
                setStatusMessage('Camera is not ready.');
                haltVerification();
            }
            return;
        }

        setProcessingState(true);
        goodFrameStreakRef.current = 0;
        stopCoaching();
        setStatus('capturing');
        setStatusTitle(undefined);
        setStatusMessage('Hold still while we verify your identity.');
        setStatusTips(undefined);
        setLiveGuidance('Hold still while we verify your identity.');
        setGuidanceTone('good');

        try {
            await ensureFreshCsrfToken({ force: true });
            const result = await captureDescriptorFromVideo(videoRef.current, (progress) => {
                setStatus('capturing');
                setStatusMessage(progress);
                setLiveGuidance(progress);
                setGuidanceTone('good');
            });

            if (locationBlockedRef.current) {
                return;
            }

            setStatus('verifying');
            setStatusMessage('Comparing your face with the enrolled profile…');
            await onCapture(result);

            if (locationBlockedRef.current) {
                return;
            }

            setStatus('success');
            setStatusTitle('Face Verified Successfully');
            setStatusMessage('Face verified successfully. You can now proceed with attendance.');
            setLiveGuidance('Face verified successfully. You can now proceed with attendance.');
            setGuidanceTone('good');
            successRef.current = true;
        } catch (error) {
            if (locationBlockedRef.current) {
                return;
            }
            applyCaptureFailure(error);
            haltVerification();
        } finally {
            if (!locationBlockedRef.current) {
                setProcessingState(false);
            }
        }
    };

    handleCaptureRef.current = handleCapture;

    const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || locationBlockedRef.current || processingRef.current) {
            return;
        }

        haltedRef.current = false;
        setHalted(false);
        setProcessingState(true);
        stopCoaching();
        setStatus('capturing');
        setStatusMessage('Validating uploaded image…');
        setStatusTips(undefined);

        try {
            await ensureFreshCsrfToken({ force: true });
            const result = await captureDescriptorFromImage(file);
            if (locationBlockedRef.current) {
                return;
            }
            setStatus('verifying');
            setStatusMessage('Comparing your face with the enrolled profile…');
            await onCapture(result);
            if (locationBlockedRef.current) {
                return;
            }
            setStatus('success');
            setStatusTitle('Face Verified Successfully');
            setStatusMessage('Face verified successfully. You can now proceed with attendance.');
            successRef.current = true;
        } catch (error) {
            if (locationBlockedRef.current) {
                return;
            }
            applyCaptureFailure(error);
            haltVerification();
        } finally {
            if (!locationBlockedRef.current) {
                setProcessingState(false);
            }
            event.target.value = '';
        }
    };

    const applyCaptureFailure = (error: unknown) => {
        goodFrameStreakRef.current = 0;

        if (isFaceCaptureError(error)) {
            const isNoFace = error.code === 'no_face' || error.code === 'low_confidence';

            setStatus(isNoFace ? 'no_face' : 'failed');
            setStatusTitle(isNoFace ? 'Face Not Recognized' : error.title);
            setStatusMessage(
                isNoFace ? 'Face not recognized. Please position your face clearly in front of the camera and try again.' : error.message,
            );
            setStatusTips(error.tips);
            setLiveGuidance('Verification stopped. Tap Try Again when you are ready.');
            setGuidanceTone('warn');
            return;
        }

        const message = getApiErrorMessage(error, 'We could not verify your face. Please try again.');

        if (message.toLowerCase().includes('outside the permitted attendance location')) {
            blockLocation({
                title: 'Outside Permitted Location',
                message,
            });
            return;
        }

        if (isFaceEnrollmentRequiredMessage(message)) {
            setStatus('failed');
            setStatusTitle('Face Not Enrolled');
            setStatusMessage(
                'Your face is not registered on this account, so attendance cannot be verified. Please complete face enrollment or contact an administrator.',
            );
            setStatusTips([
                'Ask an administrator to enroll or re-enroll your face.',
                'Confirm you are signed in with the correct staff account.',
                'Retrying will not work until your face is enrolled.',
            ]);
            setLiveGuidance('Face enrollment is required before attendance can be verified.');
            setGuidanceTone('warn');
            return;
        }

        if (isFaceMismatchMessage(message)) {
            setStatus('mismatch');
            setStatusTitle('Face Not Recognized');
            setStatusMessage('Face not recognized. Please position your face clearly in front of the camera and try again.');
            setStatusTips([
                'Make sure you are verifying with the correct staff account.',
                'Improve lighting and look directly at the camera.',
                'If you recently changed your appearance significantly, ask an administrator to re-enroll your face.',
            ]);
            setLiveGuidance('Verification stopped. Tap Try Again when you are ready.');
            setGuidanceTone('warn');
            return;
        }

        setStatus('failed');
        setStatusTitle('Face Could Not Be Verified');
        setStatusMessage(message);
        setStatusTips(['Look directly at the camera, improve the lighting, and tap Try Again.']);
        setLiveGuidance('Verification stopped. Tap Try Again when you are ready.');
        setGuidanceTone('warn');
    };

    const handleLocationRetry = async () => {
        cancelDeviceLocation();
        stopCoaching();
        stopCamera();
        resetStatus();
        locationBlockedRef.current = false;
        setLocationPhase('checking');
        setLocationHint('Getting your location...');
        setLocationBlock(null);
        setDevicePosition(null);
        setDeviceDistance(null);
        const allowed = await confirmLocation();
        if (!allowed) {
            return;
        }
        await startCamera();
    };

    /** True while the existing stream can still be reused for another attempt. */
    const hasLiveCameraStream = () => Boolean(streamRef.current?.getVideoTracks().some((track) => track.readyState === 'live'));

    const handleFaceRetry = async () => {
        if (retryingRef.current || processingRef.current) {
            return;
        }

        retryingRef.current = true;

        try {
            if (locationPhase === 'blocked' || locationPhase === 'checking') {
                await handleLocationRetry();
                return;
            }

            stopCoaching();
            resetStatus();

            if (!hasLiveCameraStream()) {
                // The previous stream ended (permission revoked, device released), so reinitialize it.
                stopCamera();
                await startCamera();
                return;
            }

            if (videoRef.current && videoRef.current.paused) {
                await videoRef.current.play().catch(() => undefined);
            }

            startCoaching();
        } finally {
            retryingRef.current = false;
        }
    };

    const guidanceClass =
        guidanceTone === 'good'
            ? 'border-emerald-300 bg-emerald-500/90 text-white'
            : guidanceTone === 'warn'
              ? 'border-amber-300 bg-amber-500/95 text-white'
              : 'border-white/30 bg-black/55 text-white';

    const showRangeMap = locationPhase === 'blocked' && venueGate !== null && devicePosition !== null;
    const showCamera = locationPhase === 'skipped' || locationPhase === 'allowed';
    const showLocationRetry = locationPhase === 'blocked' || locationPhase === 'checking';
    const showFaceRetry = showCamera && halted;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[min(96dvh,52rem)] w-[calc(100%-0.5rem)] max-w-[calc(100%-0.5rem)] gap-3 overflow-y-auto p-3 sm:max-w-2xl sm:p-6">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {locationPhase === 'checking' ? (
                        <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
                            <div className="flex items-start gap-2.5">
                                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                                <div>
                                    <p className="leading-tight font-semibold">{locationHint}</p>
                                    <p className="mt-1 leading-snug opacity-90">
                                        A fresh GPS reading is required before face verification starts.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {locationPhase === 'blocked' && locationBlock ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                            <div className="flex items-start gap-2.5">
                                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                                <div className="min-w-0 flex-1 space-y-1.5">
                                    <p className="leading-tight font-semibold">{locationBlock.title}</p>
                                    <p className="leading-snug">{locationBlock.message}</p>
                                    {locationBlock.tips?.length ? (
                                        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed">
                                            {locationBlock.tips.map((tip) => (
                                                <li key={tip}>{tip}</li>
                                            ))}
                                        </ul>
                                    ) : null}
                                </div>
                            </div>

                            {showRangeMap && venueGate && devicePosition ? (
                                <AttendanceRangeMap
                                    className="mt-3"
                                    venue={{ lat: venueGate.latitude, lng: venueGate.longitude }}
                                    venueName={venueGate.venueName}
                                    radiusMeters={venueGate.radiusMeters}
                                    device={devicePosition}
                                    distanceMeters={deviceDistance}
                                />
                            ) : null}
                        </div>
                    ) : null}

                    {showCamera ? <FaceVerificationStatus status={status} title={statusTitle} message={statusMessage} tips={statusTips} /> : null}

                    {showFaceRetry ? (
                        <div className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700 dark:bg-slate-800/60">
                            <p className="text-xs text-muted-foreground sm:text-sm">
                                Verification has stopped. Reposition your face, then start a new attempt.
                            </p>
                            <Button type="button" onClick={() => void handleFaceRetry()} disabled={processing} className="min-h-11 w-full sm:w-auto">
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Try Again
                            </Button>
                        </div>
                    ) : null}

                    <div className={showCamera ? 'relative -mx-0.5 overflow-hidden rounded-xl border bg-black sm:mx-0' : 'hidden'}>
                        {/*
                              Mirror preview only (selfie-style). face-api reads raw video frames,
                              so CSS scaleX does not affect detection or descriptor quality.
                            */}
                        <video
                            ref={videoRef}
                            className="h-[min(64dvh,34rem)] w-full -scale-x-100 object-cover sm:aspect-video sm:h-auto"
                            muted
                            playsInline
                        />
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            <div
                                className={`aspect-[3/4] h-[74%] w-auto max-w-[92%] rounded-[50%] border-2 sm:h-[84%] ${
                                    guidanceTone === 'good'
                                        ? 'border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.28)]'
                                        : 'border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.28)]'
                                }`}
                            />
                        </div>
                        <div
                            className={`absolute inset-x-2 bottom-2 rounded-lg border px-2.5 py-1.5 text-center text-xs font-medium backdrop-blur-sm sm:inset-x-3 sm:bottom-3 sm:px-3 sm:py-2 sm:text-sm ${guidanceClass}`}
                        >
                            {liveGuidance}
                        </div>
                    </div>

                    {status === 'no_face' && showCamera && !statusTips?.length ? (
                        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-100">
                            <p className="font-semibold">Please try the following:</p>
                            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
                                {DEFAULT_NO_FACE_TIPS.map((tip) => (
                                    <li key={tip}>{tip}</li>
                                ))}
                            </ul>
                        </div>
                    ) : null}

                    {showCamera ? (
                        <p className="text-xs text-muted-foreground">
                            {halted
                                ? 'Automatic verification is paused so the same attempt is not repeated. Tap Try Again to start a new attempt.'
                                : autoCapture
                                  ? 'Keep only one face in frame. Verification starts automatically when your face is centered, clearly lit, and steady. You can also verify manually if needed.'
                                  : 'Keep only one face in frame. Use good lighting, look straight at the camera, and hold still during capture.'}
                        </p>
                    ) : (
                        <p className="text-xs text-muted-foreground">
                            Face verification will start only after your location is within the permitted range. You can try again as many times as
                            you need.
                        </p>
                    )}
                </div>

                <DialogFooter>
                    {showLocationRetry ? (
                        <Button type="button" onClick={() => void handleLocationRetry()} disabled={locationPhase === 'checking'}>
                            {locationPhase === 'checking' ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <RefreshCw className="mr-2 h-4 w-4" />
                            )}
                            {locationPhase === 'checking' ? 'Checking location…' : 'Try Again'}
                        </Button>
                    ) : (
                        <>
                            {allowUpload && (
                                <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent">
                                    <ImageUp className="mr-2 h-4 w-4" />
                                    Upload Image
                                    <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={processing} />
                                </label>
                            )}
                            {showFaceRetry ? (
                                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="min-h-11 w-full sm:w-auto">
                                    Close
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    variant={autoCapture ? 'outline' : 'default'}
                                    onClick={() => void handleCapture()}
                                    disabled={processing || status === 'success'}
                                    className="min-h-11 w-full sm:w-auto"
                                >
                                    {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                                    {processing ? 'Verifying…' : captureLabel}
                                </Button>
                            )}
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
