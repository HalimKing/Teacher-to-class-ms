import { CommunicationStatusBadge } from '@/components/communication/status-badge';
import { type CommunicationMessage, type PaginatedMessages } from '@/components/communication/types';
import { Link, router } from '@inertiajs/react';

type Filters = {
    search?: string;
    status?: string;
    from?: string;
    to?: string;
    recipient_type?: string;
};

export function CommunicationMessageList({
    messages,
    emptyTitle,
    emptyDescription,
    showHref,
    showSender = false,
}: {
    messages: PaginatedMessages;
    emptyTitle: string;
    emptyDescription: string;
    showHref: (id: number) => string;
    showSender?: boolean;
}) {
    const rows = messages.data ?? [];

    if (rows.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
                <p className="text-base font-semibold text-slate-900">{emptyTitle}</p>
                <p className="mt-1 text-sm text-slate-500">{emptyDescription}</p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-4 py-3">Subject</th>
                            <th className="px-4 py-3">Audience</th>
                            {showSender && <th className="px-4 py-3">Sender</th>}
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Recipients</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {rows.map((message: CommunicationMessage) => (
                            <tr key={message.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3">
                                    <Link href={showHref(message.id)} className="font-medium text-slate-900 hover:underline">
                                        {message.subject}
                                    </Link>
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                    {(message.audience_summary ?? []).slice(0, 2).join(' · ') || '—'}
                                </td>
                                {showSender && <td className="px-4 py-3 text-slate-600">{message.sender?.name ?? '—'}</td>}
                                <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                                    {message.sent_at ? new Date(message.sent_at).toLocaleString() : new Date(message.created_at ?? '').toLocaleString()}
                                </td>
                                <td className="px-4 py-3">
                                    <CommunicationStatusBadge status={message.status} label={message.status_label} />
                                </td>
                                <td className="px-4 py-3 text-right font-medium text-slate-900">{message.recipient_count}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {messages.links && messages.links.length > 3 && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
                    <p className="text-xs text-slate-500">{messages.total ?? rows.length} messages</p>
                    <div className="flex flex-wrap gap-1">
                        {messages.links.map((link, index) => (
                            <button
                                key={`${link.label}-${index}`}
                                disabled={!link.url}
                                onClick={() => link.url && router.get(link.url, {}, { preserveState: true })}
                                className={`rounded-md px-2.5 py-1 text-xs ${
                                    link.active
                                        ? 'bg-slate-900 text-white'
                                        : 'border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40'
                                }`}
                                dangerouslySetInnerHTML={{ __html: link.label }}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export function CommunicationFilters({
    action,
    filters,
    statuses,
    showRecipientType = false,
}: {
    action: string;
    filters: Filters;
    statuses?: Record<string, string>;
    showRecipientType?: boolean;
}) {
    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                router.get(action, Object.fromEntries(data.entries()), { preserveState: true, replace: true });
            }}
            className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4"
        >
            <input
                name="search"
                defaultValue={filters.search || ''}
                placeholder="Search subject or message..."
                className="min-w-[12rem] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            {statuses && (
                <select name="status" defaultValue={filters.status || ''} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <option value="">All statuses</option>
                    {Object.entries(statuses).map(([value, label]) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </select>
            )}
            {showRecipientType && (
                <select
                    name="recipient_type"
                    defaultValue={filters.recipient_type || ''}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                    <option value="">All recipient types</option>
                    <option value="all_faculties">All faculties</option>
                    <option value="faculty">Selected faculties</option>
                    <option value="all_departments">All departments</option>
                    <option value="department">Selected departments</option>
                    <option value="all_staff">All staff</option>
                    <option value="staff">Selected staff</option>
                </select>
            )}
            <input name="from" type="date" defaultValue={filters.from || ''} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <input name="to" type="date" defaultValue={filters.to || ''} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                Filter
            </button>
        </form>
    );
}
