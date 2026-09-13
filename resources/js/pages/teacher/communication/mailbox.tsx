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
        description: 'When an administrator or unit leader sends you a message, the conversation will appear here.',
    },
    sent: {
        title: 'No sent conversations',
        description: 'Messages you compose or reply to will be grouped here.',
    },
    drafts: {
        title: 'No drafts',
        description: 'Save a message as a draft and it will wait here until you send it.',
    },
    all: {
        title: 'No conversations yet',
        description: 'Conversations you send or receive will be collected in All Mail.',
    },
};

export default function TeacherCommunicationMailbox({ conversations, folder, filters, capabilities, counts }: PageProps) {
    const meta = folderMeta(folder);
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/teacher/dashboard' },
        { title: 'Communication', href: '/teacher/communication/inbox' },
        { title: meta.title, href: `/teacher/communication/${folder === 'all' ? 'all' : folder}` },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={meta.title} />
            <CommunicationMailboxLayout prefix="teacher" folder={folder} counts={counts} capabilities={capabilities}>
                <div className="space-y-4">
                    <ConversationFilters action={route(`teacher.communication.${folder === 'all' ? 'all' : folder}`)} filters={filters} />
                    <ConversationList
                        prefix="teacher"
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
