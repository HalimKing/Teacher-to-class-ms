import React, { useState, useEffect } from 'react';
import { 
  Eye,
  Search,
  Award,
  Plus,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  FileSpreadsheet,
  FileText,
  X
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useForm } from '@inertiajs/react';
import { ToastContainer, toast, Bounce } from 'react-toastify';
import { PagePropsWithFlash } from '@/types';
import Button from '@mui/material/Button';
import { can } from '@/lib/can';

// Utility function to convert status string to display name
const formatStatus = (status: string): string => {
    return status.replace('_', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

type Faculty = {
  id: number;
  name: string;
};

type Department = {
  id: number;
  name: string;
};

interface Teacher {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  employee_id: string | number;
  faculty: Faculty;
  department: Department;
  title: string;
}

interface TeachersIndexPageProps {
  teachers: {
    data: Teacher[];
    current_page: number;
    last_page: number;
    total: number;
    from: number;
    to: number;
  };
  faculties: Faculty[];
  departments: Department[];
  filters: {
    search?: string;
    faculty?: string;
    department?: string;
  };
}

const TeachersIndexPage = ({ teachers, faculties, departments, filters: initialFilters }: TeachersIndexPageProps) => {
  const [searchTerm, setSearchTerm] = useState(initialFilters.search || '');
  const [selectedFaculty, setSelectedFaculty] = useState(initialFilters.faculty || 'all');
  const [selectedDepartment, setSelectedDepartment] = useState(initialFilters.department || 'all');

  const { flash } = usePage().props as PagePropsWithFlash;

  const importForm = useForm({ file: null as File | null });
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  
  // Debounce search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const currentParams = new URLSearchParams(window.location.search);
      const newFilters: any = {};
      
      if (searchTerm) newFilters.search = searchTerm;
      if (selectedFaculty !== 'all') newFilters.faculty = selectedFaculty;
      if (selectedDepartment !== 'all') newFilters.department = selectedDepartment;
      
      // Only update if filters changed
      if (JSON.stringify(newFilters) !== JSON.stringify(initialFilters)) {
        router.get(route('admin.teachers.index'), newFilters, {
          preserveState: true,
          replace: true,
        });
      }
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [searchTerm, selectedFaculty, selectedDepartment]);


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
  



  const handleFilterChange = (filterType: string, value: string) => {
    if (filterType === 'faculty') {
      setSelectedFaculty(value);
      setSelectedDepartment('all'); // Reset department when faculty changes
    } else if (filterType === 'department') {
      setSelectedDepartment(value);
    }
  };

  const handlePageChange = (page: number) => {
    const currentParams = new URLSearchParams(window.location.search);
    currentParams.set('page', page.toString());
    
    router.get(route('admin.teachers.index') + '?' + currentParams.toString(), {}, {
      preserveState: true,
    });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedFaculty('all');
    setSelectedDepartment('all');
    router.get(route('admin.teachers.index'));
  };

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
      const res = await fetch(route('admin.teachers.preview'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-CSRF-TOKEN': token, Accept: 'application/json' },
        body: fd,
      });

      if (!res.ok) {
        let errorMessage = 'Unable to preview file.';
        try {
          const j = await res.json();
          if (j.errors?.file) errorMessage = Array.isArray(j.errors.file) ? j.errors.file.join(', ') : j.errors.file;
          else if (j.error) errorMessage = j.error;
          else if (j.message) errorMessage = j.message;
        } catch (e) {
          try { errorMessage = (await res.text()) || `Server error (${res.status})`; } catch { /* ignore */ }
        }
        toast.error(errorMessage, { position: 'top-right', autoClose: 5000, theme: 'dark' });
        setPreviewLoading(false);
        return;
      }

      const json = await res.json();
      if (json.error) {
        toast.error(json.error, { position: 'top-right', autoClose: 5000, theme: 'dark' });
        setPreviewLoading(false);
        return;
      }

      setPreviewRows(json.rows || []);
      setShowPreview(true);
    } catch (err) {
      console.error('Preview error:', err);
      toast.error(err instanceof Error ? err.message : 'Unable to preview file.', {
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
      const res = await fetch(route('admin.teachers.confirm-import'), {
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
      toast.error('Import failed', { position: 'top-right', autoClose: 5000, theme: 'dark' });
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleDelete = (teacherId: number) => {
    if (confirm('Are you sure you want to delete this teacher?')) {
      router.delete(route('admin.teachers.destroy', teacherId), {
        preserveState: true,
      });
    }
  };

  type TeacherStatus = 'teaching' | 'available' | 'offline' | 'in_meeting';

  const getStatusColor = (status: TeacherStatus | string): string => {
    switch (status) {
      case 'teaching': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'available': return 'bg-green-50 text-green-700 border-green-200';
      case 'offline': return 'bg-gray-50 text-gray-700 border-gray-200';
      case 'in_meeting': return 'bg-orange-50 text-orange-700 border-orange-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getStatusDot = (status: TeacherStatus | string): string => {
    switch (status) {
      case 'teaching': return 'bg-blue-500';
      case 'available': return 'bg-green-500';
      case 'offline': return 'bg-gray-400';
      case 'in_meeting': return 'bg-orange-500';
      default: return 'bg-gray-400';
    }
  };

  // Breadcrumbs for the layout
  const breadcrumbs = [
    {
      title: 'Admin',
      href: '/admin/dashboard',
    },
    {
      title: 'Teachers',
      href: '/admin/teachers',
    }
  ];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Teachers" />
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex">
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="p-4 sm:p-6 lg:p-8 flex-1 overflow-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
              <div>
                <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">Teachers Overview</h2>
                <p className="text-slate-600 dark:text-slate-400">Comprehensive management and performance monitoring for teaching staff</p>
              </div>
              {can('admin.teachers.create') && (
              <Link
                href={route('admin.teachers.create')} 
                className="mt-4 sm:mt-0 flex items-center justify-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add New Teacher
              </Link>
              )}
            </div>

            {/* Import/Export Card */}
            <div className="mb-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Import & Export</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Export Data</h3>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={route('admin.teachers.export', 'excel')}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      Export XLSX
                    </a>
                    <a
                      href={route('admin.teachers.export', 'csv')}
                      className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                    >
                      <FileText className="h-4 w-4" />
                      Export CSV
                    </a>
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Import Data</h3>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <a
                        href={route('admin.teachers.template')}
                        className="mb-2 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      >
                        <Download className="h-4 w-4" />
                        Download Template
                      </a>
                      <form onSubmit={handlePreview} className="mt-2" encType="multipart/form-data">
                        <label className="mb-2 block text-xs font-medium text-slate-700 dark:text-slate-300">Upload File</label>
                        <div className="flex gap-2">
                          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-600 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500">
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
                              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-600"
                              title="Clear file"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="submit"
                            disabled={previewLoading || !importForm.data.file}
                            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
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

            {/* Filters Section */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 mb-6">
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between space-y-4 lg:space-y-0">
                <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 flex-1">
                  <div className="relative flex-1 sm:flex-none">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Search name, email or ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm w-full sm:w-64 transition-shadow dark:placeholder-slate-400"
                    />
                  </div>
                  
                  <select
                    value={selectedFaculty}
                    onChange={(e) => handleFilterChange('faculty', e.target.value)}
                    className="px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm w-full sm:w-48"
                  >
                    <option value="all">All Faculties</option>
                    {faculties.map((faculty) => (
                      <option key={faculty.id} value={faculty.id}>
                        {faculty.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedDepartment}
                    onChange={(e) => handleFilterChange('department', e.target.value)}
                    className="px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm w-full sm:w-48"
                  >
                    <option value="all">All Departments</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                {(searchTerm || selectedFaculty !== 'all' || selectedDepartment !== 'all') && (
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            {/* Teachers Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Teacher Directory</h3>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Showing {teachers.from}-{teachers.to} of {teachers.total} teachers
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Teacher</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">ID</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Faculty</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Department</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                    {teachers.data.map((teacher) => (
                      <tr key={teacher.id} className="hover:bg-indigo-50/20 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-4">
                            <div className="relative flex-shrink-0">
                              <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                                <span className="text-white text-sm font-semibold">
                                  {teacher.first_name[0] + teacher.last_name[0]}
                                </span>
                              </div>
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-slate-900 dark:text-white">{`${teacher.title} ${teacher.first_name} ${teacher.last_name}`}</div>
                              <div className="text-sm text-slate-500 dark:text-slate-400">{teacher.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-slate-900 dark:text-white">{teacher.employee_id}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-700 dark:text-slate-300">{teacher.faculty.name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-700 dark:text-slate-300">{teacher.department.name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-1">
                            <Link href={route('admin.teachers.edit', teacher.id)} title="Edit Teacher" className="p-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                              <Edit className="w-5 h-5" />
                            </Link>
                            <Button
                            onClick={() => handleDelete(teacher.id)} title="Delete Teacher" className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                              <Trash2 className="w-5 h-5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {teachers.data.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400 text-lg">
                          No teachers found matching your criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-4">
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Showing <span className="font-semibold text-slate-800 dark:text-slate-200">{teachers.from}-{teachers.to}</span> of <span className="font-semibold text-slate-800 dark:text-slate-200">{teachers.total}</span> teachers
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => handlePageChange(teachers.current_page - 1)}
                    disabled={teachers.current_page === 1}
                    className={`px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-medium flex items-center space-x-2 ${
                      teachers.current_page === 1 
                        ? 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 cursor-not-allowed' 
                        : 'text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600'
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>
                  
                  <button 
                    onClick={() => handlePageChange(teachers.current_page + 1)}
                    disabled={teachers.current_page === teachers.last_page}
                    className={`px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-medium flex items-center space-x-2 ${
                      teachers.current_page === teachers.last_page
                        ? 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 cursor-not-allowed' 
                        : 'text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600'
                    }`}
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
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
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setShowPreview(false)}
          />
          <div className="relative w-full max-w-5xl max-h-[90vh] rounded-xl bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-6 py-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Import Preview</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Review {previewRows.length} row{previewRows.length !== 1 ? 's' : ''} before importing
                </p>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-auto max-h-[calc(90vh-180px)] p-6">
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Line</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Employee ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Faculty / Dept</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Errors</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-800">
                    {previewRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">No data to preview</td>
                      </tr>
                    ) : (
                      previewRows.map((r: any, i: number) => (
                        <tr
                          key={i}
                          className={`transition-colors ${
                            r.errors.length > 0
                              ? 'bg-red-50/50 dark:bg-red-900/20 hover:bg-red-50 dark:hover:bg-red-900/30'
                              : r.exists
                              ? 'bg-amber-50/50 dark:bg-amber-900/20 hover:bg-amber-50 dark:hover:bg-amber-900/30'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                          }`}
                        >
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">{r.line}</td>
                          <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">{[r.data.first_name, r.data.last_name].filter(Boolean).join(' ') || '-'}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{r.data.employee_id ?? '-'}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{[r.data.faculty, r.data.department].filter(Boolean).join(' / ') || '-'}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm">
                            {r.errors.length > 0 ? (
                              <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/30 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:text-red-200">Error</span>
                            ) : r.exists ? (
                              <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">Exists</span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:text-green-200">New</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-red-600 dark:text-red-400">
                            {r.errors.length > 0 ? r.errors.join(', ') : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 px-6 py-4">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {previewRows.filter((r: any) => r.errors.length === 0).length} valid row
                {previewRows.filter((r: any) => r.errors.length === 0).length !== 1 ? 's' : ''} ready to import
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPreview(false)}
                  className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={confirmLoading || previewRows.filter((r: any) => r.errors.length === 0).length === 0}
                  className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
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