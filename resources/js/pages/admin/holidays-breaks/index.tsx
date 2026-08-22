import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import AppLayout from '@/layouts/app-layout';
import { can } from '@/lib/can';
import { formatLongDateRange } from '@/lib/dates';
import { type BreadcrumbItem, type PagePropsWithFlash } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { AlertTriangle, CalendarDays, Edit, Eye, MoreVertical, Plus, Power, PowerOff, Search } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Bounce, toast, ToastContainer } from 'react-toastify';

interface HolidayBreakRow {
    id: number;
    name: string;
    type: string;
    type_label: string;
    coverage_label: string;
    covered_staff_count: number;
    start_date: string;
    end_date: string;
    status: string;
    created_by_name?: string | null;
    created_at?: string | null;
    duty_assignments_count: number;
    overlaps: boolean;
    description?: string | null;
}

interface PaginatedBreaks {
    data: HolidayBreakRow[];
    links: Array<{ url: string | null; label: string; active: boolean }>;
    meta?: { current_page?: number; last_page?: number };
    current_page?: number;
    last_page?: number;
}

interface IndexProps {
    holidayBreaks: PaginatedBreaks;
    filters: {
        search: string;
        type: string;
        status: string;
        from: string;
        to: string;
    };
    typeOptions: Record<string, string>;
    overlappingIds: number[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Holidays & Breaks', href: '/admin/holidays-breaks' },
];

export default function HolidayBreaksIndex({ holidayBreaks, filters, typeOptions }: IndexProps) {
    const { flash } = usePage().props as PagePropsWithFlash;
    const [search, setSearch] = useState(filters.search || '');
    const [type, setType] = useState(filters.type || 'all');
    const [status, setStatus] = useState(filters.status || 'all');
    const [from, setFrom] = useState(filters.from || '');
    const [to, setTo] = useState(filters.to || '');

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success, { theme: 'dark', transition: Bounce });
        }
        if (flash?.error) {
            toast.error(flash.error, { theme: 'dark', transition: Bounce });
        }
    }, [flash]);

    const applyFilters = (event?: FormEvent) => {
        event?.preventDefault();
        router.get(
            route('admin.holidays-breaks.index'),
            {
                search: search || undefined,
                type: type !== 'all' ? type : undefined,
                status: status !== 'all' ? status : undefined,
                from: from || undefined,
                to: to || undefined,
            },
            { preserveState: true, replace: true },
        );
    };

    const toggleStatus = (item: HolidayBreakRow) => {
        const next = item.status === 'active' ? 'inactive' : 'active';
        router.patch(route('admin.holidays-breaks.toggle-status', item.id), { status: next }, { preserveScroll: true });
    };

    const renderActions = (item: HolidayBreakRow) => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-10 shrink-0 lg:size-9"
                    aria-label={`Actions for ${item.name}`}
                >
                    <MoreVertical className="size-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem asChild className="min-h-10 cursor-pointer">
                    <Link href={route('admin.holidays-breaks.show', item.id)}>
                        <Eye className="size-4" />
                        Manage
                    </Link>
                </DropdownMenuItem>
                {can('admin.holidays-breaks.edit') && (
                    <>
                        <DropdownMenuItem asChild className="min-h-10 cursor-pointer">
                            <Link href={route('admin.holidays-breaks.edit', item.id)}>
                                <Edit className="size-4" />
                                Edit
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="min-h-10 cursor-pointer" onSelect={() => toggleStatus(item)}>
                            {item.status === 'active' ? <PowerOff className="size-4" /> : <Power className="size-4" />}
                            {item.status === 'active' ? 'Deactivate' : 'Activate'}
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );

    const emptyState = (
        <div className="px-4 py-10 text-center text-slate-500">
            <CalendarDays className="mx-auto mb-2 size-8 opacity-40" />
            No holiday or break periods found.
        </div>
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Holidays & Breaks" />
            <ToastContainer />

            <div className="mx-auto w-full min-w-0 max-w-6xl space-y-5 p-4 md:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Holidays & University Breaks</h1>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            Configure days when normal attendance is suspended, and assign essential break-duty staff.
                        </p>
                    </div>
                    {can('admin.holidays-breaks.create') && (
                        <Link
                            href={route('admin.holidays-breaks.create')}
                            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 sm:h-auto sm:w-auto"
                        >
                            <Plus className="size-4" />
                            Add Holiday / Break
                        </Link>
                    )}
                </div>

                <form onSubmit={applyFilters} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="grid gap-3 md:grid-cols-5">
                        <div className="relative md:col-span-2">
                            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by name"
                                className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                            />
                        </div>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                        >
                            <option value="all">All types</option>
                            {Object.entries(typeOptions).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                        >
                            <option value="all">All statuses</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                        <button
                            type="submit"
                            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
                        >
                            Filter
                        </button>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <input
                            type="date"
                            value={from}
                            onChange={(e) => setFrom(e.target.value)}
                            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                        />
                        <input
                            type="date"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                        />
                    </div>
                </form>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="space-y-3 p-4 lg:hidden">
                        {holidayBreaks.data.length === 0
                            ? emptyState
                            : holidayBreaks.data.map((item) => (
                                  <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                                      <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0">
                                              <Link
                                                  href={route('admin.holidays-breaks.show', item.id)}
                                                  className="font-semibold break-words text-slate-900 hover:text-emerald-700 dark:text-white"
                                              >
                                                  {item.name}
                                              </Link>
                                              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.type_label}</p>
                                          </div>
                                          <div className="flex shrink-0 items-center gap-2">
                                              <span
                                                  className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                                                      item.status === 'active'
                                                          ? 'bg-emerald-100 text-emerald-800'
                                                          : 'bg-slate-100 text-slate-600'
                                                  }`}
                                              >
                                                  {item.status}
                                              </span>
                                              {renderActions(item)}
                                          </div>
                                      </div>

                                      {item.overlaps && (
                                          <p className="mt-2 inline-flex items-center gap-1 text-xs text-amber-700">
                                              <AlertTriangle className="size-3.5" />
                                              Overlaps another active period
                                          </p>
                                      )}

                                      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                                          <div>
                                              <dt className="text-xs text-slate-500">Applies to</dt>
                                              <dd className="text-slate-700 dark:text-slate-200">{item.coverage_label}</dd>
                                              <dd className="text-xs text-slate-500">{item.covered_staff_count} covered</dd>
                                          </div>
                                          <div>
                                              <dt className="text-xs text-slate-500">Dates</dt>
                                              <dd className="text-slate-700 dark:text-slate-200">
                                                  {formatLongDateRange(item.start_date, item.end_date)}
                                              </dd>
                                          </div>
                                          <div>
                                              <dt className="text-xs text-slate-500">Duty staff</dt>
                                              <dd className="text-slate-700 dark:text-slate-200">{item.duty_assignments_count}</dd>
                                          </div>
                                      </dl>

                                  </div>
                              ))}
                    </div>

                    <div className="hidden overflow-x-auto lg:block">
                        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                            <thead className="bg-slate-50 dark:bg-slate-950/50">
                                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    <th className="px-4 py-3">Name</th>
                                    <th className="px-4 py-3">Type</th>
                                    <th className="px-4 py-3">Applies to</th>
                                    <th className="px-4 py-3">Dates</th>
                                    <th className="px-4 py-3">Duty staff</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="sticky right-0 bg-slate-50 px-4 py-3 text-right dark:bg-slate-950/50">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {holidayBreaks.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={7}>{emptyState}</td>
                                    </tr>
                                ) : (
                                    holidayBreaks.data.map((item) => (
                                        <tr key={item.id} className="align-top">
                                            <td className="px-4 py-3">
                                                <Link
                                                    href={route('admin.holidays-breaks.show', item.id)}
                                                    className="font-semibold text-slate-900 hover:text-emerald-700 dark:text-white"
                                                >
                                                    {item.name}
                                                </Link>
                                                {item.overlaps && (
                                                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-amber-700">
                                                        <AlertTriangle className="size-3.5" />
                                                        Overlaps another active period
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{item.type_label}</td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                                <p>{item.coverage_label}</p>
                                                <p className="text-xs text-slate-500">{item.covered_staff_count} covered</p>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                                {formatLongDateRange(item.start_date, item.end_date)}
                                            </td>
                                            <td className="px-4 py-3">{item.duty_assignments_count}</td>
                                            <td className="px-4 py-3">
                                                <span
                                                    className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                                                        item.status === 'active'
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : 'bg-slate-100 text-slate-600'
                                                    }`}
                                                >
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="sticky right-0 bg-white px-4 py-3 text-right dark:bg-slate-900">
                                                {renderActions(item)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
