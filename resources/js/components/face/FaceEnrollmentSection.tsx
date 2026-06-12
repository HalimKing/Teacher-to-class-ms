import { Button } from '@/components/ui/button';
import { type FaceCaptureResult } from '@/lib/face-recognition';
import { ShieldCheck, ShieldX, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-toastify';
import FaceCaptureModal from './FaceCaptureModal';

interface FaceEnrollmentSectionProps {
    teacherId?: number;
    status?: string;
    faceRegisteredAt?: string | null;
    enrollmentRequired?: boolean;
}

const csrfToken = () => (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';

export default function FaceEnrollmentSection({
    teacherId,
    status = 'not_enrolled',
    faceRegisteredAt = null,
    enrollmentRequired = false,
}: FaceEnrollmentSectionProps) {
    const [modalOpen, setModalOpen] = useState(false);
    const [currentStatus, setCurrentStatus] = useState(status);
    const [registeredAt, setRegisteredAt] = useState(faceRegisteredAt);
    const [processing, setProcessing] = useState(false);
    const enrolled = currentStatus === 'enrolled';

    const handleEnrollment = async (result: FaceCaptureResult) => {
        if (!teacherId) {
            toast.info('Create the lecturer first, then open Edit Teacher to enroll their face.', { theme: 'dark' });
            return;
        }

        setProcessing(true);
        try {
            const token = csrfToken();
            const response = await fetch(route('admin.teachers.face-enrollment.store', teacherId), {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': token,
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({
                    _token: token,
                    face_descriptor: result.descriptor,
                    quality: result.quality,
                }),
            });
            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.message || 'Unable to enroll face.');
            }

            setCurrentStatus(payload.face_enrollment_status || 'enrolled');
            setRegisteredAt(payload.face_registered_at || new Date().toISOString());
            setModalOpen(false);
            toast.success(payload.message || 'Face enrollment saved successfully.', { theme: 'dark' });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Unable to enroll face.', { theme: 'dark' });
        } finally {
            setProcessing(false);
        }
    };

    const handleRemove = async () => {
        if (!teacherId || !confirm('Remove this lecturer face enrollment?')) {
            return;
        }

        setProcessing(true);
        try {
            const token = csrfToken();
            const response = await fetch(route('admin.teachers.face-enrollment.destroy', teacherId), {
                method: 'DELETE',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': token,
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({ _token: token }),
            });
            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.message || 'Unable to remove face enrollment.');
            }

            setCurrentStatus('not_enrolled');
            setRegisteredAt(null);
            toast.success(payload.message || 'Face enrollment removed successfully.', { theme: 'dark' });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Unable to remove face enrollment.', { theme: 'dark' });
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h3 className="flex items-center text-lg font-semibold text-slate-900 dark:text-white">
                        {enrolled ? <ShieldCheck className="mr-2 h-5 w-5 text-emerald-600" /> : <ShieldX className="mr-2 h-5 w-5 text-amber-600" />}
                        Facial Recognition Enrollment
                    </h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        Status: <span className="font-medium">{formatStatus(currentStatus, enrollmentRequired)}</span>
                        {registeredAt && <span> • Registered {new Date(registeredAt).toLocaleString()}</span>}
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={() => setModalOpen(true)} disabled={processing || !teacherId}>
                        {enrolled ? 'Re-enroll Face' : 'Enroll Face'}
                    </Button>
                    {enrolled && (
                        <Button type="button" variant="outline" onClick={handleRemove} disabled={processing}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove
                        </Button>
                    )}
                </div>
            </div>

            {!teacherId && <p className="mt-3 text-xs text-slate-500">Face enrollment is available after the lecturer record is created.</p>}

            <FaceCaptureModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                allowUpload
                title="Enroll Lecturer Face"
                description="Capture from webcam or upload a clear lecturer image. Exactly one face must be visible."
                captureLabel="Save Face Enrollment"
                onCapture={handleEnrollment}
            />
        </div>
    );
}

function formatStatus(status: string, enrollmentRequired: boolean) {
    if (status === 'enrolled') {
        return 'Enrolled';
    }

    return enrollmentRequired ? 'Enrollment Required' : 'Not Enrolled';
}
