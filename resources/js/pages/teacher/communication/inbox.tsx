import { CommunicationFilters, CommunicationMessageList } from '@/components/communication/message-list';
import { type CommunicationCapabilities, type PaginatedMessages } from '@/components/communication/types';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';

interface PageProps {
    messages: PaginatedMessages;
    filters: { search?: string; status?: string; from?: string; to?: string };
    capabilities: CommunicationCapabilities;
    flash?: { success?: string; error?: string };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/teacher/dashboard' },
    { title: 'Communication', href: '/teacher/communication/inbox' },
];

export default function TeacherCommunicationInbox({ messages, filters, capabilities }: PageProps) {
    const { flash } = usePage().props as PageProps;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Inbox" />
            <div className="min-w-0 space-y-6 p-3 sm:p-4 md:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0">
                        <h1 className="text-xl font-bold text-sidebar-foreground sm:text-2xl">Inbox</h1>
                        <p className="mt-1 text-sm text-sidebar-foreground/60">Messages sent to you by administrators and unit leaders.</p>
                    </div>
                    {capabilities.can_compose && (
                        <Link href={route('teacher.communication.compose')} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-sidebar-foreground px-4 py-2 text-sm font-semibold text-sidebar dark:bg-white dark:text-neutral-950">
                            Compose message
                        </Link>
                    )}
                </div>
                {flash?.success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{flash.success}</div>}
                {flash?.error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{flash.error}</div>}
                <CommunicationFilters action={route('teacher.communication.inbox')} filters={filters} />
                <CommunicationMessageList
                    messages={messages}
                    emptyTitle="No messages yet"
                    emptyDescription="When an administrator or unit leader sends you a message, it will appear here."
                    showHref={(id) => route('teacher.communication.show', id)}
                    showSender
                />
            </div>
        </AppLayout>
    );
}
