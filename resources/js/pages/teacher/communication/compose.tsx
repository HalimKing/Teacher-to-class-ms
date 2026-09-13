import { CommunicationComposeForm } from '@/components/communication/compose-form';
import { type CommunicationCapabilities } from '@/components/communication/types';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type PagePropsWithFlash } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeft, Mail } from 'lucide-react';
import { useEffect } from 'react';
import { Bounce, ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface PageProps extends PagePropsWithFlash {
    capabilities: CommunicationCapabilities;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/teacher/dashboard' },
    { title: 'Communication', href: '/teacher/communication' },
    { title: 'Compose', href: '/teacher/communication/compose' },
];

export default function TeacherCommunicationCompose({ capabilities }: PageProps) {
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
                            Unit communication
                        </div>
                        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-sidebar-foreground sm:text-3xl">Compose message</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-sidebar-foreground/65">
                            Send a message to selected or all eligible staff in your assigned unit. {capabilities.scope_label}.
                        </p>
                    </div>
                    <Link
                        href={route('teacher.communication.index')}
                        className="inline-flex items-center gap-2 text-sm font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground"
                    >
                        <ArrowLeft className="size-4" />
                        Back to dashboard
                    </Link>
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
