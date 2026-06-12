import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { captureDescriptorFromImage, captureDescriptorFromVideo, type FaceCaptureResult } from '@/lib/face-recognition';
import { Camera, ImageUp, Loader2 } from 'lucide-react';
import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import FaceVerificationStatus, { type FaceStatus } from './FaceVerificationStatus';

interface FaceCaptureModalProps {
    open: boolean;
    title: string;
    description: string;
    allowUpload?: boolean;
    captureLabel?: string;
    onOpenChange: (open: boolean) => void;
    onCapture: (result: FaceCaptureResult) => Promise<void> | void;
}

export default function FaceCaptureModal({
    open,
    title,
    description,
    allowUpload = false,
    captureLabel = 'Capture Face',
    onOpenChange,
    onCapture,
}: FaceCaptureModalProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [status, setStatus] = useState<FaceStatus>('idle');
    const [statusMessage, setStatusMessage] = useState<string | undefined>();
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (!open) {
            stopCamera();
            return;
        }

        startCamera();

        return () => stopCamera();
    }, [open]);

    const startCamera = async () => {
        setStatus('camera_initializing');
        setStatusMessage(undefined);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setStatus('idle');
            setStatusMessage('Camera ready. Center your face and capture.');
        } catch (error) {
            setStatus('failed');
            setStatusMessage('Camera permission denied or unavailable.');
        }
    };

    const stopCamera = () => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
    };

    const handleCapture = async () => {
        if (!videoRef.current) {
            setStatus('failed');
            setStatusMessage('Camera is not ready.');
            return;
        }

        setProcessing(true);
        setStatus('verifying');
        setStatusMessage('Capturing multiple frames and validating face quality...');
        try {
            const result = await captureDescriptorFromVideo(videoRef.current);
            setStatus('success');
            setStatusMessage('Face captured successfully.');
            await onCapture(result);
        } catch (error) {
            setStatus('failed');
            setStatusMessage(error instanceof Error ? error.message : 'Unable to capture face.');
        } finally {
            setProcessing(false);
        }
    };

    const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        setProcessing(true);
        setStatus('verifying');
        setStatusMessage('Validating uploaded image...');
        try {
            const result = await captureDescriptorFromImage(file);
            setStatus('success');
            setStatusMessage('Face image processed successfully.');
            await onCapture(result);
        } catch (error) {
            setStatus('failed');
            setStatusMessage(error instanceof Error ? error.message : 'Unable to process uploaded image.');
        } finally {
            setProcessing(false);
            event.target.value = '';
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <FaceVerificationStatus status={status} message={statusMessage} />
                    <div className="overflow-hidden rounded-xl border bg-black">
                        <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Keep only one face in frame. Use good lighting, face forward, and avoid moving during capture.
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
                    <Button type="button" onClick={handleCapture} disabled={processing}>
                        {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                        {captureLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
