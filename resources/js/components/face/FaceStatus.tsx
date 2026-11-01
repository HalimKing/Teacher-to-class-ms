import { staffMessageForStatus } from '@/services/faceVerification';
import FaceVerificationStatus, { type FaceStatus as FaceUiStatus } from './FaceVerificationStatus';

interface FaceStatusProps {
    status: FaceUiStatus;
    title?: string;
    message?: string;
    tips?: string[];
    code?: string | null;
}

export default function FaceStatus({ status, title, message, tips, code }: FaceStatusProps) {
    return <FaceVerificationStatus status={status} title={title} message={message || (code ? staffMessageForStatus(code) : undefined)} tips={tips} />;
}
