import InputError from '@/components/input-error';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { AlertTriangle, CalendarClock, UserRound, X } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { Bounce, toast } from 'react-toastify';

interface SessionPayload {
    kind: 'lecturer' | 'administrator';
    timetable_id: number;
    date: string;
    date_display: string;
    session_label: string;
    venue?: string | null;
    staff: {
        name: string;
        role: string;
        faculty?: string | null;
        department?: string | null;
    };
    submit_url: string;
    cancel_url: string;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/teacher/dashboard' },
    { title: 'Mark Absent', href: '#' },
];

export default function SelfReportedAbsenceCreate({ session }: { session: SessionPayload }) {
    const { flash } = usePage().props as { flash?: { success?: string; error?: string } };
    const { data, setData, post, processing, errors } = useForm({
        timetable_id: session.timetable_id,
        reason: '',
        notes: '',
    });
    const [confirmOpen, setConfirmOpen] = useState(false);

    useEffect(() => {
        if (flash?.error) {
            toast.error(flash.error, { theme: 'dark', transition: Bounce });
        }
    }, [flash?.error]);

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        setConfirmOpen(true);
    };

    const confirmSubmit = () => {
        post(session.submit_url, {
            preserveScroll: true,
            onError: () => setConfirmOpen(false),
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Mark yourself absent" />

            <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-6 p-3 sm:p-4 md:p-6">
                <div>
                    <p className="text-sm font-medium text-rose-700 dark:text-rose-300">Self-service absence</p>
                    <h1 className="mt-1 text-xl font-semibold text-sidebar-foreground sm:text-2xl">Mark yourself absent</h1>
                    <p className="mt-2 text-sm text-sidebar-foreground/70">
                        Submit a reason for this session. Your Director/Dean and Head of Department will be notified when the absence is recorded.
                    </p>
                </div>

                <section className="grid gap-4 rounded-2xl border border-sidebar-border/60 bg-card p-4 sm:grid-cols-2 sm:p-5">
                    <div className="flex items-start gap-3">
                        <UserRound className="mt-0.5 size-5 text-slate-500" />
                        <div>
                            <p className="text-xs font-medium tracking-wide text-sidebar-foreground/50 uppercase">Staff member</p>
                            <p className="mt-1 font-medium text-sidebar-foreground">{session.staff.name}</p>
                            <p className="text-sm text-sidebar-foreground/70">{session.staff.role}</p>
                            {(session.staff.faculty || session.staff.department) && (
                                <p className="mt-1 text-xs text-sidebar-foreground/60">
                                    {[session.staff.faculty, session.staff.department].filter(Boolean).join(' · ')}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <CalendarClock className="mt-0.5 size-5 text-slate-500" />
                        <div>
                            <p className="text-xs font-medium tracking-wide text-sidebar-foreground/50 uppercase">Attendance session</p>
                            <p className="mt-1 font-medium text-sidebar-foreground">{session.date_display}</p>
                            <p className="text-sm text-sidebar-foreground/70">{session.session_label}</p>
                            {session.venue && <p className="mt-1 text-xs text-sidebar-foreground/60">{session.venue}</p>}
                        </div>
                    </div>
                </section>

                <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-sidebar-border/60 bg-card p-4 sm:p-5">
                    <div>
                        <label htmlFor="reason" className="mb-1.5 block text-sm font-medium text-sidebar-foreground">
                            Reason for absence <span className="text-rose-600">*</span>
                        </label>
                        <textarea
                            id="reason"
                            value={data.reason}
                            onChange={(event) => setData('reason', event.target.value)}
                            required
                            minLength={10}
                            maxLength={4000}
                            rows={7}
                            className="w-full rounded-xl border border-sidebar-border/80 bg-background px-3 py-2.5 text-base text-sidebar-foreground outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 md:text-sm dark:focus:ring-rose-900/40"
                            placeholder="Explain why you will be absent for this session."
                        />
                        <div className="mt-1 flex items-center justify-between gap-3">
                            <InputError message={errors.reason || errors.session} />
                            <p className="ml-auto text-xs text-sidebar-foreground/50">{data.reason.length}/4000</p>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="notes" className="mb-1.5 block text-sm font-medium text-sidebar-foreground">
                            Supporting information <span className="font-normal text-sidebar-foreground/50">(optional)</span>
                        </label>
                        <textarea
                            id="notes"
                            value={data.notes}
                            onChange={(event) => setData('notes', event.target.value)}
                            maxLength={2000}
                            rows={4}
                            className="w-full rounded-xl border border-sidebar-border/80 bg-background px-3 py-2.5 text-base text-sidebar-foreground outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 md:text-sm dark:focus:ring-slate-800"
                            placeholder="Add any extra context your supervisors should know."
                        />
                        <InputError message={errors.notes} />
                    </div>

                    <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                        <Link
                            href={session.cancel_url}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-sidebar-border px-5 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent"
                        >
                            <X className="size-4" />
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={processing}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <AlertTriangle className="size-4" />
                            Submit absence
                        </button>
                    </div>
                </form>
            </div>

            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm absence</DialogTitle>
                        <DialogDescription>Are you sure you want to mark yourself absent for this attendance session?</DialogDescription>
                    </DialogHeader>
                    <p className="text-sm text-sidebar-foreground/70">
                        After you submit, this session will be recorded as absent and you will not be able to check in or check out.
                    </p>
                    <DialogFooter>
                        <button
                            type="button"
                            onClick={() => setConfirmOpen(false)}
                            className="min-h-11 w-full rounded-lg border border-sidebar-border px-4 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent sm:w-auto"
                        >
                            Go back
                        </button>
                        <button
                            type="button"
                            disabled={processing}
                            onClick={confirmSubmit}
                            className="min-h-11 w-full rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60 sm:w-auto"
                        >
                            {processing ? 'Submitting…' : 'Yes, mark me absent'}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
