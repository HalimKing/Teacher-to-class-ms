import { type CommunicationCapabilities, type CommunicationMessage, type CommunicationStats } from '@/components/communication/types';
import { CommunicationStatusBadge } from '@/components/communication/status-badge';
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
    { title: 'Dashboard', href: '/admin/dashboard' },
    { title: 'Communication', href: '/admin/communication' },
];

export default function AdminCommunicationDashboard({ stats, recent, capabilities }: PageProps) {
    const { flash } = usePage().props as PageProps;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Communication" />
            <div className="space-y-6 p-4 md:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Communication</h1>
                        <p className="mt-1 text-sm text-slate-500">Send targeted or institution-wide messages to staff.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link href={route('admin.communication.inbox')} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">
                            Inbox
                        </Link>
                        <Link href={route('admin.communication.sent')} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">
                            Sent
                        </Link>
                        {capabilities.can_compose && (
                            <Link href={route('admin.communication.compose')} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                                <PenSquare className="h-4 w-4" />
                                Compose message
                            </Link>
                        )}
                    </div>
                </div>

                {flash?.success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{flash.success}</div>}
                {flash?.error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{flash.error}</div>}

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {[
                        { label: 'Messages sent', value: stats.sent, icon: Send },
                        { label: 'Recipients reached', value: stats.recipients, icon: Users },
                        { label: 'Delivered', value: stats.delivered, icon: Mail },
                        { label: 'Drafts', value: stats.drafts, icon: PenSquare },
                    ].map((stat) => (
                        <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{stat.label}</p>
                                <stat.icon className="h-4 w-4 text-slate-400" />
                            </div>
                            <p className="mt-2 text-2xl font-bold text-slate-900">{stat.value}</p>
                        </div>
                    ))}
                </div>

                <section className="rounded-xl border border-slate-200 bg-white">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                        <h2 className="text-sm font-semibold text-slate-900">Recent messages</h2>
                        <Link href={route('admin.communication.sent')} className="text-sm text-slate-600 hover:underline">
                            View all
                        </Link>
                    </div>
                    {recent.length === 0 ? (
                        <div className="px-4 py-12 text-center text-sm text-slate-500">No messages have been sent yet.</div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {recent.map((message) => (
                                <Link key={message.id} href={message.conversation_id ? route('admin.communication.thread', message.conversation_id) : route('admin.communication.show', message.id)} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50">
                                    <div className="min-w-0">
                                        <p className="truncate font-medium text-slate-900">{message.subject}</p>
                                        <p className="truncate text-xs text-slate-500">{(message.audience_summary ?? []).join(' · ')}</p>
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
