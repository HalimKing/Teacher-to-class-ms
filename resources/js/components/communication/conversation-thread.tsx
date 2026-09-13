import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Link, router, useForm } from '@inertiajs/react';
import { ArrowLeft, ChevronDown, Loader2, Reply, ReplyAll, Send, Users } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { mailboxHref } from './mailbox-layout';
import { CommunicationStatusBadge } from './status-badge';
import {
    type CommunicationCapabilities,
    type CommunicationFolder,
    type CommunicationMessage,
    type CommunicationThread,
    type MailboxPrefix,
} from './types';

function formatDate(value?: string | null): string {
    if (!value) {
        return 'Draft';
    }

    return new Date(value).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
}

function MessageCard({
    message,
    expanded,
    onToggle,
    isLatest,
    canReply,
    canReplyAll,
    onReply,
}: {
    message: CommunicationMessage;
    expanded: boolean;
    onToggle: () => void;
    isLatest: boolean;
    canReply: boolean;
    canReplyAll: boolean;
    onReply: (mode: 'reply' | 'reply_all', parentId: number) => void;
}) {
    const recipientNames = (message.to ?? []).map((item) => item.name).filter(Boolean);

    return (
        <article
            className={cn(
                'overflow-hidden rounded-2xl border border-sidebar-border/70 bg-card transition',
                isLatest && 'ring-1 ring-primary/15',
            )}
        >
            <button
                type="button"
                onClick={onToggle}
                className="flex min-h-14 w-full items-start gap-3 px-3 py-3 text-left hover:bg-sidebar-accent/50 sm:px-4"
            >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {message.sender?.initials ?? '•'}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="break-words font-semibold text-sidebar-foreground">{message.sender?.name ?? 'Unknown sender'}</p>
                        {message.kind === 'reply' || message.kind === 'reply_all' ? (
                            <span className="text-[11px] font-medium uppercase tracking-wide text-sidebar-foreground/45">
                                {message.kind === 'reply_all' ? 'Reply all' : 'Reply'}
                            </span>
                        ) : null}
                        {isLatest && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">Latest</span>
                        )}
                    </div>
                    <p className="mt-0.5 break-words text-xs text-sidebar-foreground/55">
                        To {recipientNames.length > 0 ? recipientNames.join(', ') : (message.audience_summary ?? []).join(' · ') || 'recipients'}
                    </p>
                    {!expanded && <p className="mt-1 truncate text-sm text-sidebar-foreground/60">{message.excerpt || message.body}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs text-sidebar-foreground/50">
                    <span className="hidden sm:inline">{formatDate(message.sent_at ?? message.created_at)}</span>
                    <ChevronDown className={cn('size-4 transition', expanded && 'rotate-180')} />
                </div>
            </button>
            {expanded && (
                <div className="space-y-4 border-t border-sidebar-border/60 px-4 py-4 sm:px-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-sidebar-foreground/55">
                        <span>{formatDate(message.sent_at ?? message.created_at)}</span>
                        <CommunicationStatusBadge status={message.status} label={message.status_label} />
                    </div>
                    {message.in_reply_to && (
                        <div className="rounded-xl border border-sidebar-border/70 bg-sidebar-accent/40 px-3 py-2 text-sm text-sidebar-foreground/70">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/45">
                                In reply to {message.in_reply_to.sender?.name ?? 'previous message'}
                            </p>
                            <p className="mt-1 line-clamp-2">{message.in_reply_to.excerpt}</p>
                        </div>
                    )}
                    <div className="whitespace-pre-wrap break-words text-sm leading-6 text-sidebar-foreground">{message.body}</div>
                    {message.recipients.length > 0 && (
                        <div className="rounded-xl border border-sidebar-border/60 bg-background/60 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/45">Delivery</p>
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                {message.recipients.slice(0, 8).map((recipient) => (
                                    <div key={recipient.id} className="flex items-center justify-between gap-2 text-xs">
                                        <span className="truncate text-sidebar-foreground">{recipient.name}</span>
                                        <CommunicationStatusBadge status={recipient.status} label={recipient.status_label} />
                                    </div>
                                ))}
                            </div>
                            {message.recipients.length > 8 && (
                                <p className="mt-2 text-xs text-sidebar-foreground/50">+{message.recipients.length - 8} more recipients</p>
                            )}
                        </div>
                    )}
                    {canReply && message.status !== 'draft' && (
                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                            <Button type="button" variant="outline" size="sm" className="min-h-11 w-full sm:w-auto" onClick={() => onReply('reply', message.id)}>
                                <Reply className="size-3.5" />
                                Reply
                            </Button>
                            {canReplyAll && (
                                <Button type="button" variant="outline" size="sm" className="min-h-11 w-full sm:w-auto" onClick={() => onReply('reply_all', message.id)}>
                                    <ReplyAll className="size-3.5" />
                                    Reply all
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </article>
    );
}

export function ConversationThreadView({
    prefix,
    folder,
    conversation,
    capabilities,
}: {
    prefix: MailboxPrefix;
    folder: CommunicationFolder;
    conversation: CommunicationThread;
    capabilities: CommunicationCapabilities;
}) {
    const messages = conversation.messages ?? [];
    const latestId = messages[messages.length - 1]?.id;
    const composerRef = useRef<HTMLTextAreaElement | null>(null);
    const [expanded, setExpanded] = useState<Record<number, boolean>>(() => {
        const initial: Record<number, boolean> = {};
        messages.forEach((message, index) => {
            initial[message.id] = index === messages.length - 1 || messages.length <= 2;
        });
        return initial;
    });
    const [mode, setMode] = useState<'reply' | 'reply_all'>('reply');
    const [parentId, setParentId] = useState<number | undefined>(latestId ?? messages[0]?.id);
    const [confirmSend, setConfirmSend] = useState(false);
    const [composerOpen, setComposerOpen] = useState(conversation.can_reply);

    const form = useForm({
        body: '',
    });

    const parentMessage = messages.find((message) => message.id === parentId) ?? messages[messages.length - 1];

    const replyTarget = useMemo(() => {
        if (!parentMessage) {
            return 'this conversation';
        }

        if (mode === 'reply_all') {
            return conversation.participants.map((item) => item.name).join(', ');
        }

        const latestFromOther =
            parentMessage.sender?.id !== conversation.viewer?.id || parentMessage.sender?.type !== conversation.viewer?.type;

        return latestFromOther
            ? parentMessage.sender?.name
            : conversation.participants.find((item) => item.id !== conversation.viewer?.id)?.name;
    }, [conversation.participants, conversation.viewer, mode, parentMessage]);

    const startReply = (nextMode: 'reply' | 'reply_all', nextParentId?: number) => {
        setMode(nextMode);
        setParentId(nextParentId ?? latestId ?? messages[0]?.id);
        setComposerOpen(true);
        window.setTimeout(() => composerRef.current?.focus(), 50);
    };

    const submitReply = () => {
        const body = form.data.body.trim();
        const replyParentId = parentId ?? latestId ?? messages[0]?.id;

        if (!replyParentId) {
            toast.error('There is no message to reply to.');
            return;
        }

        if (body === '') {
            toast.error('Write a reply before sending.');
            return;
        }

        form.transform(() => ({
            parent_id: replyParentId,
            mode,
            body,
        }));
        form.post(route(`${prefix}.communication.reply`, conversation.id), {
            preserveScroll: true,
            onSuccess: () => form.reset('body'),
            onError: (errors) => {
                const message = errors.body || errors.parent_id || errors.mode || 'The reply could not be sent.';
                toast.error(message);
            },
        });
    };

    return (
        <div className="min-w-0 space-y-5 p-3 sm:p-4 md:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <Link
                        href={mailboxHref(prefix, folder)}
                        className="inline-flex min-h-10 items-center gap-1.5 text-sm text-sidebar-foreground/65 hover:text-sidebar-foreground"
                    >
                        <ArrowLeft className="size-4" />
                        Back to {folder === 'all' ? 'All Mail' : folder}
                    </Link>
                    <h1 className="mt-2 text-xl font-semibold tracking-tight break-words text-sidebar-foreground sm:text-2xl">{conversation.subject}</h1>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-sidebar-foreground/65">
                        <Users className="size-3.5 shrink-0" />
                        <span className="min-w-0 break-words">{conversation.participants.map((item) => item.name).join(', ')}</span>
                        <span className="rounded-full bg-sidebar-accent px-2 py-0.5 text-xs">
                            {conversation.message_count} {conversation.message_count === 1 ? 'message' : 'messages'}
                        </span>
                    </div>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                    {conversation.can_reply && (
                        <>
                            <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => startReply('reply')}>
                                <Reply className="size-4" />
                                Reply
                            </Button>
                            {conversation.can_reply_all && (
                                <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => startReply('reply_all')}>
                                    <ReplyAll className="size-4" />
                                    Reply all
                                </Button>
                            )}
                        </>
                    )}
                    {capabilities.can_compose && (
                        <Link
                            href={route(`${prefix}.communication.compose`)}
                            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-sidebar-border px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent"
                        >
                            New message
                        </Link>
                    )}
                </div>
            </div>

            <div className="space-y-3">
                {messages.length > 3 && (
                    <button
                        type="button"
                        onClick={() => {
                            const next: Record<number, boolean> = {};
                            messages.forEach((message) => {
                                next[message.id] = true;
                            });
                            setExpanded(next);
                        }}
                        className="w-full rounded-xl border border-dashed border-sidebar-border px-3 py-2 text-sm text-sidebar-foreground/65 hover:bg-sidebar-accent/60"
                    >
                        Expand all {messages.length} messages
                    </button>
                )}
                {messages.map((message) => (
                    <MessageCard
                        key={message.id}
                        message={message}
                        expanded={Boolean(expanded[message.id])}
                        isLatest={message.id === latestId}
                        canReply={conversation.can_reply}
                        canReplyAll={conversation.can_reply_all}
                        onReply={startReply}
                        onToggle={() =>
                            setExpanded((current) => ({
                                ...current,
                                [message.id]: !current[message.id],
                            }))
                        }
                    />
                ))}
            </div>

            {conversation.can_send_draft && conversation.draft_id && (
                <div className="rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-4 dark:border-amber-900 dark:bg-amber-950/30">
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">This conversation is still a draft.</p>
                    <p className="mt-1 text-sm text-amber-800/80 dark:text-amber-200/70">Send it to deliver the message to the selected audience.</p>
                    <Button className="mt-3" type="button" onClick={() => setConfirmSend(true)}>
                        <Send className="size-4" />
                        Send message
                    </Button>
                    {confirmSend && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                                type="button"
                                onClick={() =>
                                    router.post(route(`${prefix}.communication.send`, conversation.draft_id), {}, { preserveScroll: true })
                                }
                            >
                                Confirm send
                            </Button>
                            <Button type="button" variant="outline" onClick={() => setConfirmSend(false)}>
                                Cancel
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {conversation.can_reply && composerOpen && (
                <section className="rounded-2xl border border-sidebar-border/70 bg-card p-3 sm:p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                        <button
                            type="button"
                            onClick={() => startReply('reply', parentId)}
                            className={cn(
                                'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium',
                                mode === 'reply' ? 'bg-primary text-primary-foreground' : 'bg-sidebar-accent text-sidebar-foreground/75',
                            )}
                        >
                            <Reply className="size-3.5" />
                            Reply
                        </button>
                        {conversation.can_reply_all && (
                            <button
                                type="button"
                                onClick={() => startReply('reply_all', parentId)}
                                className={cn(
                                    'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium',
                                    mode === 'reply_all' ? 'bg-primary text-primary-foreground' : 'bg-sidebar-accent text-sidebar-foreground/75',
                                )}
                            >
                                <ReplyAll className="size-3.5" />
                                Reply all
                            </button>
                        )}
                    </div>
                    <p className="mt-3 break-words text-xs text-sidebar-foreground/55">
                        Replying to {replyTarget || 'this conversation'} · Subject stays “{conversation.subject}”
                    </p>
                    <form
                        className="mt-3 space-y-3"
                        onSubmit={(event) => {
                            event.preventDefault();
                            submitReply();
                        }}
                    >
                        <textarea
                            ref={composerRef}
                            value={form.data.body}
                            onChange={(event) => form.setData('body', event.target.value)}
                            rows={6}
                            placeholder="Write your reply..."
                            className="min-h-32 w-full rounded-xl border border-sidebar-border/80 bg-background px-3 py-2.5 text-base text-sidebar-foreground outline-none ring-primary/20 placeholder:text-sidebar-foreground/40 focus:ring-2 md:text-sm"
                        />
                        {form.errors.body && <p className="text-sm text-rose-600">{form.errors.body}</p>}
                        <div className="flex justify-end">
                            <Button type="submit" disabled={form.processing} className="min-h-11 w-full sm:w-auto">
                                {form.processing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                                Send reply
                            </Button>
                        </div>
                    </form>
                </section>
            )}
        </div>
    );
}
