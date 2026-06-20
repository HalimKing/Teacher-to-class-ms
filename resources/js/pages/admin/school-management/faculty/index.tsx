import AppLayout from '@/layouts/app-layout';
import { can } from '@/lib/can';
import { PagePropsWithFlash } from '@/types';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { Edit, Eye, Plus, Search, Trash2, Download, Upload, FileSpreadsheet, FileText, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { simpleFilterParamsEqual } from '@/lib/list-filters';
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

    const skipInitialFilterFetch = useRef(true);

    // Handle search with debounce
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            const params = { search: searchTerm || '' };
            const serverParams = { search: search || '' };

            if (skipInitialFilterFetch.current) {
                skipInitialFilterFetch.current = false;
                if (simpleFilterParamsEqual(params, serverParams)) {
                    return;
                }
            }

            if (simpleFilterParamsEqual(params, serverParams)) {
                return;
            }

            router.get(route('admin.school-management.faculties.index'), params, {
                preserveState: true,
                replace: true,
                preserveScroll: true,
            });
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [searchTerm, search]);

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
            title: 'Dashboard',
            href: '/admin/dashboard',
        },
        {
            title: 'Faculties',
            href: '/admin/teachers',
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

    // Function to handle pagination with Inertia
    const handlePageChange = (url: string | null) => {
        if (url) {
            router.get(
                url,
                {},
                {
                    preserveState: true,
                    replace: true,
                    preserveScroll: true,
                },
            );
        }
    };

    // Function to clear search
    const clearSearch = () => {
        setSearchTerm('');
    };

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

                        {/* Faculty Table Card */}
                        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                            <div className="border-b border-slate-200 p-5">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <h3 className="text-lg font-semibold text-slate-900">Faculty List</h3>
                                    <div className="relative w-full sm:w-auto">
                                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Search faculty..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-10 text-sm text-slate-900 placeholder-slate-500 transition-shadow focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:w-64"
                                        />
                                        {searchTerm && (
                                            <button
                                                onClick={clearSearch}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                                                title="Clear search"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                                                Name
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                                                Description
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-700">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 bg-white">
                                        {faculties.data.length > 0 ? (
                                            faculties.data.map((faculty) => (
                                                <tr key={faculty.id} className="transition-colors hover:bg-slate-50">
                                                    <td className="whitespace-nowrap px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-sm">
                                                                <span className="text-sm font-semibold text-white">
                                                                    {faculty.name
                                                                        .split(' ')
                                                                        .map((word) => word[0])
                                                                        .join('')
                                                                        .substring(0, 2)
                                                                        .toUpperCase()}
                                                                </span>
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="text-sm font-medium text-slate-900">{faculty.name}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="max-w-md text-sm text-slate-600 line-clamp-2">
                                                            {faculty.description || <span className="text-slate-400">No description</span>}
                                                        </div>
                                                    </td>
                                                    <td className="whitespace-nowrap px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <button
                                                                title="View Details"
                                                                className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                            >
                                                                <Eye className="h-4 w-4" />
                                                            </button>
                                                            <Link
                                                                title="Edit Faculty"
                                                                className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                href={route('admin.school-management.faculties.edit', faculty.id)}
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </Link>
                                                            <Link
                                                                title="Delete Faculty"
                                                                method="delete"
                                                                className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
                                                                onClick={() => confirm('Are you sure you want to permanently delete this faculty? ')}
                                                                href={route('admin.school-management.faculties.destroy', faculty.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Link>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={3} className="px-6 py-12 text-center">
                                                    <div className="flex flex-col items-center justify-center text-slate-500">
                                                        <div className="mb-2 text-sm font-medium">No faculties found</div>
                                                        {searchTerm && (
                                                            <div className="text-xs text-slate-400">Try adjusting your search terms</div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="text-sm text-slate-600">
                                    Showing <span className="font-medium text-slate-900">{faculties.from}</span> to{' '}
                                    <span className="font-medium text-slate-900">{faculties.to}</span> of{' '}
                                    <span className="font-medium text-slate-900">{faculties.total}</span> faculties
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handlePageChange(faculties.links[0].url)}
                                        disabled={faculties.current_page === 1}
                                        className={`rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium transition-colors ${
                                            faculties.current_page === 1
                                                ? 'cursor-not-allowed bg-white text-slate-400'
                                                : 'bg-white text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500'
                                        }`}
                                    >
                                        Previous
                                    </button>

                                    {/* Page Numbers */}
                                    <div className="hidden gap-1 sm:flex">
                                        {faculties.links.slice(1, -1).map((link, index) => (
                                            <button
                                                key={index}
                                                onClick={() => handlePageChange(link.url)}
                                                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                                                    link.active
                                                        ? 'bg-indigo-600 text-white shadow-sm'
                                                        : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                                                }`}
                                                dangerouslySetInnerHTML={{ __html: link.label }}
                                            />
                                        ))}
                                    </div>

                                    <button
                                        onClick={() => handlePageChange(faculties.links[faculties.links.length - 1].url)}
                                        disabled={faculties.current_page === faculties.last_page}
                                        className={`rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                                            faculties.current_page === faculties.last_page
                                                ? 'cursor-not-allowed text-slate-400'
                                                : 'text-slate-700 hover:bg-slate-50'
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
