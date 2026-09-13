import React, { useState, useEffect, type FormEvent } from 'react';
import { 
  Search,
  Plus,
  Edit,
  Trash2,
  Filter,
  X,
  Calendar,
  Clock,
  Building,
  BookOpen,
  User,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Download,
  Upload,
  Layers,
  FileSpreadsheet,
  FileText,
  Loader2,
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, usePage, router } from '@inertiajs/react';
import { PagePropsWithFlash } from '@/types';
import { ToastContainer, toast, Bounce } from 'react-toastify';
import ComboBox from '@/components/combobox';
import { can } from '@/lib/can';
import { getCsrfToken, refreshCsrfToken } from '@/lib/csrf';

interface AcademicYear {
  id: number;
  name: string;
  start_year: number;
  end_year: number;
  is_active: boolean;
}

interface Program {
  id: number;
  name: string;
  program_code?: string;
  description?: string;
}

interface Course {
  id: number;
  name: string;
  course_code: string;
  teacher_id: number | null;
  program_id: number;
  teacher?: Teacher;
  program?: Program;
  description?: string;
}

interface ClassRoom {
  id: number;
  name: string;
  capacity: number;
  location?: string;
}

interface Teacher {
  id: number;
  first_name: string;
  last_name: string;
  employee_id: string;
  title: string;
  staff_type?: string;
  employment_status?: string;
  employment_status_label?: string;
}

interface TimeTable {
  id: number;
  academic_year_id: number;
  course_id: number;
  class_room_id: number | null;
  teacher_id: number | null;
  staff_type: string;
  day_of_week?: string;
  day: string;
  start_time: string;
  end_time: string;
  academic_year: AcademicYear;
  course?: Course | null;
  class_room?: ClassRoom | null;
  teacher?: Teacher | null;
}

interface TimeTablesIndexPageProps {
  timeTables: {
    data: TimeTable[];
    current_page: number;
    last_page: number;
    total: number;
    per_page: number;
  };
  academicYearOptions: Array<{ label: string; value: number }>;
  programOptions: Array<{ label: string; value: number }>;
  courseOptions: Array<{ label: string; value: number }>;
  classRoomOptions: Array<{ label: string; value: number }>;
  teacherOptions: Array<{ label: string; value: number; staff_type?: string; employment_status?: string; employment_status_label?: string }>;
  staffTypeOptions: Array<{ label: string; value: string }>;
  employmentStatusOptions: Array<{ label: string; value: string }>;
  dayOptions: Array<{ label: string; value: string }>;
  filters: {
    academic_year_id?: number;
    program_id?: number;
    course_id?: number;
    class_room_id?: number;
    teacher_id?: number;
    staff_type?: string;
    employment_status?: string;
    day?: string;
  };
}

const TimeTablesIndexPage = ({ 
  timeTables,
  academicYearOptions,
  programOptions,
  courseOptions,
  classRoomOptions,
  teacherOptions,
  staffTypeOptions,
  employmentStatusOptions = [],
  dayOptions,
  filters: initialFilters
}: TimeTablesIndexPageProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(timeTables.current_page || 1);
  const [filters, setFilters] = useState({
    academic_year_id: initialFilters.academic_year_id || '',
    program_id: initialFilters.program_id || '',
    course_id: initialFilters.course_id || '',
    class_room_id: initialFilters.class_room_id || '',
    teacher_id: initialFilters.teacher_id || '',
    staff_type: initialFilters.staff_type || '',
    employment_status: initialFilters.employment_status || '',
    day: initialFilters.day || ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<Array<{
    line: number;
    data: Record<string, string | null>;
    errors: string[];
    exists: boolean;
  }>>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [importSummary, setImportSummary] = useState<{ total: number; valid: number; invalid: number } | null>(null);
  const { flash } = usePage().props as PagePropsWithFlash;

  // Show toast notifications based on flash messages
  useEffect(() => {
    if (flash?.success) {
      toast.success(flash.success || 'Time table operation successful!', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: false,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
        transition: Bounce,
      });
    }
    if (flash?.error) {
      toast.error(flash.error || 'An error occurred!', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: false,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
        transition: Bounce,
      });
    }
  }, [flash]);

   const handleValueChange = (name: keyof typeof filters) => (value: string | number | undefined) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  // Apply filters via Inertia
  const applyFilters = () => {
    router.get(route('admin.academics.time-tables.index'), {
      ...filters,
      page: 1 // Reset to first page when filters change
    }, {
      preserveState: true,
      preserveScroll: true,
    });
  };

  // Clear all filters
  const clearAllFilters = () => {
    setFilters({
      academic_year_id: '',
      program_id: '',
      course_id: '',
      class_room_id: '',
      teacher_id: '',
      staff_type: '',
      employment_status: '',
      day: ''
    });
    setShowFilters(false);
    
    router.get(route('admin.academics.time-tables.index'), {}, {
      preserveState: true,
      preserveScroll: true,
    });
  };

  // Handle delete
  const handleDelete = (id: number, courseName: string, day: string, time: string) => {
    if (confirm(`Are you sure you want to delete the time slot for "${courseName}" on ${day} at ${time}?`)) {
      router.delete(route('admin.academics.time-tables.destroy', id), {
        preserveState: true,
        onSuccess: () => {
          // The page will be refreshed automatically by Inertia
        }
      });
    }
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    router.get(route('admin.academics.time-tables.index'), {
      ...filters,
      page
    }, {
      preserveState: true,
      preserveScroll: true,
    });
  };

  // Handle export
  const handleExport = async (format: 'excel' | 'csv' | 'pdf' = 'excel') => {
    try {
      setIsExporting(true);
      
      // Build query parameters from filters
      const queryParams = new URLSearchParams();
      
      // Add filters to query params
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      // Create the export URL
      const exportUrl = route('admin.academics.time-tables.export', {
        format,
        ...Object.fromEntries(queryParams)
      });

      // Create a temporary link to trigger download
      const link = document.createElement('a');
      link.href = exportUrl;
      link.download = `timetables_export_${new Date().toISOString().split('T')[0]}.${format === 'pdf' ? 'pdf' : format === 'csv' ? 'csv' : 'xlsx'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Time tables exported successfully as ${format.toUpperCase()}!`, {
        position: "top-right",
        autoClose: 3000,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export time tables. Please try again.', {
        position: "top-right",
        autoClose: 3000,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportPreview = async (event: FormEvent) => {
    event.preventDefault();
    if (!importFile) {
      toast.error('Please select a file to preview.', { theme: 'dark' });
      return;
    }

    setPreviewLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      let token = getCsrfToken();
      if (!token) {
        token = await refreshCsrfToken();
      }

      const response = await fetch(route('admin.academics.time-tables.preview'), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'X-CSRF-TOKEN': token,
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
        body: formData,
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || json.message || 'Unable to preview file.');
      }

      setPreviewRows(json.rows || []);
      setImportSummary(json.summary || null);
      setShowPreview(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to preview file.', { theme: 'dark' });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importFile) return;

    setConfirmLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      let token = getCsrfToken();
      if (!token) {
        token = await refreshCsrfToken();
      }

      const response = await fetch(route('admin.academics.time-tables.confirm-import'), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'X-CSRF-TOKEN': token,
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
        body: formData,
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || json.message || 'Import failed.');
      }

      toast.success(json.message || `Imported ${json.imported} schedule(s).`, { theme: 'dark' });
      setShowPreview(false);
      setImportFile(null);
      setPreviewRows([]);
      setImportSummary(null);
      router.reload({ only: ['timeTables'] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Import failed.', { theme: 'dark' });
    } finally {
      setConfirmLoading(false);
    }
  };

  // Format time
  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Calculate duration
  const calculateDuration = (start: string, end: string) => {
    const startTime = new Date(`2000-01-01T${start}`);
    const endTime = new Date(`2000-01-01T${end}`);
    const diffMs = endTime.getTime() - startTime.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours === 0) {
      return `${diffMinutes} minutes`;
    } else if (diffMinutes === 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    }
    return `${diffHours}h ${diffMinutes}m`;
  };

  // Count active filters
  const activeFilterCount = Object.values(filters).filter(value => value !== '').length;

  // Breadcrumbs
  const breadcrumbs = [
    {
      title: 'Dashboard',
      href: '/admin/dashboard',
    },
    {
      title: 'Assigned Schedules',
      href: '/admin/academics/time-tables',
    }
  ];

  // Group by day for better organization
  const groupedByDay = timeTables.data.reduce((acc, timetable) => {
    const day = timetable.day_of_week || timetable.day;
    if (!acc[day]) {
      acc[day] = [];
    }
    acc[day].push(timetable);
    return acc;
  }, {} as Record<string, TimeTable[]>);

  // Sort days
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const sortedDays = Object.keys(groupedByDay).sort((a, b) => 
    dayOrder.indexOf(a) - dayOrder.indexOf(b)
  );

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Assigned Schedules" />
      <div className="flex min-h-screen min-w-0 bg-slate-50 dark:bg-background">
        {/* Main Content Area */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Page Content */}
          <div className="min-w-0 p-3 sm:p-6 lg:p-8 flex-1 overflow-x-hidden">
            <div className="mb-6 flex flex-col gap-4 sm:mb-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <h2 className="mb-1 text-2xl font-extrabold text-slate-900 sm:text-3xl dark:text-sidebar-foreground">Assigned Schedules</h2>
                <p className="text-sm text-slate-600 sm:text-base dark:text-sidebar-foreground/65">Manage class schedules and time slots</p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:justify-end">
                <div className="relative sm:col-span-2 lg:col-span-1">
                  <button
                    type="button"
                    onClick={() => setShowExportMenu((open) => !open)}
                    disabled={isExporting}
                    className="flex min-h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 px-4 py-3 font-semibold text-white shadow-md transition-all hover:from-emerald-700 hover:to-teal-800 focus:outline-none focus:ring-4 focus:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto lg:px-6"
                  >
                    <Download className="mr-2 h-5 w-5" />
                    {isExporting ? 'Exporting...' : 'Export'}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </button>
                  {showExportMenu && (
                    <div className="absolute right-0 z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg sm:w-48 dark:border-sidebar-border dark:bg-card">
                      <button
                        type="button"
                        onClick={() => {
                          setShowExportMenu(false);
                          handleExport('excel');
                        }}
                        disabled={isExporting}
                        className="flex min-h-11 w-full items-center px-4 py-2.5 text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 dark:text-sidebar-foreground dark:hover:bg-sidebar-accent"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Export as Excel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowExportMenu(false);
                          handleExport('csv');
                        }}
                        disabled={isExporting}
                        className="flex min-h-11 w-full items-center px-4 py-2.5 text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 dark:text-sidebar-foreground dark:hover:bg-sidebar-accent"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Export as CSV
                      </button>
                    </div>
                  )}
                </div>

                {can('admin.academics.time-tables.create') && (
                  <>
                    <Link
                      href={route('admin.academics.time-tables.bulk-create')}
                      className="flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-slate-700 to-slate-900 px-4 py-3 font-semibold text-white shadow-md transition-all hover:from-slate-800 hover:to-black focus:outline-none focus:ring-4 focus:ring-slate-500/50 lg:px-6"
                    >
                      <Layers className="mr-2 h-5 w-5" />
                      Bulk Create
                    </Link>
                    <Link
                      href={route('admin.academics.time-tables.create')}
                      className="flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-purple-700 px-4 py-3 font-semibold text-white shadow-md transition-all hover:from-indigo-700 hover:to-purple-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/50 lg:px-6"
                    >
                      <Plus className="mr-2 h-5 w-5" />
                      Create Schedule
                    </Link>
                  </>
                )}
              </div>
            </div>

            {can('admin.academics.time-tables.create') && (
              <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">Import Schedules</h3>
                  <p className="text-sm text-slate-600">
                    Upload CSV or Excel files to create multiple schedules. Download the template for the required column structure.
                  </p>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    <a
                      href={route('admin.academics.time-tables.template')}
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 sm:w-auto dark:border-sidebar-border dark:text-sidebar-foreground dark:hover:bg-sidebar-accent"
                    >
                      <Download className="h-4 w-4" />
                      Download Template
                    </a>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        .xlsx / .xls
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1">
                        <FileText className="h-3.5 w-3.5" />
                        .csv
                      </span>
                    </div>
                  </div>
                  <form onSubmit={handleImportPreview} className="space-y-3">
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm transition-colors hover:bg-slate-50">
                      <Upload className="h-4 w-4 text-slate-500" />
                      <span className="flex-1 truncate text-slate-700">
                        {importFile?.name || 'Choose CSV or Excel file...'}
                      </span>
                      <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        className="hidden"
                        onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                      />
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      {importFile && (
                        <button
                          type="button"
                          onClick={() => setImportFile(null)}
                          className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-sidebar-foreground dark:hover:bg-sidebar-accent"
                        >
                          <X className="h-4 w-4" />
                          Clear
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={previewLoading || !importFile}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {previewLoading ? 'Previewing...' : 'Preview Import'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Filters Section */}
            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg dark:border-sidebar-border dark:bg-card">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <Filter className="h-5 w-5 shrink-0 text-slate-500" />
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-sidebar-foreground">Filters</h3>
                  {activeFilterCount > 0 && (
                    <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">
                      {activeFilterCount} active
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeFilterCount > 0 && (
                    <button
                      onClick={clearAllFilters}
                      className="flex min-h-11 items-center gap-1 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-sidebar-foreground/70 dark:hover:bg-sidebar-accent"
                    >
                      <X className="h-4 w-4" />
                      <span>Clear all</span>
                    </button>
                  )}
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex min-h-11 items-center gap-1 rounded-lg px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950/30"
                  >
                    {showFilters ? 'Hide filters' : 'Show filters'}
                  </button>
                </div>
              </div>

              {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-200">
                  {/* Academic Year Filter */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Academic Year
                    </label>
                     <ComboBox
                        options={academicYearOptions}
                        label="All Academic Year"
                        externalValue={handleValueChange('academic_year_id')}
                        defaultValue={null}
                      />
                    {/* <select
                      value={filters.academic_year_id}
                      onChange={(e) => setFilters(prev => ({ ...prev, academic_year_id: e.target.value ? Number(e.target.value) : '' }))}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm transition-shadow"
                    >
                      <option value="">All Academic Years</option>
                      {academicYearOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select> */}
                  </div>

                  {/* Program Filter */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Program
                    </label>
                     <ComboBox
                        options={programOptions}
                        label="All Program"
                        externalValue={handleValueChange('program_id')}
                        defaultValue={null}
                      />
                    {/* <select
                      value={filters.program_id}
                      onChange={(e) => setFilters(prev => ({ ...prev, program_id: e.target.value ? Number(e.target.value) : '' }))}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm transition-shadow"
                    >
                      <option value="">All Programs</option>
                      {programOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select> */}
                  </div>

                  {/* Course Filter */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Course
                    </label>
                     <ComboBox
                        options={courseOptions}
                        label="All Course"
                        externalValue={handleValueChange('course_id')}
                        defaultValue={null}
                      />
                    {/* <select
                      value={filters.course_id}
                      onChange={(e) => setFilters(prev => ({ ...prev, course_id: e.target.value ? Number(e.target.value) : '' }))}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm transition-shadow"
                    >
                      <option value="">All Courses</option>
                      {courseOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select> */}
                  </div>

                  {/* Venue Filter */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Venue
                    </label>
                     <ComboBox
                        options={classRoomOptions}
                        label="All Venues"
                        externalValue={handleValueChange('class_room_id')}
                        defaultValue={null}
                      />
                      {/* <select
                        value={filters.class_room_id}
                        onChange={(e) => setFilters(prev => ({ ...prev, class_room_id: e.target.value ? Number(e.target.value) : '' }))}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm transition-shadow"
                      >
                        <option value="">All Venues</option>
                        {classRoomOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select> */}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Staff Type
                    </label>
                    <ComboBox
                      options={staffTypeOptions}
                      label="All Staff Types"
                      externalValue={handleValueChange('staff_type')}
                      defaultValue={null}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Employment Status
                    </label>
                    <ComboBox
                      options={employmentStatusOptions}
                      label="All Employment Statuses"
                      externalValue={handleValueChange('employment_status')}
                      defaultValue={null}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Staff Member
                    </label>
                    <ComboBox
                      options={teacherOptions}
                      label="All Staff"
                      externalValue={handleValueChange('teacher_id')}
                      defaultValue={null}
                    />
                  </div>

                  {/* Day Filter */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Day
                    </label>
                     <ComboBox
                        options={dayOptions}
                        label="All Day"
                        externalValue={handleValueChange('day')}
                        defaultValue={null}
                      />
                    {/* <select
                      value={filters.day}
                      onChange={(e) => setFilters(prev => ({ ...prev, day: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm transition-shadow"
                    >
                      <option value="">All Days</option>
                      {dayOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select> */}
                  </div>

                  {/* Apply Filter Button */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end md:col-span-2 lg:col-span-4">
                    <button
                      onClick={clearAllFilters}
                      className="min-h-11 rounded-xl border border-slate-300 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50 dark:border-sidebar-border dark:text-sidebar-foreground dark:hover:bg-sidebar-accent"
                    >
                      Reset
                    </button>
                    <button
                      onClick={applyFilters}
                      className="min-h-11 rounded-xl bg-indigo-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                      Apply Filters
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Export Info Bar */}
            {activeFilterCount > 0 && (
              <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/40">
                      <Download className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
                        Export with current filters applied
                      </p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300/80">
                        {activeFilterCount} active filter{activeFilterCount !== 1 ? 's' : ''} will be included in the export
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleExport('excel')}
                    disabled={isExporting}
                    className="min-h-11 w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    {isExporting ? 'Exporting...' : 'Export Now'}
                  </button>
                </div>
              </div>
            )}

            {/* Time Tables List - Grouped by Day */}
            <div className="space-y-6">
              {sortedDays.map((day) => (
                <div key={day} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-sidebar-border dark:bg-card">
                  <div className="border-b border-slate-200 bg-slate-50 p-4 sm:p-6 dark:border-sidebar-border dark:bg-sidebar-accent/40">
                    <h3 className="flex flex-wrap items-center gap-2 text-lg font-bold text-slate-900 sm:text-xl dark:text-sidebar-foreground">
                      <Calendar className="h-5 w-5 shrink-0 text-indigo-600" />
                      <span>{day}</span>
                      <span className="text-sm font-normal text-slate-500 dark:text-sidebar-foreground/55">
                        ({groupedByDay[day].length} time slots)
                      </span>
                    </h3>
                  </div>

                  <div className="space-y-3 p-3 lg:hidden">
                    {groupedByDay[day]
                      .sort((a, b) => a.start_time.localeCompare(b.start_time))
                      .map((timetable) => (
                        <article key={timetable.id} className="rounded-xl border border-slate-200 p-4 dark:border-sidebar-border">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 dark:text-sidebar-foreground">
                                {formatTime(timetable.start_time)} – {formatTime(timetable.end_time)}
                              </p>
                              <p className="mt-1 text-xs text-slate-500 dark:text-sidebar-foreground/55">
                                {calculateDuration(timetable.start_time, timetable.end_time)}
                              </p>
                            </div>
                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              timetable.staff_type === 'administrator'
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-200'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200'
                            }`}>
                              {timetable.staff_type === 'administrator' ? 'Administrator' : 'Lecturer'}
                            </span>
                          </div>
                          <p className="mt-3 truncate text-sm font-medium text-slate-900 dark:text-sidebar-foreground">
                            {timetable.course?.name || 'Office Schedule'}
                          </p>
                          <p className="truncate text-xs text-slate-500 dark:text-sidebar-foreground/55">
                            {timetable.course?.course_code || 'No course'}
                            {timetable.class_room?.name ? ` · ${timetable.class_room.name}` : ''}
                          </p>
                          <p className="mt-2 truncate text-sm text-slate-700 dark:text-sidebar-foreground/75">
                            {timetable.teacher
                              ? `${timetable.teacher.title} ${timetable.teacher.first_name} ${timetable.teacher.last_name}`
                              : 'No staff assigned'}
                          </p>
                          <div className="mt-3 flex gap-2">
                            {can('admin.academics.time-tables.edit') && (
                              <Link
                                href={route('admin.academics.time-tables.edit', timetable.id)}
                                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-sidebar-border dark:text-sidebar-foreground dark:hover:bg-sidebar-accent"
                              >
                                <Edit className="h-4 w-4" />
                                Edit
                              </Link>
                            )}
                            {can('admin.academics.time-tables.delete') && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleDelete(
                                    timetable.id,
                                    timetable.course?.name || 'Office Schedule',
                                    timetable.day_of_week || timetable.day,
                                    `${formatTime(timetable.start_time)} - ${formatTime(timetable.end_time)}`,
                                  )
                                }
                                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-rose-200 px-3 text-sm font-medium text-rose-700 hover:bg-rose-50 dark:border-rose-900/40 dark:text-rose-300 dark:hover:bg-rose-950/20"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </button>
                            )}
                          </div>
                        </article>
                      ))}
                  </div>
                  
                  <div className="hidden overflow-x-auto lg:block">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Time</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Staff Type</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Course</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Program</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Venue</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Staff</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Academic Year</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Duration</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-200">
                        {groupedByDay[day]
                          .sort((a, b) => a.start_time.localeCompare(b.start_time))
                          .map((timetable) => (
                          <tr key={timetable.id} className="hover:bg-indigo-50/20 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-2">
                                <Clock className="w-4 h-4 text-slate-400" />
                                <div className="text-sm font-medium text-slate-900">
                                  {formatTime(timetable.start_time)} - {formatTime(timetable.end_time)}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                timetable.staff_type === 'administrator'
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {timetable.staff_type === 'administrator' ? 'Administrator' : 'Lecturer'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-2">
                                <BookOpen className="w-4 h-4 text-slate-400" />
                                <div>
                                  <div className="text-sm font-medium text-slate-900">
                                    {timetable.course?.name || 'Office Schedule'}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {timetable.course?.course_code || 'No course'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {timetable.course?.program ? (
                                <div className="flex items-center space-x-2">
                                  <GraduationCap className="w-4 h-4 text-slate-400" />
                                  <div>
                                    <div className="text-sm font-medium text-slate-900">
                                      {timetable.course.program.name}
                                    </div>
                                    {timetable.course.program.program_code && (
                                      <div className="text-xs text-slate-500">
                                        {timetable.course.program.program_code}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-sm text-slate-400 italic">No program assigned</div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-2">
                                <Building className="w-4 h-4 text-slate-400" />
                                <div>
                                  <div className="text-sm font-medium text-slate-900">
                                    {timetable.class_room?.name || 'N/A'}
                                  </div>
                                  {timetable.class_room && (
                                    <div className="text-xs text-slate-500">
                                      Capacity: {timetable.class_room.capacity}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {timetable.teacher ? (
                                <div className="flex items-center space-x-2">
                                  <User className="w-4 h-4 text-slate-400" />
                                  <div>
                                    <div className="text-sm font-medium text-slate-900">
                                      {timetable.teacher.title} {timetable.teacher.first_name} {timetable.teacher.last_name}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      {timetable.teacher.employee_id}
                                      {timetable.teacher.employment_status_label
                                        ? ` · ${timetable.teacher.employment_status_label}`
                                        : timetable.teacher.employment_status
                                          ? ` · ${timetable.teacher.employment_status}`
                                          : ''}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-sm text-slate-400 italic">No staff assigned</div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-slate-700">
                                {timetable.academic_year.name}
                                <div className="text-xs text-slate-500">
                                  {timetable.academic_year.start_year} - {timetable.academic_year.end_year}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-slate-700">
                                {calculateDuration(timetable.start_time, timetable.end_time)}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-1">
                                <button
                                  onClick={() => setExpandedRow(expandedRow === timetable.id ? null : timetable.id)}
                                  className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                  title={expandedRow === timetable.id ? 'Hide details' : 'Show details'}
                                >
                                  {expandedRow === timetable.id ? (
                                    <ChevronUp className="w-5 h-5" />
                                  ) : (
                                    <ChevronDown className="w-5 h-5" />
                                  )}
                                </button>
                                {can('admin.academics.time-tables.edit') && (
                                <Link
                                  href={route('admin.academics.time-tables.edit', timetable.id)}
                                  className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Edit time slot"
                                >
                                  <Edit className="w-5 h-5" />
                                </Link>
                                )}

                                {can('admin.academics.time-tables.delete') && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleDelete(
                                      timetable.id,
                                      timetable.course?.name || 'Office Schedule',
                                      timetable.day_of_week || timetable.day,
                                      `${formatTime(timetable.start_time)} - ${formatTime(timetable.end_time)}`
                                    );
                                  }}
                                  className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete time slot"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              {sortedDays.length === 0 && (
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-12 text-center">
                  <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-slate-700 mb-2">No Assigned Schedules Found</h3>
                  <p className="text-slate-500 mb-6">
                    {activeFilterCount > 0 
                      ? "No schedules match your current filters. Try adjusting your filter criteria."
                      : "No schedules have been created yet. Create your first schedule to get started."
                    }
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    {activeFilterCount > 0 && (
                      <button
                        onClick={clearAllFilters}
                        className="px-6 py-3 border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                      >
                        Clear Filters
                      </button>
                    )}
                    {can('admin.academics.time-tables.create') && (
                    <Link
                      href={route('admin.academics.time-tables.create')}
                      className="inline-flex items-center justify-center px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Create Schedule
                    </Link>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Pagination */}
            {timeTables.total > 0 && (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg dark:border-sidebar-border dark:bg-card">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-slate-600 dark:text-sidebar-foreground/65">
                    Showing <span className="font-semibold text-slate-800 dark:text-sidebar-foreground">
                      {((timeTables.current_page - 1) * timeTables.per_page) + 1}
                    </span> to <span className="font-semibold text-slate-800 dark:text-sidebar-foreground">
                      {Math.min(timeTables.current_page * timeTables.per_page, timeTables.total)}
                    </span> of <span className="font-semibold text-slate-800 dark:text-sidebar-foreground">{timeTables.total}</span> Time Slots
                  </div>
                  <div className="flex w-full gap-2 sm:w-auto">
                    <button
                      onClick={() => handlePageChange(timeTables.current_page - 1)}
                      disabled={timeTables.current_page === 1}
                      className={`min-h-11 flex-1 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium sm:flex-none ${
                        timeTables.current_page === 1
                          ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                          : 'text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-sidebar-border dark:text-sidebar-foreground dark:hover:bg-sidebar-accent'
                      }`}
                    >
                      Previous
                    </button>

                    {/* Page Numbers */}
                    <div className="hidden sm:flex space-x-1">
                      {Array.from({ length: Math.min(5, timeTables.last_page) }, (_, i) => {
                        let pageNum;
                        if (timeTables.last_page <= 5) {
                          pageNum = i + 1;
                        } else if (timeTables.current_page <= 3) {
                          pageNum = i + 1;
                        } else if (timeTables.current_page >= timeTables.last_page - 2) {
                          pageNum = timeTables.last_page - 4 + i;
                        } else {
                          pageNum = timeTables.current_page - 2 + i;
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium min-w-[40px] ${
                              timeTables.current_page === pageNum
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-700 hover:bg-slate-100 border border-slate-300 hover:border-slate-400'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => handlePageChange(timeTables.current_page + 1)}
                      disabled={timeTables.current_page === timeTables.last_page}
                      className={`min-h-11 flex-1 rounded-xl border border-indigo-300 bg-indigo-600 px-4 py-2 text-sm font-medium text-white sm:flex-none ${
                        timeTables.current_page === timeTables.last_page
                          ? 'cursor-not-allowed opacity-50'
                          : 'hover:bg-indigo-700'
                      }`}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowPreview(false)}
            aria-label="Close import preview"
          />
          <div className="relative z-10 flex max-h-[min(92dvh,40rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-card">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-6 dark:border-sidebar-border">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-sidebar-foreground">Import Preview</h3>
                <p className="text-sm text-slate-600">
                  Review {previewRows.length} row(s) before importing.
                  {importSummary && (
                    <> Total {importSummary.total} · Valid {importSummary.valid} · Failed {importSummary.invalid}</>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-auto px-3 py-4 sm:px-6">
              <div className="space-y-3 md:hidden">
                {previewRows.map((row) => (
                  <article key={row.line} className="rounded-xl border border-slate-200 p-3 dark:border-sidebar-border">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900 dark:text-sidebar-foreground">Line {row.line}</p>
                      {row.errors.length === 0 ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          {row.exists ? 'Exists' : 'Ready'}
                        </span>
                      ) : (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">Invalid</span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-slate-700 dark:text-sidebar-foreground/75">
                      {row.data.employee_id || '—'} · {row.data.course_code || '—'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {row.data.day || '—'} · {row.data.start_time || '—'} – {row.data.end_time || '—'}
                    </p>
                    {row.errors.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs text-rose-600">
                        {row.errors.map((error) => (
                          <li key={error}>• {error}</li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))}
              </div>
              <table className="hidden min-w-full text-left text-sm md:table">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-sidebar-accent">
                  <tr>
                    <th className="px-3 py-2">Line</th>
                    <th className="px-3 py-2">Staff</th>
                    <th className="px-3 py-2">Course</th>
                    <th className="px-3 py-2">Venue</th>
                    <th className="px-3 py-2">Day / Time</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => (
                    <tr key={row.line} className="border-t border-slate-100 align-top dark:border-sidebar-border">
                      <td className="px-3 py-3 font-medium text-slate-700 dark:text-sidebar-foreground">{row.line}</td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-slate-900 dark:text-sidebar-foreground">{row.data.employee_id || '—'}</div>
                        <div className="text-xs text-slate-500">{row.data.staff_type || '—'}</div>
                      </td>
                      <td className="px-3 py-3 text-slate-700 dark:text-sidebar-foreground/75">{row.data.course_code || '—'}</td>
                      <td className="px-3 py-3 text-slate-700 dark:text-sidebar-foreground/75">{row.data.venue || row.data.classroom || '—'}</td>
                      <td className="px-3 py-3 text-slate-700 dark:text-sidebar-foreground/75">
                        <div>{row.data.day || '—'}</div>
                        <div className="text-xs text-slate-500">
                          {row.data.start_time || '—'} – {row.data.end_time || '—'}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {row.errors.length === 0 ? (
                          <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            {row.exists ? 'Exists / conflict check passed' : 'Ready'}
                          </span>
                        ) : (
                          <ul className="space-y-1 text-xs text-rose-600">
                            {row.errors.map((error) => (
                              <li key={error}>• {error}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-sidebar-border">
              <p className="text-sm text-slate-600 dark:text-sidebar-foreground/65">
                Valid rows will be imported. Invalid rows are skipped.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  className="min-h-11 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-sidebar-border dark:text-sidebar-foreground dark:hover:bg-sidebar-accent"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={confirmLoading || previewRows.filter((row) => row.errors.length === 0).length === 0}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {confirmLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {confirmLoading ? 'Importing...' : 'Confirm Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ToastContainer />
    </AppLayout>
  );
};

export default TimeTablesIndexPage;