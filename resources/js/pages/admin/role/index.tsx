import React, { useState, useEffect } from 'react';
import { 
  Search,
  Plus,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Shield,
  Eye
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ToastContainer, toast, Bounce } from 'react-toastify';
import { PagePropsWithFlash } from '@/types';
import Button from '@mui/material/Button';
import { can } from '@/lib/can';

interface Permission {
  id: number;
  name: string;
  guard_name: string;
}

interface Role {
  id: number;
  name: string;
  permissions: Permission[];
  created_at: string;
  updated_at: string;
}

interface RolesIndexPageProps {
  roles: {
    data: Role[];
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

const RolesIndexPage = ({ roles, filters: initialFilters }: RolesIndexPageProps) => {
  const [searchTerm, setSearchTerm] = useState(initialFilters.search || '');
  const { flash } = usePage().props as PagePropsWithFlash;
  
  // Debounce search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const newFilters: any = {};
      
      if (searchTerm) newFilters.search = searchTerm;
      
      // Only update if filters changed
      if (JSON.stringify(newFilters) !== JSON.stringify(initialFilters)) {
        router.get(route('admin.user-management.roles.index'), newFilters, {
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
    
    router.get(route('admin.user-management.roles.index') + '?' + currentParams.toString(), {}, {
      preserveState: true,
    });
  };

  const clearFilters = () => {
    setSearchTerm('');
    router.get(route('admin.user-management.roles.index'));
  };

  const handleDelete = (roleId: number) => {
    if (confirm('Are you sure you want to delete this role? This action cannot be undone.')) {
      router.delete(route('admin.user-management.roles.destroy', roleId), {
        preserveState: true,
        onSuccess: () => {
          toast.success('Role deleted successfully!', {
            position: "top-right",
            autoClose: 5000,
            theme: "dark",
          });
        },
        onError: () => {
          toast.error('Failed to delete role!', {
            position: "top-right",
            autoClose: 5000,
            theme: "dark",
          });
        }
      });
    }
  };

  // Get color based on role name
  const getRoleColor = (roleName: string) => {
    const colors = [
      'from-blue-500 to-blue-600',
      'from-purple-500 to-purple-600',
      'from-green-500 to-green-600',
      'from-red-500 to-red-600',
      'from-yellow-500 to-yellow-600',
      'from-indigo-500 to-indigo-600',
      'from-pink-500 to-pink-600',
      'from-teal-500 to-teal-600'
    ];
    
    const hash = roleName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get initials from role name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Format permission name for display
  const formatPermissionName = (permissionName: string) => {
    return permissionName
      .split('.')
      .slice(1)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') || 'View';
  };

  // Get permission group color
  const getPermissionGroupColor = (permissionName: string) => {
    const group = permissionName.split('.')[0];
    const colorMap: {[key: string]: string} = {
      'users': 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
      'roles': 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
      'permissions': 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300',
      'settings': 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
      'dashboard': 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
      'admin': 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300',
      'default': 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-400',
    };
    
    return colorMap[group] || colorMap.default;
  };

  // Breadcrumbs for the layout
  const breadcrumbs = [
    {
      title: 'Admin',
      href: '/admin/dashboard',
    },
    {
      title: 'Roles & Permissions',
      href: '/admin/user-management/roles',
    }
  ];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Roles & Permissions" />
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex">
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="p-4 sm:p-6 lg:p-8 flex-1 overflow-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
              <div>
                <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">Roles & Permissions</h2>
                <p className="text-slate-600 dark:text-slate-400">Manage user roles and their permissions</p>
              </div>
              <Link
                href={route('admin.user-management.roles.create')} 
                className="mt-4 sm:mt-0 flex items-center justify-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create New Role
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
                      placeholder="Search roles by name..."
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

            {/* Roles Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Role Directory</h3>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Showing {roles.from}-{roles.to} of {roles.total} roles
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Permissions</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Created</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Updated</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                    {roles.data.map((role) => {
                      // Get first 5 permissions or all if less than 6
                      const displayedPermissions = role.permissions.slice(0, 5);
                      const remainingCount = role.permissions.length - 5;
                      
                      return (
                        <tr key={role.id} className="hover:bg-indigo-50/20 dark:hover:bg-slate-700/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-4">
                              <div className="flex-shrink-0">
                                <div className={`w-12 h-12 bg-gradient-to-r ${getRoleColor(role.name)} rounded-xl flex items-center justify-center`}>
                                  <span className="text-white text-sm font-semibold">
                                    {getInitials(role.name)}
                                  </span>
                                </div>
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-slate-900 dark:text-white">{role.name}</div>
                                <div className="text-sm text-slate-500 dark:text-slate-400">ID: {role.id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-2 max-w-lg">
                              {role.permissions.length > 0 ? (
                                <>
                                  {/* Show up to 5 permissions */}
                                  {displayedPermissions.map((permission) => (
                                    <span
                                      key={permission.id}
                                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getPermissionGroupColor(permission.name)}`}
                                      title={permission.name}
                                    >
                                      {formatPermissionName(permission.name)}
                                    </span>
                                  ))}
                                  
                                  {/* Show "+X more" badge if there are more permissions */}
                                  {remainingCount > 0 && (
                                    <span 
                                      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 cursor-help"
                                      title={`${remainingCount} more permission${remainingCount > 1 ? 's' : ''}`}
                                    >
                                      +{remainingCount} more
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                                  No permissions
                                </span>
                              )}
                            </div>
                            {/* Total permissions count */}
                            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                              Total: {role.permissions.length} permission{role.permissions.length !== 1 ? 's' : ''}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-slate-700 dark:text-slate-300">
                              {formatDate(role.created_at)}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-slate-700 dark:text-slate-300">
                              {formatDate(role.updated_at)}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-1">
                              {can('admin.user-management.roles.edit') && (
                              <Link 
                                href={`/admin/user-management/roles/${role.id}/edit`} 
                                title="Edit Role" 
                                className="p-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                              >
                                <Edit className="w-5 h-5" />
                              </Link>
                              )}
                              {/* show */}
                              {can('admin.user-management.roles.view') && (
                                
                                <Link 
                                  href={route('admin.user-management.roles.show', role.id)} 
                                  title="Show Role"
                                >
                                  <Eye className="w-5 h-5" />
                                </Link>
                              )}
                              {can('admin.user-management.roles.delete') && (
                              <button
                                onClick={() => handleDelete(role.id)} 
                                title="Delete Role" 
                                className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {roles.data.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center justify-center space-y-3">
                            <Shield className="w-16 h-16 text-slate-400 dark:text-slate-500" />
                            <div className="text-slate-500 dark:text-slate-400 text-lg">
                              {searchTerm ? 'No roles found matching your search.' : 'No roles found.'}
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
              {roles.data.length > 0 && (
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-4">
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Showing <span className="font-semibold text-slate-800 dark:text-slate-200">{roles.from}-{roles.to}</span> of <span className="font-semibold text-slate-800 dark:text-slate-200">{roles.total}</span> roles
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => handlePageChange(roles.current_page - 1)}
                      disabled={roles.current_page === 1}
                      className={`px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-medium flex items-center space-x-2 ${
                        roles.current_page === 1 
                          ? 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 cursor-not-allowed' 
                          : 'text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600'
                      }`}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Previous</span>
                    </button>
                    
                    <button 
                      onClick={() => handlePageChange(roles.current_page + 1)}
                      disabled={roles.current_page === roles.last_page}
                      className={`px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-medium flex items-center space-x-2 ${
                        roles.current_page === roles.last_page
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

export default RolesIndexPage;