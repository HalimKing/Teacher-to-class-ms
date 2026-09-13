import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/teacher/dashboard' },
    { title: 'Unit Attendance', href: '/teacher/unit/attendance' },
];

interface AttendanceRecord {
    id: number;
    kind: string;
    staff_name: string;
    employee_id: string | null;
    staff_type: string | null;
    date: string;
    status: string;
    check_in: string | null;
    check_out: string | null;
    self_reported?: boolean;
    source?: string | null;
    reason?: string | null;
}

interface UnitAttendancePageProps {
    records: AttendanceRecord[];
    staff: Array<{ id: number; first_name: string; last_name: string; title?: string; employee_id: string }>;
    filters: { date_from: string; date_to: string; teacher_id?: string | number | null };
    leadershipScope?: { role_label?: string | null; faculty_name?: string | null; department_name?: string | null } | null;
}

export default function UnitAttendancePage({ records, staff, filters, leadershipScope }: UnitAttendancePageProps) {
    const [dateFrom, setDateFrom] = useState(filters.date_from);
    const [dateTo, setDateTo] = useState(filters.date_to);
    const [teacherId, setTeacherId] = useState(filters.teacher_id ? String(filters.teacher_id) : '');

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        router.get(route('teacher.unit.attendance.index'), {
            date_from: dateFrom,
            date_to: dateTo,
            teacher_id: teacherId || undefined,
        });
    };

    const unitLabel = leadershipScope?.department_name || leadershipScope?.faculty_name || 'your unit';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Unit Attendance" />
            <div className="flex min-w-0 flex-col gap-6 p-3 sm:p-4 md:p-6">
                <div>
                    <h1 className="text-xl font-semibold text-sidebar-foreground sm:text-2xl">Unit Attendance</h1>
                    <p className="mt-1 text-sm text-sidebar-foreground/70">
                        {leadershipScope?.role_label || 'Leadership'} · {unitLabel}
                    </p>
                    <Link href={route('teacher.unit.self-reported-absences.index')} className="mt-2 inline-flex min-h-10 items-center text-sm font-medium text-primary hover:underline">
                        View self-reported absences
                    </Link>
                </div>

                <form onSubmit={handleSubmit} className="grid gap-4 rounded-2xl border border-sidebar-border/60 bg-card p-4 md:grid-cols-4">
                    <label className="text-sm">
                        <span className="mb-1 block text-sidebar-foreground/60">From</span>
                        <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-11 w-full rounded-lg border border-sidebar-border/80 bg-background px-3 py-2 text-base md:text-sm" />
                    </label>
                    <label className="text-sm">
                        <span className="mb-1 block text-sidebar-foreground/60">To</span>
                        <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-11 w-full rounded-lg border border-sidebar-border/80 bg-background px-3 py-2 text-base md:text-sm" />
                    </label>
                    <label className="text-sm">
                        <span className="mb-1 block text-sidebar-foreground/60">Staff member</span>
                        <select value={teacherId} onChange={(event) => setTeacherId(event.target.value)} className="h-11 w-full rounded-lg border border-sidebar-border/80 bg-background px-3 py-2 text-base md:text-sm">
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

                <div className="space-y-3 md:hidden">
                    {records.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-sidebar-border px-4 py-8 text-center text-sm text-sidebar-foreground/60">
                            No attendance records in this range for your unit.
                        </div>
                    ) : (
                        records.map((record) => (
                            <div key={`${record.kind}-${record.id}`} className="rounded-2xl border border-sidebar-border/60 bg-card p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate font-medium text-sidebar-foreground">{record.staff_name}</p>
                                        <p className="truncate text-xs text-sidebar-foreground/60">{record.employee_id || record.staff_type}</p>
                                    </div>
                                    <span className="shrink-0 capitalize text-xs font-medium text-sidebar-foreground/70">{record.status?.replaceAll('_', ' ')}</span>
                                </div>
                                <p className="mt-2 text-sm text-sidebar-foreground/70">{record.date}</p>
                                <p className="mt-1 text-xs text-sidebar-foreground/55">
                                    In {record.check_in || '—'} · Out {record.check_out || '—'}
                                </p>
                                {record.self_reported && (
                                    <Link
                                        href={route('teacher.unit.self-reported-absences.show', { kind: record.kind, attendance: record.id })}
                                        className="mt-3 inline-flex min-h-10 items-center text-sm font-medium text-primary hover:underline"
                                    >
                                        View reason
                                    </Link>
                                )}
                            </div>
                        ))
                    )}
                </div>

                <div className="hidden overflow-hidden rounded-2xl border border-sidebar-border/60 bg-card md:block">
                    <table className="min-w-full divide-y divide-sidebar-border/60">
                        <thead className="bg-muted/40 text-left text-xs font-semibold tracking-wide text-sidebar-foreground/60 uppercase">
                            <tr>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Staff member</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Source</th>
                                <th className="px-4 py-3">Check in</th>
                                <th className="px-4 py-3">Check out</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-sidebar-border/50">
                            {records.map((record) => (
                                <tr key={`${record.kind}-${record.id}`}>
                                    <td className="px-4 py-3 text-sm">{record.date}</td>
                                    <td className="px-4 py-3">
                                        <div className="font-medium">{record.staff_name}</div>
                                        <div className="text-xs text-sidebar-foreground/60">{record.employee_id}</div>
                                    </td>
                                    <td className="px-4 py-3 text-sm capitalize">{record.staff_type}</td>
                                    <td className="px-4 py-3 text-sm capitalize">{record.status?.replaceAll('_', ' ')}</td>
                                    <td className="px-4 py-3 text-sm">{record.source || '—'}</td>
                                    <td className="px-4 py-3 text-sm">{record.check_in || '—'}</td>
                                    <td className="px-4 py-3 text-sm">{record.check_out || '—'}</td>
                                    <td className="px-4 py-3 text-right text-sm">
                                        {record.self_reported ? (
                                            <Link
                                                href={route('teacher.unit.self-reported-absences.show', { kind: record.kind, attendance: record.id })}
                                                className="font-medium text-primary hover:underline"
                                            >
                                                View reason
                                            </Link>
                                        ) : (
                                            '—'
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {records.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-sidebar-foreground/60">
                                        No attendance records in this range for your unit.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </AppLayout>
    );
}
