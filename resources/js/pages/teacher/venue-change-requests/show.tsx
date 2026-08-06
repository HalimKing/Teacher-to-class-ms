import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';

interface RequestRecord {
    id: number;
    status: string;
    status_label?: string;
    period_label?: string;
    reason: string;
    notes?: string | null;
    authorization_type: string;
    admin_comments?: string | null;
    authorized_classroom?: { name?: string } | null;
    reviewer?: { name?: string } | null;
    items?: Array<{
        id: number;
        timetable?: { day_of_week?: string; day?: string; start_time?: string; end_time?: string; course?: { name?: string } | null } | null;
        original_classroom?: { name?: string } | null;
    }>;
}

interface PageProps {
    requestRecord: RequestRecord;
    flash?: { success?: string; error?: string };
}

const breadcrumbs = (id: number): BreadcrumbItem[] => [
    { title: 'Dashboard', href: '/teacher/dashboard' },
    { title: 'Venue Change Requests', href: '/teacher/venue-change-requests' },
    { title: `Request #${id}`, href: `/teacher/venue-change-requests/${id}` },
];

export default function TeacherVenueChangeRequestShow({ requestRecord }: PageProps) {
    const { flash } = usePage().props as PageProps;

    const cancel = () => {
        if (!confirm('Cancel this pending request?')) return;
        router.post(route('teacher.venue-change-requests.cancel', requestRecord.id));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs(requestRecord.id)}>
            <Head title={`Venue Change Request #${requestRecord.id}`} />
            <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Request #{requestRecord.id}</h1>
                        <p className="mt-1 text-sm text-slate-500">{requestRecord.status_label || requestRecord.status}</p>
                    </div>
                    <Link href={route('teacher.venue-change-requests.index')} className="text-sm font-medium text-blue-600 hover:underline">
                        Back to list
                    </Link>
                </div>

                {flash?.success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{flash.success}</div>}
                {flash?.error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{flash.error}</div>}

                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 text-sm">
                    <p>
                        <span className="font-semibold">Replacement venue:</span> {requestRecord.authorized_classroom?.name}
                    </p>
                    <p>
                        <span className="font-semibold">Period:</span> {requestRecord.period_label}
                    </p>
                    <p>
                        <span className="font-semibold">Type:</span> {requestRecord.authorization_type.replace('_', ' ')}
                    </p>
                    <p>
                        <span className="font-semibold">Reason:</span> {requestRecord.reason}
                    </p>
                    {requestRecord.notes && (
                        <p>
                            <span className="font-semibold">Notes:</span> {requestRecord.notes}
                        </p>
                    )}
                    {requestRecord.admin_comments && (
                        <p>
                            <span className="font-semibold">Reviewer feedback:</span> {requestRecord.admin_comments}
                        </p>
                    )}
                    {requestRecord.reviewer?.name && (
                        <p>
                            <span className="font-semibold">Reviewed by:</span> {requestRecord.reviewer.name}
                        </p>
                    )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-6">
                    <h2 className="mb-3 text-sm font-semibold text-slate-900">Affected schedules</h2>
                    <ul className="space-y-2 text-sm text-slate-700">
                        {(requestRecord.items || []).map((item) => (
                            <li key={item.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                                {item.timetable?.course?.name || 'Work period'} · {item.timetable?.day_of_week || item.timetable?.day}{' '}
                                {item.timetable?.start_time}–{item.timetable?.end_time}
                                {item.original_classroom?.name ? ` · Original: ${item.original_classroom.name}` : ''}
                            </li>
                        ))}
                    </ul>
                </div>

                {requestRecord.status === 'pending' && (
                    <button
                        type="button"
                        onClick={cancel}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                    >
                        Cancel request
                    </button>
                )}
            </div>
        </AppLayout>
    );
}
