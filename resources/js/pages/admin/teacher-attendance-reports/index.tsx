import { ReportAnalyticsSection } from '@/components/reports/ReportAnalyticsSection';
import { ReportAttendanceTable } from '@/components/reports/ReportAttendanceTable';
import { ReportExportButtons } from '@/components/reports/ReportExportButtons';
import { ReportErrorState, ReportLoadingState } from '@/components/reports/ReportStates';
import { ReportSummaryCards } from '@/components/reports/ReportSummaryCards';
import {
    PaginatedRecords,
    ReportAnalytics,
    ReportFilterField,
    StatusBadge,
    SummaryCard,
    filterInputClass,
    reportStyles,
} from '@/components/reports/shared';
import AppLayout from '@/layouts/app-layout';
import { can } from '@/lib/can';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Title, Tooltip } from 'chart.js';
import { Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/admin/dashboard' },
    { title: 'Teacher Attendance Report', href: '/admin/attendance' },
];

interface TeacherRecord {
    id: number;
    staff_id: string;
    teacher_member_id: number;
    teacher_name: string;
    department: string;
    course_class: string;
    date: string;
    check_in_time: string | null;
    check_out_time: string | null;
    working_hours: string | null;
    attendance_status: string;
    geolocation_status: string;
    face_verification_status: string;
    face_match_score: number | null;
    attendance_source: string;
    created_at: string;
}

interface FilterOptions {
    teachers: Array<{ id: number; name: string; employee_id: string }>;
    faculties: Array<{ id: number; name: string }>;
    departments: Array<{ id: number; name: string; faculty_id: number }>;
    courses: Array<{ id: number; name: string }>;
    attendanceStatuses: string[];
}

interface PageProps {
    filterOptions: FilterOptions;
    initialFilters: { start_date: string; end_date: string };
}

export default function TeacherAttendanceReportsIndex({ filterOptions, initialFilters }: PageProps) {
    const canExport = can('admin.attendance.export');

    const [filters, setFilters] = useState({
        start_date: initialFilters.start_date,
        end_date: initialFilters.end_date,
        teacher_id: 'all',
        faculty_id: 'all',
        department_id: 'all',
        course_id: 'all',
        attendance_status: 'all',
        face_verification_status: 'all',
        geolocation_status: 'all',
        check_in_from: '',
        check_in_to: '',
        check_out_from: '',
        check_out_to: '',
        month: '',
        year: '',
        search: '',
    });
    const [sortBy, setSortBy] = useState('date');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [perPage, setPerPage] = useState(15);
    const [currentPage, setCurrentPage] = useState(1);
    const [summaryCards, setSummaryCards] = useState<SummaryCard[]>([]);
    const [records, setRecords] = useState<PaginatedRecords<TeacherRecord> | null>(null);
    const [analytics, setAnalytics] = useState<ReportAnalytics | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const filteredDepartments = useMemo(() => {
        if (filters.faculty_id === 'all') return filterOptions.departments;
        return filterOptions.departments.filter((d) => String(d.faculty_id) === filters.faculty_id);
    }, [filterOptions.departments, filters.faculty_id]);

    const buildQueryParams = useCallback((pageNumber = currentPage) => {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value && value !== 'all') params.append(key, value);
        });
        params.append('sort_by', sortBy);
        params.append('sort_dir', sortDir);
        params.append('per_page', String(perPage));
        params.append('page', String(pageNumber));
        return params;
    }, [filters, sortBy, sortDir, perPage, currentPage]);

    const fetchReportData = useCallback(async (pageNumber = 1) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`/admin/attendance/data?${buildQueryParams(pageNumber)}`);
            const payload = await response.json();
            if (!response.ok || !payload.success) throw new Error(payload.message || 'Failed to load report data');
            setSummaryCards(payload.data.summaryCards);
            setRecords(payload.data.records);
            setAnalytics(payload.data.analytics);
            setCurrentPage(pageNumber);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load report data');
        } finally {
            setIsLoading(false);
        }
    }, [buildQueryParams]);

    useEffect(() => { fetchReportData(1); }, [fetchReportData]);
    useEffect(() => { fetchReportData(1); }, [sortBy, sortDir, perPage]);

    const handleExport = (format: 'xlsx' | 'csv' | 'pdf' | 'print') => {
        const params = buildQueryParams(1);
        params.set('format', format);
        window.open(`/admin/attendance/export?${params.toString()}`, '_blank');
    };

    const tableColumns = useMemo(() => [
        { key: 'teacher_name', label: 'Teacher Name' },
        { key: 'staff_id', label: 'Staff ID', sortable: false },
        { key: 'department', label: 'Department', sortable: false },
        { key: 'course_class', label: 'Course/Class', sortable: false },
        { key: 'date', label: 'Date' },
        { key: 'check_in_time', label: 'Check-in' },
        { key: 'check_out_time', label: 'Check-out' },
        { key: 'working_hours', label: 'Hours', sortable: false },
        { key: 'attendance_status', label: 'Status', render: (r: TeacherRecord) => <StatusBadge status={r.attendance_status} /> },
        { key: 'geolocation_status', label: 'Geolocation', sortable: false },
        { key: 'face_verification_status', label: 'Face', sortable: false },
        { key: 'face_match_score', label: 'Score' },
        { key: 'attendance_source', label: 'Source', sortable: false },
        { key: 'created_at', label: 'Created' },
    ], []);

    if (isLoading && !records) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Teacher Attendance Report" />
                <ReportLoadingState message="Loading teacher attendance reports..." />
            </AppLayout>
        );
    }

    if (error && !records) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Teacher Attendance Report" />
                <ReportErrorState error={error} onRetry={() => fetchReportData(1)} />
            </AppLayout>
        );
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Teacher Attendance Report" />
            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-4 md:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-sidebar-foreground">Teacher Attendance Report</h1>
                        <p className="mt-1 text-sm text-sidebar-foreground/60">Comprehensive lecturer attendance analytics, verification metrics, and exportable records.</p>
                    </div>
                    <ReportExportButtons canExport={canExport} onExport={handleExport} />
                </div>

                <div className="rounded-xl border border-sidebar-border/70 bg-white p-4 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <ReportFilterField label="Start Date"><input type="date" value={filters.start_date} onChange={(e) => setFilters((p) => ({ ...p, start_date: e.target.value }))} className={filterInputClass} /></ReportFilterField>
                        <ReportFilterField label="End Date"><input type="date" value={filters.end_date} onChange={(e) => setFilters((p) => ({ ...p, end_date: e.target.value }))} className={filterInputClass} /></ReportFilterField>
                        <ReportFilterField label="Month"><select value={filters.month} onChange={(e) => setFilters((p) => ({ ...p, month: e.target.value }))} className={filterInputClass}><option value="">All Months</option>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={String(i + 1)}>{new Date(2000, i, 1).toLocaleString('default', { month: 'long' })}</option>)}</select></ReportFilterField>
                        <ReportFilterField label="Year"><select value={filters.year} onChange={(e) => setFilters((p) => ({ ...p, year: e.target.value }))} className={filterInputClass}><option value="">All Years</option>{Array.from({ length: 5 }, (_, i) => { const y = new Date().getFullYear() - i; return <option key={y} value={String(y)}>{y}</option>; })}</select></ReportFilterField>
                        <ReportFilterField label="Teacher"><select value={filters.teacher_id} onChange={(e) => setFilters((p) => ({ ...p, teacher_id: e.target.value }))} className={filterInputClass}><option value="all">All Teachers</option>{filterOptions.teachers.map((t) => <option key={t.id} value={String(t.id)}>{t.name} ({t.employee_id})</option>)}</select></ReportFilterField>
                        <ReportFilterField label="Faculty"><select value={filters.faculty_id} onChange={(e) => setFilters((p) => ({ ...p, faculty_id: e.target.value, department_id: 'all' }))} className={filterInputClass}><option value="all">All Faculties</option>{filterOptions.faculties.map((f) => <option key={f.id} value={String(f.id)}>{f.name}</option>)}</select></ReportFilterField>
                        <ReportFilterField label="Department"><select value={filters.department_id} onChange={(e) => setFilters((p) => ({ ...p, department_id: e.target.value }))} className={filterInputClass}><option value="all">All Departments</option>{filteredDepartments.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}</select></ReportFilterField>
                        <ReportFilterField label="Course"><select value={filters.course_id} onChange={(e) => setFilters((p) => ({ ...p, course_id: e.target.value }))} className={filterInputClass}><option value="all">All Courses</option>{filterOptions.courses.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}</select></ReportFilterField>
                        <ReportFilterField label="Attendance Status"><select value={filters.attendance_status} onChange={(e) => setFilters((p) => ({ ...p, attendance_status: e.target.value }))} className={filterInputClass}><option value="all">All Statuses</option>{filterOptions.attendanceStatuses.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</select></ReportFilterField>
                        <ReportFilterField label="Face Verification"><select value={filters.face_verification_status} onChange={(e) => setFilters((p) => ({ ...p, face_verification_status: e.target.value }))} className={filterInputClass}><option value="all">All</option><option value="verified">Verified</option><option value="unverified">Unverified</option></select></ReportFilterField>
                        <ReportFilterField label="Geolocation"><select value={filters.geolocation_status} onChange={(e) => setFilters((p) => ({ ...p, geolocation_status: e.target.value }))} className={filterInputClass}><option value="all">All</option><option value="verified">Verified</option><option value="failed">Failed</option></select></ReportFilterField>
                        <ReportFilterField label="Check-in From"><input type="time" value={filters.check_in_from} onChange={(e) => setFilters((p) => ({ ...p, check_in_from: e.target.value }))} className={filterInputClass} /></ReportFilterField>
                        <ReportFilterField label="Check-in To"><input type="time" value={filters.check_in_to} onChange={(e) => setFilters((p) => ({ ...p, check_in_to: e.target.value }))} className={filterInputClass} /></ReportFilterField>
                        <ReportFilterField label="Check-out From"><input type="time" value={filters.check_out_from} onChange={(e) => setFilters((p) => ({ ...p, check_out_from: e.target.value }))} className={filterInputClass} /></ReportFilterField>
                        <ReportFilterField label="Check-out To"><input type="time" value={filters.check_out_to} onChange={(e) => setFilters((p) => ({ ...p, check_out_to: e.target.value }))} className={filterInputClass} /></ReportFilterField>
                        <ReportFilterField label="Search"><div className="relative"><Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-sidebar-foreground/40" /><input type="text" placeholder="Name, staff ID, course..." value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} className={`${filterInputClass} pl-9`} /></div></ReportFilterField>
                        <div className="flex items-end"><button onClick={() => fetchReportData(1)} className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">Apply Filters</button></div>
                    </div>
                </div>

                <ReportSummaryCards cards={summaryCards} />
                {analytics && <ReportAnalyticsSection analytics={analytics} />}
                <ReportAttendanceTable
                    records={records}
                    columns={tableColumns}
                    sortBy={sortBy}
                    sortDir={sortDir}
                    perPage={perPage}
                    isLoading={isLoading}
                    detailHref={(record) => `/admin/attendance/${record.teacher_member_id}`}
                    onSort={(column) => {
                        if (sortBy === column) setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                        else { setSortBy(column); setSortDir('desc'); }
                    }}
                    onPerPageChange={setPerPage}
                    onPageChange={fetchReportData}
                />
            </div>
            <style>{reportStyles}</style>
        </AppLayout>
    );
}
