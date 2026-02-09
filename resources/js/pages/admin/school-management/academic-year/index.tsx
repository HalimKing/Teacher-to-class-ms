import React, { useState, useEffect } from 'react';
import { 
  Search,
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  AlertTriangle
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, usePage, router } from '@inertiajs/react';
import { PagePropsWithFlash } from '@/types';
import { ToastContainer, toast, Bounce } from 'react-toastify';
import { Button } from '@headlessui/react';
import { can } from '@/lib/can';

interface ClassRoom {
  id: number;
  name: string;
  status: string;
}

interface TeachersIndexPageProps {
  academicYearData: ClassRoom[];
}

const AcademicYearIndexPage = ({ academicYearData }: TeachersIndexPageProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { flash } = usePage().props as PagePropsWithFlash;
  
  const [allAcademicYears, setAllAcademicYears] = useState<ClassRoom[]>(academicYearData);
  const [filteredData, setFilteredData] = useState<ClassRoom[]>(academicYearData);
  const [isToggling, setIsToggling] = useState<number | null>(null);

  // Count active academic years
  const activeAcademicYearCount = allAcademicYears.filter(year => year.status.toLowerCase() === 'active').length;

  // Show toast notifications based on flash messages
  useEffect(() => {
    if (flash?.success) {
      toast.success(flash.success || 'Academic year operation successful!', {
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

  // Update filtered data when search term changes
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredData(allAcademicYears);
    } else {
      const filtered = allAcademicYears.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredData(filtered);
    }
    setCurrentPage(1);
  }, [searchTerm, allAcademicYears]);

  // Calculate pagination based on filtered data
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, endIndex);

  // Function to generate pagination numbers with ellipsis
  const getPaginationNumbers = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pageNumbers.push(i);
        }
        pageNumbers.push('...');
        pageNumbers.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pageNumbers.push(1);
        pageNumbers.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pageNumbers.push(i);
        }
      } else {
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
      title: 'School Management',
      href: '/admin/dashboard',
    },
    {
      title: 'Academic Years',
      href: '/admin/school-management/academic-years',
    }
  ];

  const handlePageChange = (page: number | string) => {
    if (typeof page === 'number' && page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
  };

  // Function to get status badge styles
  const getStatusBadge = (status: string) => {
    const baseClasses = 'px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1';
    
    switch (status.toLowerCase()) {
      case 'active':
        return {
          classes: `${baseClasses} bg-green-100 text-green-800 border border-green-200`,
          label: 'Active',
          icon: <Check className="w-3 h-3" />
        };
      case 'inactive':
        return {
          classes: `${baseClasses} bg-red-100 text-red-800 border border-red-200`,
          label: 'Inactive',
          icon: <X className="w-3 h-3" />
        };
      case 'pending':
        return {
          classes: `${baseClasses} bg-yellow-100 text-yellow-800`,
          label: 'Pending',
          icon: null
        };
      case 'archived':
        return {
          classes: `${baseClasses} bg-slate-100 text-slate-800`,
          label: 'Archived',
          icon: null
        };
      default:
        return {
          classes: `${baseClasses} bg-slate-100 text-slate-700`,
          label: status,
          icon: null
        };
    }
  };

  // Function to handle status toggle
  const handleToggleStatus = (id: number, currentStatus: string, name: string) => {
    const newStatus = currentStatus.toLowerCase() === 'active' ? 'inactive' : 'active';
    
    // Frontend validation: Check if trying to deactivate the only active academic year
    if (newStatus === 'inactive' && activeAcademicYearCount === 1 && currentStatus.toLowerCase() === 'active') {
      toast.error('Cannot deactivate. At least one academic year must remain active.', {
        position: "top-right",
        autoClose: 5000,
      });
      return;
    }
    
    // Confirmation message based on action
    let confirmationMessage = '';
    if (newStatus === 'active') {
      confirmationMessage = `Setting "${name}" as active will deactivate all other academic years. Are you sure?`;
    } else {
      confirmationMessage = `Are you sure you want to deactivate "${name}"?`;
    }
    
    if (confirm(confirmationMessage)) {
      setIsToggling(id);
      
      router.patch(route('admin.school-management.academic-years.toggle-status', id), {
        status: newStatus
      }, {
        preserveState: true,
        onSuccess: () => {
          // Update all records based on the backend logic
          if (newStatus === 'active') {
            // Set clicked one to active, all others to inactive
            setAllAcademicYears(prevYears =>
              prevYears.map(year => ({
                ...year,
                status: year.id === id ? 'active' : 'inactive'
              }))
            );
          } else {
            // Set clicked one to inactive, keep others as they are
            setAllAcademicYears(prevYears =>
              prevYears.map(year =>
                year.id === id ? { ...year, status: 'inactive' } : year
              )
            );
          }
          setIsToggling(null);
        },
        onError: () => {
          setIsToggling(null);
          toast.error(`Failed to update status for "${name}"!`, {
            position: "top-right",
            autoClose: 3000,
          });
        }
      });
    }
  };

  // Function to handle delete
  const handleDelete = (id: number, name: string) => {
    // Check if trying to delete the only active academic year
    const academicYearToDelete = allAcademicYears.find(year => year.id === id);
    if (academicYearToDelete?.status.toLowerCase() === 'active' && activeAcademicYearCount === 1) {
      toast.error('Cannot delete the only active academic year. Please activate another one first.', {
        position: "top-right",
        autoClose: 5000,
      });
      return;
    }
    
    if (confirm(`Are you sure you want to permanently delete "${name}" academic year?`)) {
      router.delete(route('admin.school-management.academic-years.destroy', id), {
        preserveState: true,
        onSuccess: () => {
          setAllAcademicYears(prevYears => 
            prevYears.filter(year => year.id !== id)
          );
        }
      });
    }
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Academic Years" />
      <div className="min-h-screen bg-slate-50 flex">
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="p-4 sm:p-6 lg:p-8 flex-1 overflow-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
              <div>
                <h2 className="text-3xl font-extrabold text-slate-900 mb-2">Academic Years</h2>
                <p className="text-slate-600">Manage academic years for your institution</p>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-4 sm:mt-0">
                {/* Active status info badge */}
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
                  <Check className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    Active: {activeAcademicYearCount} of {allAcademicYears.length}
                  </span>
                </div>
                {can('admin.school-management.academic-years.create') && (
                <Link
                  href={route('admin.school-management.academic-years.create')} 
                  className="flex items-center justify-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Add Academic Year
                </Link>
                )}
              </div>
            </div>

            {/* Important Notice */}
            {activeAcademicYearCount === 1 && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-amber-800 mb-1">Important Notice</h4>
                    <p className="text-amber-700 text-sm">
                      You currently have only one active academic year. This record cannot be deactivated or deleted. 
                      Please activate another academic year first if you wish to change the active status.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-lg border border-slate-200">
              <div className="p-6 border-b border-slate-200">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                  <h3 className="text-xl font-bold text-slate-900">Academic Years List</h3>
                  <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                      <input
                        type="text"
                        placeholder="Search academic years..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm w-full sm:w-64 transition-shadow"
                      />
                      {searchTerm && (
                        <button
                          onClick={clearSearch}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          aria-label="Clear search"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">#</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {paginatedData.length > 0 ? (
                      paginatedData.map((academic_year, index) => {
                        const isOnlyActive = academic_year.status.toLowerCase() === 'active' && activeAcademicYearCount === 1;
                        const isTogglingThis = isToggling === academic_year.id;
                        
                        return (
                          <tr key={academic_year.id} className="hover:bg-indigo-50/20 transition-colors">
                            <td className='text-right px-4 py-4'>
                              {index + 1 + startIndex}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-4">
                                <div className="text-sm font-semibold text-slate-900">
                                  <p style={{ textTransform: 'capitalize' }}>{academic_year.name}</p>
                                </div>
                                {academic_year.status.toLowerCase() === 'active' && (
                                  <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-semibold rounded-full border border-green-200">
                                    Currently Active
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <button
                                onClick={() => handleToggleStatus(academic_year.id, academic_year.status, academic_year.name)}
                                disabled={isTogglingThis || isOnlyActive}
                                className="transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                                title={
                                  isOnlyActive 
                                    ? 'Cannot deactivate the only active academic year' 
                                    : `Click to ${academic_year.status.toLowerCase() === 'active' ? 'deactivate' : 'activate'}`
                                }
                              >
                                <span className={getStatusBadge(academic_year.status).classes}>
                                  {getStatusBadge(academic_year.status).icon}
                                  {getStatusBadge(academic_year.status).label}
                                  {isTogglingThis && (
                                    <span className="ml-1">
                                      <svg className="animate-spin h-3 w-3 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                      </svg>
                                    </span>
                                  )}
                                </span>
                              </button>
                            </td>
                            
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-1">
                                {can('admin.school-management.academic-years.edit') && (
                                <Link 
                                  title="Edit Academic Year" 
                                  className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  href={route('admin.school-management.academic-years.edit', academic_year.id)}
                                >
                                  <Edit className="w-5 h-5" />
                                </Link>
                                )}
                                {can('admin.school-management.academic-years.delete') && (
                                <Button 
                                  title={
                                    isOnlyActive 
                                      ? 'Cannot delete the only active academic year' 
                                      : 'Delete Academic Year'
                                  }
                                  disabled={isOnlyActive}
                                  className={`p-2 rounded-lg transition-colors ${
                                    isOnlyActive
                                      ? 'text-slate-300 cursor-not-allowed'
                                      : 'text-slate-500 hover:text-red-600 hover:bg-red-50'
                                  }`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    if (!isOnlyActive) {
                                      handleDelete(academic_year.id, academic_year.name);
                                    }
                                  }}
                                >
                                  <Trash2 className="w-5 h-5" />
                                </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                          {searchTerm 
                            ? `No academic years found for "${searchTerm}". Try adjusting your search terms.` 
                            : 'No academic years found. Add your first academic year!'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {totalPages > 0 && (
                <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between flex-wrap gap-4">
                  <div className="text-sm text-slate-600">
                    Showing <span className="font-semibold text-slate-800">{totalItems > 0 ? startIndex + 1 : 0}</span> to <span className="font-semibold text-slate-800">{Math.min(endIndex, totalItems)}</span> of <span className="font-semibold text-slate-800">{totalItems}</span> Academic Years
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={`px-4 py-2 border border-slate-300 rounded-xl text-sm font-medium ${
                        currentPage === 1 
                          ? 'text-slate-400 bg-slate-100 cursor-not-allowed' 
                          : 'text-slate-700 hover:bg-slate-50 hover:border-slate-400'
                      }`}
                    >
                      Previous
                    </button>
                    
                    <div className="hidden sm:flex space-x-1">
                      {getPaginationNumbers().map((page, index) => (
                        <button
                          key={index}
                          onClick={() => typeof page === 'number' && handlePageChange(page)}
                          disabled={typeof page !== 'number'}
                          className={`px-3 py-2 rounded-lg text-sm font-medium min-w-[40px] ${
                            currentPage === page
                              ? 'bg-indigo-600 text-white'
                              : typeof page === 'number'
                                ? 'text-slate-700 hover:bg-slate-100 border border-slate-300 hover:border-slate-400'
                                : 'text-slate-400 cursor-default'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>
                    
                    <button 
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className={`px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium ${
                        currentPage === totalPages || totalPages === 0
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

export default AcademicYearIndexPage;