import { CommunicationComposeForm } from '@/components/communication/compose-form';
import { type CommunicationCapabilities, type DepartmentOption, type FacultyOption } from '@/components/communication/types';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type PagePropsWithFlash } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeft, Mail } from 'lucide-react';
import { useEffect } from 'react';
import { Bounce, ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface PageProps extends PagePropsWithFlash {
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
    const { flash } = usePage().props as PageProps;

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
            <Head title="Compose Message" />
            <ToastContainer />
            <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6 lg:p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                            <Mail className="size-3.5" />
                            Institutional communication
                        </div>
                        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-sidebar-foreground sm:text-3xl">Compose message</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-sidebar-foreground/65">
                            Send a targeted or institution-wide message to selected faculties, departments, and staff.
                        </p>
                    </div>
                    <Link
                        href={route('admin.communication.index')}
                        className="inline-flex items-center gap-2 text-sm font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground"
                    >
                        <ArrowLeft className="size-4" />
                        Back to dashboard
                    </Link>
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
