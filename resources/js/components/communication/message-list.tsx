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

function formatMessageDate(value?: string | null): string {
    if (!value) {
        return '—';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '—';
    }

    return date.toLocaleString();
}

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
            <div className="rounded-xl border border-dashed border-sidebar-border bg-card px-6 py-16 text-center">
                <p className="text-base font-semibold text-sidebar-foreground">{emptyTitle}</p>
                <p className="mt-1 text-sm text-sidebar-foreground/55">{emptyDescription}</p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-xl border border-sidebar-border/70 bg-card">
            <div className="divide-y divide-sidebar-border/60 md:hidden">
                {rows.map((message: CommunicationMessage) => (
                    <Link key={message.id} href={showHref(message.id)} className="block min-w-0 px-4 py-3.5 hover:bg-sidebar-accent/60">
                        <div className="flex items-start justify-between gap-3">
                            <p className="min-w-0 truncate font-medium text-sidebar-foreground">{message.subject}</p>
                            <CommunicationStatusBadge status={message.status} label={message.status_label} />
                        </div>
                        <p className="mt-1 truncate text-sm text-sidebar-foreground/60">
                            {(message.audience_summary ?? []).slice(0, 2).join(' · ') || '—'}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-sidebar-foreground/50">
                            <span>{showSender ? message.sender?.name ?? '—' : formatMessageDate(message.sent_at ?? message.created_at)}</span>
                            <span>{message.recipient_count} recipients</span>
                        </div>
                    </Link>
                ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full divide-y divide-sidebar-border/60 text-sm">
                    <thead className="bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/55">
                        <tr>
                            <th className="px-4 py-3">Subject</th>
                            <th className="px-4 py-3">Audience</th>
                            {showSender && <th className="px-4 py-3">Sender</th>}
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Recipients</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-sidebar-border/50">
                        {rows.map((message: CommunicationMessage) => (
                            <tr key={message.id} className="hover:bg-sidebar-accent/40">
                                <td className="px-4 py-3">
                                    <Link href={showHref(message.id)} className="font-medium text-sidebar-foreground hover:underline">
                                        {message.subject}
                                    </Link>
                                </td>
                                <td className="px-4 py-3 text-sidebar-foreground/70">
                                    {(message.audience_summary ?? []).slice(0, 2).join(' · ') || '—'}
                                </td>
                                {showSender && <td className="px-4 py-3 text-sidebar-foreground/70">{message.sender?.name ?? '—'}</td>}
                                <td className="whitespace-nowrap px-4 py-3 text-sidebar-foreground/55">
                                    {formatMessageDate(message.sent_at ?? message.created_at)}
                                </td>
                                <td className="px-4 py-3">
                                    <CommunicationStatusBadge status={message.status} label={message.status_label} />
                                </td>
                                <td className="px-4 py-3 text-right font-medium text-sidebar-foreground">{message.recipient_count}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {messages.links && messages.links.length > 3 && (
                <div className="flex flex-col gap-2 border-t border-sidebar-border/60 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                    <p className="text-xs text-sidebar-foreground/50">{messages.total ?? rows.length} messages</p>
                    <div className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1">
                        {messages.links.map((link, index) => (
                            <button
                                key={`${link.label}-${index}`}
                                disabled={!link.url}
                                onClick={() => link.url && router.get(link.url, {}, { preserveState: true })}
                                className={`min-h-9 shrink-0 rounded-md px-2.5 py-1 text-xs ${
                                    link.active
                                        ? 'bg-sidebar-foreground text-sidebar dark:bg-white dark:text-neutral-950'
                                        : 'border border-sidebar-border text-sidebar-foreground/70 hover:bg-sidebar-accent disabled:opacity-40'
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
            className="grid grid-cols-1 gap-3 rounded-xl border border-sidebar-border/70 bg-card p-3 sm:flex sm:flex-wrap sm:p-4"
        >
            <input
                name="search"
                defaultValue={filters.search || ''}
                placeholder="Search subject or message..."
                className="h-11 min-w-0 flex-1 rounded-lg border border-sidebar-border/80 bg-background px-3 py-2 text-base text-sidebar-foreground sm:min-w-[12rem] md:text-sm"
            />
            {statuses && (
                <select
                    name="status"
                    defaultValue={filters.status || ''}
                    className="h-11 w-full rounded-lg border border-sidebar-border/80 bg-background px-3 py-2 text-base text-sidebar-foreground sm:w-auto md:text-sm"
                >
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
                    className="h-11 w-full rounded-lg border border-sidebar-border/80 bg-background px-3 py-2 text-base text-sidebar-foreground sm:w-auto md:text-sm"
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
            <input
                name="from"
                type="date"
                defaultValue={filters.from || ''}
                className="h-11 w-full min-w-0 rounded-lg border border-sidebar-border/80 bg-background px-3 py-2 text-base text-sidebar-foreground sm:w-auto md:text-sm"
            />
            <input
                name="to"
                type="date"
                defaultValue={filters.to || ''}
                className="h-11 w-full min-w-0 rounded-lg border border-sidebar-border/80 bg-background px-3 py-2 text-base text-sidebar-foreground sm:w-auto md:text-sm"
            />
            <button
                type="submit"
                className="min-h-11 w-full rounded-lg bg-sidebar-foreground px-4 py-2 text-sm font-semibold text-sidebar sm:w-auto dark:bg-white dark:text-neutral-950"
            >
                Filter
            </button>
        </form>
    );
}
