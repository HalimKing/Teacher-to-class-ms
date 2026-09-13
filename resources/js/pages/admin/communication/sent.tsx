import { CommunicationFilters, CommunicationMessageList } from '@/components/communication/message-list';
import { type CommunicationCapabilities, type PaginatedMessages } from '@/components/communication/types';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';

interface PageProps {
    messages: PaginatedMessages;
    filters: { search?: string; status?: string; from?: string; to?: string; recipient_type?: string };
    statuses: Record<string, string>;
    capabilities: CommunicationCapabilities;
    flash?: { success?: string; error?: string };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/admin/dashboard' },
    { title: 'Communication', href: '/admin/communication' },
    { title: 'Sent messages', href: '/admin/communication/sent' },
];

export default function AdminCommunicationSent({ messages, filters, statuses, capabilities }: PageProps) {
    const { flash } = usePage().props as PageProps;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Sent Messages" />
            <div className="space-y-6 p-4 md:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Sent messages</h1>
                        <p className="mt-1 text-sm text-slate-500">Search and review messages you have sent or saved as drafts.</p>
                    </div>
                    {capabilities.can_compose && (
                        <Link href={route('admin.communication.compose')} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                            Compose message
                        </Link>
                    )}
                </div>
                {flash?.success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{flash.success}</div>}
                {flash?.error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{flash.error}</div>}
                <CommunicationFilters action={route('admin.communication.sent')} filters={filters} statuses={statuses} showRecipientType />
                <CommunicationMessageList
                    messages={messages}
                    emptyTitle="No sent messages"
                    emptyDescription="Compose a message to start communicating with staff."
                    showHref={(id) => route('admin.communication.show', id)}
                />
            </div>
        </AppLayout>
    );
}
