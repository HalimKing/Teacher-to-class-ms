import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { can } from '@/lib/can';

interface RequestRecord {
    id: number;
    status: string;
    status_label?: string;
    period_label?: string;
    reason: string;
    notes?: string | null;
    authorization_type: string;
    start_time?: string | null;
    end_time?: string | null;
    admin_comments?: string | null;
    reviewed_at?: string | null;
    resulting_authorization_id?: number | null;
    staff?: { title?: string; first_name?: string; last_name?: string; employee_id?: string };
    authorized_classroom?: { name?: string } | null;
    reviewer?: { name?: string } | null;
    items?: Array<{
        id: number;
        timetable?: { day_of_week?: string; day?: string; start_time?: string; end_time?: string; course?: { name?: string } | null } | null;
        original_classroom?: { name?: string } | null;
    }>;
    resulting_authorizations?: Array<{ id: number; status?: string }>;
}

interface PageProps {
    requestRecord: RequestRecord;
    flash?: { success?: string; error?: string };
}

const breadcrumbs = (id: number): BreadcrumbItem[] => [
    { title: 'Dashboard', href: '/admin/dashboard' },
    { title: 'Venue Change Requests', href: '/admin/venue-change-requests' },
    { title: `Request #${id}`, href: `/admin/venue-change-requests/${id}` },
];

export default function VenueChangeRequestShow({ requestRecord }: PageProps) {
    const { flash } = usePage().props as PageProps;
    const canManage = can('admin.venue-change-requests.manage');
    const form = useForm({ admin_comments: requestRecord.admin_comments || '' });

    const approve = () => form.post(route('admin.venue-change-requests.approve', requestRecord.id));
    const reject = () => form.post(route('admin.venue-change-requests.reject', requestRecord.id));

    return (
        <AppLayout breadcrumbs={breadcrumbs(requestRecord.id)}>
            <Head title={`Venue Change Request #${requestRecord.id}`} />
            <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Venue Change Request #{requestRecord.id}</h1>
                    <p className="mt-1 text-sm text-slate-500">{requestRecord.status_label || requestRecord.status}</p>
                </div>

                {flash?.success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{flash.success}</div>}
                {flash?.error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{flash.error}</div>}

                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 text-sm">
                    <p>
                        <span className="font-semibold">Requester:</span> {requestRecord.staff?.title} {requestRecord.staff?.first_name}{' '}
                        {requestRecord.staff?.last_name}
                    </p>
                    <p>
                        <span className="font-semibold">Replacement venue:</span> {requestRecord.authorized_classroom?.name}
                    </p>
                    <p>
                        <span className="font-semibold">Period:</span> {requestRecord.period_label}
                        {requestRecord.start_time || requestRecord.end_time
                            ? ` · ${requestRecord.start_time || '—'} – ${requestRecord.end_time || '—'}`
                            : ''}
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

                {requestRecord.status === 'pending' && canManage ? (
                    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
                        <label className="block space-y-1.5">
                            <span className="text-sm font-medium">Reviewer comments</span>
                            <textarea
                                value={form.data.admin_comments}
                                onChange={(e) => form.setData('admin_comments', e.target.value)}
                                className="min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            />
                        </label>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                disabled={form.processing}
                                onClick={approve}
                                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                                Approve & authorize
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
                    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                        {requestRecord.reviewer?.name && <p>Reviewed by {requestRecord.reviewer.name}.</p>}
                        {requestRecord.admin_comments && <p>Comments: {requestRecord.admin_comments}</p>}
                        {requestRecord.status === 'approved' && requestRecord.resulting_authorization_id && (
                            <p>
                                <Link
                                    href={route('admin.venue-change-authorizations.show', requestRecord.resulting_authorization_id)}
                                    className="font-medium text-blue-600 hover:underline"
                                >
                                    Open resulting authorization
                                </Link>
                            </p>
                        )}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
