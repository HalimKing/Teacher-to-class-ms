import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';

interface TicketRow {
    id: number;
    ticket_number: string;
    subject: string;
    category_label: string;
    priority: string;
    priority_label: string;
    status: string;
    status_label: string;
    created_at?: string;
}

interface PageProps {
    tickets: { data: TicketRow[] };
    filters: { status?: string; category?: string; priority?: string; search?: string };
    categories: Record<string, string>;
    priorities: Record<string, string>;
    statuses: Record<string, string>;
    flash?: { success?: string; error?: string };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/teacher/dashboard' },
    { title: 'Help Desk', href: '/teacher/help-desk' },
];

const statusBadge = (status: string) => {
    if (status === 'open') return 'bg-sky-100 text-sky-800';
    if (status === 'in_progress') return 'bg-amber-100 text-amber-800';
    if (status === 'resolved') return 'bg-emerald-100 text-emerald-800';
    return 'bg-slate-100 text-slate-700';
};

const priorityBadge = (priority: string) => {
    if (priority === 'urgent') return 'bg-rose-100 text-rose-800';
    if (priority === 'high') return 'bg-orange-100 text-orange-800';
    if (priority === 'medium') return 'bg-blue-100 text-blue-800';
    return 'bg-slate-100 text-slate-700';
};

export default function TeacherHelpDeskIndex({ tickets, filters, categories, priorities, statuses }: PageProps) {
    const { flash } = usePage().props as PageProps;
    const [search, setSearch] = useState(filters.search || '');
    const [status, setStatus] = useState(filters.status || '');
    const [category, setCategory] = useState(filters.category || '');
    const [priority, setPriority] = useState(filters.priority || '');

    const applyFilters = () => {
        router.get(
            route('teacher.help-desk.index'),
            { search, status, category, priority },
            { preserveState: true, replace: true },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Help Desk" />
            <div className="space-y-6 p-4 md:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Help Desk</h1>
                        <p className="mt-1 text-sm text-slate-500">Submit and track support requests with the admin team.</p>
                    </div>
                    <Link
                        href={route('teacher.help-desk.create')}
                        className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                        New ticket
                    </Link>
                </div>

                {flash?.success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{flash.success}</div>}
                {flash?.error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{flash.error}</div>}

                <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search tickets..."
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                    <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                        <option value="">All statuses</option>
                        {Object.entries(statuses).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                    <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                        <option value="">All categories</option>
                        {Object.entries(categories).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                    <select value={priority} onChange={(e) => setPriority(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                        <option value="">All priorities</option>
                        {Object.entries(priorities).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                    <button type="button" onClick={applyFilters} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200">
                        Filter
                    </button>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <tr>
                                <th className="px-4 py-3">Ticket</th>
                                <th className="px-4 py-3">Subject</th>
                                <th className="px-4 py-3">Category</th>
                                <th className="px-4 py-3">Priority</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {tickets.data.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                                        No tickets yet.
                                    </td>
                                </tr>
                            ) : (
                                tickets.data.map((row) => (
                                    <tr key={row.id}>
                                        <td className="px-4 py-3 font-medium">{row.ticket_number}</td>
                                        <td className="px-4 py-3">{row.subject}</td>
                                        <td className="px-4 py-3">{row.category_label}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${priorityBadge(row.priority)}`}>
                                                {row.priority_label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge(row.status)}`}>
                                                {row.status_label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Link href={route('teacher.help-desk.show', row.id)} className="font-medium text-blue-600 hover:underline">
                                                View
                                            </Link>
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
