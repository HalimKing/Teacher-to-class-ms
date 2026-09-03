import AttendanceRangeMap from '@/components/attendance/AttendanceRangeMap';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ensureFreshCsrfToken } from '@/lib/csrf';
import { getApiErrorMessage } from '@/lib/http';
import {
    assessVideoFrame,
    captureDescriptorFromImage,
    captureDescriptorFromVideo,
    DEFAULT_NO_FACE_TIPS,
    isFaceCaptureError,
    isFaceMismatchMessage,
    type FaceCaptureResult,
    type FaceDetectionIssue,
} from '@/lib/face-recognition';
import { distanceInMeters, formatOutOfRangeAttendanceMessage } from '@/lib/geo';
import { Camera, ImageUp, Loader2, MapPin, RefreshCw } from 'lucide-react';
import { type ChangeEvent, useEffect, useRef, useState } from 'react';
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
    const watchIdRef = useRef<number | null>(null);
    const processingRef = useRef(false);
    const locationBlockedRef = useRef(false);
    const successRef = useRef(false);
    const keepFailureBannerRef = useRef(false);
    const goodFrameStreakRef = useRef(0);
    const handleCaptureRef = useRef<() => Promise<void>>(async () => undefined);
    const locationGateRef = useRef<VenueGate | null>(null);
    const [status, setStatus] = useState<FaceStatus>('idle');
    const [statusTitle, setStatusTitle] = useState<string | undefined>();
    const [statusMessage, setStatusMessage] = useState<string | undefined>();
    const [statusTips, setStatusTips] = useState<string[] | undefined>();
    const [liveGuidance, setLiveGuidance] = useState('Center your face in the oval guide.');
    const [guidanceTone, setGuidanceTone] = useState<'neutral' | 'good' | 'warn'>('neutral');
    const [processing, setProcessing] = useState(false);
    const [locationPhase, setLocationPhase] = useState<LocationPhase>(requireLocation ? 'checking' : 'skipped');
    const [locationBlock, setLocationBlock] = useState<LocationBlock | null>(null);
    const [devicePosition, setDevicePosition] = useState<{ lat: number; lng: number } | null>(null);
    const [deviceDistance, setDeviceDistance] = useState<number | null>(null);

    const venueGate = normalizeLocationGate(locationGate);
    locationGateRef.current = venueGate;

    const locationEnabled = Boolean(requireLocation);
    const gateKey = venueGate ? `${venueGate.latitude},${venueGate.longitude},${venueGate.radiusMeters}` : '';

    useEffect(() => {
        if (!open) {
            stopWatch();
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
            startWatch();
        };

        void boot();

        return () => {
            cancelled = true;
            stopWatch();
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
        keepFailureBannerRef.current = false;
        goodFrameStreakRef.current = 0;
        successRef.current = false;
    };

    const setProcessingState = (value: boolean) => {
        processingRef.current = value;
        setProcessing(value);
    };

    const blockLocation = (block: LocationBlock) => {
        locationBlockedRef.current = true;
        setLocationPhase('blocked');
        setLocationBlock(block);
        setProcessingState(false);
        stopCoaching();
        stopCamera();
        stopWatch();
    };

    const requestCurrentPosition = (): Promise<{ lat: number; lng: number }> => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Location is not available on this device.'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) =>
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    }),
                (error) => {
                    if (error.code === error.PERMISSION_DENIED) {
                        reject(new Error('Please allow location access to mark attendance.'));
                        return;
                    }
                    reject(new Error('We could not confirm your location. Please try again.'));
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
            );
        });
    };

    const applyCoordinates = (lat: number, lng: number): boolean => {
        const gate = locationGateRef.current;
        setDevicePosition({ lat, lng });

        if (!gate) {
            setDeviceDistance(null);
            blockLocation({
                title: 'Location Not Configured',
                message: 'This session does not have a valid attendance location configured. Contact an administrator if this continues.',
            });
            return false;
        }

        const distance = distanceInMeters(lat, lng, gate.latitude, gate.longitude);
        setDeviceDistance(distance);

        if (distance > gate.radiusMeters) {
            blockLocation({
                title: 'Outside Permitted Location',
                message: formatOutOfRangeAttendanceMessage(distance, gate.radiusMeters),
                tips: [
                    gate.venueName ? `Move closer to ${gate.venueName}.` : 'Move closer to the permitted attendance venue.',
                    `Required range: ${Math.round(gate.radiusMeters)}m.`,
                    `Your current distance: ${Math.round(distance)}m.`,
                ],
            });
            return false;
        }

        locationBlockedRef.current = false;
        setLocationBlock(null);
        setLocationPhase((current) => (current === 'allowed' ? current : 'allowed'));
        return true;
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
        setLocationBlock(null);
        locationBlockedRef.current = false;

        try {
            const position = await requestCurrentPosition();
            return applyCoordinates(position.lat, position.lng);
        } catch (error) {
            blockLocation({
                title: 'Location Needed',
                message: getApiErrorMessage(error, 'We could not confirm your location. Please try again.'),
                tips: ['Allow location access in your browser settings.', 'Move to an open area and tap Try Again.'],
            });
            return false;
        }
    };

    const startWatch = () => {
        stopWatch();
        if (!locationEnabled || !navigator.geolocation) {
            return;
        }

        watchIdRef.current = navigator.geolocation.watchPosition(
            (position) => {
                if (locationBlockedRef.current || successRef.current) {
                    return;
                }
                applyCoordinates(position.coords.latitude, position.coords.longitude);
            },
            () => {
                // Keep the last known location state if a watch update fails.
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 },
        );
    };

    const stopWatch = () => {
        if (watchIdRef.current != null && navigator.geolocation) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
    };

    const startCamera = async () => {
        if (locationBlockedRef.current) {
            return;
        }

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
            if (!videoRef.current || processingRef.current || locationBlockedRef.current) {
                return;
            }

            try {
                const assessment = await assessVideoFrame(videoRef.current);
                if (processingRef.current || locationBlockedRef.current) {
                    return;
                }

                applyLiveGuidance(assessment.issue, assessment.guidance);

                if (assessment.issue !== 'ok') {
                    goodFrameStreakRef.current = 0;

                    if (keepFailureBannerRef.current) {
                        return;
                    }

                    setStatus('coaching');
                    setStatusTitle(undefined);
                    setStatusMessage(assessment.guidance);
                    setStatusTips(undefined);
                    return;
                }

                if (keepFailureBannerRef.current) {
                    keepFailureBannerRef.current = false;
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

        if (!videoRef.current || processingRef.current) {
            if (!videoRef.current) {
                setStatus('failed');
                setStatusMessage('Camera is not ready.');
            }
            return;
        }

        setProcessingState(true);
        keepFailureBannerRef.current = false;
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
            startCoaching();
        } finally {
            if (!locationBlockedRef.current) {
                setProcessingState(false);
            }
        }
    };

    handleCaptureRef.current = handleCapture;

    const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || locationBlockedRef.current) {
            return;
        }

        setProcessingState(true);
        keepFailureBannerRef.current = false;
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
            startCoaching();
        } finally {
            if (!locationBlockedRef.current) {
                setProcessingState(false);
            }
            event.target.value = '';
        }
    };

    const applyCaptureFailure = (error: unknown) => {
        keepFailureBannerRef.current = true;
        goodFrameStreakRef.current = 0;

        if (isFaceCaptureError(error)) {
            const isNoFace = error.code === 'no_face' || error.code === 'low_confidence';
            const isCoachingIssue =
                error.code === 'too_small' ||
                error.code === 'too_large' ||
                error.code === 'off_center' ||
                error.code === 'unstable' ||
                error.code === 'multiple_faces';

            setStatus(isNoFace ? 'no_face' : isCoachingIssue ? 'coaching' : 'failed');
            setStatusTitle(error.title);
            setStatusMessage(error.message);
            setStatusTips(error.tips);
            setLiveGuidance(error.message);
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

        if (isFaceMismatchMessage(message)) {
            setStatus('mismatch');
            setStatusTitle('Face Could Not Be Verified');
            setStatusMessage(
                'We could not verify your face because it does not match the enrolled profile for this account. Please try again.',
            );
            setStatusTips([
                'Make sure you are verifying with the correct staff account.',
                'Improve lighting and look directly at the camera.',
                'If you recently changed your appearance significantly, ask an administrator to re-enroll your face.',
            ]);
            setLiveGuidance('Face detected, but it does not match the enrolled profile.');
            setGuidanceTone('warn');
            return;
        }

        setStatus('failed');
        setStatusTitle('Face Could Not Be Verified');
        setStatusMessage(message);
        setStatusTips(['Look directly at the camera, improve the lighting, and tap Try Again.']);
        setLiveGuidance(message);
        setGuidanceTone('warn');
    };

    const handleLocationRetry = async () => {
        stopWatch();
        stopCoaching();
        stopCamera();
        resetStatus();
        locationBlockedRef.current = false;
        setLocationPhase('checking');
        setLocationBlock(null);
        const allowed = await confirmLocation();
        if (!allowed) {
            return;
        }
        await startCamera();
        startWatch();
    };

    const handleFaceRetry = async () => {
        if (locationPhase === 'blocked' || locationPhase === 'checking') {
            await handleLocationRetry();
            return;
        }

        resetStatus();
        if (!streamRef.current) {
            await startCamera();
            return;
        }
        startCoaching();
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
    const showFaceRetry = showCamera && (status === 'failed' || status === 'mismatch' || status === 'no_face');

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
                                    <p className="font-semibold leading-tight">Checking Location</p>
                                    <p className="mt-1 leading-snug opacity-90">
                                        Confirming you are within the permitted attendance range before face verification starts.
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
                                    <p className="font-semibold leading-tight">{locationBlock.title}</p>
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

                    {showCamera ? (
                        <FaceVerificationStatus
                            status={status}
                            title={statusTitle}
                            message={statusMessage}
                            tips={statusTips}
                        />
                    ) : null}

                    <div className={showCamera ? 'relative -mx-0.5 overflow-hidden rounded-xl border bg-black sm:mx-0' : 'hidden'}>
                            {/*
                              Mirror preview only (selfie-style). face-api reads raw video frames,
                              so CSS scaleX does not affect detection or descriptor quality.
                            */}
                            <video
                                ref={videoRef}
                                className="h-[min(64dvh,34rem)] w-full -scale-x-100 object-cover sm:h-auto sm:aspect-video"
                                muted
                                playsInline
                            />
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                <div
                                    className={`h-[82%] w-[86%] rounded-[50%] border-2 sm:h-[64%] sm:w-[48%] ${
                                        guidanceTone === 'good'
                                            ? 'border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.28)]'
                                            : 'border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.28)]'
                                    }`}
                                />
                            </div>
                            <div className={`absolute inset-x-2 bottom-2 rounded-lg border px-2.5 py-1.5 text-center text-xs font-medium backdrop-blur-sm sm:inset-x-3 sm:bottom-3 sm:px-3 sm:py-2 sm:text-sm ${guidanceClass}`}>
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
                            {autoCapture
                                ? 'Keep only one face in frame. Verification starts automatically when your face is centered, clearly lit, and steady. You can also verify manually if needed.'
                                : 'Keep only one face in frame. Use good lighting, look straight at the camera, and hold still during capture.'}
                        </p>
                    ) : (
                        <p className="text-xs text-muted-foreground">
                            Face verification will start only after your location is within the permitted range. You can try again as many times as you need.
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
                                <label className="inline-flex cursor-pointer items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent">
                                    <ImageUp className="mr-2 h-4 w-4" />
                                    Upload Image
                                    <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={processing} />
                                </label>
                            )}
                            {showFaceRetry ? (
                                <Button type="button" variant="outline" onClick={() => void handleFaceRetry()} disabled={processing}>
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Try Again
                                </Button>
                            ) : null}
                            <Button
                                type="button"
                                variant={autoCapture ? 'outline' : 'default'}
                                onClick={() => void handleCapture()}
                                disabled={processing || status === 'success'}
                            >
                                {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                                {processing ? 'Verifying…' : captureLabel}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
