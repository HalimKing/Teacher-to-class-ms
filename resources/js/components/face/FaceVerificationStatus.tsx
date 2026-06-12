import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

export type FaceStatus = 'idle' | 'camera_initializing' | 'face_detected' | 'verifying' | 'success' | 'failed';

export default function FaceVerificationStatus({ status, message }: { status: FaceStatus; message?: string }) {
    const styles = {
        idle: 'border-slate-200 bg-slate-50 text-slate-700',
        camera_initializing: 'border-blue-200 bg-blue-50 text-blue-700',
        face_detected: 'border-indigo-200 bg-indigo-50 text-indigo-700',
        verifying: 'border-blue-200 bg-blue-50 text-blue-700',
        success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        failed: 'border-red-200 bg-red-50 text-red-700',
    }[status];

    const icon =
        status === 'success' ? (
            <CheckCircle className="h-4 w-4" />
        ) : status === 'failed' ? (
            <AlertCircle className="h-4 w-4" />
        ) : status === 'camera_initializing' || status === 'verifying' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
        ) : null;

    return (
        <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${styles}`}>
            {icon}
            <span>{message || defaultMessage(status)}</span>
        </div>
    );
}

function defaultMessage(status: FaceStatus): string {
    return {
        idle: 'Ready for facial verification.',
        camera_initializing: 'Camera initializing...',
        face_detected: 'Face detected.',
        verifying: 'Verifying face...',
        success: 'Verification successful.',
        failed: 'Verification failed.',
    }[status];
}
