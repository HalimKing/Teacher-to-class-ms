import React, { useState, useEffect } from 'react';
import { 
  Search,
  Plus,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Users
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ToastContainer, toast, Bounce } from 'react-toastify';
import { PagePropsWithFlash } from '@/types';
import { can } from '@/lib/can';

interface User {
  id: number;
  name: string;
  email: string;
  staff_id: string;
  created_at: string;
}

interface UsersIndexPageProps {
  users: {
    data: User[];
    current_page: number;
    last_page: number;
    total: number;
    from: number;
    to: number;
  };
  filters: {
    search?: string;
  };
}

const UsersIndexPage = ({ users, filters: initialFilters }: UsersIndexPageProps) => {
  
  const [searchTerm, setSearchTerm] = useState(initialFilters.search || '');
  const { flash } = usePage().props as PagePropsWithFlash;
  
  // Debounce search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const newFilters: any = {};
      
      if (searchTerm) newFilters.search = searchTerm;
      
      // Only update if filters changed
      if (JSON.stringify(newFilters) !== JSON.stringify(initialFilters)) {
        router.get(route('admin.user-management.users.index'), newFilters, {
          preserveState: true,
          replace: true,
        });
      }
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  useEffect(() => {
    if (flash?.success) {
      toast.success(flash.success || 'Operation successful!', {
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
  }, [flash?.success, flash?.error]);

  const handlePageChange = (page: number) => {
    const currentParams = new URLSearchParams(window.location.search);
    currentParams.set('page', page.toString());

    router.get(route('admin.user-management.users.index') + '?' + currentParams.toString(), {}, {
      preserveState: true,
    });
  };

  const clearFilters = () => {
    setSearchTerm('');
    router.get(route('admin.user-management.users.index'));
  };

  const handleDelete = (userId: number) => {
    if (confirm('Are you sure you want to delete this user?')) {
      router.delete(route('admin.user-managemtn.users.destroy', userId), {
        preserveState: true,
        onSuccess: () => {
          toast.success('User deleted successfully!', {
            position: "top-right",
            autoClose: 5000,
            theme: "dark",
          });
        },
        onError: () => {
          toast.error('Failed to delete user!', {
            position: "top-right",
            autoClose: 5000,
            theme: "dark",
          });
        }
      });
    }
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Breadcrumbs for the layout
  const breadcrumbs = [
    {
      title: 'Admin',
      href: '/admin/dashboard',
    },
    {
      title: 'Users',
      href: '/admin/users',
    }
  ];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Users" />
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex">
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="p-4 sm:p-6 lg:p-8 flex-1 overflow-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
              <div>
                <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">User Management</h2>
                <p className="text-slate-600 dark:text-slate-400">Manage system users and their permissions</p>
              </div>
              {can('admin.user-management.users.create') &&
              <Link
                href={route('admin.user-management.users.create')} 
                className="mt-4 sm:mt-0 flex items-center justify-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add New User
              </Link>
              }
            </div>

            {/* Filters Section */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 mb-6">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between space-y-4 lg:space-y-0">
                <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 flex-1">
                  <div className="relative flex-1 sm:flex-none">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Search by name, email, or staff ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm w-full sm:w-64 transition-shadow dark:placeholder-slate-400"
                    />
                  </div>
                </div>
                
                {searchTerm && (
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">User Directory</h3>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Showing {users.from}-{users.to} of {users.total} users
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">User</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Staff ID</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Roles</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Joined Date</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                    {users.data.map((user) => (
                      <tr key={user.id} className="hover:bg-indigo-50/20 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-4">
                            <div className="flex-shrink-0">
                              <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                                <span className="text-white text-sm font-semibold">
                                  {getInitials(user.name)}
                                </span>
                              </div>
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-slate-900 dark:text-white">{user.name}</div>
                              <div className="text-sm text-slate-500 dark:text-slate-400">User ID: {user.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-700 dark:text-slate-300">{user.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                            {user.staff_id}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="">
                            {user.roles.length === 0 ? 'No Roles' : user.roles.map((role: any) => { return <span key={role.id} className='inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-50 dark:bg-blue-900/30 text-orange-700 dark:text-blue-300'>{role.name} </span>
                            })}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-700 dark:text-slate-300">
                            {formatDate(user.created_at)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-1">
                            <Link 
                              href={`/admin/user-management/users/${user.id}/edit`} 
                              title="Edit User" 
                              className="p-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            >
                              <Edit className="w-5 h-5" />
                            </Link>
                            <button
                              onClick={() => handleDelete(user.id)} 
                              title="Delete User" 
                              className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {users.data.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center justify-center space-y-3">
                            <Users className="w-16 h-16 text-slate-400 dark:text-slate-500" />
                            <div className="text-slate-500 dark:text-slate-400 text-lg">
                              {searchTerm ? 'No users found matching your search.' : 'No users found.'}
                            </div>
                            {searchTerm && (
                              <button
                                onClick={clearFilters}
                                className="px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
                              >
                                Clear search
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
              {users.data.length > 0 && (
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-4">
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Showing <span className="font-semibold text-slate-800 dark:text-slate-200">{users.from}-{users.to}</span> of <span className="font-semibold text-slate-800 dark:text-slate-200">{users.total}</span> users
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => handlePageChange(users.current_page - 1)}
                      disabled={users.current_page === 1}
                      className={`px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-medium flex items-center space-x-2 ${
                        users.current_page === 1 
                          ? 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 cursor-not-allowed' 
                          : 'text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600'
                      }`}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Previous</span>
                    </button>
                    
                    <button 
                      onClick={() => handlePageChange(users.current_page + 1)}
                      disabled={users.current_page === users.last_page}
                      className={`px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-medium flex items-center space-x-2 ${
                        users.current_page === users.last_page
                          ? 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 cursor-not-allowed' 
                          : 'text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600'
                      }`}
                    >
                      <span>Next</span>
                      <ChevronRight className="w-4 h-4" />
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

export default UsersIndexPage;