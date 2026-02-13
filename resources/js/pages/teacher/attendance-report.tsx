import AppLayout from '@/layouts/app-layout';
import { SharedData, type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { AlertTriangle, Calendar, ChevronDown, Loader2, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
    },
    {
        title: 'Reports',
        href: '/reports',
    },
];

interface ReportData {
    summaryMetrics: any[];
    attendanceRatePerClass: any[];
    classPerformanceSummary: any[];
    heatmapData: any[][];
    courses: any[];
    dateRange: string;
}

const getHeatmapColor = (intensity: number, isHoliday: boolean) => {
    if (isHoliday) return 'bg-red-200 dark:bg-red-900/30';

    const colors = [
        'bg-blue-100 dark:bg-blue-900/20',
        'bg-blue-200 dark:bg-blue-800/40',
        'bg-blue-400 dark:bg-blue-700/60',
        'bg-blue-500 dark:bg-blue-600/80',
        'bg-blue-600 dark:bg-blue-500',
    ];
    return colors[intensity] || colors[0];
};

export default function ReportsPage() {
    const [dateRange, setDateRange] = useState('');
    const [selectedCourse, setSelectedCourse] = useState('all');
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [courses, setCourses] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const page = usePage<SharedData>();
    const { auth } = page.props;

    // Fetch report data
    useEffect(() => {
        fetchReportData();
    }, []);

    const fetchReportData = async () => {
        try {
            setIsLoading(true);
            setError(null);

            const params = new URLSearchParams();
            if (selectedCourse && selectedCourse !== 'all') {
                params.append('courseId', selectedCourse);
            }

            const response = await fetch(`/teacher/reports/data?${params}`);

            if (!response.ok) {
                throw new Error('Failed to fetch report data');
            }

            const data = await response.json();

            if (data.success) {
                setReportData(data.data);
                setCourses(data.data.courses);
                setDateRange(data.data.dateRange);
            } else {
                throw new Error(data.message || 'Failed to fetch report data');
            }
        } catch (err) {
            console.error('Error fetching report data:', err);
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const handleApplyFilters = () => {
        fetchReportData();
    };

    if (isLoading) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Attendance Reports" />
                <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                        <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-blue-500" />
                        <p className="text-sidebar-foreground/60">Loading report data...</p>
                    </div>
                </div>
            </AppLayout>
        );
    }

    if (error) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Attendance Reports" />
                <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                        <AlertTriangle className="mx-auto mb-4 h-8 w-8 text-red-500" />
                        <p className="text-red-600">{error}</p>
                        <button onClick={fetchReportData} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
                            Retry
                        </button>
                    </div>
                </div>
            </AppLayout>
        );
    }

    if (!reportData) {
        return null;
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Attendance Reports" />

            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-4 md:p-6">
                {/* Page Header */}
                <div>
                    <h1 className="text-2xl font-bold text-sidebar-foreground dark:text-sidebar-foreground">Attendance Reports</h1>
                    <p className="mt-1 text-sm text-sidebar-foreground/60 dark:text-sidebar-foreground/60">
                        Comprehensive attendance analytics and insights
                    </p>
                </div>

                {/* Filters Section */}
                <div className="rounded-xl border border-sidebar-border/70 bg-white p-4 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {/* Date Range Filter */}
                        <div>
                            <label className="mb-2 block text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">Date Range</label>
                            <div className="relative">
                                <div className="flex cursor-pointer items-center gap-2 rounded-lg border border-sidebar-border/50 bg-white px-3 py-2 transition-colors hover:border-blue-300 dark:bg-sidebar-accent dark:hover:border-blue-700">
                                    <Calendar className="h-4 w-4 text-sidebar-foreground/60" />
                                    <input
                                        type="text"
                                        value={dateRange}
                                        readOnly
                                        className="flex-1 bg-transparent text-sm text-sidebar-foreground outline-none dark:text-sidebar-foreground"
                                        placeholder="Select date range"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Class Section Filter */}
                        <div>
                            <label className="mb-2 block text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                                Class Section
                            </label>
                            <div className="relative">
                                <div className="flex cursor-pointer items-center gap-2 rounded-lg border border-sidebar-border/50 bg-white px-3 py-2 transition-colors hover:border-blue-300 dark:bg-sidebar-accent dark:hover:border-blue-700">
                                    <Users className="h-4 w-4 text-sidebar-foreground/60" />
                                    <select
                                        value={selectedCourse}
                                        onChange={(e) => setSelectedCourse(e.target.value)}
                                        className="flex-1 cursor-pointer bg-transparent text-sm text-sidebar-foreground outline-none dark:text-sidebar-foreground"
                                    >
                                        <option value="all">All Assigned Classes</option>
                                        {courses.map((course) => (
                                            <option key={course.id} value={course.id}>
                                                {course.name}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="h-4 w-4 text-sidebar-foreground/60" />
                                </div>
                            </div>
                        </div>

                        {/* Apply Filters Button */}
                        <div className="flex items-end">
                            <button
                                onClick={handleApplyFilters}
                                className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700"
                            >
                                Apply Filters
                            </button>
                        </div>
                    </div>
                </div>

                {/* Summary Metrics */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {reportData.summaryMetrics.map((metric, index) => (
                        <div
                            key={index}
                            className="rounded-xl border border-sidebar-border/70 bg-white p-5 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent"
                        >
                            <p className="mb-3 text-xs font-medium text-sidebar-foreground/60 dark:text-sidebar-foreground/60">{metric.title}</p>

                            <div className="flex items-baseline gap-2">
                                <p className="text-3xl font-bold text-sidebar-foreground dark:text-sidebar-foreground">{metric.value}</p>
                                {metric.subtitle && (
                                    <p className="text-lg font-semibold text-sidebar-foreground/60 dark:text-sidebar-foreground/60">
                                        {metric.subtitle}
                                    </p>
                                )}
                            </div>

                            {metric.badge && (
                                <div className="mt-2">
                                    <span className={`inline-block rounded px-2 py-0.5 text-sm font-semibold ${metric.badgeColor}`}>
                                        {metric.badge}
                                    </span>
                                </div>
                            )}

                            {metric.change && (
                                <div className="mt-2">
                                    <span
                                        className={`text-sm font-medium ${
                                            metric.changeType === 'positive'
                                                ? 'text-green-600'
                                                : metric.changeType === 'negative'
                                                  ? 'text-red-600'
                                                  : 'text-sidebar-foreground/60'
                                        }`}
                                    >
                                        {metric.change}
                                    </span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Attendance Rate per Class */}
                    <div className="rounded-xl border border-sidebar-border/70 bg-white p-6 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold text-sidebar-foreground dark:text-sidebar-foreground">Attendance Rate per Class</h3>
                            <p className="mt-1 text-sm text-sidebar-foreground/60 dark:text-sidebar-foreground/60">
                                Performance distribution across sections
                            </p>
                        </div>

                        {reportData.attendanceRatePerClass.length > 0 ? (
                            <div className="space-y-4">
                                {reportData.attendanceRatePerClass.map((item, index) => (
                                    <div key={index}>
                                        <div className="mb-2 flex items-center justify-between">
                                            <span className="text-sm font-medium text-sidebar-foreground dark:text-sidebar-foreground">
                                                {item.class}
                                            </span>
                                            <span className="text-sm font-bold text-sidebar-foreground dark:text-sidebar-foreground">
                                                {item.rate}%
                                            </span>
                                        </div>
                                        <div className="h-2.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                                            <div
                                                className={`${item.color} h-2.5 rounded-full transition-all duration-500`}
                                                style={{ width: `${item.rate}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-sidebar-foreground/60">No data available</p>
                        )}
                    </div>

                    {/* Monthly Consistency Heatmap */}
                    <div className="rounded-xl border border-sidebar-border/70 bg-white p-6 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold text-sidebar-foreground dark:text-sidebar-foreground">
                                Monthly Consistency Heatmap
                            </h3>
                            <p className="mt-1 text-sm text-sidebar-foreground/60 dark:text-sidebar-foreground/60">Daily presence trends</p>
                        </div>

                        {/* Day labels */}
                        <div className="mb-2 flex gap-1 pl-0">
                            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day) => (
                                <div key={day} className="flex-1 text-center">
                                    <span className="text-xs font-medium text-sidebar-foreground/50">{day}</span>
                                </div>
                            ))}
                        </div>

                        {/* Heatmap grid */}
                        <div className="space-y-1">
                            {reportData.heatmapData.map((week, weekIndex) => (
                                <div key={weekIndex} className="flex gap-1">
                                    {week.map((cell, dayIndex) => (
                                        <div
                                            key={`${weekIndex}-${dayIndex}`}
                                            className={`aspect-square flex-1 rounded ${getHeatmapColor(cell.intensity, cell.isHoliday)} cursor-pointer transition-colors hover:ring-2 hover:ring-blue-400`}
                                            title={`${cell.date}: ${cell.isHoliday ? 'Holiday/No Class' : `${cell.count} records`}`}
                                        ></div>
                                    ))}
                                </div>
                            ))}
                        </div>

                        {/* Legend */}
                        <div className="mt-4 flex items-center justify-between border-t border-sidebar-border/30 pt-4">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-sidebar-foreground/60">LESS</span>
                                <div className="flex gap-1">
                                    <div className="h-4 w-4 rounded bg-blue-100 dark:bg-blue-900/20"></div>
                                    <div className="h-4 w-4 rounded bg-blue-300 dark:bg-blue-800/40"></div>
                                    <div className="h-4 w-4 rounded bg-blue-500 dark:bg-blue-600/80"></div>
                                    <div className="h-4 w-4 rounded bg-blue-600 dark:bg-blue-500"></div>
                                </div>
                                <span className="text-xs font-medium text-sidebar-foreground/60">MORE</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-4 w-4 rounded bg-red-200 dark:bg-red-900/30"></div>
                                <span className="text-xs font-medium text-sidebar-foreground/60">HOLIDAY / NO CLASS</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Class Performance Summary Table */}
                <div className="rounded-xl border border-sidebar-border/70 bg-white p-6 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-sidebar-foreground dark:text-sidebar-foreground">Class Performance Summary</h3>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-sidebar-border/30">
                                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                                        Class
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                                        Sessions
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                                        Pending
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                                        Rate
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                                        Reliability
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                                        Trend
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.classPerformanceSummary.length > 0 ? (
                                    reportData.classPerformanceSummary.map((classData, index) => (
                                        <tr
                                            key={index}
                                            className="border-b border-sidebar-border/20 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                        >
                                            <td className="px-4 py-4">
                                                <span className="font-medium text-sidebar-foreground dark:text-sidebar-foreground">
                                                    {classData.class}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className="text-sidebar-foreground/80 dark:text-sidebar-foreground/80">
                                                    {classData.present}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className="text-sidebar-foreground/80 dark:text-sidebar-foreground/80">{classData.late}</span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className="font-semibold text-sidebar-foreground/80 dark:text-sidebar-foreground/80">
                                                    {classData.attendanceRate}%
                                                </span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <span
                                                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${classData.reliabilityColor}`}
                                                >
                                                    {classData.reliability}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4">
                                                {classData.trend === 'up' && <TrendingUp className="h-5 w-5 text-green-500" />}
                                                {classData.trend === 'down' && <TrendingDown className="h-5 w-5 text-red-500" />}
                                                {classData.trend === 'neutral' && <div className="h-0.5 w-5 bg-orange-500"></div>}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="py-8 text-center text-sidebar-foreground/60">
                                            No data available
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
