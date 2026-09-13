import { CommunicationStatusBadge } from '@/components/communication/status-badge';
import { type CommunicationCapabilities, type CommunicationMessage } from '@/components/communication/types';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';

interface PageProps {
    message: CommunicationMessage;
    capabilities: CommunicationCapabilities;
    flash?: { success?: string; error?: string };
}

export default function AdminCommunicationShow({ message }: PageProps) {
    const { flash } = usePage().props as PageProps;
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/admin/dashboard' },
        { title: 'Communication', href: '/admin/communication' },
        { title: message.subject, href: `/admin/communication/${message.id}` },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={message.subject} />
            <div className="mx-auto max-w-5xl min-w-0 space-y-6 p-3 sm:p-4 md:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <h1 className="text-xl font-bold break-words text-sidebar-foreground sm:text-2xl">{message.subject}</h1>
                        <p className="mt-1 text-sm text-sidebar-foreground/60">
                            {message.sent_at ? new Date(message.sent_at).toLocaleString() : 'Draft'} · {message.recipient_count} recipients
                        </p>
                    </div>
                    <CommunicationStatusBadge status={message.status} label={message.status_label} />
                </div>

                {flash?.success && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
                        {flash.success}
                    </div>
                )}
                {flash?.error && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
                        {flash.error}
                    </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                    <div className="min-w-0 rounded-xl border border-sidebar-border/70 bg-card p-3 sm:p-4">
                        <p className="text-[11px] uppercase tracking-wide text-sidebar-foreground/55 sm:text-xs">Recipients</p>
                        <p className="mt-1 text-xl font-bold text-sidebar-foreground sm:text-2xl">{message.recipient_count}</p>
                    </div>
                    <div className="min-w-0 rounded-xl border border-sidebar-border/70 bg-card p-3 sm:p-4">
                        <p className="text-[11px] uppercase tracking-wide text-sidebar-foreground/55 sm:text-xs">Delivered</p>
                        <p className="mt-1 text-xl font-bold text-sidebar-foreground sm:text-2xl">{message.delivered_count}</p>
                    </div>
                    <div className="min-w-0 rounded-xl border border-sidebar-border/70 bg-card p-3 sm:p-4">
                        <p className="text-[11px] uppercase tracking-wide text-sidebar-foreground/55 sm:text-xs">Read</p>
                        <p className="mt-1 text-xl font-bold text-sidebar-foreground sm:text-2xl">{message.read_count}</p>
                    </div>
                </div>

                <section className="rounded-xl border border-sidebar-border/70 bg-card p-4 sm:p-5">
                    <h2 className="text-sm font-semibold text-sidebar-foreground">Audience</h2>
                    <p className="mt-2 break-words text-sm text-sidebar-foreground/70">{(message.audience_summary ?? []).join(' · ') || '—'}</p>
                    <div className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-sidebar-foreground">{message.body}</div>
                </section>

                <section className="overflow-hidden rounded-xl border border-sidebar-border/70 bg-card">
                    <div className="border-b border-sidebar-border/60 px-4 py-3 text-sm font-semibold text-sidebar-foreground">Recipient details</div>
                    {message.recipients.length === 0 ? (
                        <p className="px-4 py-8 text-sm text-sidebar-foreground/55">No individual recipients are stored for this draft.</p>
                    ) : (
                        <>
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
                                    <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-sidebar-foreground/55">
                                        <tr>
                                            <th className="px-4 py-2">Staff</th>
                                            <th className="px-4 py-2">Unit</th>
                                            <th className="px-4 py-2">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-sidebar-border/50">
                                        {message.recipients.map((recipient) => (
                                            <tr key={recipient.id}>
                                                <td className="px-4 py-2">
                                                    <p className="font-medium text-sidebar-foreground">{recipient.name}</p>
                                                    <p className="text-xs text-sidebar-foreground/55">{recipient.employee_id}</p>
                                                </td>
                                                <td className="px-4 py-2 text-sidebar-foreground/70">
                                                    {[recipient.department, recipient.faculty].filter(Boolean).join(' · ')}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <CommunicationStatusBadge status={recipient.status} label={recipient.status_label} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </section>

                <Link href={route('admin.communication.sent')} className="inline-flex min-h-11 items-center text-sm text-sidebar-foreground/70 hover:underline">
                    Back to sent messages
                </Link>
            </div>
        </AppLayout>
    );
}
