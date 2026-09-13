import { ConversationThreadView } from '@/components/communication/conversation-thread';
import {
    type CommunicationCapabilities,
    type CommunicationFolder,
    type CommunicationFolderCounts,
    type CommunicationThread,
} from '@/components/communication/types';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type PagePropsWithFlash } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import { Bounce, ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface PageProps extends PagePropsWithFlash {
    conversation: CommunicationThread;
    capabilities: CommunicationCapabilities;
    folder: CommunicationFolder;
    counts: CommunicationFolderCounts;
}

export default function TeacherCommunicationThread({ conversation, capabilities, folder }: PageProps) {
    const { flash } = usePage().props as PageProps;
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/teacher/dashboard' },
        { title: 'Communication', href: '/teacher/communication/inbox' },
        { title: conversation.subject, href: `/teacher/communication/conversations/${conversation.id}` },
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
            <Head title={conversation.subject} />
            <ToastContainer />
            <ConversationThreadView prefix="teacher" folder={folder} conversation={conversation} capabilities={capabilities} />
        </AppLayout>
    );
}
