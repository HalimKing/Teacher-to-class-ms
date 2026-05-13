import React, { useState, useEffect } from 'react';
import { 
  Eye,
  Search,
  Plus,
  Edit,
  Trash2,
  Filter,
  X,
  Download,
  Upload,
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import { useForm } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, usePage, router } from '@inertiajs/react';
import { PagePropsWithFlash } from '@/types';
import { ToastContainer, toast, Bounce } from 'react-toastify';
import { can } from '@/lib/can';

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

  // Import/Export state
  const importForm = useForm({ file: null as File | null });
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

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

  // File handling
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      importForm.setData('file', e.target.files[0]);
    }
  };

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
      const res = await fetch(route('admin.school-management.departments.preview'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-CSRF-TOKEN': token, Accept: 'application/json' },
        body: fd,
      });

      if (!res.ok) {
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
      const res = await fetch(route('admin.school-management.departments.confirm-import'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-CSRF-TOKEN': token, Accept: 'application/json' },
        body: fd,
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(`Imported ${json.imported} rows, skipped ${json.skipped}`, {
          position: 'top-right',
          autoClose: 5000,
          theme: 'dark',
        });
        router.reload();
      } else {
        toast.error(json.error || 'Import failed', {
          position: 'top-right',
          autoClose: 5000,
          theme: 'dark',
        });
      }
    } catch (err) {
      console.error(err);
      toast.error('Import failed', {
        position: 'top-right',
        autoClose: 5000,
        theme: 'dark',
      });
    } finally {
      setConfirmLoading(false);
    }
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Departments" />
      <div className="min-h-screen bg-slate-50 flex">
        {/* -------------------- MAIN CONTENT AREA -------------------- */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Page Content */}
          <div className="p-4 sm:p-6 lg:p-8 flex-1 overflow-auto">
            {/* Page Header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Departments</h1>
                <p className="mt-1 text-sm text-slate-600">Manage and organize department information</p>
              </div>
              {can('admin.school-management.departments.create') && (
                <Link
                  href={route('admin.school-management.departments.create')}
                  className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:from-indigo-700 hover:to-purple-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Department
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
                      href={route('admin.school-management.departments.export', 'excel')}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      Export XLSX
                    </a>
                    <a
                      href={route('admin.school-management.departments.export', 'csv')}
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
                        href={route('admin.school-management.departments.template')}
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

            {/* Department Table Card */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">Department List</h3>
                  <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                    {/* Search Input */}
                    <div className="relative w-full sm:w-auto">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search departments..."
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
                             {can('admin.school-management.departments.edit') && (
                              <Link 
                                title="Edit Department" 
                                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                href={route('admin.school-management.departments.edit', department.id)}
                              >
                                <Edit className="w-5 h-5" />
                              </Link>
                             )}

                             {can('admin.school-management.departments.delete') && (
                              <Link 
                                title="Delete Department" 
                                method='delete'
                                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                onClick={() => confirm('Are you sure you want to permanently delete this department?')}
                                href={route('admin.school-management.departments.destroy', department.id)}
                              >
                                <Trash2 className="w-5 h-5" />
                              </Link>
                             )}
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
                        Faculty
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
                          <td className="px-4 py-3 text-sm text-slate-600">{r.data.faculty || '-'}</td>
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

export default DepartmentIndexPage;