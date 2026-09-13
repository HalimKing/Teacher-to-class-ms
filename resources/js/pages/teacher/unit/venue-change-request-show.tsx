import VenueChangeApprovalStatus, { type VenueChangeApprovalItem } from '@/components/attendance/VenueChangeApprovalStatus';
import InputError from '@/components/input-error';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRightLeft,
    Building2,
    CalendarDays,
    Check,
    CheckCircle2,
    Clock3,
    FileText,
    IdCard,
    MapPin,
    ShieldCheck,
    UserRound,
    X,
} from 'lucide-react';
import { useEffect } from 'react';
import { Bounce, ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface RequestRecord {
    id: number;
    status: string;
    status_label: string;
    period_label: string;
    reason: string;
    notes?: string | null;
    authorization_type: string;
    start_time?: string | null;
    end_time?: string | null;
    staff_name: string;
    employee_id?: string | null;
    staff_role?: string;
    faculty_name?: string | null;
    department_name?: string | null;
    current_venue: string;
    requested_venue: string;
    session_label: string;
    created_at_display?: string | null;
    approval_progress: string;
    approvals: VenueChangeApprovalItem[];
    resulting_authorization_id?: number | null;
    items?: Array<{
        id: number;
        timetable?: { day_of_week?: string; day?: string; start_time?: string | null; end_time?: string | null; course?: { name?: string } | null } | null;
        original_classroom?: { name?: string } | null;
    }>;
}

interface PageProps {
    requestRecord: RequestRecord;
    canDecide: boolean;
    actorRole?: string | null;
    leadershipScope?: { role_label?: string | null; faculty_name?: string | null; department_name?: string | null } | null;
    flash?: { success?: string; error?: string };
}

const breadcrumbs = (id: number): BreadcrumbItem[] => [
    { title: 'Dashboard', href: '/teacher/dashboard' },
    { title: 'Venue Change Requests', href: '/teacher/unit/venue-change-requests' },
    { title: `Request #${id}`, href: `/teacher/unit/venue-change-requests/${id}` },
];

function initials(name?: string | null) {
    if (!name) return 'ST';

    return name
        .replace(/^(Dr|Prof|Mr|Mrs|Ms|Miss)\.?\s+/i, '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');
}

function formatTime(time?: string | null) {
    if (!time) return null;
    const normalized = time.length === 5 ? `${time}:00` : time;

    try {
        return new Date(`2000-01-01T${normalized}`).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    } catch {
        return time;
    }
}

function authorizationTypeLabel(type?: string) {
    return (type || 'both').replaceAll('_', ' ');
}

function statusTone(status: string) {
    if (status === 'approved') {
        return 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900/60';
    }

    if (status === 'rejected') {
        return 'bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-900/60';
    }

    return 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/60';
}

export default function UnitVenueChangeRequestShow({ requestRecord, canDecide, leadershipScope }: PageProps) {
    const { flash } = usePage().props as PageProps;
    const form = useForm({ comments: '' });
    const unitLabel = leadershipScope?.department_name || leadershipScope?.faculty_name;
    const organization = [requestRecord.faculty_name, requestRecord.department_name].filter(Boolean).join(' · ');
    const dailyWindow = [formatTime(requestRecord.start_time), formatTime(requestRecord.end_time)].filter(Boolean).join(' – ');
    const approvedCount = requestRecord.approvals.filter((approval) => approval.status === 'approved').length;
    const totalApprovals = requestRecord.approvals.length;

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success, { theme: 'dark', transition: Bounce });
        }
        if (flash?.error) {
            toast.error(flash.error, { theme: 'dark', transition: Bounce });
        }
    }, [flash?.success, flash?.error]);

    const approve = () => form.post(route('teacher.unit.venue-change-requests.approve', requestRecord.id), { preserveScroll: true });
    const reject = () => {
        if (!form.data.comments.trim()) {
            form.setError('comments', 'A rejection reason is required.');
            return;
        }

        form.post(route('teacher.unit.venue-change-requests.reject', requestRecord.id), { preserveScroll: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs(requestRecord.id)}>
            <Head title={`Venue change · ${requestRecord.staff_name}`} />
            <ToastContainer />

            <div className="min-h-full bg-gradient-to-b from-indigo-50/80 via-slate-50 to-slate-50 dark:from-indigo-950/20 dark:via-background dark:to-background">
                <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-5 p-3 pb-10 sm:p-4 md:p-6 lg:p-8">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <Link
                            href={route('teacher.unit.venue-change-requests.index')}
                            className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                        >
                            <ArrowLeft className="size-4" />
                            Back to venue change requests
                        </Link>
                        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
                            {leadershipScope?.role_label || 'Leadership view'}
                            {unitLabel ? ` · ${unitLabel}` : ''}
                        </p>
                    </div>

                    <section className="overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-sm shadow-indigo-100/70 dark:border-indigo-900/40 dark:bg-card dark:shadow-none">
                        <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-slate-800 px-4 py-4 text-white sm:px-8 sm:py-5">
                            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                                <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                                    <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-base font-semibold tracking-wide ring-1 ring-white/30 sm:size-16 sm:text-lg">
                                        {initials(requestRecord.staff_name)}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase ring-1 ring-white/20">
                                                <ArrowRightLeft className="size-3.5" />
                                                Venue change
                                            </span>
                                            <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold tracking-wide text-indigo-700 uppercase">
                                                {requestRecord.status_label}
                                            </span>
                                        </div>
                                        <h1 className="mt-2 text-xl font-semibold tracking-tight break-words sm:text-3xl">{requestRecord.staff_name}</h1>
                                        <p className="mt-1 break-words text-sm text-indigo-50/90">
                                            Request #{requestRecord.id}
                                            {requestRecord.staff_role ? ` · ${requestRecord.staff_role}` : ''}
                                            {requestRecord.employee_id ? ` · ${requestRecord.employee_id}` : ''}
                                            {organization ? ` · ${organization}` : ''}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[22rem]">
                                    <HeaderStat icon={CalendarDays} label="Requested period" value={requestRecord.period_label || '—'} />
                                    <HeaderStat icon={Clock3} label="Submitted" value={requestRecord.created_at_display || '—'} />
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-px bg-slate-100 dark:bg-sidebar-border sm:grid-cols-3">
                            <MetaTile icon={MapPin} label="Current venue" value={requestRecord.current_venue} hint="Assigned attendance location" />
                            <MetaTile icon={ArrowRightLeft} label="Requested venue" value={requestRecord.requested_venue} hint="Replacement location" />
                            <MetaTile icon={CalendarDays} label="Attendance session" value={requestRecord.session_label} hint={authorizationTypeLabel(requestRecord.authorization_type)} />
                        </div>
                    </section>

                    <div className="grid gap-6 xl:grid-cols-12">
                        <section className="space-y-6 xl:col-span-8">
                            <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-7 dark:border-sidebar-border dark:bg-card">
                                <p className="text-xs font-semibold tracking-[0.18em] text-indigo-600 uppercase dark:text-indigo-300">Request reason</p>
                                <h2 className="mt-1 text-lg font-semibold text-slate-900 sm:text-xl dark:text-sidebar-foreground">Why this venue change is needed</h2>
                                <blockquote className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-4 text-base leading-7 text-slate-800 sm:px-5 sm:py-5 dark:border-indigo-900/40 dark:bg-indigo-950/20 dark:text-indigo-50">
                                    <p className="whitespace-pre-wrap break-words">{requestRecord.reason || 'No reason was provided.'}</p>
                                </blockquote>
                                {requestRecord.notes ? (
                                    <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 sm:px-5 dark:border-sidebar-border dark:bg-sidebar-accent">
                                        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-sidebar-foreground/55">Additional notes</p>
                                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 dark:text-sidebar-foreground/80">{requestRecord.notes}</p>
                                    </div>
                                ) : (
                                    <p className="mt-6 text-sm text-slate-500 dark:text-sidebar-foreground/55">No additional notes were submitted.</p>
                                )}
                            </div>

                            <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-7 dark:border-sidebar-border dark:bg-card">
                                <div className="flex items-start gap-3">
                                    <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300">
                                        <CalendarDays className="size-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase">Affected schedules</p>
                                        <h2 className="mt-1 text-lg font-semibold text-slate-900 sm:text-xl dark:text-sidebar-foreground">Attendance sessions covered</h2>
                                    </div>
                                </div>

                                <div className="mt-5 space-y-3">
                                    {(requestRecord.items || []).length === 0 ? (
                                        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-sidebar-border dark:text-sidebar-foreground/55">
                                            No schedules are attached to this request.
                                        </div>
                                    ) : (
                                        (requestRecord.items || []).map((item) => {
                                            const timeRange = [formatTime(item.timetable?.start_time), formatTime(item.timetable?.end_time)]
                                                .filter(Boolean)
                                                .join(' – ');

                                            return (
                                                <article
                                                    key={item.id}
                                                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-sidebar-border dark:bg-sidebar-accent"
                                                >
                                                    <p className="font-semibold break-words text-slate-900 dark:text-sidebar-foreground">
                                                        {item.timetable?.course?.name || 'Work period'}
                                                    </p>
                                                    <p className="mt-1 text-sm text-slate-600 dark:text-sidebar-foreground/70">
                                                        {item.timetable?.day_of_week || item.timetable?.day || '—'}
                                                        {timeRange ? ` · ${timeRange}` : ''}
                                                    </p>
                                                    {item.original_classroom?.name && (
                                                        <p className="mt-2 text-xs font-medium text-slate-500 dark:text-sidebar-foreground/55">
                                                            Original venue: {item.original_classroom.name}
                                                        </p>
                                                    )}
                                                </article>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-7 dark:border-sidebar-border dark:bg-card">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="flex items-start gap-3">
                                        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300">
                                            <ShieldCheck className="size-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase">Approval workflow</p>
                                            <h2 className="mt-1 text-lg font-semibold text-slate-900 sm:text-xl dark:text-sidebar-foreground">Required reviews</h2>
                                            <p className="mt-1 text-sm text-slate-500 dark:text-sidebar-foreground/60">
                                                {requestRecord.approval_progress}. The request is fully approved only after every required reviewer has approved.
                                            </p>
                                        </div>
                                    </div>
                                    {totalApprovals > 0 && (
                                        <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusTone(requestRecord.status)}`}>
                                            {approvedCount} of {totalApprovals} complete
                                        </span>
                                    )}
                                </div>

                                <div className="mt-6">
                                    <VenueChangeApprovalStatus approvals={requestRecord.approvals} variant="timeline" />
                                </div>
                            </div>

                            {requestRecord.status === 'approved' && requestRecord.resulting_authorization_id && (
                                <Link
                                    href={route('teacher.unit.venue-change-authorizations.show', requestRecord.resulting_authorization_id)}
                                    className="flex min-h-11 items-center justify-between rounded-3xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100 dark:hover:bg-emerald-950/40"
                                >
                                    <span>View resulting venue change authorization</span>
                                    <span aria-hidden>→</span>
                                </Link>
                            )}

                            {canDecide ? (
                                <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-7 dark:border-sidebar-border dark:bg-card">
                                    <div className="flex items-start gap-3">
                                        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                            <CheckCircle2 className="size-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase">Your decision</p>
                                            <h2 className="mt-1 text-lg font-semibold text-slate-900 sm:text-xl dark:text-sidebar-foreground">Review this request</h2>
                                            <p className="mt-1 text-sm text-slate-500 dark:text-sidebar-foreground/60">
                                                Approve if the replacement venue is appropriate, or reject with a reason. Your decision is recorded independently of the other approvers.
                                            </p>
                                        </div>
                                    </div>

                                    <label className="mt-6 block space-y-2">
                                        <span className="text-sm font-medium text-slate-800 dark:text-sidebar-foreground">Reviewer comments</span>
                                        <textarea
                                            value={form.data.comments}
                                            onChange={(event) => form.setData('comments', event.target.value)}
                                            rows={5}
                                            maxLength={2000}
                                            placeholder="Required when rejecting the request"
                                            className="w-full rounded-2xl border border-slate-200 bg-background px-4 py-3 text-base text-sidebar-foreground outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 md:text-sm dark:border-sidebar-border dark:focus:ring-indigo-950"
                                        />
                                        <InputError message={form.errors.comments} />
                                    </label>

                                    <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row">
                                        <button
                                            type="button"
                                            disabled={form.processing}
                                            onClick={reject}
                                            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200 dark:hover:bg-rose-950/50"
                                        >
                                            <X className="size-4" />
                                            {form.processing ? 'Saving…' : 'Reject request'}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={form.processing}
                                            onClick={approve}
                                            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            <Check className="size-4" />
                                            {form.processing ? 'Saving…' : 'Approve request'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 px-4 py-6 text-sm text-slate-600 sm:px-6 dark:border-sidebar-border dark:bg-card dark:text-sidebar-foreground/65">
                                    {requestRecord.status === 'pending'
                                        ? 'You can view this request, but your approval is not currently required or has already been recorded.'
                                        : 'This request is no longer awaiting review.'}
                                </div>
                            )}
                        </section>

                        <aside className="space-y-6 xl:col-span-4">
                            <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5 dark:border-sidebar-border dark:bg-card">
                                <p className="text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase">Staff member</p>
                                <div className="mt-4 space-y-4">
                                    <InfoRow icon={UserRound} label="Full name" value={requestRecord.staff_name} />
                                    <InfoRow icon={IdCard} label="Role" value={requestRecord.staff_role || 'Staff'} />
                                    <InfoRow icon={IdCard} label="Employee ID" value={requestRecord.employee_id || '—'} />
                                    <InfoRow icon={Building2} label="Directorate / Faculty" value={requestRecord.faculty_name || '—'} />
                                    <InfoRow icon={Building2} label="Department" value={requestRecord.department_name || '—'} />
                                </div>
                            </div>

                            <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5 dark:border-sidebar-border dark:bg-card">
                                <p className="text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase">Request details</p>
                                <div className="mt-4 space-y-4">
                                    <InfoRow icon={MapPin} label="Current venue" value={requestRecord.current_venue} />
                                    <InfoRow icon={ArrowRightLeft} label="Requested venue" value={requestRecord.requested_venue} />
                                    <InfoRow icon={CalendarDays} label="Period" value={requestRecord.period_label || '—'} />
                                    <InfoRow icon={Clock3} label="Daily window" value={dailyWindow || 'Full session'} />
                                    <InfoRow icon={FileText} label="Authorization type" value={authorizationTypeLabel(requestRecord.authorization_type)} />
                                    <InfoRow icon={Clock3} label="Submitted" value={requestRecord.created_at_display || '—'} />
                                </div>
                            </div>
                        </aside>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

function HeaderStat({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
    return (
        <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15">
            <div className="flex items-center gap-2 text-[11px] font-medium tracking-wide text-indigo-100 uppercase">
                <Icon className="size-3.5" />
                {label}
            </div>
            <p className="mt-1 break-words text-sm font-semibold text-white">{value}</p>
        </div>
    );
}

function MetaTile({ icon: Icon, label, value, hint }: { icon: typeof CalendarDays; label: string; value: string; hint?: string }) {
    return (
        <div className="bg-white px-4 py-4 sm:px-5 dark:bg-card">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-sidebar-foreground/55">
                <Icon className="size-4 shrink-0 text-indigo-500" />
                {label}
            </div>
            <p className="mt-2 break-words text-sm font-semibold text-slate-900 dark:text-sidebar-foreground">{value}</p>
            {hint && <p className="mt-1 text-xs text-slate-500 dark:text-sidebar-foreground/55">{hint}</p>}
        </div>
    );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
    return (
        <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-sidebar-accent dark:text-sidebar-foreground/70">
                <Icon className="size-4" />
            </div>
            <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500 dark:text-sidebar-foreground/55">{label}</p>
                <p className="mt-0.5 break-words text-sm font-medium text-slate-900 dark:text-sidebar-foreground">{value}</p>
            </div>
        </div>
    );
}
