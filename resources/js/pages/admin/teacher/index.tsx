import React, { useState, useEffect } from 'react';
import { 
  Eye,
  Search,
  Award,
  Plus,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ToastContainer, toast, Bounce } from 'react-toastify';
import { PagePropsWithFlash } from '@/types';
import Button from '@mui/material/Button';

// Utility function to convert status string to display name
const formatStatus = (status: string): string => {
    return status.replace('_', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

type Faculty = {
  id: number;
  name: string;
};

type Department = {
  id: number;
  name: string;
};

interface Teacher {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  employee_id: string | number;
  faculty: Faculty;
  department: Department;
  title: string;
}

interface TeachersIndexPageProps {
  teachers: {
    data: Teacher[];
    current_page: number;
    last_page: number;
    total: number;
    from: number;
    to: number;
  };
  faculties: Faculty[];
  departments: Department[];
  filters: {
    search?: string;
    faculty?: string;
    department?: string;
  };
}

const TeachersIndexPage = ({ teachers, faculties, departments, filters: initialFilters }: TeachersIndexPageProps) => {
  const [searchTerm, setSearchTerm] = useState(initialFilters.search || '');
  const [selectedFaculty, setSelectedFaculty] = useState(initialFilters.faculty || 'all');
  const [selectedDepartment, setSelectedDepartment] = useState(initialFilters.department || 'all');

  const { flash } = usePage().props as PagePropsWithFlash;
  
  // Debounce search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const currentParams = new URLSearchParams(window.location.search);
      const newFilters: any = {};
      
      if (searchTerm) newFilters.search = searchTerm;
      if (selectedFaculty !== 'all') newFilters.faculty = selectedFaculty;
      if (selectedDepartment !== 'all') newFilters.department = selectedDepartment;
      
      // Only update if filters changed
      if (JSON.stringify(newFilters) !== JSON.stringify(initialFilters)) {
        router.get(route('admin.teachers.index'), newFilters, {
          preserveState: true,
          replace: true,
        });
      }
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [searchTerm, selectedFaculty, selectedDepartment]);


  useEffect(() => {
      if (flash?.success) {
        toast.success(flash.success || 'Successful created faculty!', {
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
    },[flash?.success]);
  



  const handleFilterChange = (filterType: string, value: string) => {
    if (filterType === 'faculty') {
      setSelectedFaculty(value);
      setSelectedDepartment('all'); // Reset department when faculty changes
    } else if (filterType === 'department') {
      setSelectedDepartment(value);
    }
  };

  const handlePageChange = (page: number) => {
    const currentParams = new URLSearchParams(window.location.search);
    currentParams.set('page', page.toString());
    
    router.get(route('admin.teachers.index') + '?' + currentParams.toString(), {}, {
      preserveState: true,
    });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedFaculty('all');
    setSelectedDepartment('all');
    router.get(route('admin.teachers.index'));
  };

  const handleDelete = (teacherId: number) => {
    if (confirm('Are you sure you want to delete this teacher?')) {
      router.delete(route('admin.teachers.destroy', teacherId), {
        preserveState: true,
      });
    }
  };

  type TeacherStatus = 'teaching' | 'available' | 'offline' | 'in_meeting';

  const getStatusColor = (status: TeacherStatus | string): string => {
    switch (status) {
      case 'teaching': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'available': return 'bg-green-50 text-green-700 border-green-200';
      case 'offline': return 'bg-gray-50 text-gray-700 border-gray-200';
      case 'in_meeting': return 'bg-orange-50 text-orange-700 border-orange-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getStatusDot = (status: TeacherStatus | string): string => {
    switch (status) {
      case 'teaching': return 'bg-blue-500';
      case 'available': return 'bg-green-500';
      case 'offline': return 'bg-gray-400';
      case 'in_meeting': return 'bg-orange-500';
      default: return 'bg-gray-400';
    }
  };

  // Breadcrumbs for the layout
  const breadcrumbs = [
    {
      title: 'Admin',
      href: '/admin/dashboard',
    },
    {
      title: 'Teachers',
      href: '/admin/teachers',
    }
  ];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Teachers" />
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex">
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="p-4 sm:p-6 lg:p-8 flex-1 overflow-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
              <div>
                <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">Teachers Overview</h2>
                <p className="text-slate-600 dark:text-slate-400">Comprehensive management and performance monitoring for teaching staff</p>
              </div>
              <Link
                href={route('admin.teachers.create')} 
                className="mt-4 sm:mt-0 flex items-center justify-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add New Teacher
              </Link>
            </div>

            {/* Filters Section */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 mb-6">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between space-y-4 lg:space-y-0">
                <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 flex-1">
                  <div className="relative flex-1 sm:flex-none">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Search name, email or ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm w-full sm:w-64 transition-shadow dark:placeholder-slate-400"
                    />
                  </div>
                  
                  <select
                    value={selectedFaculty}
                    onChange={(e) => handleFilterChange('faculty', e.target.value)}
                    className="px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm w-full sm:w-48"
                  >
                    <option value="all">All Faculties</option>
                    {faculties.map((faculty) => (
                      <option key={faculty.id} value={faculty.id}>
                        {faculty.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedDepartment}
                    onChange={(e) => handleFilterChange('department', e.target.value)}
                    className="px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm w-full sm:w-48"
                  >
                    <option value="all">All Departments</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                {(searchTerm || selectedFaculty !== 'all' || selectedDepartment !== 'all') && (
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            {/* Teachers Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Teacher Directory</h3>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Showing {teachers.from}-{teachers.to} of {teachers.total} teachers
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Teacher</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">ID</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Faculty</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Department</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                    {teachers.data.map((teacher) => (
                      <tr key={teacher.id} className="hover:bg-indigo-50/20 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-4">
                            <div className="relative flex-shrink-0">
                              <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                                <span className="text-white text-sm font-semibold">
                                  {teacher.first_name[0] + teacher.last_name[0]}
                                </span>
                              </div>
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-slate-900 dark:text-white">{`${teacher.title} ${teacher.first_name} ${teacher.last_name}`}</div>
                              <div className="text-sm text-slate-500 dark:text-slate-400">{teacher.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-slate-900 dark:text-white">{teacher.employee_id}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-700 dark:text-slate-300">{teacher.faculty.name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-700 dark:text-slate-300">{teacher.department.name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-1">
                            <Link href={route('admin.teachers.edit', teacher.id)} title="Edit Teacher" className="p-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                              <Edit className="w-5 h-5" />
                            </Link>
                            <Button
                            onClick={() => handleDelete(teacher.id)} title="Delete Teacher" className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                              <Trash2 className="w-5 h-5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {teachers.data.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400 text-lg">
                          No teachers found matching your criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-4">
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Showing <span className="font-semibold text-slate-800 dark:text-slate-200">{teachers.from}-{teachers.to}</span> of <span className="font-semibold text-slate-800 dark:text-slate-200">{teachers.total}</span> teachers
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => handlePageChange(teachers.current_page - 1)}
                    disabled={teachers.current_page === 1}
                    className={`px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-medium flex items-center space-x-2 ${
                      teachers.current_page === 1 
                        ? 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 cursor-not-allowed' 
                        : 'text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600'
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>
                  
                  <button 
                    onClick={() => handlePageChange(teachers.current_page + 1)}
                    disabled={teachers.current_page === teachers.last_page}
                    className={`px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-medium flex items-center space-x-2 ${
                      teachers.current_page === teachers.last_page
                        ? 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 cursor-not-allowed' 
                        : 'text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600'
                    }`}
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ToastContainer />
    </AppLayout>
  );
};

export default TeachersIndexPage;