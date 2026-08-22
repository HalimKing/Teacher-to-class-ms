import DataTable from '@/components/data-table/DataTable';
import RowActionsMenu from '@/components/data-table/RowActionsMenu';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import type { PaginatedCollection } from '@/components/data-table/types';
import { useListTableQuery } from '@/hooks/use-list-table-query';
import React, { useMemo, useState, useEffect } from 'react';
import { 
  Plus,
  Edit,
  Trash2
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, usePage, router } from '@inertiajs/react';
import { PagePropsWithFlash } from '@/types';
import { ToastContainer, toast, Bounce } from 'react-toastify';
import { can } from '@/lib/can';

// Simplified interface - now just an array of items
interface AcademicPeriodItem {
  id: number;
  name: string;
}

interface TeachersIndexPageProps {
  academicPeriodData: PaginatedCollection<AcademicPeriodItem>;
  filters?: {
    search?: string;
    sort_by?: string;
    sort_dir?: string;
    per_page?: string;
  };
}

const AcademicPeriodIndexPage = ({ academicPeriodData, filters = {} }: TeachersIndexPageProps) => {
  const [searchTerm, setSearchTerm] = useState(filters.search ?? '');
  const [sortBy, setSortBy] = useState(filters.sort_by || 'name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(filters.sort_dir === 'desc' ? 'desc' : 'asc');
  const [perPage, setPerPage] = useState(Number(filters.per_page || academicPeriodData.per_page || 10));
  const { flash } = usePage().props as PagePropsWithFlash;

  // Show toast notifications based on flash messages
  useEffect(() => {
    if (flash?.success) {
      toast.success(flash.success || 'Academic period operation successful!', {
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
    url: route('admin.school-management.academic-periods.index'),
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
    only: ['academicPeriodData', 'filters'],
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
      title: 'Academic Periods',
      href: '/admin/school-management/academic-periods',
    }
  ];

  const handleDelete = (id: number, name: string) => {
   if ( confirm(`Are you sure you want to permanently delete "${name} Academic period"?`) ) {
        router.delete(route('admin.school-management.academic-periods.destroy', id), {
            preserveState: true,
            preserveScroll: true,
          });
    }
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Academic Periods" />
      <div className="min-h-screen bg-slate-50 flex">
        {/* -------------------- MAIN CONTENT AREA -------------------- */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Page Content */}
          <div className="p-4 sm:p-6 lg:p-8 flex-1 overflow-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
              <div>
                <h2 className="text-3xl font-extrabold text-slate-900 mb-2">Academic Periods</h2>
                <p className="text-slate-600">Manage academic periods for your institution</p>
              </div>
              {can('admin.school-management.academic-periods.create') && (
              <Link
                href={route('admin.school-management.academic-periods.create')} 
                className="mt-4 sm:mt-0 flex items-center justify-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add Academic Period
              </Link>
              )}
            </div>

            {/* Academic Periods Table */}
            <DataTable
              title="Academic Periods List"
              records={academicPeriodData}
              columns={[
                {
                  key: 'name',
                  label: 'Name',
                  sortable: true,
                  render: (period) => <p className="font-medium capitalize text-sidebar-foreground">{period.name}</p>,
                },
                {
                  key: 'actions',
                  label: 'Actions',
                  className: 'text-right',
                  render: (period) => (
                    <RowActionsMenu label={`Actions for ${period.name}`}>
                      {can('admin.school-management.academic-periods.edit') && (
                        <DropdownMenuItem asChild>
                          <Link href={route('admin.school-management.academic-periods.edit', period.id)}>
                            <Edit className="size-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                      )}
                      {can('admin.school-management.academic-periods.delete') && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-rose-600 focus:text-rose-600"
                            onClick={() => handleDelete(period.id, period.name)}
                          >
                            <Trash2 className="size-4" />
                            Delete
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
              searchPlaceholder="Search academic periods..."
              onSearchChange={setSearchTerm}
              hasActiveQuery={Boolean(searchTerm)}
              recordLabel="academic periods"
              empty={{
                title: 'No academic periods yet',
                description: 'Add an academic period such as Semester 1 or Term 2.',
                action: can('admin.school-management.academic-periods.create') ? (
                  <Link
                    href={route('admin.school-management.academic-periods.create')}
                    className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    <Plus className="mr-2 size-4" />
                    Add Academic Period
                  </Link>
                ) : undefined,
              }}
              noResults={{
                title: 'No academic periods match your search',
                description: 'Try a different name or clear the search.',
              }}
            />
          </div>
        </div>
      </div>
      <ToastContainer />
    </AppLayout>
  );
};

export default AcademicPeriodIndexPage;