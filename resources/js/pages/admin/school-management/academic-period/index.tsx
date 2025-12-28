import React, { useState, useEffect } from 'react';
import { 
  Search,
  Plus,
  Edit,
  Trash2
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, usePage, router } from '@inertiajs/react';
import { PagePropsWithFlash } from '@/types';
import { ToastContainer, toast, Bounce } from 'react-toastify';
import { Button } from '@headlessui/react';

// Simplified interface - now just an array of items
interface ClassRoom {
  id: number;
  name: string;
}



// Update props to accept just an array
interface TeachersIndexPageProps {
  academicPeriodData: ClassRoom[]; // Changed from PaginatedClassRooms to ClassRoom[]
}

const AcademicPeriodIndexPage = ({ academicPeriodData }: TeachersIndexPageProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { flash } = usePage().props as PagePropsWithFlash;

  // Store all academic periods from props
  const [allAcademicPeriods, setAllAcademicPeriods] = useState<ClassRoom[]>(academicPeriodData);
  
  // Filtered data based on search term
  const [filteredData, setFilteredData] = useState<ClassRoom[]>(academicPeriodData);

  // Show toast notifications based on flash messages
  useEffect(() => {
    if (flash?.success) {
      toast.success(flash.success || 'Academic period operation successful!', {
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
      setFilteredData(allAcademicPeriods);
    } else {
      const filtered = allAcademicPeriods.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredData(filtered);
    }
    // Reset to first page when search term changes
    setCurrentPage(1);
  }, [searchTerm, allAcademicPeriods]);

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
      title: 'Academic Periods',
      href: '/admin/school-management/academic-periods',
    }
  ];

  // Function to handle pagination
  const handlePageChange = (page: number | string) => {
    if (typeof page === 'number' && page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Function to clear search
  const clearSearch = () => {
    setSearchTerm('');
  };

  // Function to handle delete (you might want to add confirmation and update state)
  const handleDelete = (id: number, name: string) => {
   if ( confirm(`Are you sure you want to permanently delete "${name} Academic period"?`) ) {
        router.delete(route('admin.school-management.academic-periods.destroy', id), {
            preserveState: true,
            onSuccess: () => {
              // Remove the deleted item from the state
              setAllAcademicPeriods(prevPeriods => 
                prevPeriods.filter(period => period.id !== id)
              );
            }
          });
    }
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Academic Periods" />
      <div className="min-h-screen bg-slate-50 flex">
        {/* -------------------- MAIN CONTENT AREA -------------------- */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Page Content */}
          <div className="p-4 sm:p-6 lg:p-8 flex-1 overflow-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
              <div>
                <h2 className="text-3xl font-extrabold text-slate-900 mb-2">Academic Periods</h2>
                <p className="text-slate-600">Manage academic periods for your institution</p>
              </div>
              <Link
                href={route('admin.school-management.academic-periods.create')} 
                className="mt-4 sm:mt-0 flex items-center justify-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Academic Period
              </Link>
            </div>

            {/* Academic Periods Table */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200">
              <div className="p-6 border-b border-slate-200">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                  <h3 className="text-xl font-bold text-slate-900">Academic Periods List</h3>
                  <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                      <input
                        type="text"
                        placeholder="Search academic periods..."
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
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {paginatedData.length > 0 ? (
                      paginatedData.map((academic_period, index) => (
                        <tr key={academic_period.id} className="hover:bg-indigo-50/20 transition-colors">
                          <td className='text-right px-4 py-4'>
                            {index + 1 + startIndex}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-4">
                              <div className="text-sm font-semibold text-slate-900">
                                <p style={{ textTransform: 'capitalize' }}>{academic_period.name}</p>
                              </div>
                            </div>
                          </td>
                          
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-1">
                              <Link 
                                title="Edit Academic Period" 
                                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                href={route('admin.school-management.academic-periods.edit', academic_period.id)}
                              >
                                <Edit className="w-5 h-5" />
                              </Link>
                              <Button 
                                title="Delete Academic Period" 
                                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleDelete(academic_period.id, academic_period.name);
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
                        <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                          {searchTerm 
                            ? `No academic periods found for "${searchTerm}". Try adjusting your search terms.` 
                            : 'No academic periods found. Add your first academic period!'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              {totalPages > 0 && (
                <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between flex-wrap gap-4">
                  <div className="text-sm text-slate-600">
                    Showing <span className="font-semibold text-slate-800">{totalItems > 0 ? startIndex + 1 : 0}</span> to <span className="font-semibold text-slate-800">{Math.min(endIndex, totalItems)}</span> of <span className="font-semibold text-slate-800">{totalItems}</span> Academic Periods
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
                    
                    {/* Page Numbers */}
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

export default AcademicPeriodIndexPage;