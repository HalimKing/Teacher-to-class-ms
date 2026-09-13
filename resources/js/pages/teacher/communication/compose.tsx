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
    { title: 'Communication', href: '/teacher/communication/inbox' },
    { title: 'Compose', href: '/teacher/communication/compose' },
];

export default function TeacherCommunicationCompose({ capabilities }: PageProps) {
    const { flash } = usePage().props as PageProps;
    const inboxHref = route('teacher.communication.inbox');

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
            <div className="mx-auto max-w-6xl min-w-0 space-y-5 px-3 py-3 sm:space-y-6 sm:px-4 sm:py-4 md:px-6 md:py-6 lg:px-8">
                <div className="min-w-0">
                    <Link
                        href={inboxHref}
                        className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground"
                    >
                        <ArrowLeft className="size-4" />
                        Back to inbox
                    </Link>
                    <div className="mt-3 flex items-start gap-3">
                        <div className="mt-0.5 hidden size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:flex">
                            <Mail className="size-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/50">Unit communication</p>
                            <h1 className="mt-1 text-xl font-semibold tracking-tight text-sidebar-foreground sm:text-2xl">Compose message</h1>
                            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-sidebar-foreground/65">
                                Send a message to selected or all eligible staff in your assigned unit. {capabilities.scope_label}.
                            </p>
                        </div>
                    </div>
                </div>

                <CommunicationComposeForm
                    mode="leader"
                    storeRoute={route('teacher.communication.store')}
                    previewRoute={route('teacher.communication.preview')}
                    staffSearchRoute={route('teacher.communication.staff')}
                    capabilities={capabilities}
                    cancelHref={inboxHref}
                />
            </div>
        </AppLayout>
    );
}
