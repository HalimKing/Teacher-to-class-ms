import AppLayout from '@/layouts/app-layout';
import { SharedData, type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { AlertCircle, Bell, BookOpen as BookIcon, Calendar, CheckCircle, Clock, Clock as ClockIcon, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

// Import Chart.js components
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Title, Tooltip } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
    },
];

// Teacher profile data will come from props

const timeFilters = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'semester', label: 'This Semester' },
];

// Mock attendance data for fallback
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
        legend: {
            position: 'top' as const,
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
}

export default function TeacherDashboard({
    upcomingClasses,
    todayLectures,
    attendanceData,
    metricsData,
    profileData,
}: {
    upcomingClasses: any[];
    todayLectures: TodayLectures[];
    attendanceData: AttendanceData;
    metricsData: MetricsData;
    profileData: TeacherProfile;
}) {
    const [timeFilter, setTimeFilter] = useState('week');
    const [activeTab, setActiveTab] = useState('overview');
    const [chartData, setChartData] = useState<AttendanceData>(attendanceData);
    const [isLoading, setIsLoading] = useState(false);
    const page = usePage<SharedData>();

    const { auth } = page.props;

    console.log("today's lectures: ", todayLectures);

    // Fetch attendance data when time filter changes
    useEffect(() => {
        const fetchAttendanceData = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(`/api/teacher/attendance-data?timeRange=${timeFilter}`);
                if (response.ok) {
                    const data = await response.json();
                    setChartData(data);
                } else {
                    console.warn('Failed to fetch attendance data, using local data');
                    setChartData(generateAttendanceData(timeFilter));
                }
            } catch (error) {
                console.error('Error fetching attendance data:', error);
                setChartData(generateAttendanceData(timeFilter));
            } finally {
                setIsLoading(false);
            }
        };

        fetchAttendanceData();
    }, [timeFilter]);

    // Generate chart data based on state
    const attendanceChartData = useMemo(() => {
        console.log('Chart Data: ', chartData);

        return {
            labels: chartData.labels,
            datasets: [
                {
                    label: 'Attendance Rate (%)',
                    data: chartData.attendance,
                    borderColor: 'rgb(16, 185, 129)',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4,
                },
            ],
        };
    }, [chartData]);

    // Generate dynamic metrics grid from real data
    const dynamicMetricsGrid = useMemo(() => {
        return [
            {
                title: 'Total Classes Assigned',
                value: metricsData.totalClasses.toString().padStart(2, '0'),
                subtitle: '',
                icon: Calendar,
                iconColor: 'text-blue-500',
                iconBg: 'bg-blue-50 dark:bg-blue-900/20',
                badge: metricsData.totalClasses > 0 ? `+${metricsData.totalClasses} courses` : '0 courses',
                badgeColor: 'text-green-600 bg-green-50 dark:bg-green-900/20',
            },
            {
                title: 'Attendance Taken Today',
                value: metricsData.attendanceTodayCount.toString(),
                subtitle: `/${metricsData.attendanceTodayTarget}`,
                icon: CheckCircle,
                iconColor: 'text-green-500',
                iconBg: 'bg-green-50 dark:bg-green-900/20',
                badge: `Target ${metricsData.attendanceTodayTarget}/${metricsData.attendanceTodayTarget}`,
                badgeColor: 'text-gray-600 bg-gray-100 dark:bg-gray-800',
            },
            {
                title: 'Pending Attendance',
                value: metricsData.pendingAttendance.toString().padStart(2, '0'),
                subtitle: '',
                icon: AlertCircle,
                iconColor: 'text-orange-500',
                iconBg: 'bg-orange-50 dark:bg-orange-900/20',
                badge: metricsData.pendingAttendance > 0 ? 'Attention' : 'Completed',
                badgeColor:
                    metricsData.pendingAttendance > 0
                        ? 'text-orange-600 bg-orange-50 dark:bg-orange-900/20'
                        : 'text-green-600 bg-green-50 dark:bg-green-900/20',
            },
            {
                title: 'Total Records',
                value: metricsData.totalRecords.toLocaleString(),
                subtitle: '',
                icon: BookIcon,
                iconColor: 'text-purple-500',
                iconBg: 'bg-purple-50 dark:bg-purple-900/20',
                badge: 'Lifetime',
                badgeColor: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20',
            },
        ];
    }, [metricsData]);

    function to12Hour(time24: string) {
        let [hours, minutes] = time24.split(':').map(Number);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        return `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Teacher Dashboard" />
            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-4 md:p-6">
                {/* Welcome Header */}
                <div className="rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-700 p-6 text-white shadow-lg">
                    <div className="flex flex-col items-start justify-between gap-4 lg:flex-row">
                        <div className="flex items-center gap-4">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-600 text-2xl font-bold text-white shadow-md lg:h-20 lg:w-20">
                                {(auth.user.first_name ?? '')[0]}
                                {(auth.user.last_name ?? '')[0]}
                            </div>
                            <div>
                                <h1 className="text-xl font-bold lg:text-2xl">
                                    Welcome back, {auth.user.title} {auth.user.first_name} {auth.user.last_name}
                                </h1>
                                <p className="mt-1 text-purple-100">
                                    {profileData.subject} • {profileData.department}
                                </p>
                                <div className="mt-3 flex flex-wrap items-center gap-3 lg:gap-4">
                                    <div className="flex items-center gap-2">
                                        <ClockIcon className="h-4 w-4" />
                                        <span className="text-sm">Next: {profileData.nextClass}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Users className="h-4 w-4" />
                                        <span className="text-sm">{profileData.totalStudents} Students</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex w-full items-center gap-2 lg:w-auto lg:gap-3">
                            <button className="flex-1 rounded-lg bg-white/20 px-3 py-2 text-sm font-medium transition-colors hover:bg-white/30 lg:flex-none lg:px-4">
                                <Bell className="mr-2 inline h-4 w-4" />
                                Notifications
                            </button>
                        </div>
                    </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {dynamicMetricsGrid.map((stat, index) => {
                        const Icon = stat.icon;
                        return (
                            <div
                                key={index}
                                className="relative overflow-hidden rounded-xl border border-sidebar-border/70 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-sidebar-border dark:bg-sidebar-accent"
                            >
                                {/* Badge in top-right corner */}
                                <div className="absolute top-3 right-3">
                                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${stat.badgeColor}`}>{stat.badge}</span>
                                </div>

                                {/* Icon */}
                                <div className={`h-10 w-10 rounded-lg ${stat.iconBg} mb-4 flex items-center justify-center`}>
                                    <Icon className={`h-5 w-5 ${stat.iconColor}`} />
                                </div>

                                {/* Title */}
                                <p className="mb-2 text-sm font-medium text-sidebar-foreground/60 dark:text-sidebar-foreground/60">{stat.title}</p>

                                {/* Value with optional subtitle */}
                                <div className="flex items-baseline gap-1">
                                    <p className="text-3xl font-bold text-sidebar-foreground dark:text-sidebar-foreground">{stat.value}</p>
                                    {stat.subtitle && (
                                        <p className="text-xl font-semibold text-sidebar-foreground/40 dark:text-sidebar-foreground/40">
                                            {stat.subtitle}
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Main Content Area */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    {/* Left Column - Upcoming Classes & Performance Analytics */}
                    <div className="space-y-6 lg:col-span-2">
                        {/* Performance Analytics Section */}
                        <div className="rounded-xl border border-sidebar-border/70 bg-white p-6 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                            {/* Today's Classes Table */}
                            <div>
                                <div className="mb-4 flex items-center justify-between">
                                    <h4 className="font-medium text-sidebar-foreground dark:text-sidebar-foreground">Today's Classes</h4>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="table-responsive w-full overflow-auto">
                                        <thead>
                                            <tr className="border-b border-sidebar-border/30">
                                                <th className="px-3 py-3 text-left text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                                                    Programme
                                                </th>
                                                <th className="px-3 py-3 text-left text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                                                    Course
                                                </th>
                                                <th className="px-3 py-3 text-left text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                                                    Level
                                                </th>
                                                <th className="w-32 px-3 py-3 text-left text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                                                    Time
                                                </th>
                                                <th className="px-3 py-3 text-left text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                                                    Class Room
                                                </th>
                                                <th className="px-3 py-3 text-right text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                                                    Status
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {todayLectures.map((lecture, index) => (
                                                <tr
                                                    key={lecture.id || index}
                                                    className="border-b border-sidebar-border/20 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                                >
                                                    <td className="px-3 py-4">
                                                        <span className="text-sidebar-foreground/80 dark:text-sidebar-foreground/80">
                                                            {lecture.program || 'Advanced Mathematics'}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20">
                                                                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                                                    {lecture.code || '10A'}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <div className="font-semibold text-sidebar-foreground dark:text-sidebar-foreground">
                                                                    {lecture.course || 'Grade 10 Section A'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-4">
                                                        <span className="text-sidebar-foreground/80 dark:text-sidebar-foreground/80">
                                                            {lecture.level || 'Advanced Mathematics'}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <Clock className="h-4 w-4 text-sidebar-foreground/50" />
                                                            <span className="text-sm text-sidebar-foreground/80">
                                                                {to12Hour(lecture.start_time) || '09:00 AM'} -{' '}
                                                                {to12Hour(lecture.end_time) || '10:00 AM'}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    <td className="px-3 py-4">
                                                        <span className="text-sidebar-foreground/80 dark:text-sidebar-foreground/80">
                                                            {lecture.room || 'Room 101'}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-4">
                                                        {lecture.status === 'finished' && (
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                                ✓ FINISHED
                                                            </span>
                                                        )}
                                                        {lecture.status === 'pending' && (
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                                                                ⏱ PENDING
                                                            </span>
                                                        )}
                                                        {lecture.status === 'upcoming' && (
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                                                UPCOMING
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Recent Activities & Student Engagement */}
                    <div className="space-y-6">
                        <div className="">
                            <div>
                                <h2 className="text-xl font-semibold text-sidebar-foreground dark:text-sidebar-foreground">Performance Analytics</h2>
                                <p className="mt-1 text-sm text-sidebar-foreground/60 dark:text-sidebar-foreground/60">
                                    Track your class performance and student engagement
                                </p>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                                {timeFilters.map((filter) => (
                                    <button
                                        key={filter.id}
                                        onClick={() => setTimeFilter(filter.id)}
                                        className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                                            timeFilter === filter.id
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'bg-gray-100 text-sidebar-foreground hover:bg-gray-200 dark:bg-gray-800 dark:text-sidebar-foreground dark:hover:bg-gray-700'
                                        }`}
                                    >
                                        {filter.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Attendance Chart */}
                        <div className="mb-6 rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
                            <div className="mb-4 flex items-center justify-between">
                                <h4 className="font-medium text-sidebar-foreground dark:text-sidebar-foreground">Attendance Rate</h4>
                                <Users className="h-5 w-5 text-sidebar-foreground/60" />
                            </div>
                            <div className="h-64">
                                {isLoading ? (
                                    <div className="flex h-full items-center justify-center">
                                        <p className="text-sidebar-foreground/60">Loading attendance data...</p>
                                    </div>
                                ) : (
                                    <Line data={attendanceChartData} options={chartOptions} />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
