import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
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
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <div>
                    <h1 className="text-2xl font-semibold text-sidebar-foreground">Unit Attendance</h1>
                    <p className="mt-1 text-sm text-sidebar-foreground/70">
                        {leadershipScope?.role_label || 'Leadership'} · {unitLabel}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="grid gap-4 rounded-2xl border border-sidebar-border/60 bg-white p-4 dark:bg-sidebar-accent md:grid-cols-4">
                    <label className="text-sm">
                        <span className="mb-1 block text-sidebar-foreground/60">From</span>
                        <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="w-full rounded-lg border px-3 py-2" />
                    </label>
                    <label className="text-sm">
                        <span className="mb-1 block text-sidebar-foreground/60">To</span>
                        <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="w-full rounded-lg border px-3 py-2" />
                    </label>
                    <label className="text-sm">
                        <span className="mb-1 block text-sidebar-foreground/60">Staff member</span>
                        <select value={teacherId} onChange={(event) => setTeacherId(event.target.value)} className="w-full rounded-lg border px-3 py-2">
                            <option value="">All staff in unit</option>
                            {staff.map((member) => (
                                <option key={member.id} value={member.id}>
                                    {member.title} {member.first_name} {member.last_name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <div className="flex items-end">
                        <button type="submit" className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                            Apply filters
                        </button>
                    </div>
                </form>

                <div className="overflow-hidden rounded-2xl border border-sidebar-border/60 bg-white dark:bg-sidebar-accent">
                    <table className="min-w-full divide-y divide-sidebar-border/60">
                        <thead className="bg-muted/40 text-left text-xs font-semibold tracking-wide text-sidebar-foreground/60 uppercase">
                            <tr>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Staff member</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Check in</th>
                                <th className="px-4 py-3">Check out</th>
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
                                    <td className="px-4 py-3 text-sm">{record.check_in || '—'}</td>
                                    <td className="px-4 py-3 text-sm">{record.check_out || '—'}</td>
                                </tr>
                            ))}
                            {records.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-sidebar-foreground/60">
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
