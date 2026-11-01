import { type ReactNode } from 'react';
import FaceStatus from './FaceStatus';
import { type FaceStatus as FaceUiStatus } from './FaceVerificationStatus';

interface FaceVerificationProps {
    status: FaceUiStatus;
    title?: string;
    message?: string;
    tips?: string[];
    children?: ReactNode;
}

export default function FaceVerification({ status, title, message, tips, children }: FaceVerificationProps) {
    return (
        <div className="space-y-3">
            <FaceStatus status={status} title={title} message={message} tips={tips} />
            {children}
        </div>
    );
}
