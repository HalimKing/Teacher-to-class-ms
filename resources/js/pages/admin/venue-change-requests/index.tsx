import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';

interface RequestRow {
    id: number;
    status: string;
    status_label?: string;
    period_label?: string;
    reason: string;
    authorization_type: string;
    schedule_count?: number;
    authorized_classroom?: { name?: string } | null;
    staff?: { first_name?: string; last_name?: string; employee_id?: string };
    created_at?: string;
}

interface PageProps {
    requests: { data: RequestRow[] };
    filters: { status?: string; search?: string };
    statusCounts: { pending: number; approved: number; rejected: number };
    flash?: { success?: string; error?: string };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/admin/dashboard' },
    { title: 'Venue Change Requests', href: '/admin/venue-change-requests' },
];

const statusBadge = (status: string) => {
    if (status === 'pending') return 'bg-amber-100 text-amber-800';
    if (status === 'approved') return 'bg-emerald-100 text-emerald-800';
    return 'bg-rose-100 text-rose-800';
};

export default function VenueChangeRequestIndex({ requests, filters }: PageProps) {
    const { flash } = usePage().props as PageProps;
    const [search, setSearch] = useState(filters.search || '');
    const [status, setStatus] = useState(filters.status || '');

    const applyFilters = () => {
        router.get(route('admin.venue-change-requests.index'), { search, status }, { preserveState: true, replace: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Venue Change Requests" />
            <div className="space-y-6 p-4 md:p-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Venue Change Requests</h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Review administrator-submitted requests. Approved requests become Venue Change Authorizations.
                            Direct authorizations remain available under Schedules → Venue Change Authorizations.
                        </p>
                    </div>
                    <Link
                        href={route('admin.venue-change-authorizations.index')}
                        className="text-sm font-medium text-blue-600 hover:underline"
                    >
                        View authorizations
                    </Link>
                </div>

                {flash?.success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{flash.success}</div>}
                {flash?.error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{flash.error}</div>}

                <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search staff..."
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                    <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                        <option value="">All statuses</option>
                        <option value="pending">Pending approval</option>
                        <option value="approved">Approved authorization</option>
                        <option value="rejected">Rejected request</option>
                    </select>
                    <button type="button" onClick={applyFilters} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200">
                        Filter
                    </button>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <tr>
                                <th className="px-4 py-3">Staff</th>
                                <th className="px-4 py-3">Replacement venue</th>
                                <th className="px-4 py-3">Period</th>
                                <th className="px-4 py-3">Schedules</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {requests.data.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                                        No venue change requests found.
                                    </td>
                                </tr>
                            ) : (
                                requests.data.map((row) => (
                                    <tr key={row.id}>
                                        <td className="px-4 py-3 font-medium">
                                            {row.staff?.first_name} {row.staff?.last_name}
                                        </td>
                                        <td className="px-4 py-3">{row.authorized_classroom?.name || '—'}</td>
                                        <td className="px-4 py-3">{row.period_label || '—'}</td>
                                        <td className="px-4 py-3">{row.schedule_count ?? '—'}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge(row.status)}`}>
                                                {row.status_label || row.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Link
                                                href={route('admin.venue-change-requests.show', row.id)}
                                                className="font-medium text-blue-600 hover:underline"
                                            >
                                                {row.status === 'pending' ? 'Review' : 'View'}
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </AppLayout>
    );
}
