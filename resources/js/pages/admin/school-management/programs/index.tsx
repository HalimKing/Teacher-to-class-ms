import React, { useState, useEffect } from 'react';
import { 
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
import axios from 'axios';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, usePage, router } from '@inertiajs/react';
import { useForm } from '@inertiajs/react';
import { PagePropsWithFlash } from '@/types';
import { ToastContainer, toast, Bounce } from 'react-toastify';
import { Button } from '@headlessui/react';
import { can } from '@/lib/can';

// Simplified interface for Program
interface Program {
  id: number;
  name: string;
  faculty: {
    id: number;
    name: string;
  };
  department: {
    id: number;
    name: string;
  };
}

// Update props interface to include filter options
interface ProgramsIndexPageProps {
  programsData: Program[];
  facultyOptions: Array<{ label: string; value: number }>;
  departmentOptions: Array<{ label: string; value: number }>;
}

const ProgramsIndexPage = ({ 
  programsData, 
  facultyOptions, 
  departmentOptions 
}: ProgramsIndexPageProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [facultyFilter, setFacultyFilter] = useState<number | ''>('');
  const [departmentFilter, setDepartmentFilter] = useState<number | ''>('');
  const [filteredDepartments, setFilteredDepartments] = useState<Array<{ label: string; value: number }>>(departmentOptions);
  const [showFilters, setShowFilters] = useState(false);
  const itemsPerPage = 10;
  const { flash } = usePage().props as PagePropsWithFlash;

  // Import/Export state
  const importForm = useForm({ file: null as File | null });
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Store all programs from props
  const [allPrograms, setAllPrograms] = useState<Program[]>(programsData);
  
  // Filtered data based on search term and filters
  const [filteredData, setFilteredData] = useState<Program[]>(programsData);
  
  // Show toast notifications based on flash messages
  useEffect(() => {
    if (flash?.success) {
      toast.success(flash.success || 'Program operation successful!', {
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

  // Fetch departments based on selected faculty using axios
  useEffect(() => {
    if (facultyFilter) {
      axios.get(`/api/faculties/${facultyFilter}/departments`)
        .then((response) => {
          const departments = response.data.map((dept: any) => ({
            label: dept.name,
            value: dept.id
          }));
          setFilteredDepartments(departments);
          // Reset department filter when faculty changes
          setDepartmentFilter('');
        })
        .catch((error) => {
          console.error('Error fetching departments:', error);
          setFilteredDepartments([]);
        });
    } else {
      setFilteredDepartments(departmentOptions);
      setDepartmentFilter('');
    }
  }, [facultyFilter]);

  // Update filtered data when filters or search term changes
  useEffect(() => {
    let filtered = allPrograms;
    
    // Apply search filter
    if (searchTerm.trim() !== '') {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.faculty.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.department.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply faculty filter
    if (facultyFilter) {
      filtered = filtered.filter(item => item.faculty.id === facultyFilter);
    }
    
    // Apply department filter
    if (departmentFilter) {
      filtered = filtered.filter(item => item.department.id === departmentFilter);
    }
    
    setFilteredData(filtered);
    // Reset to first page when filters change
    setCurrentPage(1);
  }, [searchTerm, facultyFilter, departmentFilter, allPrograms]);

  // Calculate pagination based on filtered data
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, endIndex);

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

  // Function to clear all filters
  const clearAllFilters = () => {
    setSearchTerm('');
    setFacultyFilter('');
    setDepartmentFilter('');
    setShowFilters(false);
  };

  // Function to handle delete
  const handleDelete = (id: number, name: string) => {
    if (confirm(`Are you sure you want to permanently delete "${name}"?`)) {
      router.delete(route('admin.school-management.programs.destroy', id), {
        preserveState: true,
        onSuccess: () => {
          // Remove the deleted item from the state
          setAllPrograms(prevPrograms => 
            prevPrograms.filter(program => program.id !== id)
          );
        }
      });
    }
  };

  // Apply filters via Inertia (reload page with filters)
  const applyFilters = () => {
    router.get(route('admin.school-management.programs.index'), {
      faculty_id: facultyFilter || null,
      department_id: departmentFilter || null,
    }, {
      preserveState: true,
      preserveScroll: true,
    });
  };

  // Count active filters
  const activeFilterCount = (searchTerm ? 1 : 0) + (facultyFilter ? 1 : 0) + (departmentFilter ? 1 : 0);

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
      const res = await fetch(route('admin.school-management.programs.preview'), {
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
            errorMessage = Array.isArray(j.errors.file) ? j.errors.file.join(', ') : j.errors.file;
          } else if (j.error) errorMessage = j.error;
          else if (j.message) errorMessage = j.message;
        } catch (e) {
          try {
            errorMessage = (await res.text()) || `Server error (${res.status})`;
          } catch {
            errorMessage = `Server error (${res.status})`;
          }
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
      const res = await fetch(route('admin.school-management.programs.confirm-import'), {
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

  // Breadcrumbs for the layout
  const breadcrumbs = [
    {
      title: 'Dashboard',
      href: '/admin/dashboard',
    },
    {
      title: 'Programs',
      href: '/admin/school-management/programs',
    }
  ];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Programs" />
      <div className="min-h-screen bg-slate-50 flex">
        {/* -------------------- MAIN CONTENT AREA -------------------- */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Page Content */}
          <div className="p-4 sm:p-6 lg:p-8 flex-1 overflow-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Programs</h1>
                <p className="mt-1 text-sm text-slate-600">Manage academic programs for your institution</p>
              </div>
              {can('admin.school-management.programs.create') && (
                <Link
                  href={route('admin.school-management.programs.create')}
                  className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:from-indigo-700 hover:to-purple-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Program
                </Link>
              )}
            </div>

            {/* Import/Export Card */}
            <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Import & Export</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-slate-700">Export Data</h3>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={route('admin.school-management.programs.export', 'excel')}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      Export XLSX
                    </a>
                    <a
                      href={route('admin.school-management.programs.export', 'csv')}
                      className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                    >
                      <FileText className="h-4 w-4" />
                      Export CSV
                    </a>
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-slate-700">Import Data</h3>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <a
                        href={route('admin.school-management.programs.template')}
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

            {/* Filters Section */}
            <div className="mb-6 bg-white rounded-2xl shadow-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Filter className="w-5 h-5 text-slate-500" />
                  <h3 className="text-lg font-semibold text-slate-900">Filters</h3>
                  {activeFilterCount > 0 && (
                    <span className="bg-indigo-100 text-indigo-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                      {activeFilterCount} active
                    </span>
                  )}
                </div>
                <div className="flex space-x-2">
                  {activeFilterCount > 0 && (
                    <button
                      onClick={clearAllFilters}
                      className="text-sm text-slate-600 hover:text-slate-900 flex items-center space-x-1 px-3 py-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                      <span>Clear all</span>
                    </button>
                  )}
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center space-x-1 px-3 py-1.5 hover:bg-indigo-50 rounded-lg transition-colors"
                  >
                    {showFilters ? 'Hide filters' : 'Show filters'}
                  </button>
                </div>
              </div>

              {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-200">
                  {/* Faculty Filter */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Faculty
                    </label>
                    <select
                      value={facultyFilter}
                      onChange={(e) => setFacultyFilter(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm transition-shadow"
                    >
                      <option value="">All Faculties</option>
                      {facultyOptions.map((faculty) => (
                        <option key={faculty.value} value={faculty.value}>
                          {faculty.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Department Filter */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Department
                    </label>
                    <select
                      value={departmentFilter}
                      onChange={(e) => setDepartmentFilter(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm transition-shadow"
                      disabled={!facultyFilter}
                    >
                      <option value="">All Departments</option>
                      {filteredDepartments.map((department) => (
                        <option key={department.value} value={department.value}>
                          {department.label}
                        </option>
                      ))}
                    </select>
                    {!facultyFilter && (
                      <p className="text-xs text-slate-500 mt-1">Select a faculty first</p>
                    )}
                  </div>

                  {/* Apply Filter Button */}
                  <div className="flex items-end">
                    <button
                      onClick={applyFilters}
                      className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                      Apply Filters
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Programs Table */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200">
              <div className="p-6 border-b border-slate-200">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                  <h3 className="text-xl font-bold text-slate-900">Programs List</h3>
                  <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                      <input
                        type="text"
                        placeholder="Search programs, faculty or department..."
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
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Program Name</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Faculty</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Department</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {paginatedData.length > 0 ? (
                      paginatedData.map((program, index) => (
                        <tr key={program.id} className="hover:bg-indigo-50/20 transition-colors">
                          <td className='text-right px-4 py-4'>
                            {index + 1 + startIndex}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-4">
                              <div className="text-sm font-semibold text-slate-900">
                                <p style={{ textTransform: 'capitalize' }}>{program.name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-slate-700">{program.faculty.name}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-slate-700">{program.department.name}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-1">
                              {can('admin.school-management.programs.edit') && (
                              <Link 
                                title="Edit Program" 
                                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                href={route('admin.school-management.programs.edit', program.id)}
                              >
                                <Edit className="w-5 h-5" />
                              </Link>
                              )}

                              {can('admin.school-management.programs.delete') && (
                                <Button 
                                  title="Delete Program" 
                                  className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleDelete(program.id, program.name);
                                  }}
                                >
                                  <Trash2 className="w-5 h-5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                          {searchTerm || facultyFilter || departmentFilter
                            ? `No programs found with the current filters. Try adjusting your filters.` 
                            : 'No programs found. Add your first program!'}
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
                    Showing <span className="font-semibold text-slate-800">{totalItems > 0 ? startIndex + 1 : 0}</span> to <span className="font-semibold text-slate-800">{Math.min(endIndex, totalItems)}</span> of <span className="font-semibold text-slate-800">{totalItems}</span> Programs
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
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => handlePageChange(page)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium min-w-[40px] ${
                            currentPage === page
                              ? 'bg-indigo-600 text-white'
                              : 'text-slate-700 hover:bg-slate-100 border border-slate-300 hover:border-slate-400'
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
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setShowPreview(false)}
          />
          <div className="relative w-full max-w-5xl max-h-[90vh] rounded-xl bg-white shadow-2xl">
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

            <div className="overflow-auto max-h-[calc(90vh-180px)] p-6">
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Line</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Faculty</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Department</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Errors</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
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
                              ? 'bg-red-50/50 hover:bg-red-50'
                              : r.exists
                              ? 'bg-amber-50/50 hover:bg-amber-50'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">{r.line}</td>
                          <td className="px-4 py-3 text-sm text-slate-900">{r.data.name || '-'}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{r.data.faculty || '-'}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{r.data.department || '-'}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm">
                            {r.errors.length > 0 ? (
                              <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">Error</span>
                            ) : r.exists ? (
                              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">Exists</span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">New</span>
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

export default ProgramsIndexPage;