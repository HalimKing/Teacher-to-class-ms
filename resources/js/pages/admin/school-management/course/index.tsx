import React, { useState, useEffect, useRef } from 'react';
import { 
  Search,
  Plus,
  Edit,
  Trash2,
  Filter,
  X,
  Download,
  RefreshCw
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, usePage, router } from '@inertiajs/react';
import { PagePropsWithFlash } from '@/types';
import { ToastContainer, toast, Bounce } from 'react-toastify';
import { Button } from '@headlessui/react';
import axios from 'axios';

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
  from: number;
  to: number;
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
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { flash } = usePage().props as PagePropsWithFlash;
  
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
  }, [filters, currentPage, perPage]);


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
      title: 'Dashboard',
      href: '/admin/dashboard',
    },
    {
      title: 'Courses',
      href: '/admin/school-management/courses',
    }
  ];

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
               
                <Link
                  href={route('admin.school-management.courses.create')} 
                  className="flex items-center justify-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Add Course
                </Link>
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

            {/* Courses Table */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200">
              <div className="p-6 border-b border-slate-200">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Courses List</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Showing {from} to {to} of {totalCourses} courses
                      {activeFiltersCount > 0 && ' (filtered)'}
                    </p>
                  </div>
                  {isLoading && (
                    <div className="flex items-center text-blue-600">
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      <span className="text-sm">Loading courses...</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">#</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Course Code</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Course Name</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Program</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Level</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Academic Year</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Academic Period</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Credit Hours</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Student Size</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Faculty</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Department</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {coursesData.length > 0 ? (
                      coursesData.map((course, index) => (
                        <tr key={course.id} className="hover:bg-indigo-50/20 transition-colors">
                          <td className='text-right px-4 py-4'>
                            {from + index}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {course.course_code}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-4">
                              <div className="text-sm font-semibold text-slate-900">
                                <p style={{ textTransform: 'capitalize' }}>{course.name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {formatField(course.program?.name)}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              course.level?.name ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {formatField(course.level?.name)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {formatField(course.academic_year?.name)}
                          </td>
                          <td className="px-6 py-4">
                            {formatField(course.academic_period?.name)}
                          </td>
                          <td className="px-6 py-4">
                            {formatCreditHours(course.credit_hours)}
                          </td>
                          <td className="px-6 py-4">
                            {course.student_size ? (
                              <div className="flex items-center">
                                <span className="text-sm font-medium text-slate-900">{course.student_size}</span>
                                <span className="ml-1 text-xs text-slate-500">students</span>
                              </div>
                            ) : (
                              <span className="text-sm text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {formatField(course.program?.department?.faculty?.name)}
                          </td>
                          <td className="px-6 py-4">
                            {formatField(course.program?.department?.name)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-1">
                              <Link 
                                title="Edit Course" 
                                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                href={route('admin.school-management.courses.edit', course.id)}
                              >
                                <Edit className="w-5 h-5" />
                              </Link>
                              <Button 
                                title="Delete Course" 
                                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleDelete(course.id, course.name);
                                }}
                               
                              >
                                <Trash2 className="w-5 h-5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={12} className="px-6 py-12 text-center text-slate-500">
                          <div className="flex flex-col items-center justify-center">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                              <Search className="w-8 h-8 text-slate-400" />
                            </div>
                            <h4 className="text-lg font-medium text-slate-700 mb-2">
                              {isLoading ? 'Loading courses...' : 'No courses found'}
                            </h4>
                            <p className="text-sm text-slate-500 max-w-md mx-auto mb-4">
                              {isLoading 
                                ? 'Please wait while we load the courses...'
                                : activeFiltersCount > 0 
                                  ? 'No courses match your current filters. Try adjusting your filter criteria.'
                                  : 'No courses have been created yet. Add your first course to get started.'}
                            </p>
                            {!isLoading && activeFiltersCount > 0 && (
                              <button
                                onClick={clearAllFilters}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                              >
                                Clear all filters
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              {lastPage > 0 && (
                <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between flex-wrap gap-4">
                  <div className="text-sm text-slate-600">
                    Showing <span className="font-semibold text-slate-800">{from}</span> to <span className="font-semibold text-slate-800">{to}</span> of <span className="font-semibold text-slate-800">{totalCourses}</span> Courses
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1 || isLoading}
                      className={`px-4 py-2 border border-slate-300 rounded-xl text-sm font-medium ${
                        currentPage === 1 || isLoading
                          ? 'text-slate-400 bg-slate-100 cursor-not-allowed' 
                          : 'text-slate-700 hover:bg-slate-50 hover:border-slate-400'
                      }`}
                    >
                      Previous
                    </button>
                    
                    {/* Page Numbers */}
                    <div className="hidden sm:flex space-x-1">
                      {getPaginationNumbers().map((page, index) => (
                        <button
                          key={index}
                          onClick={() => typeof page === 'number' && handlePageChange(page)}
                          disabled={typeof page !== 'number' || isLoading}
                          className={`px-3 py-2 rounded-lg text-sm font-medium min-w-[40px] ${
                            currentPage === page
                              ? 'bg-indigo-600 text-white'
                              : typeof page === 'number'
                                ? 'text-slate-700 hover:bg-slate-100 border border-slate-300 hover:border-slate-400'
                                : 'text-slate-400 cursor-default'
                          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>
                    
                    <button 
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === lastPage || lastPage === 0 || isLoading}
                      className={`px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium ${
                        currentPage === lastPage || lastPage === 0 || isLoading
                          ? 'opacity-50 cursor-not-allowed' 
                          : 'hover:bg-indigo-700'
                      }`}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <ToastContainer />
    </AppLayout>
  );
};

export default CourseIndexPage;