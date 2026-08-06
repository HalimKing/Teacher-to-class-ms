import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm } from '@inertiajs/react';

interface Explanation {
    id: number;
    status: string;
    explanation_type: string;
    reason_category: string;
    reason_category_label?: string;
    explanation: string;
    attendance_date: string;
    admin_comments?: string | null;
    document_url?: string | null;
    staff?: { title?: string; first_name?: string; last_name?: string; employee_id?: string };
    reviewer?: { name?: string } | null;
    attendance_record?: Record<string, unknown> | null;
}

const breadcrumbs = (id: number): BreadcrumbItem[] => [
    { title: 'Dashboard', href: '/admin/dashboard' },
    { title: 'Attendance Explanations', href: '/admin/attendance-explanations' },
    { title: `Explanation #${id}`, href: `/admin/attendance-explanations/${id}` },
];

export default function AttendanceExplanationShow({ explanation }: { explanation: Explanation }) {
    const form = useForm({
        admin_comments: '',
        update_attendance_status: true,
    });

    const approve = () => form.post(route('admin.attendance-explanations.approve', explanation.id));
    const reject = () => form.post(route('admin.attendance-explanations.reject', explanation.id));

    return (
        <AppLayout breadcrumbs={breadcrumbs(explanation.id)}>
            <Head title={`Explanation #${explanation.id}`} />
            <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Explanation #{explanation.id}</h1>
                    <p className="mt-1 text-sm capitalize text-slate-500">Status: {explanation.status}</p>
                </div>

                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 text-sm">
                    <p>
                        <span className="font-semibold">Staff:</span> {explanation.staff?.title} {explanation.staff?.first_name}{' '}
                        {explanation.staff?.last_name}
                    </p>
                    <p>
                        <span className="font-semibold">Type:</span> {explanation.explanation_type.replace('_', ' ')}
                    </p>
                    <p>
                        <span className="font-semibold">Category:</span> {explanation.reason_category_label}
                    </p>
                    <p>
                        <span className="font-semibold">Date:</span> {explanation.attendance_date}
                    </p>
                    <p>
                        <span className="font-semibold">Explanation:</span> {explanation.explanation}
                    </p>
                    {explanation.document_url && (
                        <p>
                            <a href={explanation.document_url} target="_blank" rel="noreferrer" className="font-medium text-blue-600 hover:underline">
                                View supporting document
                            </a>
                        </p>
                    )}
                </div>

                {explanation.status === 'pending' ? (
                    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
                        <label className="block space-y-1.5">
                            <span className="text-sm font-medium">Admin comments</span>
                            <textarea
                                value={form.data.admin_comments}
                                onChange={(e) => form.setData('admin_comments', e.target.value)}
                                className="min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            />
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={form.data.update_attendance_status}
                                onChange={(e) => form.setData('update_attendance_status', e.target.checked)}
                            />
                            Update attendance status on approval (excused absence / authorized early departure)
                        </label>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                disabled={form.processing}
                                onClick={approve}
                                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                                Approve
                            </button>
                            <button
                                type="button"
                                disabled={form.processing}
                                onClick={reject}
                                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                            >
                                Reject
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                        Reviewed by {explanation.reviewer?.name || 'admin'}.
                        {explanation.admin_comments ? ` Comments: ${explanation.admin_comments}` : ''}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
