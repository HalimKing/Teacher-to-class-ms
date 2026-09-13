import InputError from '@/components/input-error';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft, Building2, CalendarDays, Clock3, FileText, IdCard, MapPin, MessageSquareText, Send, UserMinus, UserRound } from 'lucide-react';
import { FormEvent, useEffect } from 'react';
import { Bounce, toast } from 'react-toastify';

interface AbsenceRecord {
    id: number;
    kind: string;
    kind_label?: string;
    staff_name: string;
    staff_role: string;
    employee_id: string | null;
    faculty?: string | null;
    department?: string | null;
    date_display?: string;
    session_label: string;
    start_time?: string | null;
    end_time?: string | null;
    status: string;
    source: string;
    reason: string;
    notes?: string | null;
    submitted_at_display?: string | null;
    replies?: AbsenceReply[];
}

interface AbsenceReply {
    id: number;
    body: string;
    author_name: string;
    author_role?: string | null;
    created_at_display?: string | null;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/teacher/dashboard' },
    { title: 'Self-reported Absences', href: '/teacher/unit/self-reported-absences' },
    { title: 'Absence details', href: '#' },
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

function statusLabel(status?: string) {
    return (status || 'absent').replaceAll('_', ' ');
}

export default function UnitSelfReportedAbsenceShow({
    record,
    leadershipScope,
    canReply = false,
    replyUrl = null,
}: {
    record: AbsenceRecord;
    leadershipScope?: { role_label?: string | null; faculty_name?: string | null; department_name?: string | null } | null;
    canReply?: boolean;
    replyUrl?: string | null;
}) {
    const { flash } = usePage().props as { flash?: { success?: string; error?: string } };
    const timeRange = [formatTime(record.start_time), formatTime(record.end_time)].filter(Boolean).join(' – ');
    const unitLabel = leadershipScope?.department_name || leadershipScope?.faculty_name;
    const organization = [record.faculty, record.department].filter(Boolean).join(' · ');
    const replies = record.replies ?? [];
    const backHref = canReply
        ? route('teacher.unit.self-reported-absences.index')
        : record.kind === 'administrator'
          ? '/teacher/staff-attendance'
          : '/teacher/attendance';
    const { data, setData, post, processing, errors, reset } = useForm({
        body: '',
    });

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success, { theme: 'dark', transition: Bounce });
        }
        if (flash?.error) {
            toast.error(flash.error, { theme: 'dark', transition: Bounce });
        }
    }, [flash?.success, flash?.error]);

    const submitReply = (event: FormEvent) => {
        event.preventDefault();
        if (!replyUrl) return;

        post(replyUrl, {
            preserveScroll: true,
            onSuccess: () => reset('body'),
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Absence · ${record.staff_name}`} />

            <div className="min-h-full bg-gradient-to-b from-rose-50/70 via-slate-50 to-slate-50 dark:from-rose-950/20 dark:via-background dark:to-background">
                <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-5 p-3 pb-10 sm:p-4 md:p-6 lg:p-8">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <Link
                            href={backHref}
                            className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                        >
                            <ArrowLeft className="size-4" />
                            {canReply ? 'Back to self-reported absences' : 'Back to attendance'}
                        </Link>
                        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
                            {leadershipScope?.role_label || 'Leadership view'}
                            {unitLabel ? ` · ${unitLabel}` : ''}
                        </p>
                    </div>

                    <section className="overflow-hidden rounded-3xl border border-rose-100 bg-white shadow-sm shadow-rose-100/60 dark:border-rose-900/40 dark:bg-card dark:shadow-none">
                        <div className="bg-gradient-to-r from-rose-600 via-rose-500 to-slate-800 px-4 py-4 text-white sm:px-8 sm:py-5">
                            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                                <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                                    <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-base font-semibold tracking-wide ring-1 ring-white/30 sm:size-16 sm:text-lg">
                                        {initials(record.staff_name)}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase ring-1 ring-white/20">
                                                <UserMinus className="size-3.5" />
                                                Self-reported
                                            </span>
                                            <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold tracking-wide text-rose-700 uppercase">
                                                {statusLabel(record.status)}
                                            </span>
                                        </div>
                                        <h1 className="mt-2 text-xl font-semibold tracking-tight break-words sm:text-3xl">{record.staff_name}</h1>
                                        <p className="mt-1 break-words text-sm text-rose-50/90">
                                            {record.staff_role}
                                            {record.employee_id ? ` · ${record.employee_id}` : ''}
                                            {organization ? ` · ${organization}` : ''}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[22rem]">
                                    <HeaderStat icon={CalendarDays} label="Attendance date" value={record.date_display || '—'} />
                                    <HeaderStat icon={Clock3} label="Submitted" value={record.submitted_at_display || '—'} />
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-px bg-slate-100 dark:bg-sidebar-border sm:grid-cols-3">
                            <MetaTile icon={MapPin} label="Session" value={record.session_label} hint={record.kind_label} />
                            <MetaTile icon={Clock3} label="Scheduled time" value={timeRange || '—'} hint="Assigned timetable period" />
                            <MetaTile icon={FileText} label="Record source" value={record.source} hint="Distinct from automatic absence" />
                        </div>
                    </section>

                    <div className="grid gap-6 xl:grid-cols-12">
                        <section className="xl:col-span-8">
                            <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-7 dark:border-sidebar-border dark:bg-card">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold tracking-[0.18em] text-rose-600 uppercase dark:text-rose-300">Absence reason</p>
                                        <h2 className="mt-1 text-lg font-semibold text-slate-900 sm:text-xl dark:text-sidebar-foreground">Why this session was marked absent</h2>
                                    </div>
                                </div>

                                <blockquote className="mt-6 rounded-2xl border border-rose-100 bg-rose-50/70 px-4 py-4 text-base leading-7 text-slate-800 sm:px-5 sm:py-5 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-50">
                                    <p className="whitespace-pre-wrap break-words">{record.reason || 'No reason was provided.'}</p>
                                </blockquote>

                                {record.notes ? (
                                    <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 sm:px-5 dark:border-sidebar-border dark:bg-sidebar-accent">
                                        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-sidebar-foreground/55">Supporting information</p>
                                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 dark:text-sidebar-foreground/80">{record.notes}</p>
                                    </div>
                                ) : (
                                    <p className="mt-6 text-sm text-slate-500 dark:text-sidebar-foreground/55">No additional supporting information was submitted.</p>
                                )}
                            </div>

                            <div className="mt-6 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-7 dark:border-sidebar-border dark:bg-card">
                                <div className="flex items-start gap-3">
                                    <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-sidebar-accent dark:text-sidebar-foreground">
                                        <MessageSquareText className="size-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase">Conversation</p>
                                        <h2 className="mt-1 text-lg font-semibold text-slate-900 sm:text-xl dark:text-sidebar-foreground">
                                            {canReply ? 'Reply to this absence reason' : 'Supervisor replies'}
                                        </h2>
                                        <p className="mt-1 text-sm text-slate-500 dark:text-sidebar-foreground/60">
                                            {canReply
                                                ? 'Your reply is visible to the staff member and other authorized supervisors in this unit.'
                                                : 'Authorized supervisors can respond to the reason you submitted.'}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-6 space-y-4">
                                    {replies.length === 0 ? (
                                        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-sidebar-border dark:text-sidebar-foreground/55">
                                            No replies yet.
                                        </div>
                                    ) : (
                                        replies.map((reply) => (
                                            <article key={reply.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-sidebar-border dark:bg-sidebar-accent">
                                                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                                    <p className="break-words text-sm font-semibold text-slate-900 dark:text-sidebar-foreground">
                                                        {reply.author_name}
                                                        {reply.author_role ? (
                                                            <span className="ml-2 text-xs font-medium text-slate-500 dark:text-sidebar-foreground/55">{reply.author_role}</span>
                                                        ) : null}
                                                    </p>
                                                    <p className="text-xs text-slate-500 dark:text-sidebar-foreground/55">{reply.created_at_display}</p>
                                                </div>
                                                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 dark:text-sidebar-foreground/80">{reply.body}</p>
                                            </article>
                                        ))
                                    )}
                                </div>

                                {canReply && replyUrl && (
                                    <form onSubmit={submitReply} className="mt-6 space-y-3 border-t border-slate-100 pt-6 dark:border-sidebar-border">
                                        <label htmlFor="reply-body" className="block text-sm font-medium text-slate-800 dark:text-sidebar-foreground">
                                            Write a reply
                                        </label>
                                        <textarea
                                            id="reply-body"
                                            value={data.body}
                                            onChange={(event) => setData('body', event.target.value)}
                                            rows={5}
                                            required
                                            minLength={5}
                                            maxLength={4000}
                                            placeholder="Acknowledge the reason, ask for clarification, or share next steps."
                                            className="w-full rounded-2xl border border-slate-200 bg-background px-4 py-3 text-base text-sidebar-foreground outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 md:text-sm dark:border-sidebar-border dark:focus:ring-slate-800"
                                        />
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                            <InputError message={errors.body} />
                                            <button
                                                type="submit"
                                                disabled={processing}
                                                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto dark:bg-white dark:text-neutral-950"
                                            >
                                                <Send className="size-4" />
                                                {processing ? 'Sending…' : 'Send reply'}
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        </section>

                        <aside className="space-y-6 xl:col-span-4">
                            <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5 dark:border-sidebar-border dark:bg-card">
                                <p className="text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase">Staff member</p>
                                <div className="mt-4 space-y-4">
                                    <InfoRow icon={UserRound} label="Full name" value={record.staff_name} />
                                    <InfoRow icon={IdCard} label="Role" value={record.staff_role} />
                                    <InfoRow icon={IdCard} label="Employee ID" value={record.employee_id || '—'} />
                                    <InfoRow icon={Building2} label="Directorate / Faculty" value={record.faculty || '—'} />
                                    <InfoRow icon={Building2} label="Department" value={record.department || '—'} />
                                </div>
                            </div>

                            <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5 dark:border-sidebar-border dark:bg-card">
                                <p className="text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase">Attendance session</p>
                                <div className="mt-4 space-y-4">
                                    <InfoRow icon={CalendarDays} label="Date" value={record.date_display || '—'} />
                                    <InfoRow icon={MapPin} label={record.kind === 'lecturer' ? 'Course' : 'Venue / shift'} value={record.session_label} />
                                    <InfoRow icon={Clock3} label="Time" value={timeRange || '—'} />
                                    <InfoRow icon={FileText} label="Status" value={statusLabel(record.status)} />
                                    <InfoRow icon={Clock3} label="Submitted" value={record.submitted_at_display || '—'} />
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
            <div className="flex items-center gap-2 text-[11px] font-medium tracking-wide text-rose-100 uppercase">
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
                <Icon className="size-4 shrink-0 text-rose-500" />
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
