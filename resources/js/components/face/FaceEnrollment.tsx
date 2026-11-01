import { Button } from '@/components/ui/button';
import { apiJsonRequest } from '@/lib/http';
import { type FaceCaptureResult } from '@/lib/face-recognition';
import { enrollFace, resolveFaceEngine } from '@/services/faceVerification';
import { usePage } from '@inertiajs/react';
import { ShieldCheck, ShieldX, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-toastify';
import FaceCaptureModal from './FaceCaptureModal';

interface FaceEnrollmentProps {
    teacherId?: number;
    status?: string;
    faceRegisteredAt?: string | null;
    enrollmentRequired?: boolean;
}

export default function FaceEnrollment({ teacherId, status = 'not_enrolled', faceRegisteredAt = null, enrollmentRequired = false }: FaceEnrollmentProps) {
    const { system_settings: systemSettings } = usePage().props as {
        system_settings?: { attendance?: { face_recognition_engine?: { value?: string } } };
    };
    const engine = resolveFaceEngine(undefined, systemSettings?.attendance?.face_recognition_engine?.value);
    const [modalOpen, setModalOpen] = useState(false);
    const [currentStatus, setCurrentStatus] = useState(status);
    const [registeredAt, setRegisteredAt] = useState(faceRegisteredAt);
    const [processing, setProcessing] = useState(false);
    const enrolled = currentStatus === 'enrolled';

    const handleEnrollment = async (result: FaceCaptureResult) => {
        if (!teacherId) {
            toast.info('Create the staff member first, then open Edit Staff Member to enroll their face.', { theme: 'dark' });
            return;
        }

        setProcessing(true);
        try {
            const payload = await enrollFace(teacherId, result);
            setCurrentStatus(payload.face_enrollment_status || 'enrolled');
            setRegisteredAt(payload.face_registered_at || new Date().toISOString());
            setModalOpen(false);
            toast.success(payload.message || 'Face enrollment saved successfully.', { theme: 'dark' });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to enroll face.';
            toast.error(message, { theme: 'dark' });
            throw error instanceof Error ? error : new Error(message);
        } finally {
            setProcessing(false);
        }
    };

    const handleRemove = async () => {
        if (!teacherId || !confirm('Remove this staff member face enrollment?')) {
            return;
        }

        setProcessing(true);
        try {
            const payload = await apiJsonRequest<{ message?: string }>(route('admin.teachers.face-enrollment.destroy', teacherId), {
                method: 'DELETE',
                body: JSON.stringify({}),
            });
            setCurrentStatus('not_enrolled');
            setRegisteredAt(null);
            toast.success(payload.message || 'Face enrollment removed successfully.', { theme: 'dark' });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Unable to remove face enrollment.', { theme: 'dark' });
        } finally {
            setProcessing(false);
        }
    };

    const handleRequireReenrollment = async () => {
        if (!teacherId) {
            return;
        }

        setProcessing(true);
        try {
            const payload = await apiJsonRequest<{ message?: string; face_enrollment_status?: string }>(
                route('admin.teachers.face-reenrollment.store', teacherId),
                { method: 'POST', body: JSON.stringify({}) },
            );
            setCurrentStatus(payload.face_enrollment_status || 'migration_required');
            toast.success(payload.message || 'Re-enrollment is now required.', { theme: 'dark' });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Unable to require re-enrollment.', { theme: 'dark' });
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
                        {enrolled || currentStatus === 'migration_required' ? 'Re-enroll Face' : 'Enroll Face'}
                    </Button>
                    {engine === 'arcface' && enrolled && (
                        <Button type="button" variant="outline" onClick={handleRequireReenrollment} disabled={processing}>
                            Require Re-enrollment
                        </Button>
                    )}
                    {enrolled && (
                        <Button type="button" variant="outline" onClick={handleRemove} disabled={processing}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove
                        </Button>
                    )}
                </div>
            </div>

            {!teacherId && <p className="mt-3 text-xs text-slate-500">Face enrollment is available after the staff record is created.</p>}

            <FaceCaptureModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                allowUpload={engine !== 'arcface'}
                engine={engine}
                sampleCount={engine === 'arcface' ? 3 : 1}
                title="Enroll Staff Face"
                description={
                    engine === 'arcface'
                        ? 'ArcFace takes one short photo. Hold still and keep only your face in view.'
                        : 'Capture from webcam or upload a clear staff image. Exactly one face must be visible.'
                }
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

    if (status === 'migration_required') {
        return 'Re-enrollment Required';
    }

    return enrollmentRequired ? 'Enrollment Required' : 'Not Enrolled';
}
