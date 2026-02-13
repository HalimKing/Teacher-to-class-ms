import AppLayout from '@/layouts/app-layout';
import { SharedData, type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { AlertTriangle, BarChart3, Calendar, Download, Loader2, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/admin/dashboard',
    },
    {
        title: 'Teacher Analysis',
        href: '/admin/settings-reports/attendance-analysis',
    },
];

interface AnalysisData {
    overallMetrics: any[];
    teacherPerformance: any[];
    attendanceDistribution: any[];
    topPerformers: any[];
    attendanceByStatus: any[];
    teachers: any[];
    dateRange: string;
    filters?: {
        faculties: any[];
        departments: any[];
        programs: any[];
        levels: any[];
        teachers: any[];
    };
}

export default function TeacherAttendanceAnalysisPage() {
    const [dateRange, setDateRange] = useState('');
    const [selectedStartDate, setSelectedStartDate] = useState('');
    const [selectedEndDate, setSelectedEndDate] = useState('');
    const [selectedTeacher, setSelectedTeacher] = useState('all');
    const [selectedFaculty, setSelectedFaculty] = useState('all');
    const [selectedDepartment, setSelectedDepartment] = useState('all');
    const [selectedProgram, setSelectedProgram] = useState('all');
    const [selectedLevel, setSelectedLevel] = useState('all');
    const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [faculties, setFaculties] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [programs, setPrograms] = useState<any[]>([]);
    const [levels, setLevels] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const page = usePage<SharedData>();
    const { auth } = page.props;

    useEffect(() => {
        fetchAnalysisData();
    }, []);

    // Fetch departments when faculty changes
    useEffect(() => {
        if (selectedFaculty && selectedFaculty !== 'all') {
            fetchDepartmentsForFaculty(selectedFaculty);
        } else {
            setDepartments([]);
        }
    }, [selectedFaculty]);

    // Fetch programs when department changes
    useEffect(() => {
        if (selectedDepartment && selectedDepartment !== 'all') {
            fetchProgramsForDepartment(selectedDepartment);
        } else {
            setPrograms([]);
        }
    }, [selectedDepartment]);

    const fetchDepartmentsForFaculty = async (facultyId: string) => {
        try {
            const params = new URLSearchParams();
            params.append('facultyId', facultyId);

            const response = await fetch(`/admin/settings-reports/attendance-analysis/data?${params}`);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data.filters?.departments) {
                    setDepartments(data.data.filters.departments);
                }
            }
        } catch (err) {
            console.error('Error fetching departments:', err);
        }
    };

    const fetchProgramsForDepartment = async (departmentId: string) => {
        try {
            const params = new URLSearchParams();
            params.append('facultyId', selectedFaculty);
            params.append('departmentId', departmentId);

            const response = await fetch(`/admin/settings-reports/attendance-analysis/data?${params}`);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data.filters?.programs) {
                    setPrograms(data.data.filters.programs);
                }
            }
        } catch (err) {
            console.error('Error fetching programs:', err);
        }
    };

    const fetchAnalysisData = async () => {
        try {
            setIsLoading(true);
            setError(null);

            const params = new URLSearchParams();
            if (selectedStartDate) {
                params.append('startDate', selectedStartDate);
            }
            if (selectedEndDate) {
                params.append('endDate', selectedEndDate);
            }
            if (selectedTeacher && selectedTeacher !== 'all') {
                params.append('teacherId', selectedTeacher);
            }
            if (selectedFaculty && selectedFaculty !== 'all') {
                params.append('facultyId', selectedFaculty);
            }
            if (selectedDepartment && selectedDepartment !== 'all') {
                params.append('departmentId', selectedDepartment);
            }
            if (selectedProgram && selectedProgram !== 'all') {
                params.append('programId', selectedProgram);
            }
            if (selectedLevel && selectedLevel !== 'all') {
                params.append('levelId', selectedLevel);
            }

            const response = await fetch(`/admin/settings-reports/attendance-analysis/data?${params}`);

            if (!response.ok) {
                throw new Error('Failed to fetch analysis data');
            }

            const data = await response.json();

            if (data.success) {
                setAnalysisData(data.data);
                setTeachers(data.data.filters?.teachers || data.data.teachers || []);
                setFaculties(data.data.filters?.faculties || []);
                setDepartments(data.data.filters?.departments || []);
                setPrograms(data.data.filters?.programs || []);
                setLevels(data.data.filters?.levels || []);
                setDateRange(data.data.dateRange);
            } else {
                throw new Error(data.message || 'Failed to fetch analysis data');
            }
        } catch (err) {
            console.error('Error fetching analysis data:', err);
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const handleApplyFilters = () => {
        fetchAnalysisData();
    };

    const handleFacultyChange = (facultyId: string) => {
        setSelectedFaculty(facultyId);
        setSelectedDepartment('all');
        setSelectedProgram('all');
    };

    const handleDepartmentChange = (departmentId: string) => {
        setSelectedDepartment(departmentId);
        setSelectedProgram('all');
    };

    const exportTeacherPerformanceCSV = () => {
        if (!analysisData || analysisData.teacherPerformance.length === 0) {
            alert('No data to export');
            return;
        }

        const getStatus = (t: { present?: number; absent?: number; late?: number }) => {
            const p = t.present ?? 0;
            const a = t.absent ?? 0;
            const l = t.late ?? 0;
            if (p >= a && p >= l) return 'Present';
            if (a >= p && a >= l) return 'Absent';
            return 'Late';
        };

        // Prepare CSV headers
        const headers = [
            'Teacher Name',
            'Course',
            'Faculty',
            'Department',
            'Program',
            'Sessions',
            'Status',
            'Attendance Rate (%)',
            'Reliability',
            'Trend',
        ];
        const rows = analysisData.teacherPerformance.map((teacher) => [
            teacher.teacherName,
            teacher.courses,
            teacher.faculty,
            teacher.department,
            teacher.program,
            teacher.total,
            getStatus(teacher),
            teacher.attendanceRate,
            teacher.reliability,
            teacher.trend === 'up' ? 'Up' : teacher.trend === 'down' ? 'Down' : 'Neutral',
        ]);

        // Combine headers and rows
        const csvContent = [
            headers.join(','),
            ...rows.map((row) =>
                row
                    .map((cell) => {
                        // Escape quotes and wrap in quotes if contains comma or quotes
                        const cellStr = String(cell);
                        if (cellStr.includes(',') || cellStr.includes('"')) {
                            return `"${cellStr.replace(/"/g, '""')}"`;
                        }
                        return cellStr;
                    })
                    .join(','),
            ),
        ].join('\n');

        // Create blob and download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `teacher-performance-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (isLoading) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Teacher Attendance Analysis" />
                <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                        <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-blue-500" />
                        <p className="text-sidebar-foreground/60">Loading analysis data...</p>
                    </div>
                </div>
            </AppLayout>
        );
    }

    if (error) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Teacher Attendance Analysis" />
                <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                        <AlertTriangle className="mx-auto mb-4 h-8 w-8 text-red-500" />
                        <p className="text-red-600">{error}</p>
                        <button onClick={fetchAnalysisData} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
                            Retry
                        </button>
                    </div>
                </div>
            </AppLayout>
        );
    }

    if (!analysisData) {
        return null;
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Teacher Attendance Analysis" />

            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-4 md:p-6">
                {/* Page Header */}
                <div>
                    <h1 className="text-2xl font-bold text-sidebar-foreground dark:text-sidebar-foreground">Teacher Attendance Analysis</h1>
                    <p className="mt-1 text-sm text-sidebar-foreground/60 dark:text-sidebar-foreground/60">
                        Comprehensive teacher attendance metrics and insights
                    </p>
                </div>

                {/* Filters Section */}
                <div className="rounded-xl border border-sidebar-border/70 bg-white p-4 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {/* Start Date Filter */}
                        <div>
                            <label className="mb-2 block text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">Start Date</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={selectedStartDate}
                                    onChange={(e) => setSelectedStartDate(e.target.value)}
                                    className="w-full rounded-lg border border-sidebar-border/50 bg-white px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:border-blue-300 dark:bg-sidebar-accent dark:text-sidebar-foreground dark:hover:border-blue-700"
                                />
                            </div>
                        </div>

                        {/* End Date Filter */}
                        <div>
                            <label className="mb-2 block text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">End Date</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={selectedEndDate}
                                    onChange={(e) => setSelectedEndDate(e.target.value)}
                                    className="w-full rounded-lg border border-sidebar-border/50 bg-white px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:border-blue-300 dark:bg-sidebar-accent dark:text-sidebar-foreground dark:hover:border-blue-700"
                                />
                            </div>
                        </div>

                        {/* Faculty Filter */}
                        <div>
                            <label className="mb-2 block text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">Faculty</label>
                            <div className="relative">
                                <select
                                    value={selectedFaculty}
                                    onChange={(e) => handleFacultyChange(e.target.value)}
                                    className="w-full rounded-lg border border-sidebar-border/50 bg-white px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:border-blue-300 dark:bg-sidebar-accent dark:text-sidebar-foreground dark:hover:border-blue-700"
                                >
                                    <option value="all">All Faculties</option>
                                    {faculties.map((faculty) => (
                                        <option key={faculty.id} value={faculty.id}>
                                            {faculty.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Department Filter */}
                        <div>
                            <label className="mb-2 block text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">Department</label>
                            <div className="relative">
                                <select
                                    value={selectedDepartment}
                                    onChange={(e) => handleDepartmentChange(e.target.value)}
                                    disabled={selectedFaculty === 'all'}
                                    className="w-full rounded-lg border border-sidebar-border/50 bg-white px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:border-blue-300 disabled:opacity-50 dark:bg-sidebar-accent dark:text-sidebar-foreground dark:hover:border-blue-700"
                                >
                                    <option value="all">All Departments</option>
                                    {departments.map((department) => (
                                        <option key={department.id} value={department.id}>
                                            {department.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Program Filter */}
                        <div>
                            <label className="mb-2 block text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">Program</label>
                            <div className="relative">
                                <select
                                    value={selectedProgram}
                                    onChange={(e) => setSelectedProgram(e.target.value)}
                                    disabled={selectedDepartment === 'all'}
                                    className="w-full rounded-lg border border-sidebar-border/50 bg-white px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:border-blue-300 disabled:opacity-50 dark:bg-sidebar-accent dark:text-sidebar-foreground dark:hover:border-blue-700"
                                >
                                    <option value="all">All Programs</option>
                                    {programs.map((program) => (
                                        <option key={program.id} value={program.id}>
                                            {program.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Level Filter */}
                        <div>
                            <label className="mb-2 block text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">Level</label>
                            <div className="relative">
                                <select
                                    value={selectedLevel}
                                    onChange={(e) => setSelectedLevel(e.target.value)}
                                    className="w-full rounded-lg border border-sidebar-border/50 bg-white px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:border-blue-300 dark:bg-sidebar-accent dark:text-sidebar-foreground dark:hover:border-blue-700"
                                >
                                    <option value="all">All Levels</option>
                                    {levels.map((level) => (
                                        <option key={level.id} value={level.id}>
                                            {level.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Teacher Filter */}
                        <div>
                            <label className="mb-2 block text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">Teacher</label>
                            <div className="relative">
                                <select
                                    value={selectedTeacher}
                                    onChange={(e) => setSelectedTeacher(e.target.value)}
                                    className="w-full rounded-lg border border-sidebar-border/50 bg-white px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:border-blue-300 dark:bg-sidebar-accent dark:text-sidebar-foreground dark:hover:border-blue-700"
                                >
                                    <option value="all">All Teachers</option>
                                    {teachers.map((teacher) => (
                                        <option key={teacher.id} value={teacher.id}>
                                            {teacher.name}
                                        </option>
                                    ))}
                                </select>
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

                {/* Overall Metrics */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {analysisData.overallMetrics.map((metric, index) => (
                        <div
                            key={index}
                            className="rounded-xl border border-sidebar-border/70 bg-white p-4 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <p className="text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">{metric.title}</p>
                                    <p className="mt-2 text-2xl font-bold text-sidebar-foreground dark:text-sidebar-foreground">{metric.value}</p>
                                    {metric.subtitle && (
                                        <p className="mt-1 text-xs text-sidebar-foreground/60 dark:text-sidebar-foreground/60">{metric.subtitle}</p>
                                    )}
                                    {metric.change && (
                                        <p
                                            className={`mt-2 text-xs font-medium ${
                                                metric.changeType === 'positive'
                                                    ? 'text-green-600 dark:text-green-400'
                                                    : metric.changeType === 'negative'
                                                      ? 'text-red-600 dark:text-red-400'
                                                      : 'text-sidebar-foreground/60'
                                            }`}
                                        >
                                            {metric.change}
                                        </p>
                                    )}
                                </div>
                                <div
                                    className={`rounded-lg p-2 ${
                                        metric.changeType === 'positive'
                                            ? 'bg-green-100 dark:bg-green-900/20'
                                            : metric.changeType === 'negative'
                                              ? 'bg-red-100 dark:bg-red-900/20'
                                              : 'bg-blue-100 dark:bg-blue-900/20'
                                    }`}
                                >
                                    {metric.icon === 'TrendingUp' && (
                                        <TrendingUp
                                            className={`h-5 w-5 ${
                                                metric.changeType === 'positive'
                                                    ? 'text-green-600 dark:text-green-400'
                                                    : 'text-red-600 dark:text-red-400'
                                            }`}
                                        />
                                    )}
                                    {metric.icon === 'Calendar' && <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
                                    {metric.icon === 'Users' && <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
                                    {metric.icon === 'BarChart3' && <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Attendance Distribution */}
                <div className="rounded-xl border border-sidebar-border/70 bg-white p-6 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-sidebar-foreground dark:text-sidebar-foreground">Attendance Distribution</h3>
                        <p className="mt-1 text-sm text-sidebar-foreground/60 dark:text-sidebar-foreground/60">Overall attendance status breakdown</p>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        {analysisData.attendanceDistribution.map((status, index) => (
                            <div
                                key={index}
                                className="flex flex-col items-center rounded-lg border border-sidebar-border/30 p-4 dark:border-sidebar-border/50"
                            >
                                <div className="mb-3 h-20 w-20 rounded-full" style={{ backgroundColor: status.color, opacity: 0.2 }}>
                                    <div className="flex h-full w-full items-center justify-center">
                                        <p className="text-lg font-bold" style={{ color: status.color }}>
                                            {status.percentage}%
                                        </p>
                                    </div>
                                </div>
                                <p className="font-semibold text-sidebar-foreground">{status.name}</p>
                                <p className="text-sm text-sidebar-foreground/60">{status.value} sessions</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top Performers */}
                <div className="rounded-xl border border-sidebar-border/70 bg-white p-6 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-sidebar-foreground dark:text-sidebar-foreground">Top Performers</h3>
                        <p className="mt-1 text-sm text-sidebar-foreground/60 dark:text-sidebar-foreground/60">
                            Teachers with highest attendance rates
                        </p>
                    </div>

                    <div className="space-y-3">
                        {analysisData.topPerformers.map((teacher, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between rounded-lg border border-sidebar-border/30 p-4 dark:border-sidebar-border/50"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
                                        <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">{index + 1}</span>
                                    </div>
                                    <div>
                                        <p className="font-medium text-sidebar-foreground">{teacher.name}</p>
                                        <p className="text-xs text-sidebar-foreground/60">{teacher.sessions} sessions</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold text-green-600 dark:text-green-400">{teacher.attendanceRate}%</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Teacher Performance Table */}
                <div className="rounded-xl border border-sidebar-border/70 bg-white shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                    <div className="border-b border-sidebar-border/30 p-6 dark:border-sidebar-border/50">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-sidebar-foreground dark:text-sidebar-foreground">Teacher Performance</h3>
                                <p className="mt-1 text-sm text-sidebar-foreground/60 dark:text-sidebar-foreground/60">
                                    Detailed attendance metrics per teacher
                                </p>
                            </div>
                            <button
                                onClick={exportTeacherPerformanceCSV}
                                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
                            >
                                <Download className="h-4 w-4" />
                                Export CSV
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-sidebar-border/30 dark:border-sidebar-border/50">
                                    <th className="px-6 py-4 text-left text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                                        Teacher Name
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                                        Course
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                                        Faculty
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                                        Department
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                                        Program
                                    </th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                                        Sessions
                                    </th>
                                    
                                    <th className="px-6 py-4 text-center text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                                        Rate
                                    </th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                                        Reliability
                                    </th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                                        Trend
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {analysisData.teacherPerformance.length > 0 ? (
                                    analysisData.teacherPerformance.map((teacher, index) => (
                                        <tr
                                            key={index}
                                            className="border-b border-sidebar-border/30 transition-colors hover:bg-sidebar-accent/50 dark:border-sidebar-border/50"
                                        >
                                            <td className="px-6 py-4 text-sm font-medium text-sidebar-foreground">{teacher.teacherName}</td>
                                            <td className="px-6 py-4 text-sm text-sidebar-foreground">{teacher.courses}</td>
                                            <td className="px-6 py-4 text-sm text-sidebar-foreground">{teacher.faculty}</td>
                                            <td className="px-6 py-4 text-sm text-sidebar-foreground">{teacher.department}</td>
                                            <td className="px-6 py-4 text-sm text-sidebar-foreground">{teacher.program}</td>
                                            <td className="px-6 py-4 text-center text-sm text-sidebar-foreground">{teacher.total}</td>
                                            {/* <td className="px-6 py-4 text-center">
                                                {(() => {
                                                    const p = teacher.present ?? 0;
                                                    const a = teacher.absent ?? 0;
                                                    const l = teacher.late ?? 0;
                                                    const status =
                                                        p >= a && p >= l
                                                            ? 'Present'
                                                            : a >= p && a >= l
                                                              ? 'Absent'
                                                              : 'Late';
                                                    const statusClass =
                                                        status === 'Present'
                                                            ? 'text-green-600 dark:text-green-400'
                                                            : status === 'Absent'
                                                              ? 'text-red-600 dark:text-red-400'
                                                              : 'text-orange-600 dark:text-orange-400';
                                                    return (
                                                        <span className={`text-sm font-medium ${statusClass}`}>
                                                            {status}
                                                        </span>
                                                    );
                                                })()}
                                            </td> */}
                                            <td className="px-6 py-4 text-center text-sm font-semibold text-sidebar-foreground">
                                                {teacher.attendanceRate}%
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span
                                                    className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${teacher.reliabilityColor}`}
                                                >
                                                    {teacher.reliability}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {teacher.trend === 'up' && (
                                                    <TrendingUp className="mx-auto h-4 w-4 text-green-600 dark:text-green-400" />
                                                )}
                                                {teacher.trend === 'down' && (
                                                    <TrendingDown className="mx-auto h-4 w-4 text-red-600 dark:text-red-400" />
                                                )}
                                                {teacher.trend === 'neutral' && <div className="mx-auto h-4 w-4 rounded-full bg-yellow-400" />}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={12} className="px-6 py-8 text-center text-sidebar-foreground/60">
                                            No teacher data available
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
