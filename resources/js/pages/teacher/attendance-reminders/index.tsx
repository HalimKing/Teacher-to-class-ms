import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Bell, Pencil, Plus, Power, Search, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Bounce, toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface ReminderRow {
    id: number;
    title: string;
    type_label: string;
    days: string[];
    trigger_label: string;
    offset_minutes: number;
    send_via_label: string;
    is_active: boolean;
    created_at?: string | null;
    next_occurrence?: string | null;
}

interface PageProps {
    reminders: {
        data: ReminderRow[];
        links: Array<{ url: string | null; label: string; active: boolean }>;
    };
    summary: { total: number; active: number; inactive: number; upcoming: number };
    usage: { used: number; limit: number };
    filters: { search?: string; type?: string; day?: string; status?: string };
    days: string[];
    can: { create: boolean; edit: boolean; delete: boolean };
    flash?: { success?: string | null; error?: string | null };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/teacher/dashboard' },
    { title: 'My Reminders', href: '/teacher/attendance-reminders' },
];

export default function RemindersIndex() {
    const { reminders, summary, usage, filters, days, can, flash } = usePage<PageProps>().props;
    const [search, setSearch] = useState(filters.search ?? '');
    const atLimit = usage.used >= usage.limit;

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success, { position: 'top-right', autoClose: 4000, theme: 'colored', transition: Bounce });
        }
        if (flash?.error) {
            toast.error(flash.error, { position: 'top-right', autoClose: 5000, theme: 'colored', transition: Bounce });
        }
    }, [flash?.success, flash?.error]);

    const applyFilters = (event: FormEvent) => {
        event.preventDefault();
        router.get('/teacher/attendance-reminders', { ...filters, search }, { preserveState: true, replace: true });
    };

    const updateFilter = (key: string, value: string) => {
        router.get('/teacher/attendance-reminders', { ...filters, search, [key]: value || undefined }, { preserveState: true, replace: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="My Reminders" />
            <ToastContainer />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Reminders</h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Check-in and check-out reminders for your own duty schedule. They repeat every selected day until you disable or delete them.
                        </p>
                        <p className="mt-1 text-sm text-slate-500">{usage.used} of {usage.limit} reminders used</p>
                    </div>
                    {can.create ? (
                        <Button asChild>
                            <Link href="/teacher/attendance-reminders/create">
                                <Plus className="size-4" />
                                New reminder
                            </Link>
                        </Button>
                    ) : (
                        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">You have reached the reminder limit.</p>
                    )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                        ['Total Reminders', summary.total],
                        ['Active Reminders', summary.active],
                        ['Inactive Reminders', summary.inactive],
                        ['Upcoming Notifications', summary.upcoming],
                    ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-sidebar-border dark:bg-card">
                            <p className="text-sm text-slate-500">{label}</p>
                            <p className="mt-1 text-2xl font-semibold">{value}</p>
                        </div>
                    ))}
                </div>

                <form onSubmit={applyFilters} className="grid gap-3 md:grid-cols-4">
                    <label className="relative block md:col-span-1">
                        <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-slate-400" />
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search reminders"
                            aria-label="Search reminders"
                            className="h-10 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-sm dark:border-sidebar-border dark:bg-card"
                        />
                    </label>
                    <select aria-label="All types" value={filters.type ?? ''} onChange={(event) => updateFilter('type', event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-sidebar-border dark:bg-card">
                        <option value="">All types</option>
                        <option value="check_in">Check-in</option>
                        <option value="check_out">Check-out</option>
                    </select>
                    <select aria-label="All days" value={filters.day ?? ''} onChange={(event) => updateFilter('day', event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-sidebar-border dark:bg-card">
                        <option value="">All days</option>
                        {days.map((day) => <option key={day} value={day}>{day}</option>)}
                    </select>
                    <select aria-label="All statuses" value={filters.status ?? ''} onChange={(event) => updateFilter('status', event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-sidebar-border dark:bg-card">
                        <option value="">All statuses</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </form>

                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-sidebar-border dark:bg-card">
                    <table className="min-w-[760px] w-full text-left text-sm">
                        <thead className="border-b text-xs tracking-wide text-slate-500 uppercase">
                            <tr>
                                <th className="px-4 py-3">Reminder</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">Days</th>
                                <th className="px-4 py-3">Trigger</th>
                                <th className="px-4 py-3">Delivery</th>
                                <th className="px-4 py-3">Next</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reminders.data.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                                        <Bell className="mx-auto mb-2 size-5" />
                                        No reminders yet.
                                    </td>
                                </tr>
                            )}
                            {reminders.data.map((reminder) => (
                                <tr key={reminder.id} className="border-b border-slate-100 last:border-0 dark:border-sidebar-border">
                                    <td className="px-4 py-3">
                                        <Link href={`/teacher/attendance-reminders/${reminder.id}`} className="font-medium text-slate-900 hover:underline dark:text-white">
                                            {reminder.title}
                                        </Link>
                                        <p className="text-xs text-slate-500">Created {reminder.created_at}</p>
                                    </td>
                                    <td className="px-4 py-3">{reminder.type_label}</td>
                                    <td className="px-4 py-3">{(reminder.days ?? []).map((day) => day.slice(0, 3)).join(', ') || '—'}</td>
                                    <td className="px-4 py-3">
                                        {reminder.trigger_label}
                                        <span className="block text-xs text-slate-500">{reminder.offset_minutes} min</span>
                                    </td>
                                    <td className="px-4 py-3">{reminder.send_via_label}</td>
                                    <td className="px-4 py-3">{reminder.next_occurrence ?? '—'}</td>
                                    <td className="px-4 py-3">
                                        <span className={reminder.is_active ? 'text-emerald-700' : 'text-slate-500'}>
                                            {reminder.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            {can.edit && (
                                                <>
                                                    <Link href={`/teacher/attendance-reminders/${reminder.id}/edit`} className="rounded-md p-1.5 hover:bg-slate-100" aria-label="Edit reminder">
                                                        <Pencil className="size-4" />
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        className="rounded-md p-1.5 hover:bg-slate-100"
                                                        aria-label={reminder.is_active ? 'Deactivate reminder' : 'Activate reminder'}
                                                        onClick={() => router.patch(`/teacher/attendance-reminders/${reminder.id}/toggle`)}
                                                    >
                                                        <Power className="size-4" />
                                                    </button>
                                                </>
                                            )}
                                            {can.delete && (
                                                <button
                                                    type="button"
                                                    className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                                                    aria-label="Delete reminder"
                                                    onClick={() => {
                                                        if (confirm('Delete this reminder? Future notifications will stop.')) {
                                                            router.delete(`/teacher/attendance-reminders/${reminder.id}`);
                                                        }
                                                    }}
                                                >
                                                    <Trash2 className="size-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {atLimit && can.create === false && (
                    <p className="text-sm text-slate-500">Existing reminders can still be edited, activated, or deactivated.</p>
                )}

                <div className="flex flex-wrap gap-2">
                    {reminders.links?.map((link, index) => (
                        <button
                            key={`${link.label}-${index}`}
                            type="button"
                            disabled={!link.url}
                            onClick={() => link.url && router.visit(link.url)}
                            className={`rounded-md px-3 py-1 text-sm ${link.active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'} disabled:opacity-40`}
                            dangerouslySetInnerHTML={{ __html: link.label }}
                        />
                    ))}
                </div>
            </div>
        </AppLayout>
    );
}
