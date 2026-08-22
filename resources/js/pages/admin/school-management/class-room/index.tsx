import DataTable from '@/components/data-table/DataTable';
import RowActionsMenu from '@/components/data-table/RowActionsMenu';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useListTableQuery } from '@/hooks/use-list-table-query';
import { useEffect, useMemo, useState } from 'react';
import { 
  Plus,
  Edit,
  Trash2,
  MapPin,
  CheckCircle,
  XCircle,
  Download,
  Upload,
  FileSpreadsheet,
  FileText,
  X
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, usePage, router } from '@inertiajs/react';
import { useForm } from '@inertiajs/react';
import { PagePropsWithFlash } from '@/types';
import { ToastContainer, toast, Bounce } from 'react-toastify';
import { can } from '@/lib/can';

// Update interface for paginated data
interface ClassRoom {
  id: number;
  name: string;
  capacity: number;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number | null;
  is_active: boolean;
}

interface PaginatedClassRooms {
  data: ClassRoom[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

interface ClassRoomFilters {
  search?: string;
  sort_by?: string;
  sort_dir?: string;
  per_page?: string;
}

interface TeachersIndexPageProps {
  classRoomData: PaginatedClassRooms;
  filters?: ClassRoomFilters;
  search?: string;
}

const ClassRoomIndexPage = ({ classRoomData, filters = {}, search }: TeachersIndexPageProps) => {
  const [searchTerm, setSearchTerm] = useState(filters.search ?? search ?? '');
  const [sortBy, setSortBy] = useState(filters.sort_by || 'name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(filters.sort_dir === 'desc' ? 'desc' : 'asc');
  const [perPage, setPerPage] = useState(Number(filters.per_page || classRoomData.per_page || 10));
  const { flash } = usePage().props as PagePropsWithFlash;

  const importForm = useForm({ file: null as File | null });
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  
  // Show toast notifications based on flash messages
  useEffect(() => {
    if (flash?.success) {
      toast.success(flash.success || 'Venue created successfully!', {
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
  },[flash]);

  const tableFilters = useMemo(() => ({ search: searchTerm }), [searchTerm]);
  const { loading, onPageChange } = useListTableQuery({
    url: route('admin.school-management.class-rooms.index'),
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
    only: ['classRoomData', 'filters'],
  });

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(column);
    setSortDir('asc');
  };

  
  const class_rooms: PaginatedClassRooms = classRoomData;

  const breadcrumbs = [
    {
      title: 'Settings',
      href: '/admin/settings-reports/settings',
    },
    {
      title: 'Venues',
      href: '/admin/school-management/class-rooms',
    }
  ];

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
      const res = await fetch(route('admin.school-management.class-rooms.preview'), {
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
      const res = await fetch(route('admin.school-management.class-rooms.confirm-import'), {
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
        setShowPreview(false);
        setPreviewRows([]);
        importForm.setData('file', null);
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

  // Format location coordinates for display
 const formatLocation = (classRoom: ClassRoom) => {
  if (!classRoom.latitude || !classRoom.longitude) {
    return 'Not set';
  }
  
  // Ensure both values are numbers before calling toFixed
  const lat = Number(classRoom.latitude);
  const lng = Number(classRoom.longitude);
  
  // Check if conversion was successful
  if (isNaN(lat) || isNaN(lng)) {
    return 'Invalid coordinates';
  }
  
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
};

  // Format radius for display
  const formatRadius = (classRoom: ClassRoom) => {
    if (!classRoom.radius_meters) {
      return 'Not set';
    }
    return `${classRoom.radius_meters}m`;
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Venues" />
      <div className="min-h-screen bg-slate-50 flex">
        {/* -------------------- MAIN CONTENT AREA -------------------- */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Page Content */}
          <div className="p-4 sm:p-6 lg:p-8 flex-1 overflow-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Venues</h1>
                <p className="text-slate-600">Manage venue information, locations, and attendance boundaries</p>
              </div>
              {can('admin.school-management.class-rooms.create') && (
              <Link
                href={route('admin.school-management.class-rooms.create')} 
                className="mt-4 sm:mt-0 flex items-center justify-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Venue
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
                      href={route('admin.school-management.class-rooms.export', 'excel')}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      Export XLSX
                    </a>
                    <a
                      href={route('admin.school-management.class-rooms.export', 'csv')}
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
                        href={route('admin.school-management.class-rooms.template')}
                        className="mb-2 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      >
                        <Download className="h-4 w-4" />
                        Download Template
                      </a>
                      <form onSubmit={handlePreview} className="mt-2" encType="multipart/form-data">
                        <label className="mb-2 block text-xs font-medium text-slate-700">Upload File</label>
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

            <DataTable
              title="Venue List"
              records={class_rooms}
              columns={[
                {
                  key: 'name',
                  label: 'Name',
                  sortable: true,
                  render: (room) => <p className="font-medium capitalize text-sidebar-foreground">{room.name}</p>,
                },
                {
                  key: 'capacity',
                  label: 'Capacity',
                  sortable: true,
                  render: (room) => (
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-950/40 dark:text-blue-300">
                      {room.capacity} seats
                    </span>
                  ),
                },
                {
                  key: 'location',
                  label: 'Location',
                  render: (room) => (
                    <div className="flex items-center gap-2 text-sm text-sidebar-foreground/70">
                      <MapPin className="size-4 text-sidebar-foreground/40" />
                      <span className="font-mono">{formatLocation(room)}</span>
                    </div>
                  ),
                },
                {
                  key: 'radius',
                  label: 'Radius',
                  render: (room) => <span className="text-sm text-sidebar-foreground/70">{formatRadius(room)}</span>,
                },
                {
                  key: 'is_active',
                  label: 'Status',
                  sortable: true,
                  render: (room) => (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                        room.is_active
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-950/40 dark:text-rose-300'
                      }`}
                    >
                      {room.is_active ? <CheckCircle className="size-3.5" /> : <XCircle className="size-3.5" />}
                      {room.is_active ? 'Active' : 'Inactive'}
                    </span>
                  ),
                },
                {
                  key: 'actions',
                  label: 'Actions',
                  className: 'text-right',
                  render: (room) => (
                    <RowActionsMenu label={`Actions for ${room.name}`}>
                      {can('admin.school-management.class-rooms.edit') && (
                        <DropdownMenuItem asChild>
                          <Link href={route('admin.school-management.class-rooms.edit', room.id)}>
                            <Edit className="size-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                      )}
                      {can('admin.school-management.class-rooms.delete') && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild className="text-rose-600 focus:text-rose-600">
                            <Link
                              href={route('admin.school-management.class-rooms.destroy', room.id)}
                              method="delete"
                              as="button"
                              onClick={(event) => {
                                if (!confirm('Are you sure you want to permanently delete this venue?')) {
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
              searchPlaceholder="Search venues..."
              onSearchChange={setSearchTerm}
              hasActiveQuery={Boolean(searchTerm)}
              recordLabel="venues"
              empty={{
                title: 'No venues yet',
                description: 'Add a venue to start assigning classes.',
                action: can('admin.school-management.class-rooms.create') ? (
                  <Link
                    href={route('admin.school-management.class-rooms.create')}
                    className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    <Plus className="mr-2 size-4" />
                    Add Venue
                  </Link>
                ) : undefined,
              }}
              noResults={{
                title: 'No venues match your search',
                description: 'Try a different venue name or clear the search.',
              }}
            />
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
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Capacity</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">Errors</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {previewRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">No data to preview</td>
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
                          <td className="px-4 py-3 text-sm text-slate-600">{r.data.capacity ?? '-'}</td>
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

export default ClassRoomIndexPage;