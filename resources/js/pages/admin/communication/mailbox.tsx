import { ConversationFilters, ConversationList } from '@/components/communication/conversation-list';
import { CommunicationMailboxLayout, folderMeta } from '@/components/communication/mailbox-layout';
import {
    type CommunicationCapabilities,
    type CommunicationFolder,
    type CommunicationFolderCounts,
    type PaginatedConversations,
} from '@/components/communication/types';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

interface PageProps {
    conversations: PaginatedConversations;
    folder: CommunicationFolder;
    filters: { search?: string; from?: string; to?: string; unread?: string | boolean };
    capabilities: CommunicationCapabilities;
    counts: CommunicationFolderCounts;
}

const emptyCopy: Record<CommunicationFolder, { title: string; description: string }> = {
    inbox: {
        title: 'Your inbox is empty',
        description: 'Replies from staff will appear here as conversations.',
    },
    sent: {
        title: 'No sent conversations',
        description: 'Messages you compose will be grouped here with any replies.',
    },
    drafts: {
        title: 'No drafts',
        description: 'Save a message as a draft and it will wait here until you send it.',
    },
    all: {
        title: 'No conversations yet',
        description: 'Every conversation you can access will appear here.',
    },
};

export default function AdminCommunicationMailbox({ conversations, folder, filters, capabilities, counts }: PageProps) {
    const meta = folderMeta(folder);
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/admin/dashboard' },
        { title: 'Communication', href: '/admin/communication/inbox' },
        { title: meta.title, href: `/admin/communication/${folder === 'all' ? 'all' : folder}` },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={meta.title} />
            <CommunicationMailboxLayout prefix="admin" folder={folder} counts={counts} capabilities={capabilities}>
                <div className="space-y-4">
                    <ConversationFilters action={route(`admin.communication.${folder === 'all' ? 'all' : folder}`)} filters={filters} />
                    <ConversationList
                        prefix="admin"
                        folder={folder}
                        conversations={conversations}
                        emptyTitle={emptyCopy[folder].title}
                        emptyDescription={emptyCopy[folder].description}
                    />
                </div>
            </CommunicationMailboxLayout>
        </AppLayout>
    );
}
