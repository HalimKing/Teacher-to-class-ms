import { ReportChartCard, StatusBadge, chartOptions } from '@/components/reports/shared';
import { ReportErrorState, ReportLoadingState } from '@/components/reports/ReportStates';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Title, Tooltip } from 'chart.js';
import { ArrowLeft, Calendar, Clock, TrendingUp, User } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);

interface TeacherInfo {
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
    geolocation_status: string;
    face_verification_status: string;
    face_match_score: number | null;
    attendance_source: string;
    course_class: string;
    created_at: string;
}

interface IndividualReport {
    summary: {
        total_records: number;
        present_count: number;
        late_count: number;
        completed_count: number;
        attendance_rate: number;
        average_check_in_time: string | null;
        average_check_out_time: string | null;
        face_verified_count: number;
        geolocation_verified_count: number;
        average_working_hours: string | null;
    };
    monthlyStatistics: Array<{ month: string; total: number; present: number; late: number; attendance_rate: number }>;
    attendanceTrend: Array<{ label: string; present: number; late: number; total: number }>;
    attendanceCalendar: Array<{ date: string; status: string; present: boolean; late: boolean }>;
    records: AttendanceRecord[];
}

interface PageProps {
    teacher: TeacherInfo;
    initialFilters: { start_date: string; end_date: string };
}

export default function TeacherAttendanceReportShow({ teacher, initialFilters }: PageProps) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/admin/dashboard' },
        { title: 'Teacher Attendance Report', href: '/admin/attendance' },
        { title: teacher.name, href: `/admin/attendance/${teacher.id}` },
    ];

    const [filters, setFilters] = useState(initialFilters);
    const [report, setReport] = useState<IndividualReport | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchReport = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams(filters);
            const response = await fetch(`/admin/attendance/${teacher.id}/data?${params}`);
            const payload = await response.json();
            if (!response.ok || !payload.success) throw new Error(payload.message || 'Failed to load individual report');
            setReport(payload.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load individual report');
        } finally {
            setIsLoading(false);
        }
    }, [filters, teacher.id]);

    useEffect(() => { fetchReport(); }, [fetchReport]);

    if (isLoading && !report) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title={`${teacher.name} - Attendance Report`} />
                <ReportLoadingState message="Loading teacher attendance report..." />
            </AppLayout>
        );
    }

    if (error && !report) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title={`${teacher.name} - Attendance Report`} />
                <ReportErrorState error={error} onRetry={fetchReport} />
            </AppLayout>
        );
    }

    const summary = report?.summary;
    const trendChart = report ? {
        labels: report.attendanceTrend.map((item) => item.label),
        datasets: [
            { label: 'Present', data: report.attendanceTrend.map((item) => item.present), borderColor: 'rgb(34, 197, 94)', backgroundColor: 'rgba(34, 197, 94, 0.2)', tension: 0.3 },
            { label: 'Late', data: report.attendanceTrend.map((item) => item.late), borderColor: 'rgb(245, 158, 11)', backgroundColor: 'rgba(245, 158, 11, 0.2)', tension: 0.3 },
        ],
    } : null;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${teacher.name} - Attendance Report`} />
            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-4 md:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <Link href="/admin/attendance" className="mb-3 inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"><ArrowLeft className="h-4 w-4" /> Back to reports</Link>
                        <h1 className="text-2xl font-bold text-sidebar-foreground">{teacher.name}</h1>
                        <p className="mt-1 text-sm text-sidebar-foreground/60">Individual teacher attendance report</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <input type="date" value={filters.start_date} onChange={(e) => setFilters((p) => ({ ...p, start_date: e.target.value }))} className="rounded-lg border border-sidebar-border/50 px-3 py-2 text-sm" />
                        <input type="date" value={filters.end_date} onChange={(e) => setFilters((p) => ({ ...p, end_date: e.target.value }))} className="rounded-lg border border-sidebar-border/50 px-3 py-2 text-sm" />
                        <button onClick={fetchReport} className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800">Apply</button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div className="rounded-xl border border-sidebar-border/70 bg-white p-4 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent lg:col-span-1">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="rounded-full bg-blue-50 p-3 text-blue-600"><User className="h-5 w-5" /></div>
                            <div><h2 className="font-semibold text-sidebar-foreground">Teacher Profile</h2><p className="text-sm text-sidebar-foreground/60">{teacher.employee_id}</p></div>
                        </div>
                        <dl className="space-y-3 text-sm">
                            <InfoRow label="Email" value={teacher.email} />
                            <InfoRow label="Department" value={teacher.department ?? 'N/A'} />
                            <InfoRow label="Faculty" value={teacher.faculty ?? 'N/A'} />
                            <InfoRow label="Face Enrollment" value={teacher.face_enrollment_status.replace(/_/g, ' ')} />
                        </dl>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-2">
                        <SummaryCard icon={Calendar} title="Total Records" value={String(summary?.total_records ?? 0)} />
                        <SummaryCard icon={TrendingUp} title="Attendance Rate" value={`${summary?.attendance_rate ?? 0}%`} />
                        <SummaryCard icon={Clock} title="Avg Check-in" value={summary?.average_check_in_time ?? '—'} />
                        <SummaryCard icon={Clock} title="Avg Check-out" value={summary?.average_check_out_time ?? '—'} />
                        <SummaryCard icon={Clock} title="Avg Working Hours" value={summary?.average_working_hours ?? '—'} />
                        <SummaryCard icon={TrendingUp} title="Face Verified" value={String(summary?.face_verified_count ?? 0)} />
                    </div>
                </div>

                {trendChart && (
                    <ReportChartCard title="Attendance Trend">
                        <div className="h-72"><Line data={trendChart} options={chartOptions} /></div>
                    </ReportChartCard>
                )}

                <div className="rounded-xl border border-sidebar-border/70 bg-white p-4 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                    <h2 className="mb-4 text-lg font-semibold text-sidebar-foreground">Attendance Calendar</h2>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
                        {report?.attendanceCalendar.map((day) => (
                            <div key={day.date} className={`rounded-lg border p-2 text-center text-xs ${day.present ? (day.late ? 'border-amber-300 bg-amber-50' : 'border-green-300 bg-green-50') : 'border-gray-200 bg-gray-50'}`}>
                                <div className="font-medium">{new Date(day.date).getDate()}</div>
                                <div className="text-sidebar-foreground/60">{day.present ? (day.late ? 'Late' : 'Present') : day.status}</div>
                            </div>
                        ))}
                    </div>
                    {report?.attendanceCalendar.length === 0 && <p className="text-sm text-sidebar-foreground/60">No calendar data for this range.</p>}
                </div>

                <div className="rounded-xl border border-sidebar-border/70 bg-white p-4 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                    <h2 className="mb-4 text-lg font-semibold text-sidebar-foreground">Monthly Statistics</h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-sidebar-accent/50 text-left text-xs uppercase tracking-wider text-sidebar-foreground/60">
                                <tr><th className="px-4 py-3">Month</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Present</th><th className="px-4 py-3">Late</th><th className="px-4 py-3">Rate</th></tr>
                            </thead>
                            <tbody>
                                {report?.monthlyStatistics.map((month) => (
                                    <tr key={month.month} className="border-t border-sidebar-border/40">
                                        <td className="px-4 py-3">{month.month}</td><td className="px-4 py-3">{month.total}</td><td className="px-4 py-3">{month.present}</td><td className="px-4 py-3">{month.late}</td><td className="px-4 py-3">{month.attendance_rate}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="rounded-xl border border-sidebar-border/70 bg-white shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                    <div className="border-b border-sidebar-border/50 p-4"><h2 className="text-lg font-semibold text-sidebar-foreground">Recent Attendance Records</h2></div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-sidebar-accent/50 text-left text-xs uppercase tracking-wider text-sidebar-foreground/60">
                                <tr>
                                    <th className="px-4 py-3">Date</th><th className="px-4 py-3">Course/Class</th><th className="px-4 py-3">Check-in</th><th className="px-4 py-3">Check-out</th><th className="px-4 py-3">Hours</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Geo</th><th className="px-4 py-3">Face</th><th className="px-4 py-3">Source</th>
                                </tr>
                            </thead>
                            <tbody>
                                {report?.records.slice(0, 20).map((record) => (
                                    <tr key={record.id} className="border-t border-sidebar-border/40">
                                        <td className="px-4 py-3">{record.date}</td>
                                        <td className="px-4 py-3">{record.course_class}</td>
                                        <td className="px-4 py-3">{record.check_in_time ?? '—'}</td>
                                        <td className="px-4 py-3">{record.check_out_time ?? '—'}</td>
                                        <td className="px-4 py-3">{record.working_hours ?? '—'}</td>
                                        <td className="px-4 py-3"><StatusBadge status={record.attendance_status} /></td>
                                        <td className="px-4 py-3">{record.geolocation_status}</td>
                                        <td className="px-4 py-3">{record.face_verification_status}</td>
                                        <td className="px-4 py-3">{record.attendance_source}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {report?.records.length === 0 && <div className="p-8 text-center text-sidebar-foreground/60">No attendance records in this date range.</div>}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (<div><dt className="text-sidebar-foreground/60">{label}</dt><dd className="font-medium text-sidebar-foreground">{value}</dd></div>);
}

function SummaryCard({ icon: Icon, title, value }: { icon: React.ComponentType<{ className?: string }>; title: string; value: string }) {
    return (
        <div className="rounded-xl border border-sidebar-border/70 bg-white p-4 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
            <div className="flex items-center justify-between">
                <div><p className="text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">{title}</p><p className="mt-2 text-2xl font-bold text-sidebar-foreground">{value}</p></div>
                <div className="rounded-lg bg-blue-50 p-2 text-blue-600"><Icon className="h-5 w-5" /></div>
            </div>
        </div>
    );
}
