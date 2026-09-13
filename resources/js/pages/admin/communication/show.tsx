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
            <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">{message.subject}</h1>
                        <p className="mt-1 text-sm text-slate-500">
                            {message.sent_at ? new Date(message.sent_at).toLocaleString() : 'Draft'} · {message.recipient_count} recipients
                        </p>
                    </div>
                    <CommunicationStatusBadge status={message.status} label={message.status_label} />
                </div>

                {flash?.success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{flash.success}</div>}
                {flash?.error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{flash.error}</div>}

                <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Recipients</p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">{message.recipient_count}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Delivered</p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">{message.delivered_count}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Read</p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">{message.read_count}</p>
                    </div>
                </div>

                <section className="rounded-xl border border-slate-200 bg-white p-5">
                    <h2 className="text-sm font-semibold text-slate-900">Audience</h2>
                    <p className="mt-2 text-sm text-slate-600">{(message.audience_summary ?? []).join(' · ') || '—'}</p>
                    <div className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-800">{message.body}</div>
                </section>

                <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">Recipient details</div>
                    {message.recipients.length === 0 ? (
                        <p className="px-4 py-8 text-sm text-slate-500">No individual recipients are stored for this draft.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100 text-sm">
                                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                                    <tr>
                                        <th className="px-4 py-2">Staff</th>
                                        <th className="px-4 py-2">Unit</th>
                                        <th className="px-4 py-2">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {message.recipients.map((recipient) => (
                                        <tr key={recipient.id}>
                                            <td className="px-4 py-2">
                                                <p className="font-medium text-slate-900">{recipient.name}</p>
                                                <p className="text-xs text-slate-500">{recipient.employee_id}</p>
                                            </td>
                                            <td className="px-4 py-2 text-slate-600">
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
                    )}
                </section>

                <Link href={route('admin.communication.sent')} className="inline-flex text-sm text-slate-600 hover:underline">
                    Back to sent messages
                </Link>
            </div>
        </AppLayout>
    );
}
