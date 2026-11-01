import FaceVerificationStatus, { type FaceStatus } from './FaceVerificationStatus';

interface FaceVerificationResultProps {
    status: FaceStatus;
    title?: string;
    message?: string;
    tips?: string[];
}

export default function FaceVerificationResult({ status, title, message, tips }: FaceVerificationResultProps) {
    if (status === 'idle' || status === 'coaching' || status === 'camera_initializing') {
        return null;
    }

    return <FaceVerificationStatus status={status} title={title} message={message} tips={tips} />;
}
