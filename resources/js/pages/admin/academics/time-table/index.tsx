// resources/js/pages/Admin/SchoolManagement/TimeTables/Index.tsx
import React, { useState, useEffect } from 'react';
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
  Download // Added for export
} from 'lucide-react';
import axios from 'axios';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, usePage, router } from '@inertiajs/react';
import { PagePropsWithFlash } from '@/types';
import { ToastContainer, toast, Bounce } from 'react-toastify';
import { Button } from '@headlessui/react';
import ComboBox from '@/components/combobox';
import { can } from '@/lib/can';

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
}

interface TimeTable {
  id: number;
  academic_year_id: number;
  course_id: number;
  class_room_id: number;
  teacher_id: number | null;
  day: string;
  start_time: string;
  end_time: string;
  academic_year: AcademicYear;
  course: Course;
  class_room: ClassRoom;
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
  dayOptions: Array<{ label: string; value: string }>;
  filters: {
    academic_year_id?: number;
    program_id?: number;
    course_id?: number;
    class_room_id?: number;
    teacher_id?: number;
    day?: string;
  };
}

const TimeTablesIndexPage = ({ 
  timeTables,
  academicYearOptions,
  programOptions,
  courseOptions,
  classRoomOptions,
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
    day: initialFilters.day || ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);
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
      title: 'Time Tables',
      href: '/admin/school-management/time-tables',
    }
  ];

  // Group by day for better organization
  const groupedByDay = timeTables.data.reduce((acc, timetable) => {
    if (!acc[timetable.day]) {
      acc[timetable.day] = [];
    }
    acc[timetable.day].push(timetable);
    return acc;
  }, {} as Record<string, TimeTable[]>);

  // Sort days
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const sortedDays = Object.keys(groupedByDay).sort((a, b) => 
    dayOrder.indexOf(a) - dayOrder.indexOf(b)
  );

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Time Tables" />
      <div className="min-h-screen bg-slate-50 flex">
        {/* Main Content Area */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Page Content */}
          <div className="p-4 sm:p-6 lg:p-8 flex-1 overflow-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
              <div>
                <h2 className="text-3xl font-extrabold text-slate-900 mb-2">Time Tables</h2>
                <p className="text-slate-600">Manage class schedules and time slots</p>
              </div>
              <div className="flex space-x-3 mt-4 sm:mt-0">
                {/* Export Dropdown */}
                <div className="relative group">
                  <button
                    onClick={() => handleExport('excel')}
                    disabled={isExporting}
                    className="flex items-center justify-center px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    {isExporting ? 'Exporting...' : 'Export'}
                  </button>
                  
                  {/* Export Options Dropdown */}
                  <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                    <button
                      onClick={() => handleExport('excel')}
                      disabled={isExporting}
                      className="flex items-center w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export as Excel
                    </button>
                    <button
                      onClick={() => handleExport('csv')}
                      disabled={isExporting}
                      className="flex items-center w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export as CSV
                    </button>
                    {/* Uncomment when PDF export is implemented
                    <button
                      onClick={() => handleExport('pdf')}
                      disabled={isExporting}
                      className="flex items-center w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export as PDF
                    </button>
                    */}
                  </div>
                </div>

                {can('admin.academics.time-tables.create') && (
                <Link
                  href={route('admin.academics.time-tables.create')}
                  className="flex items-center justify-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Add Time Slot
                </Link>
                )}
              </div>
            </div>

            {/* Filters Section */}
            <div className="mb-6 bg-white rounded-2xl shadow-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Filter className="w-5 h-5 text-slate-500" />
                  <h3 className="text-lg font-semibold text-slate-900">Filters</h3>
                  {activeFilterCount > 0 && (
                    <span className="bg-indigo-100 text-indigo-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                      {activeFilterCount} active
                    </span>
                  )}
                </div>
                <div className="flex space-x-2">
                  {activeFilterCount > 0 && (
                    <button
                      onClick={clearAllFilters}
                      className="text-sm text-slate-600 hover:text-slate-900 flex items-center space-x-1 px-3 py-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                      <span>Clear all</span>
                    </button>
                  )}
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center space-x-1 px-3 py-1.5 hover:bg-indigo-50 rounded-lg transition-colors"
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

                  {/* Classroom Filter */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Classroom
                    </label>
                     <ComboBox
                        options={classRoomOptions}
                        label="All Classroom"
                        externalValue={handleValueChange('class_room_id')}
                        defaultValue={null}
                      />
                      {/* <select
                        value={filters.class_room_id}
                        onChange={(e) => setFilters(prev => ({ ...prev, class_room_id: e.target.value ? Number(e.target.value) : '' }))}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm transition-shadow"
                      >
                        <option value="">All Classrooms</option>
                        {classRoomOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select> */}
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
                  <div className="md:col-span-2 lg:col-span-5 flex justify-end space-x-3">
                    <button
                      onClick={clearAllFilters}
                      className="px-4 py-2.5 border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      Reset
                    </button>
                    <button
                      onClick={applyFilters}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                      Apply Filters
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Export Info Bar */}
            {activeFilterCount > 0 && (
              <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <Download className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-emerald-900">
                        Export with current filters applied
                      </p>
                      <p className="text-xs text-emerald-700">
                        {activeFilterCount} active filter{activeFilterCount !== 1 ? 's' : ''} will be included in the export
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleExport('excel')}
                    disabled={isExporting}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isExporting ? 'Exporting...' : 'Export Now'}
                  </button>
                </div>
              </div>
            )}

            {/* Time Tables List - Grouped by Day */}
            <div className="space-y-6">
              {sortedDays.map((day) => (
                <div key={day} className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                  <div className="p-6 border-b border-slate-200 bg-slate-50">
                    <h3 className="text-xl font-bold text-slate-900 flex items-center">
                      <Calendar className="w-5 h-5 mr-2 text-indigo-600" />
                      {day}
                      <span className="ml-2 text-sm font-normal text-slate-500">
                        ({groupedByDay[day].length} time slots)
                      </span>
                    </h3>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Time</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Course</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Program</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Classroom</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Teacher</th>
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
                              <div className="flex items-center space-x-2">
                                <BookOpen className="w-4 h-4 text-slate-400" />
                                <div>
                                  <div className="text-sm font-medium text-slate-900">
                                    {timetable.course.name}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {timetable.course.course_code}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {timetable.course.program ? (
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
                                    {timetable.class_room.name}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    Capacity: {timetable.class_room.capacity}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {timetable.course.teacher ? (
                                <div className="flex items-center space-x-2">
                                  <User className="w-4 h-4 text-slate-400" />
                                  <div>
                                    <div className="text-sm font-medium text-slate-900">
                                      {timetable.course.teacher.title} {timetable.course.teacher.first_name} {timetable.course.teacher.last_name}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      {timetable.course.teacher.employee_id}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-sm text-slate-400 italic">No teacher assigned</div>
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
                                <Button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleDelete(
                                      timetable.id,
                                      timetable.course.name,
                                      timetable.day,
                                      `${formatTime(timetable.start_time)} - ${formatTime(timetable.end_time)}`
                                    );
                                  }}
                                  className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete time slot"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </Button>
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
                  <h3 className="text-xl font-semibold text-slate-700 mb-2">No Time Tables Found</h3>
                  <p className="text-slate-500 mb-6">
                    {activeFilterCount > 0 
                      ? "No time slots match your current filters. Try adjusting your filter criteria."
                      : "No time slots have been created yet. Add your first time slot to get started."
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
                      Add Time Slot
                    </Link>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Pagination */}
            {timeTables.total > 0 && (
              <div className="mt-6 bg-white rounded-2xl shadow-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="text-sm text-slate-600">
                    Showing <span className="font-semibold text-slate-800">
                      {((timeTables.current_page - 1) * timeTables.per_page) + 1}
                    </span> to <span className="font-semibold text-slate-800">
                      {Math.min(timeTables.current_page * timeTables.per_page, timeTables.total)}
                    </span> of <span className="font-semibold text-slate-800">{timeTables.total}</span> Time Slots
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handlePageChange(timeTables.current_page - 1)}
                      disabled={timeTables.current_page === 1}
                      className={`px-4 py-2 border border-slate-300 rounded-xl text-sm font-medium ${
                        timeTables.current_page === 1
                          ? 'text-slate-400 bg-slate-100 cursor-not-allowed'
                          : 'text-slate-700 hover:bg-slate-50 hover:border-slate-400'
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
                      className={`px-4 py-2 border border-indigo-300 bg-indigo-600 text-white rounded-xl text-sm font-medium ${
                        timeTables.current_page === timeTables.last_page
                          ? 'opacity-50 cursor-not-allowed'
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
      <ToastContainer />
    </AppLayout>
  );
};

export default TimeTablesIndexPage;