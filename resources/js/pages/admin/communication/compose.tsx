import { CommunicationComposeForm } from '@/components/communication/compose-form';
import { type CommunicationCapabilities, type DepartmentOption, type FacultyOption } from '@/components/communication/types';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

interface PageProps {
    capabilities: CommunicationCapabilities;
    faculties: FacultyOption[];
    departments: DepartmentOption[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/admin/dashboard' },
    { title: 'Communication', href: '/admin/communication' },
    { title: 'Compose', href: '/admin/communication/compose' },
];

export default function AdminCommunicationCompose({ capabilities, faculties, departments }: PageProps) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Compose Message" />
            <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Compose message</h1>
                    <p className="mt-1 text-sm text-slate-500">Send a message to selected or all faculties, departments, and staff.</p>
                </div>
                <CommunicationComposeForm
                    mode="admin"
                    storeRoute={route('admin.communication.store')}
                    previewRoute={route('admin.communication.preview')}
                    staffSearchRoute={route('admin.communication.staff')}
                    facultySearchRoute={route('admin.communication.faculties')}
                    departmentSearchRoute={route('admin.communication.departments')}
                    faculties={faculties}
                    departments={departments}
                    capabilities={capabilities}
                    cancelHref={route('admin.communication.index')}
                />
            </div>
        </AppLayout>
    );
}
