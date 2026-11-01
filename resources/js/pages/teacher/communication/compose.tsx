import { CommunicationComposeForm } from '@/components/communication/compose-form';
import { type CommunicationCapabilities } from '@/components/communication/types';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type PagePropsWithFlash } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeft, Bell, Building2, Mail, ShieldCheck } from 'lucide-react';
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

            <div className="min-h-full bg-gradient-to-b from-indigo-50/80 via-slate-50 to-slate-50 dark:from-indigo-950/20 dark:via-background dark:to-background">
                <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-5 p-3 pb-10 sm:p-4 md:p-6 lg:p-8">
                    <section className="overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-sm shadow-indigo-100/70 dark:border-indigo-900/40 dark:bg-card dark:shadow-none">
                        <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-slate-800 px-5 py-6 text-white sm:px-8">
                            <Link
                                href={inboxHref}
                                className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium ring-1 ring-white/20 transition hover:bg-white/25"
                            >
                                <ArrowLeft className="size-3.5" />
                                Back to inbox
                            </Link>
                            <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                                <div className="flex min-w-0 items-start gap-4">
                                    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                                        <Mail className="size-6" />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-semibold tracking-[0.18em] text-indigo-100 uppercase">Unit communication</p>
                                        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Compose message</h1>
                                        <p className="mt-2 max-w-2xl text-sm text-white/85">
                                            Send an announcement, instruction, or update to staff in your assigned unit. Recipients receive it in
                                            their inbox and as an in-app notification.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2 lg:justify-end">
                                    <HeroChip icon={Building2} label="Audience" value={capabilities.scope_label} />
                                    <HeroChip icon={ShieldCheck} label="Sending" value={capabilities.can_send ? 'Enabled' : 'View only'} />
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-px bg-slate-100 dark:bg-sidebar-border sm:grid-cols-3">
                            <InfoTile
                                step="1"
                                title="Choose recipients"
                                description={
                                    capabilities.can_send_all_staff
                                        ? `Pick individual staff or everyone in ${capabilities.scope_label}.`
                                        : `Pick individual staff in ${capabilities.scope_label}.`
                                }
                            />
                            <InfoTile step="2" title="Write the message" description="Add a clear subject and the full text staff should receive." />
                            <InfoTile step="3" title="Review and send" description="Check the audience count, then confirm the send." />
                        </div>
                    </section>

                    {!capabilities.can_send && (
                        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                            <Bell className="mt-0.5 size-4 shrink-0" />
                            Sending is not enabled for your account right now. You can still prepare a message if drafts are allowed.
                        </div>
                    )}

                    <CommunicationComposeForm
                        mode="leader"
                        storeRoute={route('teacher.communication.store')}
                        previewRoute={route('teacher.communication.preview')}
                        staffSearchRoute={route('teacher.communication.staff')}
                        capabilities={capabilities}
                        cancelHref={inboxHref}
                    />
                </div>
            </div>
        </AppLayout>
    );
}

function HeroChip({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
    return (
        <div className="flex min-w-0 items-center gap-2.5 rounded-2xl bg-white/10 px-3.5 py-2.5 ring-1 ring-white/15">
            <Icon className="size-4 shrink-0 text-indigo-100" />
            <div className="min-w-0">
                <p className="text-[10px] font-medium tracking-wide text-indigo-100 uppercase">{label}</p>
                <p className="truncate text-sm font-semibold text-white">{value}</p>
            </div>
        </div>
    );
}

function InfoTile({ step, title, description }: { step: string; title: string; description: string }) {
    return (
        <div className="flex items-start gap-3 bg-white px-4 py-4 sm:px-5 dark:bg-card">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                {step}
            </span>
            <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-sidebar-foreground">{title}</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-sidebar-foreground/60">{description}</p>
            </div>
        </div>
    );
}
