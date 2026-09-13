import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/teacher/dashboard' },
    { title: 'Venue Change Authorizations', href: '/teacher/unit/venue-change-authorizations' },
];

interface AuthorizationRow {
    id: number;
    status: string;
    status_label: string;
    period_label: string;
    staff_name: string;
    staff_role?: string;
    employee_id?: string | null;
    original_venue: string;
    authorized_venue: string;
    session_label: string;
    reason: string;
    source_request_id?: number | null;
}

interface PageProps {
    authorizations: { data: AuthorizationRow[] };
    staff: Array<{ id: number; first_name: string; last_name: string; title?: string; employee_id: string }>;
    filters: { status?: string; teacher_id?: string | number | null };
    leadershipScope?: { role_label?: string | null; faculty_name?: string | null; department_name?: string | null } | null;
    statusCounts?: { active: number; expired: number; revoked: number };
}

const statusBadge = (status: string) => {
    if (status === 'active') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200';
    if (status === 'revoked') return 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200';
    return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
};

export default function UnitVenueChangeAuthorizationsPage({
    authorizations,
    staff,
    filters,
    leadershipScope,
    statusCounts,
}: PageProps) {
    const [status, setStatus] = useState(filters.status || '');
    const [teacherId, setTeacherId] = useState(filters.teacher_id ? String(filters.teacher_id) : '');
    const unitLabel = leadershipScope?.department_name || leadershipScope?.faculty_name || 'your unit';

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        router.get(route('teacher.unit.venue-change-authorizations.index'), {
            status: status || undefined,
            teacher_id: teacherId || undefined,
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Unit Venue Change Authorizations" />
            <div className="flex min-w-0 flex-col gap-6 p-3 sm:p-4 md:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-xl font-semibold text-sidebar-foreground sm:text-2xl">Venue change authorizations</h1>
                        <p className="mt-1 text-sm text-sidebar-foreground/70">
                            {leadershipScope?.role_label || 'Leadership'} · {unitLabel}. Active authorizations let unit staff mark attendance at an
                            approved replacement venue.
                        </p>
                        {statusCounts && (
                            <p className="mt-2 text-xs text-sidebar-foreground/55">
                                {statusCounts.active} active · {statusCounts.expired} expired · {statusCounts.revoked} revoked
                            </p>
                        )}
                    </div>
                    <Link
                        href={route('teacher.unit.venue-change-authorizations.create')}
                        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                    >
                        New Authorization
                    </Link>
                </div>

                <form onSubmit={handleSubmit} className="grid gap-4 rounded-2xl border border-sidebar-border/60 bg-card p-4 md:grid-cols-3">
                    <label className="text-sm">
                        <span className="mb-1 block text-sidebar-foreground/60">Status</span>
                        <select
                            value={status}
                            onChange={(event) => setStatus(event.target.value)}
                            className="h-11 w-full rounded-lg border border-sidebar-border/80 bg-background px-3 py-2 text-base md:text-sm"
                        >
                            <option value="">All statuses</option>
                            <option value="active">Active</option>
                            <option value="expired">Expired</option>
                            <option value="revoked">Revoked</option>
                        </select>
                    </label>
                    <label className="text-sm">
                        <span className="mb-1 block text-sidebar-foreground/60">Staff member</span>
                        <select
                            value={teacherId}
                            onChange={(event) => setTeacherId(event.target.value)}
                            className="h-11 w-full rounded-lg border border-sidebar-border/80 bg-background px-3 py-2 text-base md:text-sm"
                        >
                            <option value="">All staff in unit</option>
                            {staff.map((member) => (
                                <option key={member.id} value={member.id}>
                                    {member.title} {member.first_name} {member.last_name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <div className="flex items-end">
                        <button type="submit" className="min-h-11 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                            Apply filters
                        </button>
                    </div>
                </form>

                <div className="space-y-3 lg:hidden">
                    {authorizations.data.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-sidebar-border px-4 py-8 text-center text-sm text-sidebar-foreground/60">
                            No venue change authorizations in your unit.
                        </div>
                    ) : (
                        authorizations.data.map((row) => (
                            <Link
                                key={row.id}
                                href={route('teacher.unit.venue-change-authorizations.show', row.id)}
                                className="block rounded-2xl border border-sidebar-border/60 bg-card p-4"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate font-medium text-sidebar-foreground">{row.staff_name}</p>
                                        <p className="truncate text-xs text-sidebar-foreground/60">
                                            {row.staff_role}
                                            {row.employee_id ? ` · ${row.employee_id}` : ''}
                                        </p>
                                    </div>
                                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge(row.status)}`}>
                                        {row.status_label}
                                    </span>
                                </div>
                                <p className="mt-2 text-sm text-sidebar-foreground/75">
                                    {row.original_venue} → {row.authorized_venue}
                                </p>
                                <p className="mt-1 text-xs text-sidebar-foreground/55">{row.period_label}</p>
                                <p className="mt-2 line-clamp-2 text-sm text-sidebar-foreground/70">{row.session_label}</p>
                            </Link>
                        ))
                    )}
                </div>

                <div className="hidden overflow-x-auto rounded-2xl border border-sidebar-border/60 bg-card lg:block">
                    <table className="min-w-full divide-y divide-sidebar-border/60">
                        <thead className="bg-muted/40 text-left text-xs font-semibold tracking-wide text-sidebar-foreground/60 uppercase">
                            <tr>
                                <th className="px-4 py-3">Staff member</th>
                                <th className="px-4 py-3">Venues</th>
                                <th className="px-4 py-3">Period</th>
                                <th className="px-4 py-3">Session</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-sidebar-border/60 text-sm">
                            {authorizations.data.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center text-sidebar-foreground/50">
                                        No venue change authorizations in your unit.
                                    </td>
                                </tr>
                            ) : (
                                authorizations.data.map((row) => (
                                    <tr key={row.id}>
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-sidebar-foreground">{row.staff_name}</p>
                                            <p className="text-xs text-sidebar-foreground/55">{row.employee_id}</p>
                                        </td>
                                        <td className="px-4 py-3 text-sidebar-foreground/80">
                                            {row.original_venue} → {row.authorized_venue}
                                        </td>
                                        <td className="px-4 py-3 text-sidebar-foreground/80">{row.period_label}</td>
                                        <td className="max-w-xs truncate px-4 py-3 text-sidebar-foreground/80">{row.session_label}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge(row.status)}`}>
                                                {row.status_label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Link
                                                href={route('teacher.unit.venue-change-authorizations.show', row.id)}
                                                className="font-medium text-primary hover:underline"
                                            >
                                                View
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
