import AppLayout from '@/layouts/app-layout';
import { can } from '@/lib/can';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import {
    ArcElement,
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Title,
    Tooltip,
} from 'chart.js';
import {
    AlertTriangle,
    ArrowDown,
    ArrowUp,
    Calendar,
    CheckCircle,
    Clock,
    Download,
    ExternalLink,
    Loader2,
    Minus,
    Printer,
    Search,
    ShieldCheck,
    ShieldX,
    TrendingUp,
    Users,
    XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, Line, Pie } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/admin/dashboard' },
    { title: 'Administrator Attendance Reports', href: '/admin/settings-reports/staff-attendance-reports' },
];

interface FilterOptions {
    administrators: Array<{ id: number; name: string; employee_id: string }>;
    faculties: Array<{ id: number; name: string }>;
    departments: Array<{ id: number; name: string; faculty_id: number }>;
    attendanceStatuses: string[];
    arrivalCategories: Array<{ value: string; label: string }>;
}

interface SummaryCard {
    title: string;
    value: string;
    change: string;
    changeType: 'positive' | 'negative' | 'neutral';
    icon: string;
}

interface AttendanceRecord {
    id: number;
    staff_id: string;
    staff_member_id: number;
    administrator_name: string;
    department: string;
    faculty: string;
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
}

interface PaginatedRecords {
    data: AttendanceRecord[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

interface Analytics {
    dailyTrend: Array<{ label: string; total: number; present: number; late: number; early?: number; attendance_rate: number }>;
    weeklyTrend: Array<{ label: string; total: number; present: number; late: number; early?: number; attendance_rate: number }>;
    monthlyTrend: Array<{ label: string; total: number; present: number; late: number; early?: number; attendance_rate: number }>;
    verificationAnalytics: {
        face_success_rate: number;
        face_failure_rate: number;
        geolocation_success_rate: number;
        geolocation_failure_rate: number;
    };
    performanceAnalytics: {
        early_check_in_analytics: {
            total_early_check_ins: number;
            average_minutes_early: number;
            early_arrival_percentage: number;
        };
        most_punctual: Array<{ name: string; department: string; attendance_rate: number; late: number; punctuality_score?: number }>;
        frequently_late: Array<{ name: string; department: string; late: number; attendance_rate: number }>;
        attendance_ranking: Array<{ name: string; department: string; attendance_rate: number; present: number; total: number }>;
    };
}

interface PageProps {
    filterOptions: FilterOptions;
    initialFilters: { start_date: string; end_date: string };
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    Users,
    Calendar,
    CheckCircle,
    XCircle,
    Clock,
    TrendingUp,
    ShieldCheck,
    ShieldX,
};

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'top' as const } },
};

const statusColors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-700',
    checked_in: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    late: 'bg-amber-100 text-amber-700',
    early_leave: 'bg-orange-100 text-orange-700',
};

export default function StaffAttendanceReportsIndex({ filterOptions, initialFilters }: PageProps) {
    const canExport = can('admin.staff-attendance.export');

    const [filters, setFilters] = useState({
        start_date: initialFilters.start_date,
        end_date: initialFilters.end_date,
        staff_id: 'all',
        faculty_id: 'all',
        department_id: 'all',
        attendance_status: 'all',
        arrival_category: 'all',
        face_verification_status: 'all',
        geolocation_status: 'all',
        check_in_from: '',
        check_in_to: '',
        month: '',
        year: '',
        search: '',
    });
    const [sortBy, setSortBy] = useState('date');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [perPage, setPerPage] = useState(15);
    const [currentPage, setCurrentPage] = useState(1);
    const [trendView, setTrendView] = useState<'dailyTrend' | 'weeklyTrend' | 'monthlyTrend'>('dailyTrend');

    const [summaryCards, setSummaryCards] = useState<SummaryCard[]>([]);
    const [records, setRecords] = useState<PaginatedRecords | null>(null);
    const [analytics, setAnalytics] = useState<Analytics | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const filteredDepartments = useMemo(() => {
        if (filters.faculty_id === 'all') {
            return filterOptions.departments;
        }
        return filterOptions.departments.filter((department) => String(department.faculty_id) === filters.faculty_id);
    }, [filterOptions.departments, filters.faculty_id]);

    const buildQueryParams = useCallback(
        (pageNumber = currentPage) => {
            const params = new URLSearchParams();
            Object.entries(filters).forEach(([key, value]) => {
                if (value && value !== 'all') {
                    params.append(key, value);
                }
            });
            params.append('sort_by', sortBy);
            params.append('sort_dir', sortDir);
            params.append('per_page', String(perPage));
            params.append('page', String(pageNumber));
            return params;
        },
        [filters, sortBy, sortDir, perPage, currentPage],
    );

    const fetchReportData = useCallback(
        async (pageNumber = 1) => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch(`/admin/settings-reports/staff-attendance-reports/data?${buildQueryParams(pageNumber)}`);
                const payload = await response.json();
                if (!response.ok || !payload.success) {
                    throw new Error(payload.message || 'Failed to load report data');
                }
                setSummaryCards(payload.data.summaryCards);
                setRecords(payload.data.records);
                setAnalytics(payload.data.analytics);
                setCurrentPage(pageNumber);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load report data');
            } finally {
                setIsLoading(false);
            }
        },
        [buildQueryParams],
    );

    useEffect(() => {
        fetchReportData(1);
    }, [fetchReportData]);

    const handleSort = (column: string) => {
        if (sortBy === column) {
            setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortBy(column);
            setSortDir('desc');
        }
    };

    useEffect(() => {
        fetchReportData(1);
    }, [sortBy, sortDir, perPage]);

    const handleExport = (format: 'xlsx' | 'csv' | 'pdf' | 'print') => {
        const params = buildQueryParams(1);
        params.set('format', format);
        window.open(`/admin/settings-reports/staff-attendance-reports/export?${params.toString()}`, '_blank');
    };

    const trendData = analytics?.[trendView] ?? [];
    const attendanceTrendChart = {
        labels: trendData.map((item) => item.label),
        datasets: [
            {
                label: 'Present',
                data: trendData.map((item) => item.present),
                borderColor: 'rgb(34, 197, 94)',
                backgroundColor: 'rgba(34, 197, 94, 0.2)',
                tension: 0.3,
            },
            {
                label: 'Late',
                data: trendData.map((item) => item.late),
                borderColor: 'rgb(245, 158, 11)',
                backgroundColor: 'rgba(245, 158, 11, 0.2)',
                tension: 0.3,
            },
        ],
    };

    const verificationChart = analytics
        ? {
              labels: ['Face Verified', 'Face Unverified', 'Geo Verified', 'Geo Failed'],
              datasets: [
                  {
                      data: [
                          analytics.verificationAnalytics.face_success_rate,
                          analytics.verificationAnalytics.face_failure_rate,
                          analytics.verificationAnalytics.geolocation_success_rate,
                          analytics.verificationAnalytics.geolocation_failure_rate,
                      ],
                      backgroundColor: ['#22c55e', '#ef4444', '#3b82f6', '#f97316'],
                  },
              ],
          }
        : null;

    const rankingChart = analytics
        ? {
              labels: analytics.performanceAnalytics.attendance_ranking.slice(0, 8).map((item) => item.name),
              datasets: [
                  {
                      label: 'Attendance Rate (%)',
                      data: analytics.performanceAnalytics.attendance_ranking.slice(0, 8).map((item) => item.attendance_rate),
                      backgroundColor: 'rgba(59, 130, 246, 0.7)',
                  },
              ],
          }
        : null;

    if (isLoading && !records) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Administrator Attendance Reports" />
                <div className="flex h-full items-center justify-center p-8">
                    <div className="text-center">
                        <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-blue-500" />
                        <p className="text-sidebar-foreground/60">Loading administrator attendance reports...</p>
                    </div>
                </div>
            </AppLayout>
        );
    }

    if (error && !records) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Administrator Attendance Reports" />
                <div className="flex h-full items-center justify-center p-8">
                    <div className="text-center">
                        <AlertTriangle className="mx-auto mb-4 h-8 w-8 text-red-500" />
                        <p className="text-red-600">{error}</p>
                        <button onClick={() => fetchReportData(1)} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
                            Retry
                        </button>
                    </div>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Administrator Attendance Reports" />

            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-4 md:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-sidebar-foreground">Administrator Attendance Reports</h1>
                        <p className="mt-1 text-sm text-sidebar-foreground/60">
                            Comprehensive attendance analytics, verification metrics, and exportable records for administrators.
                        </p>
                    </div>
                    {canExport && (
                        <div className="flex flex-wrap gap-2">
                            <button onClick={() => handleExport('xlsx')} className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white hover:bg-gray-800">
                                <Download className="h-4 w-4" /> Excel
                            </button>
                            <button onClick={() => handleExport('csv')} className="inline-flex items-center gap-2 rounded-lg border border-sidebar-border px-3 py-2 text-sm hover:bg-sidebar-accent">
                                <Download className="h-4 w-4" /> CSV
                            </button>
                            <button onClick={() => handleExport('pdf')} className="inline-flex items-center gap-2 rounded-lg border border-sidebar-border px-3 py-2 text-sm hover:bg-sidebar-accent">
                                <Download className="h-4 w-4" /> PDF
                            </button>
                            <button onClick={() => handleExport('print')} className="inline-flex items-center gap-2 rounded-lg border border-sidebar-border px-3 py-2 text-sm hover:bg-sidebar-accent">
                                <Printer className="h-4 w-4" /> Print
                            </button>
                        </div>
                    )}
                </div>

                <div className="rounded-xl border border-sidebar-border/70 bg-white p-4 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <FilterField label="Start Date">
                            <input type="date" value={filters.start_date} onChange={(e) => setFilters((prev) => ({ ...prev, start_date: e.target.value }))} className="filter-input" />
                        </FilterField>
                        <FilterField label="End Date">
                            <input type="date" value={filters.end_date} onChange={(e) => setFilters((prev) => ({ ...prev, end_date: e.target.value }))} className="filter-input" />
                        </FilterField>
                        <FilterField label="Month">
                            <select value={filters.month} onChange={(e) => setFilters((prev) => ({ ...prev, month: e.target.value }))} className="filter-input">
                                <option value="">All Months</option>
                                {Array.from({ length: 12 }, (_, index) => (
                                    <option key={index + 1} value={String(index + 1)}>
                                        {new Date(2000, index, 1).toLocaleString('default', { month: 'long' })}
                                    </option>
                                ))}
                            </select>
                        </FilterField>
                        <FilterField label="Year">
                            <select value={filters.year} onChange={(e) => setFilters((prev) => ({ ...prev, year: e.target.value }))} className="filter-input">
                                <option value="">All Years</option>
                                {Array.from({ length: 5 }, (_, index) => {
                                    const year = new Date().getFullYear() - index;
                                    return (
                                        <option key={year} value={String(year)}>
                                            {year}
                                        </option>
                                    );
                                })}
                            </select>
                        </FilterField>
                        <FilterField label="Administrator">
                            <select value={filters.staff_id} onChange={(e) => setFilters((prev) => ({ ...prev, staff_id: e.target.value }))} className="filter-input">
                                <option value="all">All Administrators</option>
                                {filterOptions.administrators.map((admin) => (
                                    <option key={admin.id} value={String(admin.id)}>
                                        {admin.name} ({admin.employee_id})
                                    </option>
                                ))}
                            </select>
                        </FilterField>
                        <FilterField label="Faculty">
                            <select
                                value={filters.faculty_id}
                                onChange={(e) => setFilters((prev) => ({ ...prev, faculty_id: e.target.value, department_id: 'all' }))}
                                className="filter-input"
                            >
                                <option value="all">All Faculties</option>
                                {filterOptions.faculties.map((faculty) => (
                                    <option key={faculty.id} value={String(faculty.id)}>
                                        {faculty.name}
                                    </option>
                                ))}
                            </select>
                        </FilterField>
                        <FilterField label="Department">
                            <select value={filters.department_id} onChange={(e) => setFilters((prev) => ({ ...prev, department_id: e.target.value }))} className="filter-input">
                                <option value="all">All Departments</option>
                                {filteredDepartments.map((department) => (
                                    <option key={department.id} value={String(department.id)}>
                                        {department.name}
                                    </option>
                                ))}
                            </select>
                        </FilterField>
                        <FilterField label="Attendance Status">
                            <select value={filters.attendance_status} onChange={(e) => setFilters((prev) => ({ ...prev, attendance_status: e.target.value }))} className="filter-input">
                                <option value="all">All Statuses</option>
                                {filterOptions.attendanceStatuses.map((status) => (
                                    <option key={status} value={status}>
                                        {status.replace('_', ' ')}
                                    </option>
                                ))}
                            </select>
                        </FilterField>
                        <FilterField label="Arrival Category">
                            <select value={filters.arrival_category} onChange={(e) => setFilters((prev) => ({ ...prev, arrival_category: e.target.value }))} className="filter-input">
                                <option value="all">All Categories</option>
                                {filterOptions.arrivalCategories.map((category) => (
                                    <option key={category.value} value={category.value}>
                                        {category.label}
                                    </option>
                                ))}
                            </select>
                        </FilterField>
                        <FilterField label="Face Verification">
                            <select value={filters.face_verification_status} onChange={(e) => setFilters((prev) => ({ ...prev, face_verification_status: e.target.value }))} className="filter-input">
                                <option value="all">All</option>
                                <option value="verified">Verified</option>
                                <option value="unverified">Unverified</option>
                            </select>
                        </FilterField>
                        <FilterField label="Geolocation">
                            <select value={filters.geolocation_status} onChange={(e) => setFilters((prev) => ({ ...prev, geolocation_status: e.target.value }))} className="filter-input">
                                <option value="all">All</option>
                                <option value="verified">Verified</option>
                                <option value="failed">Failed</option>
                            </select>
                        </FilterField>
                        <FilterField label="Check-in From">
                            <input type="time" value={filters.check_in_from} onChange={(e) => setFilters((prev) => ({ ...prev, check_in_from: e.target.value }))} className="filter-input" />
                        </FilterField>
                        <FilterField label="Check-in To">
                            <input type="time" value={filters.check_in_to} onChange={(e) => setFilters((prev) => ({ ...prev, check_in_to: e.target.value }))} className="filter-input" />
                        </FilterField>
                        <FilterField label="Search">
                            <div className="relative">
                                <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-sidebar-foreground/40" />
                                <input
                                    type="text"
                                    placeholder="Name, staff ID, email..."
                                    value={filters.search}
                                    onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                                    className="filter-input pl-9"
                                />
                            </div>
                        </FilterField>
                        <div className="flex items-end">
                            <button onClick={() => fetchReportData(1)} className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
                                Apply Filters
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {summaryCards.map((card, index) => {
                        const Icon = iconMap[card.icon] ?? Users;
                        return (
                            <div key={index} className="rounded-xl border border-sidebar-border/70 bg-white p-4 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">{card.title}</p>
                                        <p className="mt-2 text-2xl font-bold text-sidebar-foreground">{card.value}</p>
                                        {card.change && (
                                            <p
                                                className={`mt-1 inline-flex items-center gap-1 text-xs ${
                                                    card.changeType === 'positive'
                                                        ? 'text-green-600'
                                                        : card.changeType === 'negative'
                                                          ? 'text-red-600'
                                                          : 'text-sidebar-foreground/60'
                                                }`}
                                            >
                                                {card.changeType === 'positive' ? <ArrowUp className="h-3 w-3" /> : card.changeType === 'negative' ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                                                {card.change}
                                            </p>
                                        )}
                                    </div>
                                    <div className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/40">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {analytics && (
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        <ChartCard title="Attendance Trends">
                            <div className="mb-3 flex gap-2">
                                {(['dailyTrend', 'weeklyTrend', 'monthlyTrend'] as const).map((view) => (
                                    <button
                                        key={view}
                                        onClick={() => setTrendView(view)}
                                        className={`rounded-md px-3 py-1 text-xs ${trendView === view ? 'bg-gray-900 text-white' : 'bg-sidebar-accent text-sidebar-foreground'}`}
                                    >
                                        {view === 'dailyTrend' ? 'Daily' : view === 'weeklyTrend' ? 'Weekly' : 'Monthly'}
                                    </button>
                                ))}
                            </div>
                            <div className="h-72">
                                <Line data={attendanceTrendChart} options={chartOptions} />
                            </div>
                        </ChartCard>
                        <ChartCard title="Verification Analytics">
                            <div className="h-72">
                                {verificationChart && <Pie data={verificationChart} options={chartOptions} />}
                            </div>
                        </ChartCard>
                        <ChartCard title="Attendance Ranking">
                            <div className="h-72">
                                {rankingChart && <Bar data={rankingChart} options={chartOptions} />}
                            </div>
                        </ChartCard>
                        <ChartCard title="Performance Highlights">
                            {analytics.performanceAnalytics.early_check_in_analytics && (
                                <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                                    <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm dark:border-green-900 dark:bg-green-950/20">
                                        <div className="font-semibold text-green-700 dark:text-green-400">Total Early Check-Ins</div>
                                        <div className="text-lg font-bold">{analytics.performanceAnalytics.early_check_in_analytics.total_early_check_ins}</div>
                                    </div>
                                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900 dark:bg-blue-950/20">
                                        <div className="font-semibold text-blue-700 dark:text-blue-400">Average Minutes Early</div>
                                        <div className="text-lg font-bold">{analytics.performanceAnalytics.early_check_in_analytics.average_minutes_early}</div>
                                    </div>
                                    <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-sm dark:border-purple-900 dark:bg-purple-950/20">
                                        <div className="font-semibold text-purple-700 dark:text-purple-400">Early Arrival Rate</div>
                                        <div className="text-lg font-bold">{analytics.performanceAnalytics.early_check_in_analytics.early_arrival_percentage}%</div>
                                    </div>
                                </div>
                            )}
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                    <h3 className="mb-2 text-sm font-semibold text-sidebar-foreground">Most Punctual</h3>
                                    <div className="space-y-2">
                                        {analytics.performanceAnalytics.most_punctual.map((item, index) => (
                                            <div key={index} className="rounded-lg border border-sidebar-border/50 p-2 text-sm">
                                                <div className="font-medium">{item.name}</div>
                                                <div className="text-sidebar-foreground/60">
                                                    {item.department} · {item.punctuality_score ?? item.attendance_rate}% punctuality
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="mb-2 text-sm font-semibold text-sidebar-foreground">Frequently Late</h3>
                                    <div className="space-y-2">
                                        {analytics.performanceAnalytics.frequently_late.map((item, index) => (
                                            <div key={index} className="rounded-lg border border-sidebar-border/50 p-2 text-sm">
                                                <div className="font-medium">{item.name}</div>
                                                <div className="text-sidebar-foreground/60">{item.department} · {item.late} late check-ins</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </ChartCard>
                    </div>
                )}

                <div className="rounded-xl border border-sidebar-border/70 bg-white shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                    <div className="flex flex-col gap-3 border-b border-sidebar-border/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-sidebar-foreground">Attendance Records</h2>
                            <p className="text-sm text-sidebar-foreground/60">
                                {records ? `Showing ${records.from ?? 0}-${records.to ?? 0} of ${records.total} records` : 'No records'}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-sidebar-foreground/60">Per page</label>
                            <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))} className="rounded-lg border border-sidebar-border/50 px-2 py-1 text-sm">
                                {[10, 15, 25, 50, 100].map((size) => (
                                    <option key={size} value={size}>
                                        {size}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center p-10">
                            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                        </div>
                    ) : records && records.data.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-sidebar-accent/50 text-left text-xs uppercase tracking-wider text-sidebar-foreground/60">
                                    <tr>
                                        {[
                                            ['administrator_name', 'Administrator'],
                                            ['staff_id', 'Staff ID'],
                                            ['department', 'Department'],
                                            ['date', 'Date'],
                                            ['check_in_time', 'Check-in'],
                                            ['check_out_time', 'Check-out'],
                                            ['working_hours', 'Hours'],
                                            ['attendance_status', 'Status'],
                                            ['arrival_category_label', 'Arrival'],
                                            ['minutes_early', 'Min Early'],
                                            ['minutes_late', 'Min Late'],
                                            ['geolocation_status', 'Geolocation'],
                                            ['face_verification_status', 'Face'],
                                            ['face_match_score', 'Score'],
                                            ['created_at', 'Created'],
                                        ].map(([key, label]) => (
                                            <th key={key} className="px-4 py-3">
                                                <button onClick={() => handleSort(key)} className="inline-flex items-center gap-1 hover:text-sidebar-foreground">
                                                    {label}
                                                    {sortBy === key && (sortDir === 'asc' ? '↑' : '↓')}
                                                </button>
                                            </th>
                                        ))}
                                        <th className="px-4 py-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {records.data.map((record) => (
                                        <tr key={record.id} className="border-t border-sidebar-border/40">
                                            <td className="px-4 py-3 font-medium">{record.administrator_name}</td>
                                            <td className="px-4 py-3">{record.staff_id}</td>
                                            <td className="px-4 py-3">{record.department}</td>
                                            <td className="px-4 py-3">{record.date}</td>
                                            <td className="px-4 py-3">{record.check_in_time ?? '—'}</td>
                                            <td className="px-4 py-3">{record.check_out_time ?? '—'}</td>
                                            <td className="px-4 py-3">{record.working_hours ?? '—'}</td>
                                            <td className="px-4 py-3">
                                                <span className={`rounded-full px-2 py-1 text-xs capitalize ${statusColors[record.attendance_status] ?? 'bg-gray-100 text-gray-700'}`}>
                                                    {record.attendance_status.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">{record.arrival_category_label ?? '—'}</td>
                                            <td className="px-4 py-3">{record.minutes_early ?? '—'}</td>
                                            <td className="px-4 py-3">{record.minutes_late ?? '—'}</td>
                                            <td className="px-4 py-3">{record.geolocation_status}</td>
                                            <td className="px-4 py-3">{record.face_verification_status}</td>
                                            <td className="px-4 py-3">{record.face_match_score ?? '—'}</td>
                                            <td className="px-4 py-3">{record.created_at}</td>
                                            <td className="px-4 py-3">
                                                <Link
                                                    href={`/admin/settings-reports/staff-attendance-reports/${record.staff_member_id}`}
                                                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                                                >
                                                    View <ExternalLink className="h-3.5 w-3.5" />
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-10 text-center text-sidebar-foreground/60">No attendance records match the selected filters.</div>
                    )}

                    {records && records.last_page > 1 && (
                        <div className="flex items-center justify-between border-t border-sidebar-border/50 p-4">
                            <button
                                disabled={records.current_page <= 1}
                                onClick={() => fetchReportData(records.current_page - 1)}
                                className="rounded-lg border border-sidebar-border px-3 py-1.5 text-sm disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <span className="text-sm text-sidebar-foreground/60">
                                Page {records.current_page} of {records.last_page}
                            </span>
                            <button
                                disabled={records.current_page >= records.last_page}
                                onClick={() => fetchReportData(records.current_page + 1)}
                                className="rounded-lg border border-sidebar-border px-3 py-1.5 text-sm disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .filter-input {
                    width: 100%;
                    border-radius: 0.5rem;
                    border: 1px solid rgba(148, 163, 184, 0.5);
                    background: white;
                    padding: 0.5rem 0.75rem;
                    font-size: 0.875rem;
                    color: inherit;
                }
                .dark .filter-input {
                    background: var(--sidebar-accent);
                }
            `}</style>
        </AppLayout>
    );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="mb-2 block text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">{label}</label>
            {children}
        </div>
    );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-sidebar-border/70 bg-white p-4 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
            <h2 className="mb-4 text-lg font-semibold text-sidebar-foreground">{title}</h2>
            {children}
        </div>
    );
}
