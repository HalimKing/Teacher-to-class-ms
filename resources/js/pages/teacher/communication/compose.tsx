import { CommunicationComposeForm } from '@/components/communication/compose-form';
import { type CommunicationCapabilities } from '@/components/communication/types';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

interface PageProps {
    capabilities: CommunicationCapabilities;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/teacher/dashboard' },
    { title: 'Communication', href: '/teacher/communication' },
    { title: 'Compose', href: '/teacher/communication/compose' },
];

export default function TeacherCommunicationCompose({ capabilities }: PageProps) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Compose Message" />
            <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Compose message</h1>
                    <p className="mt-1 text-sm text-slate-500">{capabilities.all_staff_label}</p>
                </div>
                <CommunicationComposeForm
                    mode="leader"
                    storeRoute={route('teacher.communication.store')}
                    previewRoute={route('teacher.communication.preview')}
                    staffSearchRoute={route('teacher.communication.staff')}
                    capabilities={capabilities}
                    cancelHref={route('teacher.communication.index')}
                />
            </div>
        </AppLayout>
    );
}
