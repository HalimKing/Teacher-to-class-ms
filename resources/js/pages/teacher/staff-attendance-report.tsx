import { ReportErrorState, ReportLoadingState } from '@/components/reports/ReportStates';
import { StatusBadge } from '@/components/reports/shared';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Calendar, CheckCircle, Clock, ShieldCheck, TrendingUp, User } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface StaffInfo {
    id: number;
    name: string;
    email: string;
    employee_id: string;
    department?: string;
    faculty?: string;
    face_enrollment_status: string;
}

interface AttendanceRecord {
    id: number;
    date: string;
    check_in_time: string | null;
    check_out_time: string | null;
    working_hours: string | null;
    attendance_status: string;
    arrival_category?: string | null;
    arrival_category_label?: string;
    minutes_early?: number | null;
    minutes_late?: number | null;
    early_check_in?: boolean;
    geolocation_status: string;
    face_verification_status: string;
    face_match_score: number | null;
    created_at: string;
    classroom?: string;
}

interface IndividualReport {
    summary: {
        total_records: number;
        present_count: number;
        late_count: number;
        early_count?: number;
        on_time_count?: number;
        average_minutes_early?: number;
        early_arrival_percentage?: number;
        completed_count: number;
        attendance_rate: number;
        average_check_in_time: string | null;
        average_check_out_time: string | null;
        face_verified_count: number;
        geolocation_verified_count: number;
    };
    monthlyStatistics: Array<{
        month: string;
        total: number;
        present: number;
        late: number;
        early?: number;
        attendance_rate: number;
    }>;
    records: AttendanceRecord[];
}

interface PageProps {
    staff: StaffInfo;
    initialFilters: { start_date: string; end_date: string };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/teacher/dashboard' },
    { title: 'Attendance Report', href: '/teacher/staff-reports' },
];

export default function StaffAttendanceReportPage({ staff, initialFilters }: PageProps) {
    const [filters, setFilters] = useState(initialFilters);
    const [report, setReport] = useState<IndividualReport | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchReport = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams(filters);
            const response = await fetch(`/teacher/staff-reports/data?${params}`);
            const payload = await response.json();
            if (!response.ok || !payload.success) {
                throw new Error(payload.message || 'Failed to load attendance report');
            }
            setReport(payload.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load attendance report');
        } finally {
            setIsLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    if (isLoading && !report) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Attendance Report" />
                <ReportLoadingState message="Loading your attendance report..." />
            </AppLayout>
        );
    }

    if (error && !report) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Attendance Report" />
                <ReportErrorState error={error} onRetry={fetchReport} />
            </AppLayout>
        );
    }

    const summary = report?.summary;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Attendance Report" />

            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-4 md:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <Link
                            href="/teacher/dashboard"
                            className="mb-3 inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                        >
                            <ArrowLeft className="h-4 w-4" /> Back to dashboard
                        </Link>
                        <h1 className="text-2xl font-bold text-sidebar-foreground">My Attendance Report</h1>
                        <p className="mt-1 text-sm text-sidebar-foreground/60">
                            Personal attendance summary, verification history, and records.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <input
                            type="date"
                            value={filters.start_date}
                            onChange={(e) => setFilters((prev) => ({ ...prev, start_date: e.target.value }))}
                            className="rounded-lg border border-sidebar-border/50 px-3 py-2 text-sm"
                        />
                        <input
                            type="date"
                            value={filters.end_date}
                            onChange={(e) => setFilters((prev) => ({ ...prev, end_date: e.target.value }))}
                            className="rounded-lg border border-sidebar-border/50 px-3 py-2 text-sm"
                        />
                        <button onClick={fetchReport} className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800">
                            Apply
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div className="rounded-xl border border-sidebar-border/70 bg-white p-4 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent lg:col-span-1">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="rounded-full bg-purple-50 p-3 text-purple-600">
                                <User className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-sidebar-foreground">{staff.name}</h2>
                                <p className="text-sm text-sidebar-foreground/60">{staff.employee_id}</p>
                            </div>
                        </div>
                        <dl className="space-y-3 text-sm">
                            <InfoRow label="Email" value={staff.email} />
                            <InfoRow label="Department" value={staff.department ?? 'N/A'} />
                            <InfoRow label="Faculty" value={staff.faculty ?? 'N/A'} />
                            <InfoRow label="Face Enrollment" value={staff.face_enrollment_status.replace(/_/g, ' ')} />
                        </dl>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-2">
                        <SummaryCard icon={Calendar} title="Total Records" value={String(summary?.total_records ?? 0)} />
                        <SummaryCard icon={TrendingUp} title="Attendance Rate" value={`${summary?.attendance_rate ?? 0}%`} />
                        <SummaryCard icon={CheckCircle} title="Early Check-ins" value={String(summary?.early_count ?? 0)} />
                        <SummaryCard icon={Clock} title="Avg Minutes Early" value={String(summary?.average_minutes_early ?? 0)} />
                        <SummaryCard icon={TrendingUp} title="Early Arrival Rate" value={`${summary?.early_arrival_percentage ?? 0}%`} />
                        <SummaryCard icon={Clock} title="Avg Check-in" value={summary?.average_check_in_time ?? '—'} />
                        <SummaryCard icon={Clock} title="Avg Check-out" value={summary?.average_check_out_time ?? '—'} />
                        <SummaryCard icon={ShieldCheck} title="Face Verified" value={String(summary?.face_verified_count ?? 0)} />
                        <SummaryCard icon={ShieldCheck} title="Geo Verified" value={String(summary?.geolocation_verified_count ?? 0)} />
                    </div>
                </div>

                <div className="rounded-xl border border-sidebar-border/70 bg-white p-4 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                    <h2 className="mb-4 text-lg font-semibold text-sidebar-foreground">Monthly Statistics</h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-sidebar-accent/50 text-left text-xs uppercase tracking-wider text-sidebar-foreground/60">
                                <tr>
                                    <th className="px-4 py-3">Month</th>
                                    <th className="px-4 py-3">Total</th>
                                    <th className="px-4 py-3">Present</th>
                                    <th className="px-4 py-3">Early</th>
                                    <th className="px-4 py-3">Late</th>
                                    <th className="px-4 py-3">Rate</th>
                                </tr>
                            </thead>
                            <tbody>
                                {report?.monthlyStatistics.map((month) => (
                                    <tr key={month.month} className="border-t border-sidebar-border/40">
                                        <td className="px-4 py-3">{month.month}</td>
                                        <td className="px-4 py-3">{month.total}</td>
                                        <td className="px-4 py-3">{month.present}</td>
                                        <td className="px-4 py-3">{month.early ?? 0}</td>
                                        <td className="px-4 py-3">{month.late}</td>
                                        <td className="px-4 py-3">{month.attendance_rate}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {report?.monthlyStatistics.length === 0 && (
                            <p className="p-6 text-center text-sm text-sidebar-foreground/60">No monthly data for this range.</p>
                        )}
                    </div>
                </div>

                <div className="rounded-xl border border-sidebar-border/70 bg-white shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                    <div className="border-b border-sidebar-border/50 p-4">
                        <h2 className="text-lg font-semibold text-sidebar-foreground">Attendance History</h2>
                        <p className="text-sm text-sidebar-foreground/60">Face verification and geolocation status included</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-sidebar-accent/50 text-left text-xs uppercase tracking-wider text-sidebar-foreground/60">
                                <tr>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">Location</th>
                                    <th className="px-4 py-3">Check-in</th>
                                    <th className="px-4 py-3">Check-out</th>
                                    <th className="px-4 py-3">Hours</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Arrival</th>
                                    <th className="px-4 py-3">Min Early</th>
                                    <th className="px-4 py-3">Min Late</th>
                                    <th className="px-4 py-3">Geolocation</th>
                                    <th className="px-4 py-3">Face</th>
                                    <th className="px-4 py-3">Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {report?.records.map((record) => (
                                    <tr key={record.id} className="border-t border-sidebar-border/40">
                                        <td className="px-4 py-3">{record.date}</td>
                                        <td className="px-4 py-3">{record.classroom ?? '—'}</td>
                                        <td className="px-4 py-3">{record.check_in_time ?? '—'}</td>
                                        <td className="px-4 py-3">{record.check_out_time ?? '—'}</td>
                                        <td className="px-4 py-3">{record.working_hours ?? '—'}</td>
                                        <td className="px-4 py-3">
                                            <StatusBadge status={record.attendance_status} />
                                        </td>
                                        <td className="px-4 py-3">{record.arrival_category_label ?? '—'}</td>
                                        <td className="px-4 py-3">{record.minutes_early ?? '—'}</td>
                                        <td className="px-4 py-3">{record.minutes_late ?? '—'}</td>
                                        <td className="px-4 py-3">{record.geolocation_status}</td>
                                        <td className="px-4 py-3">{record.face_verification_status}</td>
                                        <td className="px-4 py-3">{record.face_match_score ?? '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {report?.records.length === 0 && (
                            <div className="p-8 text-center text-sidebar-foreground/60">No attendance records in this date range.</div>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <dt className="text-sidebar-foreground/60">{label}</dt>
            <dd className="font-medium text-sidebar-foreground">{value}</dd>
        </div>
    );
}

function SummaryCard({ icon: Icon, title, value }: { icon: React.ComponentType<{ className?: string }>; title: string; value: string }) {
    return (
        <div className="rounded-xl border border-sidebar-border/70 bg-white p-4 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">{title}</p>
                    <p className="mt-2 text-2xl font-bold text-sidebar-foreground">{value}</p>
                </div>
                <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
                    <Icon className="h-5 w-5" />
                </div>
            </div>
        </div>
    );
}
