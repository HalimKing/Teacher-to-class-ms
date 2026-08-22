import DataTable from '@/components/data-table/DataTable';
import RowActionsMenu from '@/components/data-table/RowActionsMenu';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useListTableQuery } from '@/hooks/use-list-table-query';
import AppLayout from '@/layouts/app-layout';
import { can } from '@/lib/can';
import { PagePropsWithFlash } from '@/types';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { Edit, Eye, Plus, Trash2, Download, Upload, FileSpreadsheet, FileText, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Bounce, ToastContainer, toast } from 'react-toastify';

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
    from: number | null;
    to: number | null;
}

interface FacultyFilters {
    search?: string;
    sort_by?: string;
    sort_dir?: string;
    per_page?: string;
}

interface TeachersIndexPageProps {
    facultiesData: PaginatedFaculties;
    filters?: FacultyFilters;
    search?: string;
}

const TeachersIndexPage = ({ facultiesData, filters = {}, search }: TeachersIndexPageProps) => {
    const initialSearch = filters.search ?? search ?? '';
    const [searchTerm, setSearchTerm] = useState(initialSearch);
    const [sortBy, setSortBy] = useState(filters.sort_by || 'name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>(filters.sort_dir === 'desc' ? 'desc' : 'asc');
    const [perPage, setPerPage] = useState(Number(filters.per_page || facultiesData.per_page || 10));
    const { flash } = usePage().props as PagePropsWithFlash;

    // Fix: Initialize with false and use useEffect to handle window resize
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Show toast notifications based on flash messages
    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success || 'Successful created faculty!', {
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

    const tableFilters = useMemo(() => ({ search: searchTerm }), [searchTerm]);
    const { loading, onPageChange } = useListTableQuery({
        url: route('admin.school-management.faculties.index'),
        filters: tableFilters,
        serverFilters: {
            search: filters.search ?? search ?? '',
            sort_by: filters.sort_by,
            sort_dir: filters.sort_dir,
            per_page: filters.per_page,
        },
        sortBy,
        sortDir,
        perPage,
        only: ['facultiesData', 'filters'],
    });

    const handleSort = (column: string) => {
        if (sortBy === column) {
            setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
            return;
        }

        setSortBy(column);
        setSortDir('asc');
    };

    const handleSignOut = () => {
        console.log('User signed out!');
    };

    const departments = ['Computer Science', 'Mathematics', 'Physics', 'Chemistry', 'Biology'];

    const faculties: PaginatedFaculties = facultiesData;

    

    const notifications = [
        {
            id: 1,
            title: 'New Teacher Added',
            message: 'Dr. Amanda White joined Mathematics department',
            time: '5 min ago',
            type: 'info',
            read: false,
        },
        { id: 2, title: 'Class Schedule Updated', message: 'Physics 101 time changed to 10:00 AM', time: '15 min ago', type: 'warning', read: false },
        { id: 3, title: 'System Maintenance', message: 'Scheduled maintenance tonight at 11:00 PM', time: '1 hour ago', type: 'info', read: true },
        { id: 4, title: 'Grade Submission Deadline', message: 'All grades due by Friday 5:00 PM', time: '2 hours ago', type: 'urgent', read: false },
    ];

    const unreadCount = notifications.filter((n) => !n.read).length;

    const breadcrumbs = [
        {
            title: 'Settings',
            href: '/admin/settings-reports/settings',
        },
        {
            title: 'Faculties',
            href: '/admin/school-management/faculties',
        },
    ];

    const importForm = useForm({ file: null as File | null });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            importForm.setData('file', e.target.files[0]);
        }
    };

    const [previewRows, setPreviewRows] = useState<any[]>([]);
    const [showPreview, setShowPreview] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [confirmLoading, setConfirmLoading] = useState(false);

    const handlePreview = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!importForm.data.file) {
            toast.error('Please select a file to preview', {
                position: 'top-right',
                autoClose: 3000,
                theme: 'dark',
            });
            return;
        }
        setPreviewLoading(true);
        const fd = new FormData();
        fd.append('file', importForm.data.file as File);
        const token = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
        try {
            const res = await fetch(route('admin.school-management.faculties.preview'), {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'X-CSRF-TOKEN': token, Accept: 'application/json' },
                body: fd,
            });

            if (!res.ok) {
                // Try to parse JSON validation errors
                let errorMessage = 'Unable to preview file.';
                try {
                    const j = await res.json();
                    if (j.errors && j.errors.file) {
                        errorMessage = Array.isArray(j.errors.file) 
                            ? j.errors.file.join(', ') 
                            : j.errors.file;
                    } else if (j.error) {
                        errorMessage = j.error;
                    } else if (j.message) {
                        errorMessage = j.message;
                    }
                } catch (e) {
                    try {
                        const text = await res.text();
                        errorMessage = text || `Server error (${res.status})`;
                    } catch (textError) {
                        errorMessage = `Server error (${res.status})`;
                    }
                }
                console.error('Preview error:', res.status, errorMessage);
                toast.error(errorMessage, {
                    position: 'top-right',
                    autoClose: 5000,
                    theme: 'dark',
                });
                setPreviewLoading(false);
                return;
            }

            const json = await res.json();
            if (json.error) {
                toast.error(json.error, {
                    position: 'top-right',
                    autoClose: 5000,
                    theme: 'dark',
                });
                setPreviewLoading(false);
                return;
            }

            setPreviewRows(json.rows || []);
            setShowPreview(true);
        } catch (err) {
            console.error('Preview error:', err);
            const errorMessage = err instanceof Error ? err.message : 'Unable to preview file. Please check your connection and try again.';
            toast.error(errorMessage, {
                position: 'top-right',
                autoClose: 5000,
                theme: 'dark',
            });
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleConfirmImport = async () => {
        if (!importForm.data.file) return;
        setConfirmLoading(true);
        const fd = new FormData();
        fd.append('file', importForm.data.file as File);
        const token = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
        try {
            const res = await fetch(route('admin.school-management.faculties.confirm-import'), {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'X-CSRF-TOKEN': token, Accept: 'application/json' },
                body: fd,
            });
            const json = await res.json();
            if (res.ok) {
                toast.success(`Imported ${json.imported} rows, skipped ${json.skipped}`);
                setShowPreview(false);
                setPreviewRows([]);
                importForm.setData('file', null);
                router.reload();
            } else {
                alert(json.error || 'Import failed');
            }
        } catch (err) {
            console.error(err);
            alert('Import failed');
        } finally {
            setConfirmLoading(false);
        }
    };

    const facultyInitials = (name: string) =>
        name
            .split(' ')
            .map((word) => word[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Teachers" />
            <div className="flex min-h-screen bg-slate-50">
                {/* -------------------- MAIN CONTENT AREA -------------------- */}
                <div className="flex min-w-0 flex-1 flex-col">
                    {/* Page Content */}
                    <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
                        {/* Page Header */}
                        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h1 className="text-3xl font-bold text-slate-900">Faculties</h1>
                                <p className="mt-1 text-sm text-slate-600">Manage and organize faculty information</p>
                            </div>
                            {can('admin.school-management.faculties.create') && (
                                <Link
                                    href={route('admin.school-management.faculties.create')}
                                    className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:from-indigo-700 hover:to-purple-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Faculty
                                </Link>
                            )}
                        </div>

                        {/* Import/Export Card */}
                        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-slate-900">Import & Export</h2>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                {/* Export Section */}
                                <div className="space-y-3">
                                    <h3 className="text-sm font-medium text-slate-700">Export Data</h3>
                                    <div className="flex flex-wrap gap-2">
                                        <a
                                            href={route('admin.school-management.faculties.export', 'excel')}
                                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                                        >
                                            <FileSpreadsheet className="h-4 w-4" />
                                            Export XLSX
                                        </a>
                                        <a
                                            href={route('admin.school-management.faculties.export', 'csv')}
                                            className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                                        >
                                            <FileText className="h-4 w-4" />
                                            Export CSV
                                        </a>
                                    </div>
                                </div>

                                {/* Import Section */}
                                <div className="space-y-3">
                                    <h3 className="text-sm font-medium text-slate-700">Import Data</h3>
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                                        <div className="flex-1">
                                            <a
                                                href={route('admin.school-management.faculties.template')}
                                                className="mb-2 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                            >
                                                <Download className="h-4 w-4" />
                                                Download Template
                                            </a>
                                            <form onSubmit={handlePreview} className="mt-2" encType="multipart/form-data">
                                                <label className="mb-2 block text-xs font-medium text-slate-700">
                                                    Upload File
                                                </label>
                                                <div className="flex gap-2">
                                                    <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500">
                                                        <Upload className="h-4 w-4 text-slate-500" />
                                                        <span className="flex-1 truncate">
                                                            {importForm.data.file ? importForm.data.file.name : 'Choose file...'}
                                                        </span>
                                                        <input
                                                            type="file"
                                                            name="file"
                                                            onChange={handleFileChange}
                                                            accept=".csv,.xlsx,.xls"
                                                            className="hidden"
                                                        />
                                                    </label>
                                                    {importForm.data.file && (
                                                        <button
                                                            type="button"
                                                            onClick={() => importForm.setData('file', null)}
                                                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                                                            title="Clear file"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    <button
                                                        type="submit"
                                                        disabled={previewLoading || !importForm.data.file}
                                                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                                                    >
                                                        {previewLoading ? 'Loading...' : 'Preview'}
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <DataTable
                            title="Faculty List"
                            records={faculties}
                            columns={[
                                {
                                    key: 'name',
                                    label: 'Name',
                                    sortable: true,
                                    render: (faculty) => (
                                        <div className="flex min-w-0 items-center gap-3">
                                            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-semibold text-white shadow-sm">
                                                {facultyInitials(faculty.name)}
                                            </div>
                                            <p className="truncate font-medium text-sidebar-foreground">{faculty.name}</p>
                                        </div>
                                    ),
                                },
                                {
                                    key: 'description',
                                    label: 'Description',
                                    sortable: true,
                                    className: 'max-w-xl',
                                    render: (faculty) => (
                                        <p className="line-clamp-2 text-sm text-sidebar-foreground/70">
                                            {faculty.description || <span className="text-sidebar-foreground/40">No description</span>}
                                        </p>
                                    ),
                                },
                                {
                                    key: 'actions',
                                    label: 'Actions',
                                    className: 'text-right',
                                    render: (faculty) => (
                                        <RowActionsMenu label={`Actions for ${faculty.name}`}>
                                            {can('admin.school-management.faculties.edit') && (
                                                <DropdownMenuItem asChild>
                                                    <Link href={route('admin.school-management.faculties.edit', faculty.id)}>
                                                        <Eye className="size-4" />
                                                        View
                                                    </Link>
                                                </DropdownMenuItem>
                                            )}
                                            {can('admin.school-management.faculties.edit') && (
                                                <DropdownMenuItem asChild>
                                                    <Link href={route('admin.school-management.faculties.edit', faculty.id)}>
                                                        <Edit className="size-4" />
                                                        Edit
                                                    </Link>
                                                </DropdownMenuItem>
                                            )}
                                            {can('admin.school-management.faculties.delete') && (
                                                <>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem asChild className="text-rose-600 focus:text-rose-600">
                                                        <Link
                                                            href={route('admin.school-management.faculties.destroy', faculty.id)}
                                                            method="delete"
                                                            as="button"
                                                            onClick={(event) => {
                                                                if (!confirm('Are you sure you want to permanently delete this faculty?')) {
                                                                    event.preventDefault();
                                                                }
                                                            }}
                                                        >
                                                            <Trash2 className="size-4" />
                                                            Delete
                                                        </Link>
                                                    </DropdownMenuItem>
                                                </>
                                            )}
                                        </RowActionsMenu>
                                    ),
                                },
                            ]}
                            sortBy={sortBy}
                            sortDir={sortDir}
                            onSort={handleSort}
                            perPage={perPage}
                            onPerPageChange={setPerPage}
                            onPageChange={onPageChange}
                            loading={loading}
                            search={searchTerm}
                            searchPlaceholder="Search faculty..."
                            onSearchChange={setSearchTerm}
                            hasActiveQuery={Boolean(searchTerm)}
                            recordLabel="faculties"
                            empty={{
                                title: 'No faculties yet',
                                description: 'Add a faculty or import a file to get started.',
                                action: can('admin.school-management.faculties.create') ? (
                                    <Link
                                        href={route('admin.school-management.faculties.create')}
                                        className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                                    >
                                        <Plus className="mr-2 size-4" />
                                        Add Faculty
                                    </Link>
                                ) : undefined,
                            }}
                            noResults={{
                                title: 'No faculties match your search',
                                description: 'Try a different name or description, or clear the search to see all faculties.',
                            }}
                        />
                    </div>
                </div>

                {/* -------------------- MOBILE SIDEBAR & OVERLAY -------------------- */}

                {/* Mobile Overlay */}
                {sidebarOpen && (
                    <div
                        className="bg-opacity-50 fixed inset-0 z-40 bg-black transition-opacity duration-300 lg:hidden"
                        onClick={() => setSidebarOpen(false)}
                    ></div>
                )}
            </div>
            <ToastContainer />
            {showPreview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                        onClick={() => setShowPreview(false)}
                    />
                    
                    {/* Modal */}
                    <div className="relative w-full max-w-5xl max-h-[90vh] rounded-xl bg-white shadow-2xl">
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                            <div>
                                <h3 className="text-xl font-semibold text-slate-900">Import Preview</h3>
                                <p className="mt-1 text-sm text-slate-600">
                                    Review {previewRows.length} row{previewRows.length !== 1 ? 's' : ''} before importing
                                </p>
                            </div>
                            <button
                                onClick={() => setShowPreview(false)}
                                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                                title="Close"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="overflow-auto max-h-[calc(90vh-180px)] p-6">
                            <div className="overflow-x-auto rounded-lg border border-slate-200">
                                <table className="w-full">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                                                Line
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                                                Name
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                                                Description
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                                                Status
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                                                Errors
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 bg-white">
                                        {previewRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                                                    No data to preview
                                                </td>
                                            </tr>
                                        ) : (
                                            previewRows.map((r: any, i: number) => (
                                                <tr
                                                    key={i}
                                                    className={`transition-colors ${
                                                        r.errors.length > 0
                                                            ? 'bg-red-50/50 hover:bg-red-50'
                                                            : r.exists
                                                            ? 'bg-amber-50/50 hover:bg-amber-50'
                                                            : 'hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">
                                                        {r.line}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-slate-900">{r.data.name || '-'}</td>
                                                    <td className="px-4 py-3 text-sm text-slate-600">{r.data.description || '-'}</td>
                                                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                                                        {r.errors.length > 0 ? (
                                                            <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                                                                Error
                                                            </span>
                                                        ) : r.exists ? (
                                                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                                                                Exists
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                                                                New
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-red-600">
                                                        {r.errors.length > 0 ? r.errors.join(', ') : '-'}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
                            <div className="text-sm text-slate-600">
                                {previewRows.filter((r: any) => r.errors.length === 0).length} valid row
                                {previewRows.filter((r: any) => r.errors.length === 0).length !== 1 ? 's' : ''} ready to import
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowPreview(false)}
                                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmImport}
                                    disabled={confirmLoading || previewRows.filter((r: any) => r.errors.length === 0).length === 0}
                                    className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                                >
                                    {confirmLoading ? (
                                        <span className="flex items-center gap-2">
                                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                            Importing...
                                        </span>
                                    ) : (
                                        'Confirm Import'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
};

export default TeachersIndexPage;
