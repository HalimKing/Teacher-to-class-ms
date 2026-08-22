import DataTable from '@/components/data-table/DataTable';
import RowActionsMenu from '@/components/data-table/RowActionsMenu';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import React, { useState, useEffect, useRef } from 'react';
import { 
  Search,
  Plus,
  Edit,
  Trash2,
  Filter,
  X,
  Download,
  RefreshCw,
  Upload,
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, usePage, router } from '@inertiajs/react';
import { useForm } from '@inertiajs/react';
import { PagePropsWithFlash } from '@/types';
import { ToastContainer, toast, Bounce } from 'react-toastify';
import { Button } from '@headlessui/react';
import axios from 'axios';
import { can } from '@/lib/can';

// Updated interface with all fields
interface Course {
  id: number;
  name: string;
  course_code: string;
  student_size: number;
  credit_hours: number;
  program: Program;
  level?: Level;
  academic_year?: AcademicYear;
  academic_period?: AcademicPeriod;
  created_at: string;
}

interface Level {
  id: number;
  name: string;
}

interface AcademicYear {
  id: number;
  name: string;
}

interface AcademicPeriod {
  id: number;
  name: string;
}

interface Department {
  id: number;
  name: string;
  faculty: Faculty;
}

interface Faculty {
  id: number;
  name: string;
}                       

interface Program {
  id: number;
  name: string;
  department: Department;
}

interface FilterOption {
  id: number;
  name: string;
}

interface FilterOptions {
  programs: FilterOption[];
  levels: FilterOption[];
  academicYears: FilterOption[];
  academicPeriods: FilterOption[];
  faculties: FilterOption[];
  departments: FilterOption[];
}

// Filter interface
interface Filters {
  search: string;
  program: string;
  level: string;
  academic_year: string;
  academic_period: string;
  faculty: string;
  department: string;
}

interface PaginationData {
  data: Course[];
  total: number;
  current_page: number;
  per_page: number;
  last_page: number;
  from: number | null;
  to: number | null;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
}

// Update props to accept initial data and filter options
interface PageProps {
  initialData?: PaginationData;
  filterOptions?: FilterOptions;
}

// Default empty data structure
const defaultPaginationData: PaginationData = {
  data: [],
  total: 0,
  current_page: 1,
  per_page: 10,
  last_page: 0,
  from: 0,
  to: 0
};

const defaultFilterOptions: FilterOptions = {
  programs: [],
  levels: [],
  academicYears: [],
  academicPeriods: [],
  faculties: [],
  departments: []
};

const CourseIndexPage = ({ 
  initialData = defaultPaginationData, 
  filterOptions = defaultFilterOptions 
}: PageProps) => {
    
  const [currentPage, setCurrentPage] = useState(initialData.current_page || 1);
  const [perPage, setPerPage] = useState(initialData.per_page || 10);
  const [sortBy, setSortBy] = useState(initialData.sort_by || 'name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(initialData.sort_dir === 'desc' ? 'desc' : 'asc');
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { flash } = usePage().props as PagePropsWithFlash;

  // Import/Export state
  const importForm = useForm({ file: null as File | null });
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  
  // State for courses and pagination - initialize with initialData
  const [paginationData, setPaginationData] = useState<PaginationData>(() => {
    // Ensure initialData has the proper structure
    if (initialData && initialData.data) {
      return {
        data: initialData.data || [],
        total: initialData.total || 0,
        current_page: initialData.current_page || 1,
        per_page: initialData.per_page || 10,
        last_page: initialData.last_page || 0,
        from: initialData.from || 0,
        to: initialData.to || 0
      };
    }
    return defaultPaginationData;
  });
  
  // Filters state
  const [filters, setFilters] = useState({
    search: '',
    program: '',
    level: '',
    academic_year: '',
    academic_period: '',
    faculty: '',
    department: ''
  });

  // Track if we've already fetched data to prevent duplicate calls
  const hasFetchedInitialData = useRef(false);
  
  // Filter options from backend
  const [filterOptionsState] = useState<FilterOptions>(() => {
    if (filterOptions) {
      return {
        programs: filterOptions.programs || [],
        levels: filterOptions.levels || [],
        academicYears: filterOptions.academicYears || [],
        academicPeriods: filterOptions.academicPeriods || [],
        faculties: filterOptions.faculties || [],
        departments: filterOptions.departments || []
      };
    }
    return defaultFilterOptions;
  });

  // Show toast notifications based on flash messages
  useEffect(() => {
    if (flash?.success) {
      toast.success(flash.success || 'Course operation successful!', {
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

  // Fetch data when filters, page, or perPage changes
  const fetchData = async (isInitialLoad = false) => {
    setIsLoading(true);
    try {
      const params = {
        ...filters,
        page: currentPage,
        per_page: perPage,
        sort_by: sortBy,
        sort_dir: sortDir,
        ajax: true
      };

      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (params[key as keyof typeof params] === '') {
          delete params[key as keyof typeof params];
        }
      });

      // Only add ajax param if it's not the initial load
      if (!isInitialLoad) {
        params.ajax = true;
      }
      

      const response = await axios.get(route('admin.school-management.courses.index'), { params });
     
      // Ensure response data has the expected structure
      const responseData = response.data || defaultPaginationData;
      setPaginationData({
        data: responseData.data || [],
        total: responseData.total || 0,
        current_page: responseData.current_page || 1,
        per_page: responseData.per_page || perPage,
        last_page: responseData.last_page || 0,
        from: responseData.from || 0,
        to: responseData.to || 0
      });

    } catch (error) {
      console.error('Error fetching courses:', error);
      toast.error('Failed to load courses. Please try again.');
      // Don't reset data on error if we have initial data
      if (!hasFetchedInitialData.current && initialData.data && initialData.data.length > 0) {
        // Keep the initial data if this is the first fetch attempt
        setPaginationData({
          data: initialData.data || [],
          total: initialData.total || 0,
          current_page: initialData.current_page || 1,
          per_page: initialData.per_page || perPage,
          last_page: initialData.last_page || 0,
          from: initialData.from || 0,
          to: initialData.to || 0
        });
      }
    } finally {
      setIsLoading(false);
      hasFetchedInitialData.current = true;
    }
  };

  // Initial fetch - only run if there are filters or page/perPage changes
  useEffect(() => {
    // Only fetch if we have active filters or if this isn't the initial render
    const hasActiveFilters = Object.values(filters).some(value => value !== '');
    const isDifferentFromInitial = currentPage !== (initialData.current_page || 1) || 
                                  perPage !== (initialData.per_page || 10);

    if (hasActiveFilters || isDifferentFromInitial || !initialData.data || initialData.data.length === 0) {
      fetchData(true);
    }
  }, []); // Only run on initial mount

  // Fetch when filters, page, or perPage changes (excluding initial mount)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchData();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [filters, currentPage, perPage, sortBy, sortDir]);


  // Function to generate pagination numbers with ellipsis
  const getPaginationNumbers = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5;
    const totalPages = paginationData.last_page || 0;
    
    if (totalPages <= maxVisiblePages) {
      // Show all pages if total pages is less than or equal to maxVisiblePages
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      // Show first page, last page, and pages around current page
      if (currentPage <= 3) {
        // Near the start
        for (let i = 1; i <= 4; i++) {
          pageNumbers.push(i);
        }
        pageNumbers.push('...');
        pageNumbers.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        // Near the end
        pageNumbers.push(1);
        pageNumbers.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pageNumbers.push(i);
        }
      } else {
        // In the middle
        pageNumbers.push(1);
        pageNumbers.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pageNumbers.push(i);
        }
        pageNumbers.push('...');
        pageNumbers.push(totalPages);
      }
    }
    
    return pageNumbers;
  };

  const breadcrumbs = [
    {
      title: 'Settings',
      href: '/admin/settings-reports/settings',
    },
    {
      title: 'Courses',
      href: '/admin/school-management/courses',
    }
  ];

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
    setCurrentPage(1);
  };

  // Function to handle pagination
  const handlePageChange = (page: number | string) => {
    if (typeof page === 'number' && page >= 1 && page <= (paginationData.last_page || 0)) {
      setCurrentPage(page);
    }
  };

  // Function to handle filter changes
  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  // Function to clear all filters
  const clearAllFilters = () => {
    setFilters({
      search: '',
      program: '',
      level: '',
      academic_year: '',
      academic_period: '',
      faculty: '',
      department: ''
    });
    setCurrentPage(1);
  };

  // Function to handle delete
  const handleDelete = async (id: number, name: string) => {
    if (confirm(`Are you sure you want to permanently delete "${name}" course?`)) {
      try {
        await axios.delete(route('admin.school-management.courses.destroy', id));
        toast.success('Course deleted successfully!');
        // Refresh data after deletion
        fetchData();
      } catch (error) {
        toast.error('Failed to delete course. Please try again.');
      }
    }
  };

  // Helper function to format null values
  const formatField = (value: any, fallback: string = 'N/A') => {
    return value || fallback;
  };

  // Helper function to format credit hours with proper styling
  const formatCreditHours = (creditHours: number) => {
    if (!creditHours || creditHours === 0) {
      return <span className="text-sm text-slate-400">-</span>;
    }
    
    // Determine badge color based on credit hours
    let badgeColor = '';
    if (creditHours >= 4) {
      badgeColor = 'bg-red-100 text-red-800';
    } else if (creditHours === 3) {
      badgeColor = 'bg-orange-100 text-orange-800';
    } else if (creditHours === 2) {
      badgeColor = 'bg-blue-100 text-blue-800';
    } else {
      badgeColor = 'bg-green-100 text-green-800';
    }
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeColor}`}>
        {creditHours} credit{creditHours !== 1 ? 's' : ''}
      </span>
    );
  };

  // Count active filters
  const activeFiltersCount = Object.values(filters).filter(value => value !== '').length;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      importForm.setData('file', e.target.files[0]);
    }
  };

  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importForm.data.file) {
      toast.error('Please select a file to preview', {
        position: 'top-right',
        autoClose: 3000,
        theme: 'dark',
      });
      return;
    }
    setPreviewLoading(true);
    const fd = new FormData();
    fd.append('file', importForm.data.file as File);
    const token = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
    try {
      const res = await fetch(route('admin.school-management.courses.preview'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-CSRF-TOKEN': token, Accept: 'application/json' },
        body: fd,
      });

      if (!res.ok) {
        let errorMessage = 'Unable to preview file.';
        try {
          const j = await res.json();
          if (j.errors && j.errors.file) {
            errorMessage = Array.isArray(j.errors.file) ? j.errors.file.join(', ') : j.errors.file;
          } else if (j.error) errorMessage = j.error;
          else if (j.message) errorMessage = j.message;
        } catch (e) {
          try {
            errorMessage = (await res.text()) || `Server error (${res.status})`;
          } catch {
            errorMessage = `Server error (${res.status})`;
          }
        }
        toast.error(errorMessage, { position: 'top-right', autoClose: 5000, theme: 'dark' });
        setPreviewLoading(false);
        return;
      }

      const json = await res.json();
      if (json.error) {
        toast.error(json.error, { position: 'top-right', autoClose: 5000, theme: 'dark' });
        setPreviewLoading(false);
        return;
      }

      setPreviewRows(json.rows || []);
      setShowPreview(true);
    } catch (err) {
      console.error('Preview error:', err);
      toast.error(err instanceof Error ? err.message : 'Unable to preview file.', {
        position: 'top-right',
        autoClose: 5000,
        theme: 'dark',
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importForm.data.file) return;
    setConfirmLoading(true);
    const fd = new FormData();
    fd.append('file', importForm.data.file as File);
    const token = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
    try {
      const res = await fetch(route('admin.school-management.courses.confirm-import'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-CSRF-TOKEN': token, Accept: 'application/json' },
        body: fd,
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(`Imported ${json.imported} rows, skipped ${json.skipped}`, {
          position: 'top-right',
          autoClose: 5000,
          theme: 'dark',
        });
        fetchData();
        setShowPreview(false);
        setPreviewRows([]);
        importForm.setData('file', null);
      } else {
        toast.error(json.error || 'Import failed', {
          position: 'top-right',
          autoClose: 5000,
          theme: 'dark',
        });
      }
    } catch (err) {
      console.error(err);
      toast.error('Import failed', { position: 'top-right', autoClose: 5000, theme: 'dark' });
    } finally {
      setConfirmLoading(false);
    }
  };

  // Safely get courses data
  const coursesData = paginationData.data || [];
  const totalCourses = paginationData.total || 0;
  const from = paginationData.from || 0;
  const to = paginationData.to || 0;
  const lastPage = paginationData.last_page || 0;

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Courses List" />
      <div className="min-h-screen bg-slate-50 flex">
        {/* -------------------- MAIN CONTENT AREA -------------------- */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Page Content */}
          <div className="p-4 sm:p-6 lg:p-8 flex-1 overflow-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
              <div>
                <h2 className="text-3xl font-extrabold text-slate-900 mb-2">Courses List</h2>
                <p className="text-slate-600">Manage courses for your institution</p>
              </div>
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 mt-4 sm:mt-0">
               
               {can('admin.school-management.courses.create') && (
                <Link
                  href={route('admin.school-management.courses.create')} 
                  className="flex items-center justify-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Add Course
                </Link>
              )}
              </div>
            </div>

            {/* Import/Export Card */}
            <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Import & Export</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-slate-700">Export Data</h3>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={route('admin.school-management.courses.export', 'excel')}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      Export XLSX
                    </a>
                    <a
                      href={route('admin.school-management.courses.export', 'csv')}
                      className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                    >
                      <FileText className="h-4 w-4" />
                      Export CSV
                    </a>
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-slate-700">Import Data</h3>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <a
                        href={route('admin.school-management.courses.template')}
                        className="mb-2 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      >
                        <Download className="h-4 w-4" />
                        Download Template
                      </a>
                      <form onSubmit={handlePreview} className="mt-2" encType="multipart/form-data">
                        <label className="mb-2 block text-xs font-medium text-slate-700">
                          Upload File
                        </label>
                        <div className="flex gap-2">
                          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500">
                            <Upload className="h-4 w-4 text-slate-500" />
                            <span className="flex-1 truncate">
                              {importForm.data.file ? importForm.data.file.name : 'Choose file...'}
                            </span>
                            <input
                              type="file"
                              name="file"
                              onChange={handleFileChange}
                              accept=".csv,.xlsx,.xls"
                              className="hidden"
                            />
                          </label>
                          {importForm.data.file && (
                            <button
                              type="button"
                              onClick={() => importForm.setData('file', null)}
                              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                              title="Clear file"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="submit"
                            disabled={previewLoading || !importForm.data.file}
                            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                          >
                            {previewLoading ? 'Loading...' : 'Preview'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Filters Section */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 mb-6">
              <div className="p-4 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Filter className="w-5 h-5 text-slate-500 mr-2" />
                    <h3 className="text-lg font-semibold text-slate-900">Filters</h3>
                    {activeFiltersCount > 0 && (
                      <span className="ml-2 px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-800 rounded-full">
                        {activeFiltersCount} active
                      </span>
                    )}
                    {isLoading && (
                      <span className="ml-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full flex items-center">
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                        Loading...
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {activeFiltersCount > 0 && (
                      <button
                        onClick={clearAllFilters}
                        className="text-sm text-slate-600 hover:text-slate-900 flex items-center"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Clear all
                      </button>
                    )}
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      {showFilters ? 'Hide Filters' : 'Show Filters'}
                    </button>
                  </div>
                </div>
              </div>

              {showFilters && (
                <div className="p-6 border-t border-slate-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Search Filter */}
                    <div className="lg:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Search Courses
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                        <input
                          type="text"
                          placeholder="Search by name, code, or program..."
                          value={filters.search}
                          onChange={(e) => handleFilterChange('search', e.target.value)}
                          className="pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm w-full transition-shadow"
                        />
                        {filters.search && (
                          <button
                            onClick={() => handleFilterChange('search', '')}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            aria-label="Clear search"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Program Filter */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Program
                      </label>
                      <select
                        value={filters.program}
                        onChange={(e) => handleFilterChange('program', e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm"
                      >
                        <option value="">All Programs</option>
                        {(filterOptionsState.programs || []).map(program => (
                          <option key={program.id} value={program.id}>
                            {program.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Level Filter */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Level
                      </label>
                      <select
                        value={filters.level}
                        onChange={(e) => handleFilterChange('level', e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm"
                      >
                        <option value="">All Levels</option>
                        {(filterOptionsState.levels || []).map(level => (
                          <option key={level.id} value={level.id}>
                            {level.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Faculty Filter */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Faculty
                      </label>
                      <select
                        value={filters.faculty}
                        onChange={(e) => handleFilterChange('faculty', e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm"
                      >
                        <option value="">All Faculties</option>
                        {(filterOptionsState.faculties || []).map(faculty => (
                          <option key={faculty.id} value={faculty.id}>
                            {faculty.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Department Filter */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Department
                      </label>
                      <select
                        value={filters.department}
                        onChange={(e) => handleFilterChange('department', e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm"
                      >
                        <option value="">All Departments</option>
                        {(filterOptionsState.departments || []).map(dept => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Academic Year Filter */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Academic Year
                      </label>
                      <select
                        value={filters.academic_year}
                        onChange={(e) => handleFilterChange('academic_year', e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm"
                      >
                        <option value="">All Academic Years</option>
                        {(filterOptionsState.academicYears || []).map(year => (
                          <option key={year.id} value={year.id}>
                            {year.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Academic Period Filter */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Academic Period
                      </label>
                      <select
                        value={filters.academic_period}
                        onChange={(e) => handleFilterChange('academic_period', e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm"
                      >
                        <option value="">All Academic Periods</option>
                        {(filterOptionsState.academicPeriods || []).map(period => (
                          <option key={period.id} value={period.id}>
                            {period.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Items Per Page */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Items Per Page
                      </label>
                      <select
                        value={perPage}
                        onChange={(e) => setPerPage(parseInt(e.target.value))}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm"
                      >
                        <option value="10">10</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                      </select>
                    </div>
                  </div>

                  {/* Active Filters Badges */}
                  {activeFiltersCount > 0 && (
                    <div className="mt-6 pt-6 border-t border-slate-200">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="text-sm font-medium text-slate-700">Active filters:</span>
                        {filters.program && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Program: {(filterOptionsState.programs || []).find(p => p.id === parseInt(filters.program))?.name}
                            <button
                              onClick={() => handleFilterChange('program', '')}
                              className="ml-2 text-blue-600 hover:text-blue-800"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        )}
                        {filters.level && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Level: {(filterOptionsState.levels || []).find(l => l.id === parseInt(filters.level))?.name}
                            <button
                              onClick={() => handleFilterChange('level', '')}
                              className="ml-2 text-green-600 hover:text-green-800"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        )}
                        {filters.academic_year && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            Year: {(filterOptionsState.academicYears || []).find(y => y.id === parseInt(filters.academic_year))?.name}
                            <button
                              onClick={() => handleFilterChange('academic_year', '')}
                              className="ml-2 text-purple-600 hover:text-purple-800"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        )}
                        {filters.academic_period && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-800">
                            Period: {(filterOptionsState.academicPeriods || []).find(p => p.id === parseInt(filters.academic_period))?.name}
                            <button
                              onClick={() => handleFilterChange('academic_period', '')}
                              className="ml-2 text-pink-600 hover:text-pink-800"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        )}
                        {filters.faculty && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            Faculty: {(filterOptionsState.faculties || []).find(f => f.id === parseInt(filters.faculty))?.name}
                            <button
                              onClick={() => handleFilterChange('faculty', '')}
                              className="ml-2 text-orange-600 hover:text-orange-800"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        )}
                        {filters.department && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                            Department: {(filterOptionsState.departments || []).find(d => d.id === parseInt(filters.department))?.name}
                            <button
                              onClick={() => handleFilterChange('department', '')}
                              className="ml-2 text-teal-600 hover:text-teal-800"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <DataTable
              title="Courses List"
              records={paginationData}
              columns={[
                {
                  key: 'course_code',
                  label: 'Code',
                  sortable: true,
                  render: (course) => (
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                      {course.course_code}
                    </span>
                  ),
                },
                {
                  key: 'name',
                  label: 'Course',
                  sortable: true,
                  render: (course) => <p className="font-medium capitalize text-sidebar-foreground">{course.name}</p>,
                },
                {
                  key: 'program',
                  label: 'Program',
                  sortable: true,
                  render: (course) => <p className="text-sm text-sidebar-foreground/70">{formatField(course.program?.name)}</p>,
                },
                {
                  key: 'level',
                  label: 'Level',
                  sortable: true,
                  hideOnMobile: true,
                  render: (course) => (
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${course.level?.name ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {formatField(course.level?.name)}
                    </span>
                  ),
                },
                {
                  key: 'academic_year',
                  label: 'Year',
                  sortable: true,
                  hideOnMobile: true,
                  render: (course) => <p className="text-sm text-sidebar-foreground/70">{formatField(course.academic_year?.name)}</p>,
                },
                {
                  key: 'academic_period',
                  label: 'Period',
                  sortable: true,
                  hideOnMobile: true,
                  render: (course) => <p className="text-sm text-sidebar-foreground/70">{formatField(course.academic_period?.name)}</p>,
                },
                {
                  key: 'credit_hours',
                  label: 'Credits',
                  sortable: true,
                  render: (course) => formatCreditHours(course.credit_hours),
                },
                {
                  key: 'student_size',
                  label: 'Size',
                  sortable: true,
                  hideOnMobile: true,
                  render: (course) => <p className="text-sm text-sidebar-foreground/70">{course.student_size || '—'}</p>,
                },
                {
                  key: 'faculty',
                  label: 'Faculty',
                  hideOnMobile: true,
                  render: (course) => <p className="text-sm text-sidebar-foreground/70">{formatField(course.program?.department?.faculty?.name)}</p>,
                },
                {
                  key: 'department',
                  label: 'Department',
                  hideOnMobile: true,
                  render: (course) => <p className="text-sm text-sidebar-foreground/70">{formatField(course.program?.department?.name)}</p>,
                },
                {
                  key: 'actions',
                  label: 'Actions',
                  className: 'text-right',
                  render: (course) => (
                    <RowActionsMenu label={`Actions for ${course.name}`}>
                      {can('admin.school-management.courses.edit') && (
                        <DropdownMenuItem asChild>
                          <Link href={route('admin.school-management.courses.edit', course.id)}>
                            <Edit className="size-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                      )}
                      {can('admin.school-management.courses.delete') && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-rose-600 focus:text-rose-600"
                            onClick={() => handleDelete(course.id, course.name)}
                          >
                            <Trash2 className="size-4" />
                            Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </RowActionsMenu>
                  ),
                },
              ]}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={handleSort}
              perPage={perPage}
              onPerPageChange={(size) => {
                setPerPage(size);
                setCurrentPage(1);
              }}
              onPageChange={(page) => setCurrentPage(page)}
              loading={isLoading}
              search={filters.search}
              searchPlaceholder="Search by name, code, or program..."
              onSearchChange={(value) => handleFilterChange('search', value)}
              hasActiveQuery={activeFiltersCount > 0}
              recordLabel="courses"
              empty={{
                title: 'No courses yet',
                description: 'Add a course or import a file to get started.',
                action: can('admin.school-management.courses.create') ? (
                  <Link
                    href={route('admin.school-management.courses.create')}
                    className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    <Plus className="mr-2 size-4" />
                    Add Course
                  </Link>
                ) : undefined,
              }}
              noResults={{
                title: 'No courses match the current filters',
                description: 'Try a different search or clear one of the filters.',
              }}
            />
          </div>
        </div>
      </div>
      <ToastContainer />
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setShowPreview(false)}
          />
          <div className="relative w-full max-w-6xl max-h-[90vh] rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Import Preview</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Review {previewRows.length} row{previewRows.length !== 1 ? 's' : ''} before importing
                </p>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-auto max-h-[calc(90vh-180px)] p-6">
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Line</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Course Code</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Program</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Course Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Student Size</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Errors</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {previewRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">No data to preview</td>
                      </tr>
                    ) : (
                      previewRows.map((r: any, i: number) => (
                        <tr
                          key={i}
                          className={`transition-colors ${
                            r.errors.length > 0
                              ? 'bg-red-50/50 hover:bg-red-50'
                              : r.exists
                              ? 'bg-amber-50/50 hover:bg-amber-50'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">{r.line}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-900">{r.data.course_code || '-'}</td>
                          <td className="px-4 py-3 text-sm text-slate-900">{r.data.name || '-'}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{r.data.program || '-'}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{r.data.course_type || '-'}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{r.data.student_size ?? '-'}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm">
                            {r.errors.length > 0 ? (
                              <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">Error</span>
                            ) : r.exists ? (
                              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">Exists</span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">New</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-red-600">
                            {r.errors.length > 0 ? r.errors.join(', ') : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
              <div className="text-sm text-slate-600">
                {previewRows.filter((r: any) => r.errors.length === 0).length} valid row
                {previewRows.filter((r: any) => r.errors.length === 0).length !== 1 ? 's' : ''} ready to import
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPreview(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={confirmLoading || previewRows.filter((r: any) => r.errors.length === 0).length === 0}
                  className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  {confirmLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Importing...
                    </span>
                  ) : (
                    'Confirm Import'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default CourseIndexPage;