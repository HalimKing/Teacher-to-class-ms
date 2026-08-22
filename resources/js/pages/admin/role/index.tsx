import React, { useEffect, useRef, useState } from 'react';
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
  const skipInitialFilterFetch = useRef(true);
  const { flash } = usePage().props as PagePropsWithFlash;
  
  // Debounce search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const newFilters: Record<string, string> = {};
      
      if (searchTerm) newFilters.search = searchTerm;

      const serverFilters: Record<string, string | undefined> = {
        search: initialFilters.search,
      };

      if (skipInitialFilterFetch.current) {
        skipInitialFilterFetch.current = false;
        if ((newFilters.search || '') === (serverFilters.search || '')) {
          return;
        }
      }

      if ((newFilters.search || '') === (serverFilters.search || '')) {
        return;
      }

      router.get(route('admin.user-management.roles.index'), newFilters, {
        preserveState: true,
        replace: true,
      });
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [searchTerm, initialFilters.search]);

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
      .replace(/class-rooms/g, 'venues')
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

  const renderRoleActions = (role: Role) => (
    <div className="flex shrink-0 items-center gap-1">
      {can('admin.user-management.roles.edit') && (
        <Link
          href={`/admin/user-management/roles/${role.id}/edit`}
          title="Edit Role"
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
        >
          <Edit className="h-5 w-5" />
        </Link>
      )}
      {can('admin.user-management.roles.view') && (
        <Link
          href={route('admin.user-management.roles.show', role.id)}
          title="Show Role"
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
        >
          <Eye className="h-5 w-5" />
        </Link>
      )}
      {can('admin.user-management.roles.delete') && (
        <button
          onClick={() => handleDelete(role.id)}
          title="Delete Role"
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      )}
    </div>
  );

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
      <div className="flex min-w-0 flex-col">
        <div className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
            <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="mb-2 text-2xl font-extrabold text-slate-900 sm:text-3xl dark:text-white">Roles & Permissions</h2>
                <p className="text-slate-600 dark:text-slate-400">Manage user roles and their permissions</p>
              </div>
              <Link
                href={route('admin.user-management.roles.create')} 
                className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-purple-700 px-6 py-3 font-semibold text-white shadow-md transition-all duration-200 hover:from-indigo-700 hover:to-purple-800 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-indigo-500/50 sm:w-auto"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create New Role
              </Link>
            </div>

            {/* Filters Section */}
            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:p-6 dark:border-slate-700 dark:bg-slate-800">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="relative w-full">
                    <Search className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 transform text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search roles by name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pr-4 pl-10 text-sm text-slate-900 transition-shadow focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400"
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
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
              <div className="border-b border-slate-200 p-4 sm:p-6 dark:border-slate-700">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <h3 className="text-lg font-bold text-slate-900 sm:text-xl dark:text-white">Role Directory</h3>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Showing {roles.from}-{roles.to} of {roles.total} roles
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-4 lg:hidden">
                {roles.data.map((role) => {
                  const displayedPermissions = role.permissions.slice(0, 5);
                  const remainingCount = role.permissions.length - 5;

                  return (
                    <div key={role.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r ${getRoleColor(role.name)}`}>
                            <span className="text-sm font-semibold text-white">{getInitials(role.name)}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{role.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {role.permissions.length} permission{role.permissions.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                        {renderRoleActions(role)}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {role.permissions.length > 0 ? (
                          <>
                            {displayedPermissions.map((permission) => (
                              <span
                                key={permission.id}
                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getPermissionGroupColor(permission.name)}`}
                                title={permission.name}
                              >
                                {formatPermissionName(permission.name)}
                              </span>
                            ))}
                            {remainingCount > 0 && (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-400">
                                +{remainingCount} more
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-sm text-slate-500">No permissions</span>
                        )}
                      </div>
                      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                        Created {formatDate(role.created_at)} · Updated {formatDate(role.updated_at)}
                      </p>
                    </div>
                  );
                })}
                {roles.data.length === 0 && (
                  <div className="px-2 py-12 text-center">
                    <Shield className="mx-auto mb-3 h-12 w-12 text-slate-400" />
                    <p className="text-slate-500 dark:text-slate-400">
                      {searchTerm ? 'No roles found matching your search.' : 'No roles found.'}
                    </p>
                  </div>
                )}
              </div>
              
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[720px]">
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
                          <td className="px-6 py-4">{renderRoleActions(role)}</td>
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
                <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-slate-700">
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Showing <span className="font-semibold text-slate-800 dark:text-slate-200">{roles.from}-{roles.to}</span> of <span className="font-semibold text-slate-800 dark:text-slate-200">{roles.total}</span> roles
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:space-x-2">
                    <button 
                      onClick={() => handlePageChange(roles.current_page - 1)}
                      disabled={roles.current_page === 1}
                      className={`flex h-10 items-center justify-center space-x-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium dark:border-slate-600 ${
                        roles.current_page === 1 
                          ? 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500' 
                          : 'bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                      }`}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span>Previous</span>
                    </button>
                    
                    <button 
                      onClick={() => handlePageChange(roles.current_page + 1)}
                      disabled={roles.current_page === roles.last_page}
                      className={`flex h-10 items-center justify-center space-x-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium dark:border-slate-600 ${
                        roles.current_page === roles.last_page
                          ? 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500' 
                          : 'bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                      }`}
                    >
                      <span>Next</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
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

export default RolesIndexPage;