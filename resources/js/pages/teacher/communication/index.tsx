import { CommunicationStatusBadge } from '@/components/communication/status-badge';
import { type CommunicationCapabilities, type CommunicationMessage, type CommunicationStats } from '@/components/communication/types';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { Mail, PenSquare, Send, Users } from 'lucide-react';

interface PageProps {
    stats: CommunicationStats;
    recent: CommunicationMessage[];
    capabilities: CommunicationCapabilities;
    flash?: { success?: string; error?: string };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/teacher/dashboard' },
    { title: 'Communication', href: '/teacher/communication' },
];

export default function TeacherCommunicationDashboard({ stats, recent, capabilities }: PageProps) {
    const { flash } = usePage().props as PageProps;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Unit Communication" />
            <div className="min-w-0 space-y-6 p-3 sm:p-4 md:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0">
                        <h1 className="text-xl font-bold text-sidebar-foreground sm:text-2xl">Unit Communication</h1>
                        <p className="mt-1 text-sm text-sidebar-foreground/60">{capabilities.scope_label}</p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                        <Link href={route('teacher.communication.inbox')} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-sidebar-border px-4 py-2 text-sm font-medium text-sidebar-foreground">
                            Inbox
                        </Link>
                        <Link href={route('teacher.communication.sent')} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-sidebar-border px-4 py-2 text-sm font-medium text-sidebar-foreground">
                            Sent
                        </Link>
                        {capabilities.can_compose && (
                            <Link href={route('teacher.communication.compose')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-sidebar-foreground px-4 py-2 text-sm font-semibold text-sidebar dark:bg-white dark:text-neutral-950">
                                <PenSquare className="h-4 w-4" />
                                Compose message
                            </Link>
                        )}
                    </div>
                </div>

                {flash?.success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">{flash.success}</div>}
                {flash?.error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">{flash.error}</div>}

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {[
                        { label: 'Messages sent', value: stats.sent, icon: Send },
                        { label: 'Recipients reached', value: stats.recipients, icon: Users },
                        { label: 'Delivered', value: stats.delivered, icon: Mail },
                        { label: 'Drafts', value: stats.drafts, icon: PenSquare },
                    ].map((stat) => (
                        <div key={stat.label} className="min-w-0 rounded-xl border border-sidebar-border/70 bg-card p-3 sm:p-4">
                            <div className="flex items-start justify-between gap-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/55 sm:text-xs">{stat.label}</p>
                                <stat.icon className="h-4 w-4 shrink-0 text-sidebar-foreground/40" />
                            </div>
                            <p className="mt-2 text-xl font-bold text-sidebar-foreground sm:text-2xl">{stat.value}</p>
                        </div>
                    ))}
                </div>

                <section className="rounded-xl border border-sidebar-border/70 bg-card">
                    <div className="border-b border-sidebar-border/60 px-4 py-3 text-sm font-semibold text-sidebar-foreground">Recent messages</div>
                    {recent.length === 0 ? (
                        <div className="px-4 py-12 text-center text-sm text-sidebar-foreground/55">You have not sent any unit messages yet.</div>
                    ) : (
                        <div className="divide-y divide-sidebar-border/60">
                            {recent.map((message) => (
                                <Link key={message.id} href={message.conversation_id ? route('teacher.communication.thread', message.conversation_id) : route('teacher.communication.show', message.id)} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-sidebar-accent/60">
                                    <div className="min-w-0">
                                        <p className="truncate font-medium text-sidebar-foreground">{message.subject}</p>
                                        <p className="truncate text-xs text-sidebar-foreground/55">{(message.audience_summary ?? []).join(' · ')}</p>
                                    </div>
                                    <CommunicationStatusBadge status={message.status} label={message.status_label} />
                                </Link>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </AppLayout>
    );
}
