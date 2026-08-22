import DataTable from '@/components/data-table/DataTable';
import RowActionsMenu from '@/components/data-table/RowActionsMenu';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import type { PaginatedCollection } from '@/components/data-table/types';
import { useListTableQuery } from '@/hooks/use-list-table-query';
import React, { useMemo, useState, useEffect } from 'react';
import { 
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  AlertTriangle
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, usePage, router } from '@inertiajs/react';
import { PagePropsWithFlash } from '@/types';
import { ToastContainer, toast, Bounce } from 'react-toastify';
import { can } from '@/lib/can';

interface AcademicYearItem {
  id: number;
  name: string;
  status: string;
}

interface TeachersIndexPageProps {
  academicYearData: PaginatedCollection<AcademicYearItem>;
  activeCount?: number;
  totalCount?: number;
  filters?: {
    search?: string;
    sort_by?: string;
    sort_dir?: string;
    per_page?: string;
  };
}

const AcademicYearIndexPage = ({ academicYearData, activeCount = 0, totalCount = 0, filters = {} }: TeachersIndexPageProps) => {
  const [searchTerm, setSearchTerm] = useState(filters.search ?? '');
  const [sortBy, setSortBy] = useState(filters.sort_by || 'name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(filters.sort_dir === 'desc' ? 'desc' : 'asc');
  const [perPage, setPerPage] = useState(Number(filters.per_page || academicYearData.per_page || 10));
  const { flash } = usePage().props as PagePropsWithFlash;
  const [isToggling, setIsToggling] = useState<number | null>(null);
  const activeAcademicYearCount = activeCount;

  // Show toast notifications based on flash messages
  useEffect(() => {
    if (flash?.success) {
      toast.success(flash.success || 'Academic year operation successful!', {
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

  const tableFilters = useMemo(() => ({ search: searchTerm }), [searchTerm]);
  const { loading, onPageChange } = useListTableQuery({
    url: route('admin.school-management.academic-years.index'),
    filters: tableFilters,
    serverFilters: {
      search: filters.search ?? '',
      sort_by: filters.sort_by,
      sort_dir: filters.sort_dir,
      per_page: filters.per_page,
    },
    sortBy,
    sortDir,
    perPage,
    only: ['academicYearData', 'filters', 'activeCount', 'totalCount'],
  });

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(column);
    setSortDir('asc');
  };

  const breadcrumbs = [
    {
      title: 'Settings',
      href: '/admin/settings-reports/settings',
    },
    {
      title: 'Academic Years',
      href: '/admin/school-management/academic-years',
    }
  ];

  // Function to get status badge styles
  const getStatusBadge = (status: string) => {
    const baseClasses = 'px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1';
    
    switch (status.toLowerCase()) {
      case 'active':
        return {
          classes: `${baseClasses} bg-green-100 text-green-800 border border-green-200`,
          label: 'Active',
          icon: <Check className="w-3 h-3" />
        };
      case 'inactive':
        return {
          classes: `${baseClasses} bg-red-100 text-red-800 border border-red-200`,
          label: 'Inactive',
          icon: <X className="w-3 h-3" />
        };
      case 'pending':
        return {
          classes: `${baseClasses} bg-yellow-100 text-yellow-800`,
          label: 'Pending',
          icon: null
        };
      case 'archived':
        return {
          classes: `${baseClasses} bg-slate-100 text-slate-800`,
          label: 'Archived',
          icon: null
        };
      default:
        return {
          classes: `${baseClasses} bg-slate-100 text-slate-700`,
          label: status,
          icon: null
        };
    }
  };

  // Function to handle status toggle
  const handleToggleStatus = (id: number, currentStatus: string, name: string) => {
    const newStatus = currentStatus.toLowerCase() === 'active' ? 'inactive' : 'active';
    
    // Frontend validation: Check if trying to deactivate the only active academic year
    if (newStatus === 'inactive' && activeAcademicYearCount === 1 && currentStatus.toLowerCase() === 'active') {
      toast.error('Cannot deactivate. At least one academic year must remain active.', {
        position: "top-right",
        autoClose: 5000,
      });
      return;
    }
    
    // Confirmation message based on action
    let confirmationMessage = '';
    if (newStatus === 'active') {
      confirmationMessage = `Setting "${name}" as active will deactivate all other academic years. Are you sure?`;
    } else {
      confirmationMessage = `Are you sure you want to deactivate "${name}"?`;
    }
    
    if (confirm(confirmationMessage)) {
      setIsToggling(id);
      
      router.patch(route('admin.school-management.academic-years.toggle-status', id), {
        status: newStatus
      }, {
        preserveState: true,
        onSuccess: () => {
          setIsToggling(null);
        },
        onError: () => {
          setIsToggling(null);
          toast.error(`Failed to update status for "${name}"!`, {
            position: "top-right",
            autoClose: 3000,
          });
        }
      });
    }
  };

  // Function to handle delete
  const handleDelete = (id: number, name: string) => {
    // Check if trying to delete the only active academic year
    const academicYearToDelete = academicYearData.data.find(year => year.id === id);
    if (academicYearToDelete?.status.toLowerCase() === 'active' && activeAcademicYearCount === 1) {
      toast.error('Cannot delete the only active academic year. Please activate another one first.', {
        position: "top-right",
        autoClose: 5000,
      });
      return;
    }
    
    if (confirm(`Are you sure you want to permanently delete "${name}" academic year?`)) {
      router.delete(route('admin.school-management.academic-years.destroy', id), {
        preserveState: true,
        preserveScroll: true,
      });
    }
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Academic Years" />
      <div className="min-h-screen bg-slate-50 flex">
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="p-4 sm:p-6 lg:p-8 flex-1 overflow-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
              <div>
                <h2 className="text-3xl font-extrabold text-slate-900 mb-2">Academic Years</h2>
                <p className="text-slate-600">Manage academic years for your institution</p>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-4 sm:mt-0">
                {/* Active status info badge */}
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
                  <Check className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    Active: {activeAcademicYearCount} of {totalCount}
                  </span>
                </div>
                {can('admin.school-management.academic-years.create') && (
                <Link
                  href={route('admin.school-management.academic-years.create')} 
                  className="flex items-center justify-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Add Academic Year
                </Link>
                )}
              </div>
            </div>

            {/* Important Notice */}
            {activeAcademicYearCount === 1 && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-amber-800 mb-1">Important Notice</h4>
                    <p className="text-amber-700 text-sm">
                      You currently have only one active academic year. This record cannot be deactivated or deleted. 
                      Please activate another academic year first if you wish to change the active status.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <DataTable
              title="Academic Years List"
              records={academicYearData}
              columns={[
                {
                  key: 'name',
                  label: 'Name',
                  sortable: true,
                  render: (year) => (
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium capitalize text-sidebar-foreground">{year.name}</p>
                      {year.status.toLowerCase() === 'active' && (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                          Currently Active
                        </span>
                      )}
                    </div>
                  ),
                },
                {
                  key: 'status',
                  label: 'Status',
                  sortable: true,
                  render: (year) => {
                    const isOnlyActive = year.status.toLowerCase() === 'active' && activeAcademicYearCount === 1;
                    const isTogglingThis = isToggling === year.id;
                    const badge = getStatusBadge(year.status);
                    return (
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(year.id, year.status, year.name)}
                        disabled={isTogglingThis || isOnlyActive}
                        className="disabled:cursor-not-allowed disabled:opacity-50"
                        title={
                          isOnlyActive
                            ? 'Cannot deactivate the only active academic year'
                            : `Click to ${year.status.toLowerCase() === 'active' ? 'deactivate' : 'activate'}`
                        }
                      >
                        <span className={badge.classes}>
                          {badge.icon}
                          {badge.label}
                          {isTogglingThis && (
                            <span className="ml-1 inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          )}
                        </span>
                      </button>
                    );
                  },
                },
                {
                  key: 'actions',
                  label: 'Actions',
                  className: 'text-right',
                  render: (year) => {
                    const isOnlyActive = year.status.toLowerCase() === 'active' && activeAcademicYearCount === 1;
                    return (
                      <RowActionsMenu label={`Actions for ${year.name}`}>
                        {can('admin.school-management.academic-years.edit') && (
                          <DropdownMenuItem asChild>
                            <Link href={route('admin.school-management.academic-years.edit', year.id)}>
                              <Edit className="size-4" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                        )}
                        {can('admin.school-management.academic-years.delete') && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-rose-600 focus:text-rose-600"
                              disabled={isOnlyActive}
                              onClick={() => {
                                if (!isOnlyActive) {
                                  handleDelete(year.id, year.name);
                                }
                              }}
                            >
                              <Trash2 className="size-4" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </RowActionsMenu>
                    );
                  },
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
              searchPlaceholder="Search academic years..."
              onSearchChange={setSearchTerm}
              hasActiveQuery={Boolean(searchTerm)}
              recordLabel="academic years"
              empty={{
                title: 'No academic years yet',
                description: 'Add an academic year to start scheduling.',
                action: can('admin.school-management.academic-years.create') ? (
                  <Link
                    href={route('admin.school-management.academic-years.create')}
                    className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    <Plus className="mr-2 size-4" />
                    Add Academic Year
                  </Link>
                ) : undefined,
              }}
              noResults={{
                title: 'No academic years match your search',
                description: 'Try a different year name or clear the search.',
              }}
            />
          </div>
        </div>
      </div>
      <ToastContainer />
    </AppLayout>
  );
};

export default AcademicYearIndexPage;