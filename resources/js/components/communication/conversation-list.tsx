import { cn } from '@/lib/utils';
import { Link, router } from '@inertiajs/react';
import { Inbox, Loader2, Search, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    type CommunicationFolder,
    type MailboxPrefix,
    type PaginatedConversations,
} from './types';

function formatMailboxDate(value?: string | null): string {
    if (!value) {
        return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    }

    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
    });
}

export function ConversationFilters({
    action,
    filters,
}: {
    action: string;
    filters: { search?: string; from?: string; to?: string; unread?: string | boolean };
}) {
    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                router.get(action, Object.fromEntries(data.entries()), { preserveState: true, replace: true });
            }}
            className="grid grid-cols-1 gap-3 rounded-2xl border border-sidebar-border/70 bg-card p-3 sm:flex sm:flex-row sm:flex-wrap sm:items-center"
        >
            <label className="relative min-w-0 flex-1 sm:min-w-[14rem]">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-sidebar-foreground/40" />
                <input
                    name="search"
                    defaultValue={filters.search || ''}
                    placeholder="Search subject, people, or message text"
                    className="h-11 w-full rounded-xl border border-sidebar-border/80 bg-background py-2 pl-9 pr-3 text-base text-sidebar-foreground outline-none ring-primary/20 placeholder:text-sidebar-foreground/45 focus:ring-2 md:text-sm"
                />
            </label>
            <input
                name="from"
                type="date"
                defaultValue={filters.from || ''}
                className="h-11 w-full min-w-0 rounded-xl border border-sidebar-border/80 bg-background px-3 py-2 text-base text-sidebar-foreground sm:w-auto md:text-sm"
            />
            <input
                name="to"
                type="date"
                defaultValue={filters.to || ''}
                className="h-11 w-full min-w-0 rounded-xl border border-sidebar-border/80 bg-background px-3 py-2 text-base text-sidebar-foreground sm:w-auto md:text-sm"
            />
            <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-sidebar-border/80 px-3 py-2 text-sm text-sidebar-foreground/80">
                <input name="unread" type="checkbox" value="1" defaultChecked={Boolean(filters.unread)} className="size-4 accent-primary" />
                Unread
            </label>
            <button type="submit" className="min-h-11 w-full rounded-xl bg-sidebar-foreground px-4 py-2 text-sm font-semibold text-sidebar sm:w-auto dark:bg-white dark:text-neutral-950">
                Search
            </button>
        </form>
    );
}

export function ConversationList({
    prefix,
    folder,
    conversations,
    emptyTitle,
    emptyDescription,
}: {
    prefix: MailboxPrefix;
    folder: CommunicationFolder;
    conversations: PaginatedConversations;
    emptyTitle: string;
    emptyDescription: string;
}) {
    const [loading, setLoading] = useState(false);
    const rows = conversations.data ?? [];

    useEffect(() => {
        const removeStart = router.on('start', () => setLoading(true));
        const removeFinish = router.on('finish', () => setLoading(false));

        return () => {
            removeStart();
            removeFinish();
        };
    }, []);

    if (rows.length === 0) {
        return (
            <div className="rounded-2xl border border-dashed border-sidebar-border bg-card px-6 py-16 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Inbox className="size-5" />
                </div>
                <p className="mt-4 text-base font-semibold text-sidebar-foreground">{emptyTitle}</p>
                <p className="mt-1 text-sm text-sidebar-foreground/60">{emptyDescription}</p>
            </div>
        );
    }

    return (
        <div className="relative overflow-hidden rounded-2xl border border-sidebar-border/70 bg-card">
            {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
                    <Loader2 className="size-5 animate-spin text-primary" />
                </div>
            )}
            <div className="divide-y divide-sidebar-border/60">
                {rows.map((conversation) => (
                    <Link
                        key={conversation.id}
                        href={`${route(`${prefix}.communication.thread`, conversation.id)}?from=${folder}`}
                        className={cn(
                            'group grid gap-2 px-4 py-3.5 transition hover:bg-sidebar-accent/70 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_auto] sm:items-center',
                            conversation.unread && 'bg-primary/[0.04]',
                        )}
                    >
                        <div className="flex min-w-0 items-center gap-3">
                            <span
                                className={cn(
                                    'size-2 shrink-0 rounded-full',
                                    conversation.unread ? 'bg-primary' : 'bg-transparent',
                                )}
                            />
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                {conversation.from?.initials ?? conversation.participants[0]?.initials ?? '•'}
                            </div>
                            <div className="min-w-0">
                                <p
                                    className={cn(
                                        'truncate text-sm text-sidebar-foreground',
                                        conversation.unread ? 'font-semibold' : 'font-medium',
                                    )}
                                >
                                    {conversation.participant_label}
                                </p>
                                <p className="truncate text-xs text-sidebar-foreground/50 sm:hidden">{formatMailboxDate(conversation.last_message_at)}</p>
                            </div>
                        </div>
                        <div className="min-w-0 pl-7 sm:pl-0">
                            <div className="flex items-center gap-2">
                                {conversation.is_important && <Star className="size-3.5 fill-amber-400 text-amber-400" />}
                                <p
                                    className={cn(
                                        'truncate text-sm text-sidebar-foreground',
                                        conversation.unread ? 'font-semibold' : 'font-medium',
                                    )}
                                >
                                    {conversation.subject}
                                </p>
                                {conversation.message_count > 1 && (
                                    <span className="shrink-0 rounded-full bg-sidebar-accent px-1.5 text-[11px] font-medium text-sidebar-foreground/70">
                                        {conversation.message_count}
                                    </span>
                                )}
                                {conversation.has_draft && (
                                    <span className="shrink-0 text-[11px] font-semibold text-amber-600 dark:text-amber-300">Draft</span>
                                )}
                            </div>
                            <p className="mt-0.5 truncate text-sm text-sidebar-foreground/55">{conversation.preview || 'No message preview'}</p>
                        </div>
                        <div className="hidden text-right text-xs text-sidebar-foreground/50 sm:block">
                            {formatMailboxDate(conversation.last_message_at)}
                        </div>
                    </Link>
                ))}
            </div>
            {conversations.links && conversations.links.length > 3 && (
                <div className="flex flex-col gap-2 border-t border-sidebar-border/60 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                    <p className="text-xs text-sidebar-foreground/50">{conversations.total ?? rows.length} conversations</p>
                    <div className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1 pb-0.5">
                        {conversations.links.map((link, index) => (
                            <button
                                key={`${link.label}-${index}`}
                                disabled={!link.url}
                                onClick={() => link.url && router.get(link.url, {}, { preserveState: true })}
                                className={cn(
                                    'min-h-9 shrink-0 rounded-md px-2.5 py-1 text-xs',
                                    link.active
                                        ? 'bg-sidebar-foreground text-sidebar dark:bg-white dark:text-neutral-950'
                                        : 'border border-sidebar-border text-sidebar-foreground/70 hover:bg-sidebar-accent disabled:opacity-40',
                                )}
                                dangerouslySetInnerHTML={{ __html: link.label }}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
