import RecentNotificationsWidget from '@/components/notifications/RecentNotificationsWidget';
import { type TeacherNotificationItem } from '@/components/notifications/types';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { SharedData, type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowRight,
    Bell,
    BookOpen,
    CalendarDays,
    CheckCircle,
    ClipboardList,
    Clock,
    Inbox,
    MapPin,
    Sparkles,
    UserCheck,
    Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Title, Tooltip } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Title, Tooltip, Legend);

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Dashboard', href: '/teacher/dashboard' }];

const timeFilters = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This week' },
    { id: 'month', label: 'This month' },
    { id: 'semester', label: 'This semester' },
];

const generateAttendanceData = (timeRange: string) => {
    switch (timeRange) {
        case 'today':
            return {
                labels: ['9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM'],
                attendance: [92, 94, 96, 95, 93, 94, 95],
            };
        case 'week':
            return {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
                attendance: [91, 93, 94, 95, 93],
            };
        case 'month':
        default:
            return {
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                attendance: [90, 92, 94, 95],
            };
    }
};

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false },
        tooltip: {
            backgroundColor: '#0f172a',
            padding: 12,
            displayColors: false,
        },
    },
    scales: {
        x: {
            grid: { display: false },
            ticks: { color: '#64748b', font: { size: 11 } },
            border: { display: false },
        },
        y: {
            min: 0,
            max: 100,
            grid: { color: 'rgba(148, 163, 184, 0.18)' },
            ticks: { color: '#64748b', font: { size: 11 }, callback: (value: string | number) => `${value}%` },
            border: { display: false },
        },
    },
};

interface TodayLectures {
    id: number;
    program: string;
    level: string;
    course: string;
    code: string;
    room: string;
    type: string;
    students: number;
    start_time: string;
    end_time: string;
    duration: string;
    status: string;
}

interface AttendanceData {
    labels: string[];
    attendance: number[];
}

interface MetricsData {
    totalClasses: number;
    attendanceTodayCount: number;
    attendanceTodayTarget: number;
    pendingAttendance: number;
    totalRecords: number;
}

interface TeacherProfile {
    name: string;
    email: string;
    phone: string;
    title: string;
    subject: string;
    faculty: string;
    department: string;
    office: string;
    experience: string;
    rating: number;
    totalStudents: number;
    status: string;
    nextClass: string;
    upcomingOfficeHours: string;
    leadership_role_label?: string | null;
    leadership_unit?: string | null;
}

interface UpcomingReminder {
    id: number;
    title: string;
    reminder_at: string;
    session: string | null;
}

type DashboardNotification = TeacherNotificationItem;

function to12Hour(time24?: string | null) {
    if (!time24) return '—';

    const [hours, minutes] = time24.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return time24;

    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;

    return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

function greetingForNow() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
}

function lectureStatus(status: string) {
    if (status === 'finished') {
        return { label: 'Finished', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' };
    }
    if (status === 'ongoing') {
        return { label: 'In session', className: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200' };
    }
    if (status === 'pending') {
        return { label: 'Pending', className: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200' };
    }

    return { label: 'Upcoming', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' };
}

export default function TeacherDashboard({
    upcomingClasses,
    todayLectures,
    attendanceData,
    metricsData,
    profileData,
    upcomingReminders = [],
    staffType,
    pendingVenueChangeApprovals = 0,
}: {
    upcomingClasses: TodayLectures[];
    todayLectures: TodayLectures[];
    attendanceData: AttendanceData;
    metricsData: MetricsData;
    profileData: TeacherProfile;
    upcomingReminders?: UpcomingReminder[];
    staffType?: string;
    pendingVenueChangeApprovals?: number;
}) {
    const [timeFilter, setTimeFilter] = useState('week');
    const [chartData, setChartData] = useState<AttendanceData>(attendanceData);
    const [isLoading, setIsLoading] = useState(false);
    const page = usePage<SharedData>();

    const { auth } = page.props;
    const unreadNotifications = (page.props as { unreadNotifications?: DashboardNotification[] }).unreadNotifications ?? [];
    const isLecturer = (staffType || String(auth.user.staff_type || 'lecturer')) === 'lecturer';
    const lectures = todayLectures.length > 0 ? todayLectures : upcomingClasses;
    const initials = `${(auth.user.first_name ?? '')[0] ?? ''}${(auth.user.last_name ?? '')[0] ?? ''}`.toUpperCase() || 'ST';
    const todayLabel = new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });
    const nextClass = lectures.find((lecture) => lecture.status === 'ongoing' || lecture.status === 'upcoming');

    useEffect(() => {
        const fetchAttendanceData = async () => {
            if (!isLecturer) {
                setChartData({ labels: [], attendance: [] });
                return;
            }

            setIsLoading(true);
            try {
                const response = await fetch(`/api/teacher/attendance-data?timeRange=${timeFilter}`);
                if (response.ok) {
                    const data = await response.json();
                    setChartData(data);
                } else {
                    setChartData(generateAttendanceData(timeFilter));
                }
            } catch {
                setChartData(generateAttendanceData(timeFilter));
            } finally {
                setIsLoading(false);
            }
        };

        fetchAttendanceData();
    }, [timeFilter, isLecturer]);

    const attendanceChartData = useMemo(
        () => ({
            labels: chartData.labels,
            datasets: [
                {
                    label: 'Attendance rate (%)',
                    data: chartData.attendance,
                    borderColor: 'rgb(79, 70, 229)',
                    backgroundColor: 'rgba(79, 70, 229, 0.12)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointBackgroundColor: 'rgb(79, 70, 229)',
                },
            ],
        }),
        [chartData],
    );

    const heroStats = isLecturer
        ? [
              { label: 'Today', value: `${lectures.length} class${lectures.length === 1 ? '' : 'es'}` },
              { label: 'Pending', value: `${metricsData.pendingAttendance} to mark` },
              { label: 'Students', value: `${profileData.totalStudents}` },
          ]
        : [
              { label: 'Role', value: profileData.leadership_role_label || 'Administrative staff' },
              { label: 'Unit', value: profileData.leadership_unit || profileData.department || '—' },
              { label: 'Approvals', value: `${pendingVenueChangeApprovals} waiting` },
          ];

    const lecturerActions = [
        { href: '/teacher/attendance', label: 'Take attendance', icon: UserCheck },
        { href: '/teacher/timetable', label: 'My schedules', icon: CalendarDays },
        { href: '/teacher/my-courses', label: 'My courses', icon: BookOpen },
        { href: '/teacher/reminders', label: 'Reminders', icon: Bell },
        { href: '/teacher/communication/inbox', label: 'Inbox', icon: Inbox },
        { href: '/teacher/attendance-explanations', label: 'Explanations', icon: ClipboardList },
    ];

    const adminActions = [
        { href: '/teacher/staff-attendance', label: 'Take attendance', icon: UserCheck },
        { href: '/teacher/staff-reports', label: 'Attendance report', icon: ClipboardList },
        { href: '/teacher/attendance-explanations', label: 'Explanations', icon: AlertCircle },
        { href: '/teacher/venue-change-requests', label: 'Venue changes', icon: MapPin },
        { href: '/teacher/communication/inbox', label: 'Inbox', icon: Inbox },
    ];

    const metrics = [
        {
            title: 'Classes assigned',
            value: metricsData.totalClasses.toString().padStart(2, '0'),
            hint: 'This academic year',
            href: '/teacher/my-courses',
            icon: CalendarDays,
            iconClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200',
        },
        {
            title: 'Attendance today',
            value: `${metricsData.attendanceTodayCount}`,
            hint: `of ${metricsData.attendanceTodayTarget} sessions`,
            href: '/teacher/attendance',
            icon: CheckCircle,
            iconClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200',
        },
        {
            title: 'Pending attendance',
            value: metricsData.pendingAttendance.toString().padStart(2, '0'),
            hint: metricsData.pendingAttendance > 0 ? 'Needs attention' : 'All caught up',
            href: '/teacher/attendance',
            icon: AlertCircle,
            iconClass:
                metricsData.pendingAttendance > 0
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200'
                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200',
        },
        {
            title: 'Total records',
            value: metricsData.totalRecords.toLocaleString(),
            hint: 'Lifetime',
            href: '/teacher/reports',
            icon: BookOpen,
            iconClass: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-200',
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Teacher Dashboard" />

            <div className="min-h-full bg-gradient-to-b from-indigo-50/80 via-slate-50 to-slate-50 dark:from-indigo-950/20 dark:via-background dark:to-background">
                <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-5 p-3 pb-10 sm:p-4 md:p-6 lg:p-8">
                    <section className="overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-sm shadow-indigo-100/70 dark:border-indigo-900/40 dark:bg-card dark:shadow-none">
                        <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-slate-800 px-4 py-5 text-white sm:px-8 sm:py-6">
                            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                                <div className="min-w-0">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase ring-1 ring-white/20">
                                        <Sparkles className="size-3.5" />
                                        {isLecturer ? 'Lecturer home' : 'Staff home'}
                                    </span>
                                    <div className="mt-4 flex items-start gap-4">
                                        <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-lg font-semibold ring-1 ring-white/20 sm:size-16 sm:text-xl">
                                            {initials}
                                        </div>
                                        <div className="min-w-0">
                                            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                                                {greetingForNow()}, {auth.user.title} {auth.user.first_name}
                                            </h1>
                                            <p className="mt-2 max-w-2xl text-sm text-white/90">
                                                {profileData.subject} · {profileData.department}
                                                {profileData.leadership_role_label
                                                    ? ` · ${profileData.leadership_role_label}${profileData.leadership_unit ? ` (${profileData.leadership_unit})` : ''}`
                                                    : ''}
                                            </p>
                                            <p className="mt-2 text-xs text-white/70">
                                                {todayLabel}
                                                {isLecturer
                                                    ? ` · Next: ${nextClass ? `${nextClass.course} at ${to12Hour(nextClass.start_time)}` : profileData.nextClass}`
                                                    : ''}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[28rem]">
                                    {heroStats.map((stat) => (
                                        <HeroStat key={stat.label} label={stat.label} value={stat.value} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    {pendingVenueChangeApprovals > 0 && (
                        <Link
                            href="/teacher/unit/venue-change-requests?status=pending"
                            className="flex flex-col gap-3 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-950 transition-colors hover:bg-amber-100 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100 dark:hover:bg-amber-950/50"
                        >
                            <div className="flex items-start gap-3">
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200">
                                    <MapPin className="size-5" />
                                </span>
                                <div>
                                    <p className="font-semibold">
                                        {pendingVenueChangeApprovals} venue change {pendingVenueChangeApprovals === 1 ? 'request' : 'requests'}{' '}
                                        awaiting your approval
                                    </p>
                                    <p className="mt-1 text-sm text-amber-800/80 dark:text-amber-200/80">
                                        Review and approve or reject each request.
                                    </p>
                                </div>
                            </div>
                            <span className="inline-flex min-h-11 items-center justify-center gap-1 rounded-2xl bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-700">
                                Review requests
                                <ArrowRight className="size-4" />
                            </span>
                        </Link>
                    )}

                    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {(isLecturer ? lecturerActions : adminActions).map((action) => {
                            const Icon = action.icon;
                            return (
                                <Link
                                    key={action.href}
                                    href={action.href}
                                    className="group flex min-h-14 items-center justify-between gap-3 rounded-3xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50/50 dark:border-sidebar-border dark:bg-card dark:hover:border-indigo-800 dark:hover:bg-indigo-950/20"
                                >
                                    <span className="flex items-center gap-3">
                                        <span className="flex size-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200">
                                            <Icon className="size-5" />
                                        </span>
                                        <span className="font-medium text-slate-900 dark:text-sidebar-foreground">{action.label}</span>
                                    </span>
                                    <ArrowRight className="size-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-600" />
                                </Link>
                            );
                        })}
                    </section>

                    {isLecturer && (
                        <RecentNotificationsWidget
                            notifications={unreadNotifications}
                            className="rounded-3xl border-indigo-200 bg-indigo-50/70 dark:border-indigo-900/40 dark:bg-indigo-950/20"
                        />
                    )}

                    {!isLecturer ? (
                        <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6 dark:border-sidebar-border dark:bg-card">
                            <div className="flex items-start gap-3">
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-200">
                                    <UserCheck className="size-5" />
                                </span>
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900 dark:text-sidebar-foreground">Staff attendance</h2>
                                    <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-sidebar-foreground/70">
                                        Your account is administrative staff. Lecturer class tools are hidden. Use Take Attendance to check in or
                                        check out for your shift.
                                    </p>
                                </div>
                            </div>
                            <div className="mt-5 flex flex-wrap gap-3">
                                <Link
                                    href="/teacher/staff-attendance"
                                    className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700"
                                >
                                    Open Take Attendance
                                </Link>
                                <Link
                                    href="/teacher/staff-reports"
                                    className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-sidebar-border dark:text-sidebar-foreground dark:hover:bg-sidebar-accent"
                                >
                                    View attendance report
                                </Link>
                            </div>
                        </section>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                {metrics.map((stat) => {
                                    const Icon = stat.icon;
                                    return (
                                        <Link
                                            key={stat.title}
                                            href={stat.href}
                                            className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50/40 dark:border-sidebar-border dark:bg-card dark:hover:border-indigo-800"
                                        >
                                            <span className={cn('mb-4 flex size-10 items-center justify-center rounded-2xl', stat.iconClass)}>
                                                <Icon className="size-5" />
                                            </span>
                                            <p className="text-sm font-medium text-slate-500 dark:text-sidebar-foreground/60">{stat.title}</p>
                                            <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 dark:text-sidebar-foreground">
                                                {stat.value}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-sidebar-foreground/55">{stat.hint}</p>
                                        </Link>
                                    );
                                })}
                            </div>

                            <div className="grid gap-6 xl:grid-cols-12">
                                <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6 xl:col-span-7 dark:border-sidebar-border dark:bg-card">
                                    <div className="mb-4 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <span className="flex size-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200">
                                                <CalendarDays className="size-5" />
                                            </span>
                                            <div>
                                                <h2 className="text-lg font-semibold text-slate-900 dark:text-sidebar-foreground">
                                                    Today&apos;s classes
                                                </h2>
                                                <p className="text-sm text-slate-500 dark:text-sidebar-foreground/60">
                                                    {lectures.length > 0
                                                        ? `${lectures.length} session${lectures.length === 1 ? '' : 's'} on your timetable`
                                                        : 'Nothing scheduled for today'}
                                                </p>
                                            </div>
                                        </div>
                                        <Link
                                            href="/teacher/timetable"
                                            className="hidden text-sm font-medium text-indigo-600 hover:text-indigo-700 sm:inline dark:text-indigo-300"
                                        >
                                            View timetable
                                        </Link>
                                    </div>

                                    {lectures.length === 0 ? (
                                        <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500 dark:border-sidebar-border dark:text-sidebar-foreground/60">
                                            No classes are scheduled for you today.
                                        </p>
                                    ) : (
                                        <>
                                            <div className="space-y-3 md:hidden">
                                                {lectures.map((lecture, index) => {
                                                    const status = lectureStatus(lecture.status);
                                                    return (
                                                        <article
                                                            key={lecture.id || index}
                                                            className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-sidebar-border dark:bg-sidebar-accent/40"
                                                        >
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <p className="font-semibold text-slate-900 dark:text-sidebar-foreground">
                                                                        {lecture.course}
                                                                    </p>
                                                                    <p className="mt-1 text-sm text-slate-500 dark:text-sidebar-foreground/60">
                                                                        {lecture.code} · {lecture.program}
                                                                    </p>
                                                                </div>
                                                                <span
                                                                    className={cn(
                                                                        'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold',
                                                                        status.className,
                                                                    )}
                                                                >
                                                                    {status.label}
                                                                </span>
                                                            </div>
                                                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-sidebar-foreground/70">
                                                                <span className="inline-flex items-center gap-1.5">
                                                                    <Clock className="size-3.5" />
                                                                    {to12Hour(lecture.start_time)} – {to12Hour(lecture.end_time)}
                                                                </span>
                                                                <span>{lecture.room || 'Venue not set'}</span>
                                                                <span>{lecture.level}</span>
                                                            </div>
                                                        </article>
                                                    );
                                                })}
                                            </div>

                                            <div className="hidden overflow-x-auto md:block">
                                                <table className="w-full min-w-[640px] text-left">
                                                    <thead>
                                                        <tr className="border-b border-slate-200 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:border-sidebar-border dark:text-sidebar-foreground/50">
                                                            <th className="px-3 py-3">Course</th>
                                                            <th className="px-3 py-3">Programme</th>
                                                            <th className="px-3 py-3">Time</th>
                                                            <th className="px-3 py-3">Venue</th>
                                                            <th className="px-3 py-3 text-right">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {lectures.map((lecture, index) => {
                                                            const status = lectureStatus(lecture.status);
                                                            return (
                                                                <tr
                                                                    key={lecture.id || index}
                                                                    className="border-b border-slate-100 last:border-b-0 dark:border-sidebar-border/50"
                                                                >
                                                                    <td className="px-3 py-4">
                                                                        <div className="flex items-center gap-3">
                                                                            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xs font-bold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200">
                                                                                {lecture.code || '—'}
                                                                            </span>
                                                                            <div className="min-w-0">
                                                                                <p className="font-semibold text-slate-900 dark:text-sidebar-foreground">
                                                                                    {lecture.course}
                                                                                </p>
                                                                                <p className="text-xs text-slate-500 dark:text-sidebar-foreground/55">
                                                                                    {lecture.level}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3 py-4 text-sm text-slate-600 dark:text-sidebar-foreground/70">
                                                                        {lecture.program}
                                                                    </td>
                                                                    <td className="px-3 py-4 text-sm text-slate-600 dark:text-sidebar-foreground/70">
                                                                        <span className="inline-flex items-center gap-1.5">
                                                                            <Clock className="size-3.5" />
                                                                            {to12Hour(lecture.start_time)} – {to12Hour(lecture.end_time)}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-3 py-4 text-sm text-slate-600 dark:text-sidebar-foreground/70">
                                                                        {lecture.room || 'Venue not set'}
                                                                    </td>
                                                                    <td className="px-3 py-4 text-right">
                                                                        <span
                                                                            className={cn(
                                                                                'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
                                                                                status.className,
                                                                            )}
                                                                        >
                                                                            {status.label}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </>
                                    )}
                                </section>

                                <aside className="space-y-5 xl:col-span-5">
                                    {upcomingReminders.length > 0 && (
                                        <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5 dark:border-sidebar-border dark:bg-card">
                                            <div className="mb-3 flex items-center justify-between">
                                                <h2 className="font-semibold text-slate-900 dark:text-sidebar-foreground">Upcoming reminders</h2>
                                                <Link
                                                    href="/teacher/reminders"
                                                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-300"
                                                >
                                                    View all
                                                </Link>
                                            </div>
                                            <ul className="space-y-2">
                                                {upcomingReminders.map((reminder) => (
                                                    <li
                                                        key={reminder.id}
                                                        className="flex items-start gap-2 rounded-2xl border border-slate-200/80 p-3 dark:border-sidebar-border"
                                                    >
                                                        <Bell className="mt-0.5 size-4 shrink-0 text-indigo-600" />
                                                        <div className="min-w-0 flex-1">
                                                            <p className="truncate text-sm font-medium text-slate-900 dark:text-sidebar-foreground">
                                                                {reminder.title}
                                                            </p>
                                                            <p className="text-xs text-slate-500 dark:text-sidebar-foreground/60">
                                                                {new Date(reminder.reminder_at).toLocaleString(undefined, {
                                                                    dateStyle: 'short',
                                                                    timeStyle: 'short',
                                                                })}
                                                                {reminder.session && ` · ${reminder.session}`}
                                                            </p>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        </section>
                                    )}

                                    <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5 dark:border-sidebar-border dark:bg-card">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <h2 className="font-semibold text-slate-900 dark:text-sidebar-foreground">Attendance rate</h2>
                                                <p className="mt-1 text-sm text-slate-500 dark:text-sidebar-foreground/60">
                                                    Class attendance over the selected period
                                                </p>
                                            </div>
                                            <Users className="hidden size-5 text-slate-400 sm:block" />
                                        </div>
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {timeFilters.map((filter) => (
                                                <button
                                                    key={filter.id}
                                                    type="button"
                                                    onClick={() => setTimeFilter(filter.id)}
                                                    className={cn(
                                                        'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                                                        timeFilter === filter.id
                                                            ? 'bg-indigo-600 text-white shadow-sm'
                                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-sidebar-accent dark:text-sidebar-foreground dark:hover:bg-sidebar-accent/80',
                                                    )}
                                                >
                                                    {filter.label}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="mt-4 h-64">
                                            {isLoading ? (
                                                <div className="flex h-full items-center justify-center text-sm text-slate-500">Loading chart…</div>
                                            ) : (
                                                <Line data={attendanceChartData} options={chartOptions} />
                                            )}
                                        </div>
                                    </section>
                                </aside>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}

function HeroStat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15">
            <p className="text-[11px] font-medium tracking-wide text-white/70 uppercase">{label}</p>
            <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
        </div>
    );
}
