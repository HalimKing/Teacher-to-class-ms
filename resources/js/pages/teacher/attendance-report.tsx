import { ReportAnalyticsSection } from '@/components/reports/ReportAnalyticsSection';
import { ReportAttendanceTable } from '@/components/reports/ReportAttendanceTable';
import { ReportExportButtons } from '@/components/reports/ReportExportButtons';
import { ReportInsightsPanel, type ReportInsight } from '@/components/reports/ReportInsightsPanel';
import { ReportErrorState, ReportLoadingState } from '@/components/reports/ReportStates';
import { ReportKpiSection } from '@/components/reports/ReportSummaryCards';
import { SessionDetailDrawer } from '@/components/reports/SessionDetailDrawer';
import {
    PaginatedRecords,
    ReportAnalytics,
    ReportFilterField,
    StatusBadge,
    SummaryCard,
    TableColumn,
    filterInputClass,
    reportStyles,
} from '@/components/reports/shared';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Title, Tooltip } from 'chart.js';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/teacher/dashboard' },
    { title: 'Attendance Analytics', href: '/teacher/reports' },
];

interface AttendanceRecord {
    id: number;
    course: string;
    classroom?: string | null;
    course_class: string;
    date: string;
    check_in_time: string | null;
    check_out_time: string | null;
    working_hours: string | null;
    attendance_status: string;
    arrival_category?: string | null;
    arrival_category_label?: string;
    minutes_early?: number | null;
    minutes_late?: number | null;
    geolocation_status: string;
    face_verification_status: string;
    face_match_score: number | null;
    attendance_source: string;
    reschedule_status?: string;
    is_rescheduled?: boolean;
    reschedule?: {
        original_date_display?: string;
        original_start_time_display?: string;
        original_end_time_display?: string;
        original_venue?: string | null;
        new_date_display?: string;
        new_start_time_display?: string;
        new_end_time_display?: string;
        new_venue?: string | null;
        summary?: string;
    } | null;
}

interface FilterOptions {
    courses: Array<{ id: number; name: string; code: string }>;
    attendanceStatuses: string[];
    arrivalCategories: Array<{ value: string; label: string }>;
    sessionTypes: Array<{ value: string; label: string }>;
    daysOfWeek: string[];
}

interface PageProps {
    filterOptions: FilterOptions;
    initialFilters: { start_date: string; end_date: string };
    teacher: { name: string; employee_id: string };
}

const defaultVisibleColumns = [
    'date',
    'course',
    'classroom',
    'check_in_time',
    'check_out_time',
    'working_hours',
    'attendance_status',
    'arrival_category_label',
    'face_verification_status',
    'geolocation_status',
];

export default function LecturerAttendanceReportPage({ filterOptions, initialFilters, teacher }: PageProps) {
    const [filters, setFilters] = useState({
        start_date: initialFilters.start_date,
        end_date: initialFilters.end_date,
        course_id: 'all',
        attendance_status: 'all',
        arrival_category: 'all',
        session_type: 'all',
        face_verification_status: 'all',
        geolocation_status: 'all',
        day_of_week: 'all',
        month: '',
        year: '',
        search: '',
    });
    const [sortBy, setSortBy] = useState('date');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [perPage, setPerPage] = useState(15);
    const [currentPage, setCurrentPage] = useState(1);
    const [summaryCards, setSummaryCards] = useState<SummaryCard[]>([]);
    const [insights, setInsights] = useState<ReportInsight[]>([]);
    const [analytics, setAnalytics] = useState<ReportAnalytics | null>(null);
    const [records, setRecords] = useState<PaginatedRecords<AttendanceRecord> | null>(null);
    const [visibleColumns, setVisibleColumns] = useState<string[]>(defaultVisibleColumns);
    const [filtersOpen, setFiltersOpen] = useState(true);
    const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
    const [isDashboardLoading, setIsDashboardLoading] = useState(true);
    const [isRecordsLoading, setIsRecordsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

    const fetchDashboard = useCallback(async () => {
        setIsDashboardLoading(true);
        setError(null);
        try {
            const params = buildQueryParams(1);
            params.delete('page');
            params.delete('per_page');
            params.delete('sort_by');
            params.delete('sort_dir');

            const response = await fetch(`/teacher/reports/data?${params}`, {
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'same-origin',
            });
            const payload = await response.json();
            if (!response.ok || !payload.success) {
                throw new Error(payload.message || 'Failed to load analytics');
            }

            setSummaryCards(payload.data.summaryCards ?? []);
            setAnalytics(payload.data.analytics ?? null);
            setInsights(payload.data.insights ?? []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load analytics');
        } finally {
            setIsDashboardLoading(false);
        }
    }, [buildQueryParams]);

    const fetchRecords = useCallback(
        async (pageNumber = 1) => {
            setIsRecordsLoading(true);
            try {
                const response = await fetch(`/teacher/reports/records?${buildQueryParams(pageNumber)}`, {
                    headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                    credentials: 'same-origin',
                });
                const payload = await response.json();
                if (!response.ok || !payload.success) {
                    throw new Error(payload.message || 'Failed to load records');
                }
                setRecords(payload.data);
                setCurrentPage(pageNumber);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load records');
            } finally {
                setIsRecordsLoading(false);
            }
        },
        [buildQueryParams],
    );

    const applyFilters = () => {
        fetchDashboard();
        fetchRecords(1);
    };

    useEffect(() => {
        fetchDashboard();
        fetchRecords(1);
    }, []);

    useEffect(() => {
        fetchRecords(1);
    }, [sortBy, sortDir, perPage]);

    const handleExport = (format: 'xlsx' | 'csv' | 'pdf' | 'print') => {
        const params = buildQueryParams(1);
        params.delete('page');
        params.set('format', format);
        window.open(`/teacher/reports/export?${params.toString()}`, '_blank');
    };

    const tableColumns = useMemo<TableColumn<AttendanceRecord>[]>(
        () => [
            { key: 'date', label: 'Date' },
            { key: 'course', label: 'Course', sortable: false },
            { key: 'classroom', label: 'Class', sortable: false, render: (record) => record.classroom ?? '—' },
            {
                key: 'reschedule',
                label: 'Original Schedule',
                sortable: false,
                render: (record) =>
                    record.reschedule ? (
                        <span className="text-xs text-sidebar-foreground/80">
                            {record.reschedule.original_date_display}, {record.reschedule.original_start_time_display} –{' '}
                            {record.reschedule.original_end_time_display}
                        </span>
                    ) : (
                        '—'
                    ),
            },
            {
                key: 'reschedule_new',
                label: 'Rescheduled Schedule',
                sortable: false,
                render: (record) =>
                    record.reschedule ? (
                        <span className="text-xs text-sidebar-foreground/80">
                            {record.reschedule.new_date_display}, {record.reschedule.new_start_time_display} –{' '}
                            {record.reschedule.new_end_time_display}
                        </span>
                    ) : (
                        '—'
                    ),
            },
            { key: 'check_in_time', label: 'Check-In' },
            { key: 'check_out_time', label: 'Check-Out' },
            { key: 'working_hours', label: 'Working Hours', sortable: false },
            {
                key: 'attendance_status',
                label: 'Status',
                render: (record) => <StatusBadge status={record.attendance_status} />,
            },
            { key: 'arrival_category_label', label: 'Arrival Status', sortable: false },
            { key: 'minutes_early', label: 'Min Early', sortable: false },
            { key: 'minutes_late', label: 'Min Late', sortable: false },
            { key: 'face_verification_status', label: 'Face', sortable: false },
            { key: 'geolocation_status', label: 'Geolocation', sortable: false },
        ],
        [],
    );

    if (isDashboardLoading && !analytics && !records) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Attendance Analytics" />
                <ReportLoadingState message="Loading attendance analytics..." />
            </AppLayout>
        );
    }

    if (error && !analytics && !records) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Attendance Analytics" />
                <ReportErrorState error={error} onRetry={applyFilters} />
            </AppLayout>
        );
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Attendance Analytics" />
            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-4 md:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-sidebar-foreground">Attendance Analytics Center</h1>
                        <p className="mt-1 text-sm text-sidebar-foreground/60">
                            Insights, trends, and detailed attendance intelligence for {teacher.name} ({teacher.employee_id})
                        </p>
                    </div>
                    <ReportExportButtons canExport onExport={handleExport} />
                </div>

                <div className="rounded-xl border border-sidebar-border/70 bg-white shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                    <button
                        type="button"
                        onClick={() => setFiltersOpen((open) => !open)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left"
                    >
                        <div>
                            <h2 className="text-sm font-semibold text-sidebar-foreground">Advanced Filters</h2>
                            <p className="text-xs text-sidebar-foreground/60">Filter by time, attendance, verification, and session type</p>
                        </div>
                        {filtersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    {filtersOpen && (
                        <div className="grid grid-cols-1 gap-4 border-t border-sidebar-border/50 p-4 md:grid-cols-2 xl:grid-cols-4">
                            <ReportFilterField label="Start Date">
                                <input type="date" value={filters.start_date} onChange={(e) => setFilters((prev) => ({ ...prev, start_date: e.target.value }))} className={filterInputClass} />
                            </ReportFilterField>
                            <ReportFilterField label="End Date">
                                <input type="date" value={filters.end_date} onChange={(e) => setFilters((prev) => ({ ...prev, end_date: e.target.value }))} className={filterInputClass} />
                            </ReportFilterField>
                            <ReportFilterField label="Month">
                                <select value={filters.month} onChange={(e) => setFilters((prev) => ({ ...prev, month: e.target.value }))} className={filterInputClass}>
                                    <option value="">All Months</option>
                                    {Array.from({ length: 12 }, (_, i) => (
                                        <option key={i + 1} value={String(i + 1)}>
                                            {new Date(2000, i, 1).toLocaleString('default', { month: 'long' })}
                                        </option>
                                    ))}
                                </select>
                            </ReportFilterField>
                            <ReportFilterField label="Year">
                                <select value={filters.year} onChange={(e) => setFilters((prev) => ({ ...prev, year: e.target.value }))} className={filterInputClass}>
                                    <option value="">All Years</option>
                                    {Array.from({ length: 5 }, (_, i) => {
                                        const year = new Date().getFullYear() - i;
                                        return (
                                            <option key={year} value={String(year)}>
                                                {year}
                                            </option>
                                        );
                                    })}
                                </select>
                            </ReportFilterField>
                            <ReportFilterField label="Day of Week">
                                <select value={filters.day_of_week} onChange={(e) => setFilters((prev) => ({ ...prev, day_of_week: e.target.value }))} className={filterInputClass}>
                                    <option value="all">All Days</option>
                                    {filterOptions.daysOfWeek.map((day) => (
                                        <option key={day} value={day}>
                                            {day}
                                        </option>
                                    ))}
                                </select>
                            </ReportFilterField>
                            <ReportFilterField label="Course">
                                <select value={filters.course_id} onChange={(e) => setFilters((prev) => ({ ...prev, course_id: e.target.value }))} className={filterInputClass}>
                                    <option value="all">All Courses</option>
                                    {filterOptions.courses.map((course) => (
                                        <option key={course.id} value={String(course.id)}>
                                            {course.name}
                                        </option>
                                    ))}
                                </select>
                            </ReportFilterField>
                            <ReportFilterField label="Attendance Status">
                                <select value={filters.attendance_status} onChange={(e) => setFilters((prev) => ({ ...prev, attendance_status: e.target.value }))} className={filterInputClass}>
                                    <option value="all">All Statuses</option>
                                    {filterOptions.attendanceStatuses.map((status) => (
                                        <option key={status} value={status}>
                                            {status.replace(/_/g, ' ')}
                                        </option>
                                    ))}
                                </select>
                            </ReportFilterField>
                            <ReportFilterField label="Arrival Status">
                                <select value={filters.arrival_category} onChange={(e) => setFilters((prev) => ({ ...prev, arrival_category: e.target.value }))} className={filterInputClass}>
                                    <option value="all">All Arrivals</option>
                                    {filterOptions.arrivalCategories.map((item) => (
                                        <option key={item.value} value={item.value}>
                                            {item.label}
                                        </option>
                                    ))}
                                </select>
                            </ReportFilterField>
                            <ReportFilterField label="Session Type">
                                <select value={filters.session_type} onChange={(e) => setFilters((prev) => ({ ...prev, session_type: e.target.value }))} className={filterInputClass}>
                                    <option value="all">All Sessions</option>
                                    {filterOptions.sessionTypes.map((item) => (
                                        <option key={item.value} value={item.value}>
                                            {item.label}
                                        </option>
                                    ))}
                                </select>
                            </ReportFilterField>
                            <ReportFilterField label="Face Verification">
                                <select value={filters.face_verification_status} onChange={(e) => setFilters((prev) => ({ ...prev, face_verification_status: e.target.value }))} className={filterInputClass}>
                                    <option value="all">All</option>
                                    <option value="verified">Verified</option>
                                    <option value="unverified">Failed / Unverified</option>
                                </select>
                            </ReportFilterField>
                            <ReportFilterField label="Geolocation">
                                <select value={filters.geolocation_status} onChange={(e) => setFilters((prev) => ({ ...prev, geolocation_status: e.target.value }))} className={filterInputClass}>
                                    <option value="all">All</option>
                                    <option value="verified">Verified</option>
                                    <option value="failed">Failed</option>
                                </select>
                            </ReportFilterField>
                            <ReportFilterField label="Search">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-sidebar-foreground/40" />
                                    <input
                                        type="text"
                                        placeholder="Course or class..."
                                        value={filters.search}
                                        onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                                        className={`${filterInputClass} pl-9`}
                                    />
                                </div>
                            </ReportFilterField>
                            <div className="flex items-end">
                                <button onClick={applyFilters} className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
                                    Apply Filters
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {isDashboardLoading ? (
                    <ReportLoadingState message="Refreshing analytics..." />
                ) : (
                    <>
                        <ReportKpiSection cards={summaryCards} />
                        <ReportInsightsPanel insights={insights} />
                        {analytics && <ReportAnalyticsSection analytics={analytics} variant="lecturer" />}
                    </>
                )}

                <div className="rounded-xl border border-sidebar-border/70 bg-white p-4 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h2 className="text-sm font-semibold text-sidebar-foreground">Column Visibility</h2>
                            <p className="text-xs text-sidebar-foreground/60">Choose which columns appear in the attendance table</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {tableColumns.map((column) => {
                                const active = visibleColumns.includes(column.key);
                                return (
                                    <button
                                        key={column.key}
                                        type="button"
                                        onClick={() =>
                                            setVisibleColumns((prev) =>
                                                active ? prev.filter((key) => key !== column.key) : [...prev, column.key],
                                            )
                                        }
                                        className={`rounded-full px-3 py-1 text-xs ${active ? 'bg-gray-900 text-white' : 'bg-sidebar-accent text-sidebar-foreground'}`}
                                    >
                                        {column.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <ReportAttendanceTable
                    title="Attendance History"
                    records={records}
                    columns={tableColumns}
                    visibleColumnKeys={visibleColumns}
                    sortBy={sortBy}
                    sortDir={sortDir}
                    perPage={perPage}
                    isLoading={isRecordsLoading}
                    onRowClick={(record) => setSelectedRecordId(record.id)}
                    onSort={(column) => {
                        if (sortBy === column) {
                            setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                        } else {
                            setSortBy(column);
                            setSortDir('desc');
                        }
                    }}
                    onPerPageChange={setPerPage}
                    onPageChange={fetchRecords}
                />
            </div>

            <SessionDetailDrawer recordId={selectedRecordId} onClose={() => setSelectedRecordId(null)} />
            <style>{reportStyles}</style>
        </AppLayout>
    );
}
