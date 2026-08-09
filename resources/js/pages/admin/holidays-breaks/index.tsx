import AppLayout from '@/layouts/app-layout';
import { can } from '@/lib/can';
import { type BreadcrumbItem, type PagePropsWithFlash } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { AlertTriangle, CalendarDays, Plus, Search } from 'lucide-react';
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

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Holidays & Breaks" />
            <ToastContainer />

            <div className="mx-auto w-full max-w-6xl space-y-5 p-4 md:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Holidays & University Breaks</h1>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            Configure days when normal attendance is suspended, and assign essential break-duty staff.
                        </p>
                    </div>
                    {can('admin.holidays-breaks.create') && (
                        <Link
                            href={route('admin.holidays-breaks.create')}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
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
                    <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                        <thead className="bg-slate-50 dark:bg-slate-950/50">
                            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                <th className="px-4 py-3">Name</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">Applies to</th>
                                <th className="px-4 py-3">Dates</th>
                                <th className="px-4 py-3">Duty staff</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {holidayBreaks.data.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                                        <CalendarDays className="mx-auto mb-2 size-8 opacity-40" />
                                        No holiday or break periods found.
                                    </td>
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
                                            {item.start_date} → {item.end_date}
                                        </td>
                                        <td className="px-4 py-3">{item.duty_assignments_count}</td>
                                        <td className="px-4 py-3">
                                            <span
                                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                    item.status === 'active'
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : 'bg-slate-100 text-slate-600'
                                                }`}
                                            >
                                                {item.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-2">
                                                <Link
                                                    href={route('admin.holidays-breaks.show', item.id)}
                                                    className="rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                                                >
                                                    Manage
                                                </Link>
                                                {can('admin.holidays-breaks.edit') && (
                                                    <>
                                                        <Link
                                                            href={route('admin.holidays-breaks.edit', item.id)}
                                                            className="rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                                                        >
                                                            Edit
                                                        </Link>
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleStatus(item)}
                                                            className="rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                                                        >
                                                            {item.status === 'active' ? 'Deactivate' : 'Activate'}
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </AppLayout>
    );
}
