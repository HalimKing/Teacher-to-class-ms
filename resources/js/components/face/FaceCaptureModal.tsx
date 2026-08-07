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
import { Camera, ImageUp, Loader2 } from 'lucide-react';
import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import FaceVerificationStatus, { type FaceStatus } from './FaceVerificationStatus';

/** Consecutive “ok” coaching ticks required before auto-verification starts. */
const AUTO_VERIFY_STABLE_TICKS = 3;

interface FaceCaptureModalProps {
    open: boolean;
    title: string;
    description: string;
    allowUpload?: boolean;
    /** When true (default), verification starts automatically once the face is stable and well positioned. */
    autoCapture?: boolean;
    captureLabel?: string;
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
    onOpenChange,
    onCapture,
}: FaceCaptureModalProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const coachingTimerRef = useRef<number | null>(null);
    const processingRef = useRef(false);
    const keepFailureBannerRef = useRef(false);
    const goodFrameStreakRef = useRef(0);
    const handleCaptureRef = useRef<() => Promise<void>>(async () => undefined);
    const [status, setStatus] = useState<FaceStatus>('idle');
    const [statusTitle, setStatusTitle] = useState<string | undefined>();
    const [statusMessage, setStatusMessage] = useState<string | undefined>();
    const [statusTips, setStatusTips] = useState<string[] | undefined>();
    const [liveGuidance, setLiveGuidance] = useState('Center your face in the oval guide.');
    const [guidanceTone, setGuidanceTone] = useState<'neutral' | 'good' | 'warn'>('neutral');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (!open) {
            stopCoaching();
            stopCamera();
            resetStatus();
            return;
        }

        startCamera();
        void ensureFreshCsrfToken({ force: true }).catch(() => undefined);

        return () => {
            stopCoaching();
            stopCamera();
        };
    }, [open]);

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
    };

    const setProcessingState = (value: boolean) => {
        processingRef.current = value;
        setProcessing(value);
    };

    const startCamera = async () => {
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
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setStatus('idle');
            setStatusMessage(
                autoCapture
                    ? 'Camera ready. Center your face in the oval — verification starts automatically.'
                    : 'Camera ready. Center your face, then capture.',
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
    };

    const startCoaching = () => {
        stopCoaching();

        const tick = async () => {
            if (!videoRef.current || processingRef.current) {
                return;
            }

            try {
                const assessment = await assessVideoFrame(videoRef.current);
                if (processingRef.current) {
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

            setStatus('verifying');
            setStatusMessage('Comparing your face with the enrolled profile…');
            await onCapture(result);

            setStatus('success');
            setStatusMessage('Your identity has been confirmed.');
        } catch (error) {
            applyCaptureFailure(error);
            startCoaching();
        } finally {
            setProcessingState(false);
        }
    };

    handleCaptureRef.current = handleCapture;

    const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
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
            setStatus('verifying');
            setStatusMessage('Comparing your face with the enrolled profile…');
            await onCapture(result);
            setStatus('success');
            setStatusMessage('Your identity has been confirmed.');
        } catch (error) {
            applyCaptureFailure(error);
            startCoaching();
        } finally {
            setProcessingState(false);
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

        const message = getApiErrorMessage(error, 'Unable to capture face.');

        if (isFaceMismatchMessage(message)) {
            setStatus('mismatch');
            setStatusTitle('Face Does Not Match');
            setStatusMessage(
                'A face was detected, but it does not match the enrolled profile for this account. Please try again or contact an administrator if this continues.',
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
        setStatusTitle('Unable to Verify');
        setStatusMessage(message);
        setStatusTips(undefined);
        setLiveGuidance(message);
        setGuidanceTone('warn');
    };

    const guidanceClass =
        guidanceTone === 'good'
            ? 'border-emerald-300 bg-emerald-500/90 text-white'
            : guidanceTone === 'warn'
              ? 'border-amber-300 bg-amber-500/95 text-white'
              : 'border-white/30 bg-black/55 text-white';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <FaceVerificationStatus
                        status={status}
                        title={statusTitle}
                        message={statusMessage}
                        tips={statusTips}
                    />

                    <div className="relative overflow-hidden rounded-xl border bg-black">
                        {/*
                          Mirror preview only (selfie-style). face-api reads raw video frames,
                          so CSS scaleX does not affect detection or descriptor quality.
                        */}
                        <video
                            ref={videoRef}
                            className="aspect-video w-full -scale-x-100 object-cover"
                            muted
                            playsInline
                        />
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            <div
                                className={`h-[58%] w-[42%] rounded-[50%] border-2 ${
                                    guidanceTone === 'good'
                                        ? 'border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.28)]'
                                        : 'border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.28)]'
                                }`}
                            />
                        </div>
                        <div className={`absolute inset-x-3 bottom-3 rounded-lg border px-3 py-2 text-center text-sm font-medium backdrop-blur-sm ${guidanceClass}`}>
                            {liveGuidance}
                        </div>
                    </div>

                    {status === 'no_face' && !statusTips?.length ? (
                        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-100">
                            <p className="font-semibold">Please try the following:</p>
                            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
                                {DEFAULT_NO_FACE_TIPS.map((tip) => (
                                    <li key={tip}>{tip}</li>
                                ))}
                            </ul>
                        </div>
                    ) : null}

                    <p className="text-xs text-muted-foreground">
                        {autoCapture
                            ? 'Keep only one face in frame. Verification starts automatically when your face is centered, clearly lit, and steady. You can also verify manually if needed.'
                            : 'Keep only one face in frame. Use good lighting, look straight at the camera, and hold still during capture.'}
                    </p>
                </div>

                <DialogFooter>
                    {allowUpload && (
                        <label className="inline-flex cursor-pointer items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent">
                            <ImageUp className="mr-2 h-4 w-4" />
                            Upload Image
                            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={processing} />
                        </label>
                    )}
                    <Button type="button" variant={autoCapture ? 'outline' : 'default'} onClick={handleCapture} disabled={processing}>
                        {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                        {processing ? 'Verifying…' : captureLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
