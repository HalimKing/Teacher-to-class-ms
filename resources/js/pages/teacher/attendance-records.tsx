import AppLayout from '@/layouts/app-layout';
import { SharedData, type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import {
    AlertCircle,
    Calendar,
    Check,
    ChevronDown,
    Clock,
    Download,
    Edit,
    Eye,
    FileText,
    Loader2,
    Printer,
    Search,
    TrendingDown,
    TrendingUp,
    Users,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
    },
    {
        title: 'Attendance Records',
        href: '/teacher/records',
    },
];

interface AttendanceRecord {
    id: number;
    date: string;
    date_formatted: string;
    day_of_week: string;
    course_name: string;
    course_code: string;
    course_id: number;
    class_time: string;
    total_students: number;
    present_count: number;
    absent_count: number;
    late_count: number;
    attendance_rate: number;
    status: string;
    taken_by: string;
    check_in_time: string;
    check_out_time: string;
}

interface SummaryStats {
    totalSessions: number;
    averageAttendance: number;
    totalStudents: number;
    absentRate: number;
}

interface PaginationInfo {
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
    from: number;
    to: number;
}

interface Course {
    id: number;
    name: string;
    code: string;
}

interface ApiResponse {
    success: boolean;
    data: AttendanceRecord[];
    pagination: PaginationInfo;
    stats: SummaryStats;
    courses: Course[];
    message?: string;
}

export default function AttendanceRecordsPage() {
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [stats, setStats] = useState<SummaryStats>({
        totalSessions: 0,
        averageAttendance: 0,
        totalStudents: 0,
        absentRate: 0,
    });
    const [courses, setCourses] = useState<Course[]>([]);
    const [pagination, setPagination] = useState<PaginationInfo>({
        total: 0,
        per_page: 15,
        current_page: 1,
        last_page: 1,
        from: 0,
        to: 0,
    });

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCourse, setSelectedCourse] = useState('all');
    const [selectedDateRange, setSelectedDateRange] = useState('last-30-days');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const page = usePage<SharedData>();
    const { auth } = page.props;

    // Fetch attendance records
    const fetchRecords = async (pageNum: number = 1) => {
        setIsLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                search: searchQuery,
                courseId: selectedCourse,
                dateRange: selectedDateRange,
                status: selectedStatus,
                page: pageNum.toString(),
            });

            const url = `/teacher/attendance/records?${params}`;
            console.log('Fetching from:', url);

            const response = await fetch(url);

            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}: Failed to fetch records`;
                try {
                    const errorData = await response.json();
                    if (errorData.message) {
                        errorMessage = errorData.message;
                    }
                } catch {
                    // Response wasn't JSON
                }
                console.error('Fetch error response:', errorMessage, response.status);
                throw new Error(errorMessage);
            }

            const data: ApiResponse = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Server returned unsuccessful response');
            }

            setRecords(data.data);
            setPagination(data.pagination);
            setStats(data.stats);
            setCourses(data.courses);
            setCurrentPage(pageNum);
            console.log('Successfully fetched records:', data.data.length);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An error occurred while fetching records';
            setError(errorMessage);
            console.error('Error fetching records:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch records on mount and when filters change
    useEffect(() => {
        fetchRecords(1);
    }, [searchQuery, selectedCourse, selectedDateRange, selectedStatus]);

    // Format stats for display
    const summaryStats = useMemo(() => {
        return [
            {
                title: 'Total Sessions',
                value: stats.totalSessions.toString(),
                icon: Calendar,
                iconColor: 'text-blue-500',
                iconBg: 'bg-blue-100 dark:bg-blue-900/20',
                change: '+12',
                changeType: 'positive' as const,
            },
            {
                title: 'Average Attendance',
                value: `${stats.averageAttendance.toFixed(1)}%`,
                icon: Users,
                iconColor: 'text-green-500',
                iconBg: 'bg-green-100 dark:bg-green-900/20',
                change: '+2.4%',
                changeType: 'positive' as const,
            },
            {
                title: 'Total Students',
                value: stats.totalStudents.toString(),
                icon: Users,
                iconColor: 'text-purple-500',
                iconBg: 'bg-purple-100 dark:bg-purple-900/20',
                change: '+15',
                changeType: 'positive' as const,
            },
            {
                title: 'Absent Rate',
                value: `${stats.absentRate.toFixed(1)}%`,
                icon: AlertCircle,
                iconColor: 'text-orange-500',
                iconBg: 'bg-orange-100 dark:bg-orange-900/20',
                change: '-1.2%',
                changeType: 'positive' as const,
            },
        ];
    }, [stats]);

    const handleDownloadReport = async () => {
        try {
            if (records.length === 0) {
                alert('No records to export');
                return;
            }

            // Prepare CSV header
            const headers = ['Date', 'Day', 'Course', 'Code', 'Time', 'Total Students', 'Present', 'Absent', 'Late', 'Attendance Rate', 'Status'];

            // Prepare CSV rows
            const rows = records.map((record) => [
                record.date_formatted,
                record.day_of_week,
                record.course_name,
                record.course_code,
                record.class_time,
                record.total_students,
                record.present_count,
                record.absent_count,
                record.late_count,
                `${record.attendance_rate}%`,
                record.status,
            ]);

            // Combine headers and rows
            const csvContent = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n');

            // Create blob and download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);

            const now = new Date();
            const timestamp = now.toISOString().slice(0, 10);
            link.setAttribute('href', url);
            link.setAttribute('download', `attendance-records-${timestamp}.csv`);
            link.style.visibility = 'hidden';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('Error exporting records:', err);
            alert('Failed to export records');
        }
    };

    const handlePrint = () => {
        const printWindow = window.open('', '', 'height=600,width=800');
        if (!printWindow) {
            alert('Please allow popups to print');
            return;
        }

        // Build HTML for print
        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Attendance Records Report</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    body {
                        font-family: Arial, sans-serif;
                        color: #333;
                        line-height: 1.6;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 30px;
                        border-bottom: 2px solid #0ea5e9;
                        padding-bottom: 15px;
                    }
                    .header h1 {
                        font-size: 24px;
                        font-weight: bold;
                        margin-bottom: 5px;
                    }
                    .header p {
                        font-size: 12px;
                        color: #666;
                    }
                    .info {
                        margin-bottom: 20px;
                        font-size: 12px;
                    }
                    .info-row {
                        display: flex;
                        gap: 40px;
                        margin-bottom: 5px;
                    }
                    .info-item {
                        flex: 1;
                    }
                    .info-label {
                        font-weight: bold;
                        color: #333;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 10px;
                    }
                    thead {
                        background-color: #f3f4f6;
                        border-bottom: 2px solid #d1d5db;
                    }
                    th {
                        padding: 10px;
                        text-align: left;
                        font-weight: bold;
                        font-size: 12px;
                        border: 1px solid #d1d5db;
                    }
                    td {
                        padding: 8px 10px;
                        font-size: 11px;
                        border: 1px solid #e5e7eb;
                    }
                    tbody tr:nth-child(odd) {
                        background-color: #f9fafb;
                    }
                    tbody tr:hover {
                        background-color: #f3f4f6;
                    }
                    .text-center {
                        text-align: center;
                    }
                    .footer {
                        margin-top: 30px;
                        padding-top: 15px;
                        border-top: 1px solid #d1d5db;
                        font-size: 10px;
                        color: #666;
                        text-align: center;
                    }
                    @media print {
                        body {
                            margin: 0;
                            padding: 0;
                        }
                        page-break-after: auto;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Attendance Records Report</h1>
                    <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
                </div>
                
                <div class="info">
                    <div class="info-row">
                        <div class="info-item">
                            <span class="info-label">Total Records:</span> ${records.length}
                        </div>
                        <div class="info-item">
                            <span class="info-label">Date Range:</span> ${selectedDateRange}
                        </div>
                        <div class="info-item">
                            <span class="info-label">Course:</span> ${selectedCourse === 'all' ? 'All Courses' : selectedCourse}
                        </div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Day</th>
                            <th>Course</th>
                            <th>Code</th>
                            <th>Time</th>
                            <th class="text-center">Total</th>
                            <th class="text-center">Present</th>
                            <th class="text-center">Absent</th>
                            <th class="text-center">Late</th>
                            <th class="text-center">Rate</th>
                            <th class="text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${records
                            .map(
                                (record) => `
                            <tr>
                                <td>${record.date_formatted}</td>
                                <td>${record.day_of_week}</td>
                                <td>${record.course_name}</td>
                                <td>${record.course_code}</td>
                                <td>${record.class_time}</td>
                                <td class="text-center">${record.total_students}</td>
                                <td class="text-center">${record.present_count}</td>
                                <td class="text-center">${record.absent_count}</td>
                                <td class="text-center">${record.late_count}</td>
                                <td class="text-center">${record.attendance_rate}%</td>
                                <td class="text-center">${record.status}</td>
                            </tr>
                        `,
                            )
                            .join('')}
                    </tbody>
                </table>
                
                <div class="footer">
                    <p>This is an official record of attendance. Please preserve this document for your records.</p>
                </div>
            </body>
            </html>
        `;

        printWindow.document.write(printContent);
        printWindow.document.close();

        // Wait for content to load then print
        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
        }, 250);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Attendance Records" />

            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-4 md:p-6">
                {/* Page Header */}
                <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-sidebar-foreground dark:text-sidebar-foreground">Attendance Records</h1>
                        <p className="mt-1 text-sm text-sidebar-foreground/60 dark:text-sidebar-foreground/60">
                            View and manage all attendance records
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            disabled={records.length === 0}
                            className="flex items-center gap-2 rounded-lg border border-sidebar-border/50 px-4 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-sidebar-foreground dark:hover:bg-gray-800"
                            title="Print the attendance records table"
                        >
                            <Printer className="h-4 w-4" />
                            Print
                        </button>
                        <button
                            onClick={handleDownloadReport}
                            disabled={records.length === 0}
                            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Export records to CSV"
                        >
                            <Download className="h-4 w-4" />
                            Export Data
                        </button>
                    </div>
                </div>

                {/* Summary Statistics */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {summaryStats.map((stat, index) => {
                        const Icon = stat.icon;
                        return (
                            <div
                                key={index}
                                className="rounded-xl border border-sidebar-border/70 bg-white p-5 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-sidebar-foreground/60 dark:text-sidebar-foreground/60">{stat.title}</p>
                                        <p className="mt-1 text-2xl font-bold text-sidebar-foreground dark:text-sidebar-foreground">{stat.value}</p>
                                        <div
                                            className={`mt-2 flex items-center gap-1 text-sm ${
                                                stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                                            }`}
                                        >
                                            {stat.changeType === 'positive' ? (
                                                <TrendingUp className="h-4 w-4" />
                                            ) : (
                                                <TrendingDown className="h-4 w-4" />
                                            )}
                                            <span className="font-medium">{stat.change}</span>
                                            <span className="text-xs text-sidebar-foreground/50">vs last month</span>
                                        </div>
                                    </div>
                                    <div className={`rounded-xl p-3 ${stat.iconBg}`}>
                                        <Icon className={`h-6 w-6 ${stat.iconColor}`} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Filters Section */}
                <div className="rounded-xl border border-sidebar-border/70 bg-white p-4 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {/* Search */}
                        <div className="lg:col-span-1">
                            <label className="mb-2 block text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">Search</label>
                            <div className="relative">
                                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-sidebar-foreground/40" />
                                <input
                                    type="text"
                                    placeholder="Course or code..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full rounded-lg border border-sidebar-border/50 bg-white py-2 pr-4 pl-10 text-sm text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-sidebar-accent dark:text-sidebar-foreground"
                                />
                            </div>
                        </div>

                        {/* Course Filter */}
                        <div>
                            <label className="mb-2 block text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">Course</label>
                            <div className="relative">
                                <select
                                    value={selectedCourse}
                                    onChange={(e) => setSelectedCourse(e.target.value)}
                                    className="w-full cursor-pointer appearance-none rounded-lg border border-sidebar-border/50 bg-white px-3 py-2 text-sm text-sidebar-foreground focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-sidebar-accent dark:text-sidebar-foreground"
                                >
                                    <option value="all">All Courses</option>
                                    {courses.map((course) => (
                                        <option key={course.id} value={course.id}>
                                            {course.name}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-sidebar-foreground/60" />
                            </div>
                        </div>

                        {/* Date Range Filter */}
                        <div>
                            <label className="mb-2 block text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">Date Range</label>
                            <div className="relative">
                                <select
                                    value={selectedDateRange}
                                    onChange={(e) => setSelectedDateRange(e.target.value)}
                                    className="w-full cursor-pointer appearance-none rounded-lg border border-sidebar-border/50 bg-white px-3 py-2 text-sm text-sidebar-foreground focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-sidebar-accent dark:text-sidebar-foreground"
                                >
                                    <option value="today">Today</option>
                                    <option value="last-7-days">Last 7 Days</option>
                                    <option value="last-30-days">Last 30 Days</option>
                                    <option value="this-month">This Month</option>
                                    <option value="last-month">Last Month</option>
                                </select>
                                <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-sidebar-foreground/60" />
                            </div>
                        </div>

                        {/* Status Filter */}
                        <div>
                            <label className="mb-2 block text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">Status</label>
                            <div className="relative">
                                <select
                                    value={selectedStatus}
                                    onChange={(e) => setSelectedStatus(e.target.value)}
                                    className="w-full cursor-pointer appearance-none rounded-lg border border-sidebar-border/50 bg-white px-3 py-2 text-sm text-sidebar-foreground focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-sidebar-accent dark:text-sidebar-foreground"
                                >
                                    <option value="all">All Status</option>
                                    <option value="completed">Completed</option>
                                    <option value="pending">Pending</option>
                                </select>
                                <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-sidebar-foreground/60" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Attendance Records Table */}
                <div className="overflow-hidden rounded-xl border border-sidebar-border/70 bg-white shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                    <div className="border-b border-sidebar-border/30 p-6">
                        <h3 className="text-lg font-semibold text-sidebar-foreground dark:text-sidebar-foreground">Attendance Records</h3>
                        <p className="mt-1 text-sm text-sidebar-foreground/60 dark:text-sidebar-foreground/60">
                            {isLoading ? (
                                <span className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading records...
                                </span>
                            ) : (
                                `${pagination.total} records found`
                            )}
                        </p>
                    </div>

                    {error && (
                        <div className="border-t border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                        </div>
                    )}

                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        </div>
                    ) : records.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16">
                            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                                <FileText className="h-10 w-10 text-sidebar-foreground/40" />
                            </div>
                            <h3 className="mb-2 text-lg font-semibold text-sidebar-foreground dark:text-sidebar-foreground">No records found</h3>
                            <p className="max-w-md text-center text-sm text-sidebar-foreground/60 dark:text-sidebar-foreground/60">
                                Try adjusting your filters or search query
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-gray-800/50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                                            Date & Time
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                                            Course
                                        </th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                                            Total
                                        </th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                                            Present
                                        </th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                                            Absent
                                        </th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                                            Late
                                        </th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                                            Rate
                                        </th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                                            Status
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {records.map((record) => (
                                        <tr
                                            key={record.id}
                                            className="border-b border-sidebar-border/20 transition-colors last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                        >
                                            {/* Date & Time */}
                                            <td className="px-4 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-sidebar-foreground dark:text-sidebar-foreground">
                                                        {record.date_formatted}
                                                    </span>
                                                    <span className="text-xs text-sidebar-foreground/60 dark:text-sidebar-foreground/60">
                                                        {record.day_of_week} • {record.class_time}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Course */}
                                            <td className="px-4 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-sidebar-foreground dark:text-sidebar-foreground">
                                                        {record.course_name}
                                                    </span>
                                                    <span className="text-xs text-sidebar-foreground/60 dark:text-sidebar-foreground/60">
                                                        {record.course_code}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Total Students */}
                                            <td className="px-4 py-4 text-center">
                                                <span className="font-semibold text-sidebar-foreground dark:text-sidebar-foreground">
                                                    {record.total_students}
                                                </span>
                                            </td>

                                            {/* Present */}
                                            <td className="px-4 py-4 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <Check className="h-4 w-4 text-green-500" />
                                                    <span className="font-semibold text-green-700 dark:text-green-400">{record.present_count}</span>
                                                </div>
                                            </td>

                                            {/* Absent */}
                                            <td className="px-4 py-4 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <X className="h-4 w-4 text-red-500" />
                                                    <span className="font-semibold text-red-700 dark:text-red-400">{record.absent_count}</span>
                                                </div>
                                            </td>

                                            {/* Late */}
                                            <td className="px-4 py-4 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <Clock className="h-4 w-4 text-orange-500" />
                                                    <span className="font-semibold text-orange-700 dark:text-orange-400">{record.late_count}</span>
                                                </div>
                                            </td>

                                            {/* Attendance Rate */}
                                            <td className="px-4 py-4 text-center">
                                                <div className="flex flex-col items-center">
                                                    <span
                                                        className={`text-sm font-bold ${
                                                            record.attendance_rate >= 95
                                                                ? 'text-green-600 dark:text-green-400'
                                                                : record.attendance_rate >= 85
                                                                  ? 'text-blue-600 dark:text-blue-400'
                                                                  : 'text-orange-600 dark:text-orange-400'
                                                        }`}
                                                    >
                                                        {record.attendance_rate}%
                                                    </span>
                                                    <div className="mt-1 h-1.5 w-16 rounded-full bg-gray-200 dark:bg-gray-700">
                                                        <div
                                                            className={`h-1.5 rounded-full ${
                                                                record.attendance_rate >= 95
                                                                    ? 'bg-green-500'
                                                                    : record.attendance_rate >= 85
                                                                      ? 'bg-blue-500'
                                                                      : 'bg-orange-500'
                                                            }`}
                                                            style={{
                                                                width: `${Math.min(record.attendance_rate, 100)}%`,
                                                            }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Status */}
                                            <td className="px-4 py-4 text-center">
                                                <span
                                                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                                        record.status === 'completed'
                                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                    }`}
                                                >
                                                    {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                                                </span>
                                            </td>

                                            {/* Actions */}
                                            <td className="px-4 py-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        className="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                                                        title="View Details"
                                                    >
                                                        <Eye className="h-4 w-4 text-sidebar-foreground/60" />
                                                    </button>
                                                    <button
                                                        className="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                                                        title="Edit Record"
                                                    >
                                                        <Edit className="h-4 w-4 text-sidebar-foreground/60" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {!isLoading && records.length > 0 && (
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-sidebar-foreground/60 dark:text-sidebar-foreground/60">
                            Showing <span className="font-medium">{pagination.from}</span> to <span className="font-medium">{pagination.to}</span> of{' '}
                            <span className="font-medium">{pagination.total}</span> results
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => fetchRecords(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                                className="rounded-lg border border-sidebar-border/50 px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-sidebar-foreground dark:hover:bg-gray-800"
                            >
                                Previous
                            </button>

                            {Array.from({ length: pagination.last_page }, (_, i) => i + 1).map((pageNum) => (
                                <button
                                    key={pageNum}
                                    onClick={() => fetchRecords(pageNum)}
                                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                        currentPage === pageNum
                                            ? 'bg-blue-600 text-white'
                                            : 'border border-sidebar-border/50 text-sidebar-foreground hover:bg-gray-50 dark:text-sidebar-foreground dark:hover:bg-gray-800'
                                    }`}
                                >
                                    {pageNum}
                                </button>
                            ))}

                            <button
                                onClick={() => fetchRecords(Math.min(pagination.last_page, currentPage + 1))}
                                disabled={currentPage === pagination.last_page}
                                className="rounded-lg border border-sidebar-border/50 px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-sidebar-foreground dark:hover:bg-gray-800"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
