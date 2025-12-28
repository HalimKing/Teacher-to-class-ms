import React, { useState, useEffect } from 'react';
import { 
  Eye,
  Search,
  Plus,
  Edit,
  Trash2,
  Filter,
  X
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, usePage, router } from '@inertiajs/react';
import { PagePropsWithFlash } from '@/types';
import { ToastContainer, toast, Bounce } from 'react-toastify';

// Update interfaces
interface Department {
  id: number;
  name: string;
  description: string;
  faculty: Faculty;
}

interface Faculty {
  id: number;
  name: string;
}

interface FacultyOption {
  label: string;
  value: number;
}

interface PaginatedDepartments {
  data: Department[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
  links: Array<{
    url: string | null;
    label: string;
    active: boolean;
  }>;
}

interface TeachersIndexPageProps {
  departmentData: PaginatedDepartments;
  facultyOptions: FacultyOption[];
  search?: string;
  faculty?: string; // Add faculty filter prop from backend
}

const DepartmentIndexPage = ({ departmentData, facultyOptions, search, faculty }: TeachersIndexPageProps) => {
  const [searchTerm, setSearchTerm] = useState(search || '');
  const [facultyFilter, setFacultyFilter] = useState(faculty || '');
  const [showFacultyFilter, setShowFacultyFilter] = useState(false);
  const { flash } = usePage().props as PagePropsWithFlash;
  
  // Fix: Initialize with false and use useEffect to handle window resize
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Show toast notifications based on flash messages
  useEffect(() => {
    if (flash?.success) {
      toast.success(flash.success || 'Department created successfully!', {
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
  }, [flash?.success]);

  // Fix: Add useEffect to handle window resize properly
  useEffect(() => {
    const handleResize = () => {
      setSidebarOpen(window.innerWidth >= 1024);
    };
    
    // Set initial value
    handleResize();
    
    // Add event listener
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle search and filter with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      router.get(route('admin.school-management.departments.index'), 
        { 
          search: searchTerm || '',
          faculty: facultyFilter || ''
        },
        {
          preserveState: true,
          replace: true,
          preserveScroll: true,
        }
      );
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchTerm, facultyFilter]);

  const handleSignOut = () => {
    console.log("User signed out!");
  };

  const departments: PaginatedDepartments = departmentData;

 

  const breadcrumbs = [
    {
      title: 'Dashboard',
      href: '/admin/dashboard',
    },
    {
      title: 'Departments',
      href: '/admin/teachers',
    }
  ];

  // Function to handle pagination with Inertia
  const handlePageChange = (url: string | null) => {
    if (url) {
      router.get(url, {}, {
        preserveState: true,
        replace: true,
        preserveScroll: true,
      });
    }
  };

  // Function to clear search
  const clearSearch = () => {
    setSearchTerm('');
  };

  // Function to clear faculty filter
  const clearFacultyFilter = () => {
    setFacultyFilter('');
  };

  // Function to clear all filters
  const clearAllFilters = () => {
    setSearchTerm('');
    setFacultyFilter('');
  };

  // Check if any filters are active
  const hasActiveFilters = searchTerm || facultyFilter;

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Departments" />
      <div className="min-h-screen bg-slate-50 flex">
        {/* -------------------- MAIN CONTENT AREA -------------------- */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Page Content */}
          <div className="p-4 sm:p-6 lg:p-8 flex-1 overflow-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
              <div>
                <h2 className="text-3xl font-extrabold text-slate-900 mb-2">Departments</h2>
              </div>
              <Link
                href={route('admin.school-management.departments.create')} 
                className="mt-4 sm:mt-0 flex items-center justify-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Department
              </Link>
            </div>

            {/* Departments Table */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200">
              <div className="p-6 border-b border-slate-200">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                  <h3 className="text-xl font-bold text-slate-900">Department List</h3>
                  <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                    {/* Search Input */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                      <input
                        type="text"
                        placeholder="Search departments..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm w-full sm:w-64 transition-shadow"
                      />
                      {searchTerm && (
                        <button
                          onClick={clearSearch}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          ×
                        </button>
                      )}
                    </div>

                    {/* Faculty Filter */}
                    <div className="relative">
                      <button
                        onClick={() => setShowFacultyFilter(!showFacultyFilter)}
                        className={`flex items-center px-4 py-2.5 border rounded-xl text-sm font-medium transition-all ${
                          facultyFilter 
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Filter className="w-4 h-4 mr-2" />
                        Faculty
                        {facultyFilter && (
                          <span className="ml-2 bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full">
                            {facultyOptions.find(f => f.value.toString() === facultyFilter)?.label}
                          </span>
                        )}
                      </button>

                      {showFacultyFilter && (
                        <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-10">
                          <div className="p-3 border-b border-slate-200">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-semibold text-slate-900">Filter by Faculty</h4>
                              {facultyFilter && (
                                <button
                                  onClick={clearFacultyFilter}
                                  className="text-xs text-indigo-600 hover:text-indigo-800"
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="max-h-60 overflow-y-auto">
                            {facultyOptions.map((faculty) => (
                              <button
                                key={faculty.value}
                                onClick={() => {
                                  setFacultyFilter(faculty.value.toString());
                                  setShowFacultyFilter(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${
                                  facultyFilter === faculty.value.toString() 
                                    ? 'bg-indigo-50 text-indigo-700' 
                                    : 'text-slate-700'
                                }`}
                              >
                                {faculty.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Clear All Filters */}
                    {hasActiveFilters && (
                      <button
                        onClick={clearAllFilters}
                        className="flex items-center px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Clear All
                      </button>
                    )}
                  </div>
                </div>

                {/* Active Filters Display */}
                {hasActiveFilters && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {searchTerm && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Search: "{searchTerm}"
                        <button
                          onClick={clearSearch}
                          className="ml-1 hover:text-blue-600"
                        >
                          ×
                        </button>
                      </span>
                    )}
                    {facultyFilter && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Faculty: {facultyOptions.find(f => f.value.toString() === facultyFilter)?.label}
                        <button
                          onClick={clearFacultyFilter}
                          className="ml-1 hover:text-green-600"
                        >
                          ×
                        </button>
                      </span>
                    )}
                  </div>
                )}
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">#</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Faculty Name</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {departments.data.length > 0 ? (
                      departments.data.map((department, index) => (
                        <tr key={department.id} className="hover:bg-indigo-50/20 transition-colors">
                          <td className='text-right px-6 py-4'>
                            <div className="text-lg text-slate-600">{departments.from + index}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-4">
                              <div className="text-sm font-semibold text-slate-900">{department.name}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-slate-600 max-full text-wrap">{department.faculty.name}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-1">
                              <button title="View Details" className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                                <Eye className="w-5 h-5" />
                              </button>
                              <Link 
                                title="Edit Department" 
                                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                href={route('admin.school-management.departments.edit', department.id)}
                              >
                                <Edit className="w-5 h-5" />
                              </Link>
                              <Link 
                                title="Delete Department" 
                                method='delete'
                                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                onClick={() => confirm('Are you sure you want to permanently delete this department?')}
                                href={route('admin.school-management.departments.destroy', department.id)}
                              >
                                <Trash2 className="w-5 h-5" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                          No departments found {hasActiveFilters && 'Try adjusting your search or filter terms.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between flex-wrap gap-4">
                <div className="text-sm text-slate-600">
                  Showing <span className="font-semibold text-slate-800">{departments.from}</span> to <span className="font-semibold text-slate-800">{departments.to}</span> of <span className="font-semibold text-slate-800">{departments.total}</span> departments
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => handlePageChange(departments.links[0].url)}
                    disabled={departments.current_page === 1}
                    className={`px-4 py-2 border border-slate-300 rounded-xl text-sm font-medium ${
                      departments.current_page === 1 
                        ? 'text-slate-400 bg-slate-100 cursor-not-allowed' 
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Previous
                  </button>
                  
                  {/* Page Numbers */}
                  <div className="hidden sm:flex space-x-1">
                    {departments.links.slice(1, -1).map((link, index) => (
                      <button
                        key={index}
                        onClick={() => handlePageChange(link.url)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium ${
                          link.active
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-700 hover:bg-slate-100 border border-slate-300'
                        }`}
                        dangerouslySetInnerHTML={{ __html: link.label }}
                      />
                    ))}
                  </div>
                  
                  <button 
                    onClick={() => handlePageChange(departments.links[departments.links.length - 1].url)}
                    disabled={departments.current_page === departments.last_page}
                    className={`px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium ${
                      departments.current_page === departments.last_page 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:bg-indigo-700'
                    }`}
                  >
                    Next
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

export default DepartmentIndexPage;