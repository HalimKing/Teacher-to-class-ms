import AppLayout from '@/layouts/app-layout';
import { can } from '@/lib/can';
import { PagePropsWithFlash } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Edit, Plus, Search, Trash2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Bounce, ToastContainer, toast } from 'react-toastify';

interface User {
    id: number;
    name: string;
    email: string;
    staff_id?: string;
    created_at: string;
    roles?: any[];
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
                position: 'top-right',
                autoClose: 5000,
                hideProgressBar: false,
                closeOnClick: false,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: 'dark',
                transition: Bounce,
            });
        }
        if (flash?.error) {
            toast.error(flash.error || 'An error occurred!', {
                position: 'top-right',
                autoClose: 5000,
                hideProgressBar: false,
                closeOnClick: false,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: 'dark',
                transition: Bounce,
            });
        }
    }, [flash?.success, flash?.error]);

    const handlePageChange = (page: number) => {
        const currentParams = new URLSearchParams(window.location.search);
        currentParams.set('page', page.toString());

        router.get(
            route('admin.user-management.users.index') + '?' + currentParams.toString(),
            {},
            {
                preserveState: true,
            },
        );
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
                        position: 'top-right',
                        autoClose: 5000,
                        theme: 'dark',
                    });
                },
                onError: () => {
                    toast.error('Failed to delete user!', {
                        position: 'top-right',
                        autoClose: 5000,
                        theme: 'dark',
                    });
                },
            });
        }
    };

    // Get initials for avatar
    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((part) => part[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
    };

    // Format date
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
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
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Users" />
            <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
                <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
                        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="mb-2 text-3xl font-extrabold text-slate-900 dark:text-white">User Management</h2>
                                <p className="text-slate-600 dark:text-slate-400">Manage system users and their permissions</p>
                            </div>
                            {can('admin.user-management.users.create') && (
                                <Link
                                    href={route('admin.user-management.users.create')}
                                    className="mt-4 flex items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-purple-700 px-6 py-3 font-semibold text-white shadow-md transition-all duration-200 hover:from-indigo-700 hover:to-purple-800 hover:shadow-lg focus:ring-4 focus:ring-indigo-500/50 focus:outline-none sm:mt-0"
                                >
                                    <Plus className="mr-2 h-5 w-5" />
                                    Add New User
                                </Link>
                            )}
                        </div>

                        {/* Filters Section */}
                        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                            <div className="flex flex-col space-y-4 lg:flex-row lg:items-end lg:justify-between lg:space-y-0">
                                <div className="flex flex-1 flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-4">
                                    <div className="relative flex-1 sm:flex-none">
                                        <Search className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 transform text-slate-400 dark:text-slate-500" />
                                        <input
                                            type="text"
                                            placeholder="Search by name, email, or staff ID..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pr-4 pl-10 text-sm text-slate-900 transition-shadow focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 sm:w-64 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400"
                                        />
                                    </div>
                                </div>

                                {searchTerm && (
                                    <button
                                        onClick={clearFilters}
                                        className="px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                                    >
                                        Clear Filters
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Users Table */}
                        <div className="rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                            <div className="border-b border-slate-200 p-6 dark:border-slate-700">
                                <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">User Directory</h3>
                                    <div className="text-sm text-slate-600 dark:text-slate-400">
                                        Showing {users.from}-{users.to} of {users.total} users
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full whitespace-nowrap">
                                    <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-700/50">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-semibold tracking-wider text-slate-600 uppercase dark:text-slate-400">
                                                User
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold tracking-wider text-slate-600 uppercase dark:text-slate-400">
                                                Email
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold tracking-wider text-slate-600 uppercase dark:text-slate-400">
                                                Staff ID
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold tracking-wider text-slate-600 uppercase dark:text-slate-400">
                                                Roles
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold tracking-wider text-slate-600 uppercase dark:text-slate-400">
                                                Joined Date
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold tracking-wider text-slate-600 uppercase dark:text-slate-400">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
                                        {users.data.map((user) => (
                                            <tr key={user.id} className="transition-colors hover:bg-indigo-50/20 dark:hover:bg-slate-700/50">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center space-x-4">
                                                        <div className="flex-shrink-0">
                                                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600">
                                                                <span className="text-sm font-semibold text-white">{getInitials(user.name)}</span>
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
                                                    <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                                        {user.staff_id}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="">
                                                        {!(user.roles && user.roles.length)
                                                            ? 'No Roles'
                                                            : user.roles.map((role: any) => (
                                                                  <span
                                                                      key={role.id}
                                                                      className="inline-flex items-center rounded-full bg-orange-50 px-3 py-1 text-sm font-medium text-orange-700 dark:bg-blue-900/30 dark:text-blue-300"
                                                                  >
                                                                      {role.name}
                                                                  </span>
                                                              ))}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-slate-700 dark:text-slate-300">{formatDate(user.created_at)}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center space-x-1">
                                                        <Link
                                                            href={`/admin/user-management/users/${user.id}/edit`}
                                                            title="Edit User"
                                                            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                                                        >
                                                            <Edit className="h-5 w-5" />
                                                        </Link>
                                                        <button
                                                            onClick={() => handleDelete(user.id)}
                                                            title="Delete User"
                                                            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                                                        >
                                                            <Trash2 className="h-5 w-5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {users.data.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-12 text-center">
                                                    <div className="flex flex-col items-center justify-center space-y-3">
                                                        <Users className="h-16 w-16 text-slate-400 dark:text-slate-500" />
                                                        <div className="text-lg text-slate-500 dark:text-slate-400">
                                                            {searchTerm ? 'No users found matching your search.' : 'No users found.'}
                                                        </div>
                                                        {searchTerm && (
                                                            <button
                                                                onClick={clearFilters}
                                                                className="px-4 py-2 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
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
                                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
                                    <div className="text-sm text-slate-600 dark:text-slate-400">
                                        Showing{' '}
                                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                                            {users.from}-{users.to}
                                        </span>{' '}
                                        of <span className="font-semibold text-slate-800 dark:text-slate-200">{users.total}</span> users
                                    </div>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => handlePageChange(users.current_page - 1)}
                                            disabled={users.current_page === 1}
                                            className={`flex items-center space-x-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium dark:border-slate-600 ${
                                                users.current_page === 1
                                                    ? 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                                                    : 'bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                                            }`}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                            <span>Previous</span>
                                        </button>

                                        <button
                                            onClick={() => handlePageChange(users.current_page + 1)}
                                            disabled={users.current_page === users.last_page}
                                            className={`flex items-center space-x-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium dark:border-slate-600 ${
                                                users.current_page === users.last_page
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
            </div>
            <ToastContainer />
        </AppLayout>
    );
};

export default UsersIndexPage;
