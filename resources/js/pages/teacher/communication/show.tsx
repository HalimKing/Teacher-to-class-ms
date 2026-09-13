import { CommunicationStatusBadge } from '@/components/communication/status-badge';
import { type CommunicationCapabilities, type CommunicationMessage } from '@/components/communication/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type PagePropsWithFlash } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, CalendarDays, Loader2, Mail, Send, UserRound, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Bounce, ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface PageProps extends PagePropsWithFlash {
    message: CommunicationMessage;
    capabilities: CommunicationCapabilities;
}

function formatDate(value?: string | null): string {
    if (!value) {
        return 'Draft';
    }

    return new Date(value).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
}

export default function TeacherCommunicationShow({ message, capabilities }: PageProps) {
    const { flash } = usePage().props as PageProps;
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [sending, setSending] = useState(false);
    const isDraft = message.status === 'draft';
    const isSenderView = isDraft || (message.recipients?.length ?? 0) > 0;
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/teacher/dashboard' },
        { title: 'Communication', href: '/teacher/communication/inbox' },
        { title: message.subject, href: `/teacher/communication/${message.id}` },
    ];

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, []);

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success, { theme: 'dark', transition: Bounce });
        }
        if (flash?.error) {
            toast.error(flash.error, { theme: 'dark', transition: Bounce });
        }
    }, [flash?.success, flash?.error]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={message.subject} />
            <ToastContainer />
            <div className="mx-auto max-w-5xl min-w-0 space-y-6 p-3 sm:p-4 md:p-6 lg:p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                            <Mail className="size-3.5" />
                            {isDraft ? 'Draft' : isSenderView ? 'Sent message' : 'Inbox'}
                        </div>
                        <h1 className="mt-3 text-xl font-semibold tracking-tight break-words text-sidebar-foreground sm:text-3xl">{message.subject}</h1>
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-sidebar-foreground/65">
                            <span className="inline-flex items-center gap-1.5">
                                <UserRound className="size-3.5" />
                                {message.sender?.name ?? 'Unknown sender'}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <CalendarDays className="size-3.5" />
                                {formatDate(message.sent_at ?? message.created_at)}
                            </span>
                            {isSenderView && (
                                <span className="inline-flex items-center gap-1.5">
                                    <Users className="size-3.5" />
                                    {message.recipient_count} recipients
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                        <CommunicationStatusBadge status={message.status} label={message.status_label} />
                        {isDraft && capabilities.can_send && (
                            <Button type="button" className="min-h-11 w-full sm:w-auto" onClick={() => setConfirmOpen(true)} disabled={sending}>
                                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                                Send message
                            </Button>
                        )}
                        <Link
                            href={isSenderView ? route('teacher.communication.sent') : route('teacher.communication.inbox')}
                            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground"
                        >
                            <ArrowLeft className="size-4" />
                            {isDraft || isSenderView ? 'Back to sent' : 'Back to inbox'}
                        </Link>
                    </div>
                </div>

                <section className="rounded-2xl border border-sidebar-border/70 bg-white p-5 shadow-sm dark:bg-sidebar-accent sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-semibold text-sidebar-foreground">Audience</h2>
                            <p className="mt-1 text-sm text-sidebar-foreground/60">
                                {isDraft ? 'Who will receive this message when you send it.' : 'Who this message was sent to.'}
                            </p>
                        </div>
                        {message.viewer_status && (
                            <CommunicationStatusBadge
                                status={message.viewer_status}
                                label={message.viewer_read_at ? 'Read' : 'Delivered'}
                            />
                        )}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                        {(message.audience_summary ?? []).length > 0 ? (
                            message.audience_summary.map((group) => (
                                <span
                                    key={group}
                                    className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-sidebar-foreground/75"
                                >
                                    {group}
                                </span>
                            ))
                        ) : (
                            <span className="text-sm text-sidebar-foreground/55">No audience summary available.</span>
                        )}
                    </div>
                    <div className="mt-5 whitespace-pre-wrap break-words rounded-xl bg-muted/40 px-4 py-4 text-sm leading-7 text-sidebar-foreground">
                        {message.body}
                    </div>
                </section>

                {isSenderView && (
                    <section className="overflow-hidden rounded-2xl border border-sidebar-border/70 bg-white shadow-sm dark:bg-sidebar-accent">
                        <div className="grid gap-3 border-b border-sidebar-border/60 p-5 sm:grid-cols-3">
                            {[
                                { label: 'Recipients', value: message.recipient_count },
                                { label: 'Delivered', value: message.delivered_count },
                                { label: 'Read', value: message.read_count },
                            ].map((stat) => (
                                <div key={stat.label} className="rounded-xl bg-muted/40 px-4 py-3">
                                    <p className="text-xs font-medium tracking-wide text-sidebar-foreground/55 uppercase">{stat.label}</p>
                                    <p className="mt-1 text-2xl font-semibold text-sidebar-foreground">{stat.value}</p>
                                </div>
                            ))}
                        </div>
                        <div className="divide-y divide-sidebar-border/50 md:hidden">
                            {message.recipients.map((recipient) => (
                                <div key={recipient.id} className="flex items-start justify-between gap-3 px-4 py-3">
                                    <div className="min-w-0">
                                        <p className="truncate font-medium text-sidebar-foreground">{recipient.name}</p>
                                        <p className="truncate text-xs text-sidebar-foreground/55">
                                            {[recipient.employee_id, recipient.department, recipient.faculty].filter(Boolean).join(' · ') || '—'}
                                        </p>
                                    </div>
                                    <CommunicationStatusBadge status={recipient.status} label={recipient.status_label} />
                                </div>
                            ))}
                        </div>
                        <div className="hidden overflow-x-auto md:block">
                            <table className="min-w-full divide-y divide-sidebar-border/60 text-sm">
                                <thead className="bg-muted/40 text-left text-xs font-semibold tracking-wide text-sidebar-foreground/55 uppercase">
                                    <tr>
                                        <th className="px-5 py-3">Staff</th>
                                        <th className="px-5 py-3">Unit</th>
                                        <th className="px-5 py-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-sidebar-border/50">
                                    {message.recipients.map((recipient) => (
                                        <tr key={recipient.id} className="hover:bg-muted/30">
                                            <td className="px-5 py-3">
                                                <p className="font-medium text-sidebar-foreground">{recipient.name}</p>
                                                {recipient.employee_id && (
                                                    <p className="text-xs text-sidebar-foreground/55">{recipient.employee_id}</p>
                                                )}
                                            </td>
                                            <td className="px-5 py-3 text-sidebar-foreground/70">
                                                {[recipient.department, recipient.faculty].filter(Boolean).join(' · ') || '—'}
                                            </td>
                                            <td className="px-5 py-3">
                                                <CommunicationStatusBadge status={recipient.status} label={recipient.status_label} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}
            </div>

            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Send this draft?</DialogTitle>
                        <DialogDescription>
                            The saved audience will be notified. Confirm the subject and recipient count before sending.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 rounded-xl border border-sidebar-border/70 bg-muted/40 p-4 text-sm">
                        <p>
                            <span className="font-medium text-sidebar-foreground">Subject:</span>{' '}
                            <span className="text-sidebar-foreground/70">{message.subject}</span>
                        </p>
                        <p>
                            <span className="font-medium text-sidebar-foreground">Recipients:</span>{' '}
                            <span className="text-sidebar-foreground/70">{message.recipient_count} staff</span>
                        </p>
                        {(message.audience_summary ?? []).length > 0 && (
                            <p className="text-xs leading-5 text-sidebar-foreground/60">{message.audience_summary.join(' · ')}</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => setConfirmOpen(false)}>
                            Keep as draft
                        </Button>
                        <Button
                            type="button"
                            disabled={sending}
                            className="min-h-11 w-full sm:w-auto"
                            onClick={() => {
                                setSending(true);
                                router.post(
                                    route('teacher.communication.send', message.id),
                                    {},
                                    {
                                        onError: () => {
                                            setSending(false);
                                            toast.error('Unable to send this draft. Check the audience and try again.', {
                                                theme: 'dark',
                                                transition: Bounce,
                                            });
                                        },
                                        onFinish: () => setSending(false),
                                    },
                                );
                                setConfirmOpen(false);
                            }}
                        >
                            Confirm send
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
