import { AlertCircle, CheckCircle, Loader2, ScanFace, SunMedium, UserRoundSearch, XCircle } from 'lucide-react';
import { type ReactNode } from 'react';

export type FaceStatus =
    | 'idle'
    | 'camera_initializing'
    | 'coaching'
    | 'face_detected'
    | 'capturing'
    | 'verifying'
    | 'success'
    | 'no_face'
    | 'mismatch'
    | 'failed';

interface FaceVerificationStatusProps {
    status: FaceStatus;
    title?: string;
    message?: string;
    tips?: string[];
}

export default function FaceVerificationStatus({ status, title, message, tips }: FaceVerificationStatusProps) {
    const config = statusConfig(status);
    const resolvedTitle = title || config.title;
    const resolvedMessage = message || config.message;

    return (
        <div className={`rounded-xl border px-3 py-3 text-sm ${config.className}`}>
            <div className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0">{config.icon}</span>
                <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="font-semibold leading-tight">{resolvedTitle}</p>
                    {resolvedMessage ? <p className="leading-snug opacity-90">{resolvedMessage}</p> : null}
                    {tips && tips.length > 0 ? (
                        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed opacity-95">
                            {tips.map((tip) => (
                                <li key={tip}>{tip}</li>
                            ))}
                        </ul>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function statusConfig(status: FaceStatus): {
    title: string;
    message: string;
    className: string;
    icon: ReactNode;
} {
    switch (status) {
        case 'camera_initializing':
            return {
                title: 'Starting Camera',
                message: 'Please allow camera access if prompted.',
                className: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200',
                icon: <Loader2 className="h-4 w-4 animate-spin" />,
            };
        case 'coaching':
            return {
                title: 'Position Your Face',
                message: 'Follow the live guidance below the camera.',
                className: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
                icon: <SunMedium className="h-4 w-4" />,
            };
        case 'face_detected':
            return {
                title: 'Face Detected',
                message: 'Hold still — verification will start automatically.',
                className: 'border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200',
                icon: <ScanFace className="h-4 w-4" />,
            };
        case 'capturing':
            return {
                title: 'Capturing Face',
                message: 'Hold still while we verify your identity.',
                className: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200',
                icon: <Loader2 className="h-4 w-4 animate-spin" />,
            };
        case 'verifying':
            return {
                title: 'Verifying Identity',
                message: 'Comparing your face with the enrolled profile…',
                className: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200',
                icon: <Loader2 className="h-4 w-4 animate-spin" />,
            };
        case 'success':
            return {
                title: 'Verification Successful',
                message: 'Your identity has been confirmed.',
                className: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
                icon: <CheckCircle className="h-4 w-4" />,
            };
        case 'no_face':
            return {
                title: 'Face Not Detected',
                message: 'We couldn’t clearly detect your face. Please try the tips below.',
                className: 'border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-100',
                icon: <UserRoundSearch className="h-4 w-4" />,
            };
        case 'mismatch':
            return {
                title: 'Face Does Not Match',
                message: 'A face was detected, but it does not match the enrolled profile for this account.',
                className: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200',
                icon: <XCircle className="h-4 w-4" />,
            };
        case 'failed':
            return {
                title: 'Unable to Verify',
                message: 'Something went wrong during verification. Please try again.',
                className: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200',
                icon: <AlertCircle className="h-4 w-4" />,
            };
        case 'idle':
        default:
            return {
                title: 'Ready',
                message: 'Center your face in the oval — verification starts automatically.',
                className: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200',
                icon: <ScanFace className="h-4 w-4" />,
            };
    }
}
