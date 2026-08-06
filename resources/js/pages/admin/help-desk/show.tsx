import AppLayout from '@/layouts/app-layout';
import { can } from '@/lib/can';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { FormEvent } from 'react';

interface Comment {
    id: number;
    body: string;
    author_name: string;
    author_role: string;
    attachment_name?: string | null;
    attachment_url?: string | null;
    attachment_preview_url?: string | null;
    created_at?: string;
}

interface Activity {
    id: number;
    action: string;
    from_value?: string | null;
    to_value?: string | null;
    actor_name?: string | null;
    created_at?: string;
}

interface Ticket {
    id: number;
    ticket_number: string;
    subject: string;
    description: string;
    category_label: string;
    priority_label: string;
    status: string;
    status_label: string;
    creator?: { name?: string; employee_id?: string; email?: string } | null;
    assignee?: { id: number; name: string } | null;
    attachment_name?: string | null;
    attachment_url?: string | null;
    attachment_preview_url?: string | null;
    created_at?: string;
    comments: Comment[];
    activities: Activity[];
}

interface PageProps {
    ticket: Ticket;
    statuses: Record<string, string>;
    assignees: Array<{ id: number; name: string }>;
    flash?: { success?: string; error?: string };
}

const breadcrumbs = (ticketId: number): BreadcrumbItem[] => [
    { title: 'Dashboard', href: '/admin/dashboard' },
    { title: 'Help Desk', href: '/admin/help-desk' },
    { title: 'Ticket', href: `/admin/help-desk/${ticketId}` },
];

const statusBadge = (status: string) => {
    if (status === 'open') return 'bg-sky-100 text-sky-800';
    if (status === 'in_progress') return 'bg-amber-100 text-amber-800';
    if (status === 'resolved') return 'bg-emerald-100 text-emerald-800';
    return 'bg-slate-100 text-slate-700';
};

export default function AdminHelpDeskShow({ ticket, statuses, assignees }: PageProps) {
    const { flash } = usePage().props as PageProps;
    const canManage = can('admin.help-desk.manage');

    const assignForm = useForm({
        assigned_to: ticket.assignee?.id ? String(ticket.assignee.id) : '',
    });
    const statusForm = useForm({
        status: ticket.status,
    });
    const replyForm = useForm<{ body: string; attachment: File | null }>({
        body: '',
        attachment: null,
    });

    const submitAssign = (event: FormEvent) => {
        event.preventDefault();
        assignForm.post(route('admin.help-desk.assign', ticket.id));
    };

    const submitStatus = (event: FormEvent) => {
        event.preventDefault();
        statusForm.post(route('admin.help-desk.status', ticket.id));
    };

    const submitReply = (event: FormEvent) => {
        event.preventDefault();
        replyForm.post(route('admin.help-desk.comment', ticket.id), {
            forceFormData: true,
            onSuccess: () => replyForm.reset('body', 'attachment'),
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs(ticket.id)}>
            <Head title={ticket.ticket_number} />
            <div className="space-y-6 p-4 md:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <p className="text-sm font-medium text-slate-500">{ticket.ticket_number}</p>
                        <h1 className="text-2xl font-bold text-slate-900">{ticket.subject}</h1>
                        <div className="mt-2 flex flex-wrap gap-2">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge(ticket.status)}`}>
                                {ticket.status_label}
                            </span>
                            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                                {ticket.priority_label}
                            </span>
                            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                                {ticket.category_label}
                            </span>
                        </div>
                    </div>
                    <Link href={route('admin.help-desk.index')} className="rounded-lg border px-4 py-2 text-sm">
                        Back to list
                    </Link>
                </div>

                {flash?.success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{flash.success}</div>}
                {flash?.error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{flash.error}</div>}

                <div className="grid gap-6 lg:grid-cols-3">
                    <div className="space-y-6 lg:col-span-2">
                        <div className="rounded-xl border border-slate-200 bg-white p-5">
                            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Requester</h2>
                            <p className="mt-2 text-sm font-medium text-slate-900">{ticket.creator?.name || '—'}</p>
                            <p className="text-xs text-slate-500">{ticket.creator?.employee_id} · {ticket.creator?.email}</p>
                            <h2 className="mt-5 text-sm font-semibold uppercase tracking-wide text-slate-500">Description</h2>
                            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-800">{ticket.description}</p>
                            {ticket.attachment_preview_url && (
                                <a href={ticket.attachment_preview_url} target="_blank" rel="noopener noreferrer" className="mt-3 block">
                                    <img
                                        src={ticket.attachment_preview_url}
                                        alt={ticket.attachment_name || 'Attachment'}
                                        className="max-h-96 max-w-full rounded-lg border border-slate-200 object-contain"
                                    />
                                </a>
                            )}
                            {ticket.attachment_url && (
                                <a href={ticket.attachment_url} className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline">
                                    {ticket.attachment_preview_url ? 'Download attachment' : 'View attachment'}
                                    {ticket.attachment_name ? `: ${ticket.attachment_name}` : ''}
                                </a>
                            )}
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-5">
                            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Conversation</h2>
                            <div className="mt-4 space-y-4">
                                {ticket.comments.length === 0 ? (
                                    <p className="text-sm text-slate-400">No replies yet.</p>
                                ) : (
                                    ticket.comments.map((comment) => (
                                        <div key={comment.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-sm font-medium text-slate-800">
                                                    {comment.author_name} <span className="text-slate-400">· {comment.author_role}</span>
                                                </p>
                                                <p className="text-xs text-slate-400">{comment.created_at}</p>
                                            </div>
                                            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{comment.body}</p>
                                            {comment.attachment_preview_url && (
                                                <a href={comment.attachment_preview_url} target="_blank" rel="noopener noreferrer" className="mt-2 block">
                                                    <img
                                                        src={comment.attachment_preview_url}
                                                        alt={comment.attachment_name || 'Attachment'}
                                                        className="max-h-48 max-w-full rounded-lg border border-slate-200 object-contain"
                                                    />
                                                </a>
                                            )}
                                            {comment.attachment_url && (
                                                <a href={comment.attachment_url} className="mt-2 inline-block text-xs font-medium text-blue-600 hover:underline">
                                                    {comment.attachment_preview_url ? 'Download attachment' : 'Attachment'}
                                                    {comment.attachment_name ? `: ${comment.attachment_name}` : ''}
                                                </a>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>

                            {canManage && ticket.status !== 'closed' && (
                                <form onSubmit={submitReply} className="mt-5 space-y-3 border-t border-slate-100 pt-5">
                                    <textarea
                                        value={replyForm.data.body}
                                        onChange={(e) => replyForm.setData('body', e.target.value)}
                                        rows={4}
                                        placeholder="Write a support reply..."
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                        required
                                    />
                                    {replyForm.errors.body && <p className="text-sm text-rose-600">{replyForm.errors.body}</p>}
                                    <input
                                        type="file"
                                        onChange={(e) => replyForm.setData('attachment', e.target.files?.[0] || null)}
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                    />
                                    <button
                                        type="submit"
                                        disabled={replyForm.processing}
                                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                                    >
                                        {replyForm.processing ? 'Sending...' : 'Send reply'}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>

                    <div className="space-y-6">
                        {canManage && (
                            <>
                                <form onSubmit={submitAssign} className="rounded-xl border border-slate-200 bg-white p-5">
                                    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Assign</h2>
                                    <select
                                        value={assignForm.data.assigned_to}
                                        onChange={(e) => assignForm.setData('assigned_to', e.target.value)}
                                        className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                    >
                                        <option value="">Unassigned</option>
                                        {assignees.map((user) => (
                                            <option key={user.id} value={user.id}>{user.name}</option>
                                        ))}
                                    </select>
                                    <button
                                        type="submit"
                                        disabled={assignForm.processing}
                                        className="mt-3 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                                    >
                                        Save assignment
                                    </button>
                                </form>

                                <form onSubmit={submitStatus} className="rounded-xl border border-slate-200 bg-white p-5">
                                    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Status</h2>
                                    <select
                                        value={statusForm.data.status}
                                        onChange={(e) => statusForm.setData('status', e.target.value)}
                                        className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                    >
                                        {Object.entries(statuses).map(([value, label]) => (
                                            <option key={value} value={value}>{label}</option>
                                        ))}
                                    </select>
                                    <button
                                        type="submit"
                                        disabled={statusForm.processing}
                                        className="mt-3 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                                    >
                                        Update status
                                    </button>
                                </form>
                            </>
                        )}

                        <div className="rounded-xl border border-slate-200 bg-white p-5">
                            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Activity</h2>
                            <div className="mt-4 space-y-3">
                                {ticket.activities.map((activity) => (
                                    <div key={activity.id} className="text-sm">
                                        <p className="font-medium capitalize text-slate-800">
                                            {activity.action.replace(/_/g, ' ')}
                                            {activity.from_value || activity.to_value
                                                ? `: ${activity.from_value || '—'} → ${activity.to_value || '—'}`
                                                : ''}
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            {activity.actor_name || 'System'} · {activity.created_at}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
