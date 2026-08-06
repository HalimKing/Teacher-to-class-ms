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
    creator?: { name?: string; employee_id?: string } | null;
    assignee?: { id: number; name: string } | null;
    created_at?: string;
}

interface PageProps {
    tickets: { data: TicketRow[] };
    filters: { status?: string; category?: string; priority?: string; assigned_to?: string; search?: string };
    categories: Record<string, string>;
    priorities: Record<string, string>;
    statuses: Record<string, string>;
    assignees: Array<{ id: number; name: string }>;
    stats: { open: number; in_progress: number; resolved: number; closed: number };
    flash?: { success?: string; error?: string };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/admin/dashboard' },
    { title: 'Help Desk', href: '/admin/help-desk' },
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

export default function AdminHelpDeskIndex({ tickets, filters, categories, priorities, statuses, assignees, stats }: PageProps) {
    const { flash } = usePage().props as PageProps;
    const [search, setSearch] = useState(filters.search || '');
    const [status, setStatus] = useState(filters.status || '');
    const [category, setCategory] = useState(filters.category || '');
    const [priority, setPriority] = useState(filters.priority || '');
    const [assignedTo, setAssignedTo] = useState(filters.assigned_to || '');

    const applyFilters = () => {
        router.get(
            route('admin.help-desk.index'),
            { search, status, category, priority, assigned_to: assignedTo },
            { preserveState: true, replace: true },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Help Desk" />
            <div className="space-y-6 p-4 md:p-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Help Desk</h1>
                    <p className="mt-1 text-sm text-slate-500">Manage and respond to staff support tickets.</p>
                </div>

                {flash?.success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{flash.success}</div>}
                {flash?.error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{flash.error}</div>}

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {[
                        { label: 'Open', value: stats.open },
                        { label: 'In Progress', value: stats.in_progress },
                        { label: 'Resolved', value: stats.resolved },
                        { label: 'Closed', value: stats.closed },
                    ].map((stat) => (
                        <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{stat.label}</p>
                            <p className="mt-1 text-2xl font-bold text-slate-900">{stat.value}</p>
                        </div>
                    ))}
                </div>

                <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search ticket or staff..."
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
                    <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                        <option value="">All assignees</option>
                        <option value="unassigned">Unassigned</option>
                        {assignees.map((user) => (
                            <option key={user.id} value={user.id}>{user.name}</option>
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
                                <th className="px-4 py-3">Staff</th>
                                <th className="px-4 py-3">Subject</th>
                                <th className="px-4 py-3">Priority</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Assignee</th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {tickets.data.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                                        No tickets found.
                                    </td>
                                </tr>
                            ) : (
                                tickets.data.map((row) => (
                                    <tr key={row.id}>
                                        <td className="px-4 py-3 font-medium">{row.ticket_number}</td>
                                        <td className="px-4 py-3">
                                            <div>{row.creator?.name || '—'}</div>
                                            <div className="text-xs text-slate-400">{row.creator?.employee_id}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div>{row.subject}</div>
                                            <div className="text-xs text-slate-400">{row.category_label}</div>
                                        </td>
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
                                        <td className="px-4 py-3">{row.assignee?.name || 'Unassigned'}</td>
                                        <td className="px-4 py-3 text-right">
                                            <Link href={route('admin.help-desk.show', row.id)} className="font-medium text-blue-600 hover:underline">
                                                Review
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
