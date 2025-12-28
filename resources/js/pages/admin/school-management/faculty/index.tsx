import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  AlertTriangle,
  Eye,
  Search,
  Bell,
  Plus,
  Edit,
  Trash2
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, usePage, router } from '@inertiajs/react';
import { PagePropsWithFlash } from '@/types';
import { ToastContainer, toast, Bounce } from 'react-toastify';

// Update interface for paginated data
interface Faculty {
  id: number;
  name: string;
  description: string;
}

interface PaginatedFaculties {
  data: Faculty[];
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
  facultiesData: PaginatedFaculties;
  search?: string; // Add search prop from backend
}

const TeachersIndexPage = ({ facultiesData, search }: TeachersIndexPageProps) => {
  const [searchTerm, setSearchTerm] = useState(search || '');
  const { flash } = usePage().props as PagePropsWithFlash;
  
  // Fix: Initialize with false and use useEffect to handle window resize
  const [sidebarOpen, setSidebarOpen] = useState(false);

    // Show toast notifications based on flash messages
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

  // Handle search with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      router.get(route('admin.school-management.faculties.index'), 
        { search: searchTerm || '' }, // Send empty string if search is cleared
        {
          preserveState: true,
          replace: true,
          preserveScroll: true,
        }
      );
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const handleSignOut = () => {
    console.log("User signed out!");
  };

  const departments = ['Computer Science', 'Mathematics', 'Physics', 'Chemistry', 'Biology'];

  const faculties: PaginatedFaculties = facultiesData;

  const notifications = [
    { id: 1, title: 'New Teacher Added', message: 'Dr. Amanda White joined Mathematics department', time: '5 min ago', type: 'info', read: false },
    { id: 2, title: 'Class Schedule Updated', message: 'Physics 101 time changed to 10:00 AM', time: '15 min ago', type: 'warning', read: false },
    { id: 3, title: 'System Maintenance', message: 'Scheduled maintenance tonight at 11:00 PM', time: '1 hour ago', type: 'info', read: true },
    { id: 4, title: 'Grade Submission Deadline', message: 'All grades due by Friday 5:00 PM', time: '2 hours ago', type: 'urgent', read: false }
  ];

  const unreadCount = notifications.filter(n => !n.read).length;

  const breadcrumbs = [
    {
      title: 'Dashboard',
      href: '/admin/dashboard',
    },
    {
      title: 'Faculties',
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

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Teachers" />
      <div className="min-h-screen bg-slate-50 flex">
        {/* -------------------- MAIN CONTENT AREA -------------------- */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Page Content */}
          <div className="p-4 sm:p-6 lg:p-8 flex-1 overflow-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
              <div>
                <h2 className="text-3xl font-extrabold text-slate-900 mb-2"></h2>
                
              </div>
              <Link
                href={route('admin.school-management.faculties.create')} 
                className="mt-4 sm:mt-0 flex items-center justify-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Faculty
              </Link>
            </div>

            {/* Teachers Table */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200">
              <div className="p-6 border-b border-slate-200">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                  <h3 className="text-xl font-bold text-slate-900">Faculty List</h3>
                  <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                      <input
                        type="text"
                        placeholder="Search Faculty..."
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
                    
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {faculties.data.length > 0 ? (
                      faculties.data.map((faculty) => (
                        <tr key={faculty.id} className="hover:bg-indigo-50/20 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-4">
                              <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                                <span className="text-white text-sm font-semibold">
                                  {faculty.name.split(' ').map((word) => word[0]).join('')}
                                </span>
                              </div>
                              <div className="text-sm font-semibold text-slate-900">{faculty.name}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-slate-600 max-full text-wrap">{faculty.description}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-1">
                              <button title="View Details" className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                                <Eye className="w-5 h-5" />
                              </button>
                              <Link 
                                  title="Edit Faculty" 
                                  className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  href={route('admin.school-management.faculties.edit', faculty.id)}
                                  >
                                <Edit className="w-5 h-5" />
                              </Link>
                              <Link 
                              title="Delete Faculty" 
                              method='delete'
                              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              onClick={()=> confirm('Are you sure you want to permanently delete this faculty? ')}
                              href={route('admin.school-management.faculties.destroy', faculty.id)}
                              >
                                <Trash2 className="w-5 h-5" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                          No faculties found. {searchTerm && 'Try adjusting your search terms.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between flex-wrap gap-4">
                <div className="text-sm text-slate-600">
                  Showing <span className="font-semibold text-slate-800">{faculties.from}</span> to <span className="font-semibold text-slate-800">{faculties.to}</span> of <span className="font-semibold text-slate-800">{faculties.total}</span> faculties
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => handlePageChange(faculties.links[0].url)}
                    disabled={faculties.current_page === 1}
                    className={`px-4 py-2 border border-slate-300 rounded-xl text-sm font-medium ${
                      faculties.current_page === 1 
                        ? 'text-slate-400 bg-slate-100 cursor-not-allowed' 
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Previous
                  </button>
                  
                  {/* Page Numbers */}
                  <div className="hidden sm:flex space-x-1">
                    {faculties.links.slice(1, -1).map((link, index) => (
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
                    onClick={() => handlePageChange(faculties.links[faculties.links.length - 1].url)}
                    disabled={faculties.current_page === faculties.last_page}
                    className={`px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium ${
                      faculties.current_page === faculties.last_page 
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

        {/* -------------------- MOBILE SIDEBAR & OVERLAY -------------------- */}

        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden transition-opacity duration-300" 
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}
      </div>
      <ToastContainer />
    </AppLayout>
  );
};

export default TeachersIndexPage;