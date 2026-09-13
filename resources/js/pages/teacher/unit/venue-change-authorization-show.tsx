import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, ArrowRightLeft, Building2, CalendarDays, Clock3, FileText, IdCard, MapPin, ShieldCheck, UserRound } from 'lucide-react';

interface AuthorizationRecord {
    id: number;
    status: string;
    status_label: string;
    authorization_type: string;
    period_label: string;
    start_time?: string | null;
    end_time?: string | null;
    reason: string;
    notes?: string | null;
    staff_name: string;
    employee_id?: string | null;
    staff_role?: string;
    faculty_name?: string | null;
    department_name?: string | null;
    original_venue: string;
    authorized_venue: string;
    session_label: string;
    source_request_id?: number | null;
    approved_by_name?: string | null;
    approved_at_display?: string | null;
    revoked_by_name?: string | null;
    revoked_at_display?: string | null;
    revoke_reason?: string | null;
}

interface BulkSibling {
    id: number;
    status: string;
    session_label: string;
    original_venue?: string | null;
}

const breadcrumbs = (id: number): BreadcrumbItem[] => [
    { title: 'Dashboard', href: '/teacher/dashboard' },
    { title: 'Venue Change Authorizations', href: '/teacher/unit/venue-change-authorizations' },
    { title: `Authorization #${id}`, href: `/teacher/unit/venue-change-authorizations/${id}` },
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
    if (status === 'active') {
        return 'bg-white text-emerald-700';
    }

    if (status === 'revoked') {
        return 'bg-white text-rose-700';
    }

    return 'bg-white text-slate-700';
}

export default function UnitVenueChangeAuthorizationShow({
    authorization,
    bulkSiblings = [],
    leadershipScope,
}: {
    authorization: AuthorizationRecord;
    bulkSiblings?: BulkSibling[];
    leadershipScope?: { role_label?: string | null; faculty_name?: string | null; department_name?: string | null } | null;
}) {
    const unitLabel = leadershipScope?.department_name || leadershipScope?.faculty_name;
    const organization = [authorization.faculty_name, authorization.department_name].filter(Boolean).join(' · ');
    const dailyWindow = [formatTime(authorization.start_time), formatTime(authorization.end_time)].filter(Boolean).join(' – ');

    return (
        <AppLayout breadcrumbs={breadcrumbs(authorization.id)}>
            <Head title={`Authorization · ${authorization.staff_name}`} />

            <div className="min-h-full bg-gradient-to-b from-emerald-50/80 via-slate-50 to-slate-50 dark:from-emerald-950/20 dark:via-background dark:to-background">
                <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-5 p-3 pb-10 sm:p-4 md:p-6 lg:p-8">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <Link
                            href={route('teacher.unit.venue-change-authorizations.index')}
                            className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                        >
                            <ArrowLeft className="size-4" />
                            Back to authorizations
                        </Link>
                        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
                            {leadershipScope?.role_label || 'Leadership view'}
                            {unitLabel ? ` · ${unitLabel}` : ''}
                        </p>
                    </div>

                    <section className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm shadow-emerald-100/70 dark:border-emerald-900/40 dark:bg-card dark:shadow-none">
                        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-slate-800 px-4 py-4 text-white sm:px-8 sm:py-5">
                            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                                <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                                    <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-base font-semibold tracking-wide ring-1 ring-white/30 sm:size-16 sm:text-lg">
                                        {initials(authorization.staff_name)}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase ring-1 ring-white/20">
                                                <ShieldCheck className="size-3.5" />
                                                Authorization
                                            </span>
                                            <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase ${statusTone(authorization.status)}`}>
                                                {authorization.status_label}
                                            </span>
                                        </div>
                                        <h1 className="mt-2 text-xl font-semibold tracking-tight break-words sm:text-3xl">{authorization.staff_name}</h1>
                                        <p className="mt-1 break-words text-sm text-emerald-50/90">
                                            Authorization #{authorization.id}
                                            {authorization.staff_role ? ` · ${authorization.staff_role}` : ''}
                                            {authorization.employee_id ? ` · ${authorization.employee_id}` : ''}
                                            {organization ? ` · ${organization}` : ''}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[22rem]">
                                    <HeaderStat icon={CalendarDays} label="Authorized period" value={authorization.period_label || '—'} />
                                    <HeaderStat icon={Clock3} label="Approved" value={authorization.approved_at_display || '—'} />
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-px bg-slate-100 dark:bg-sidebar-border sm:grid-cols-3">
                            <MetaTile icon={MapPin} label="Original venue" value={authorization.original_venue} hint="Assigned attendance location" />
                            <MetaTile icon={ArrowRightLeft} label="Authorized venue" value={authorization.authorized_venue} hint="Approved replacement location" />
                            <MetaTile icon={CalendarDays} label="Attendance session" value={authorization.session_label} hint={authorizationTypeLabel(authorization.authorization_type)} />
                        </div>
                    </section>

                    <div className="grid gap-6 xl:grid-cols-12">
                        <section className="space-y-6 xl:col-span-8">
                            <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-7 dark:border-sidebar-border dark:bg-card">
                                <p className="text-xs font-semibold tracking-[0.18em] text-emerald-600 uppercase dark:text-emerald-300">Authorization reason</p>
                                <h2 className="mt-1 text-lg font-semibold text-slate-900 sm:text-xl dark:text-sidebar-foreground">Why this venue was approved</h2>
                                <blockquote className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-4 text-base leading-7 text-slate-800 sm:px-5 sm:py-5 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-50">
                                    <p className="whitespace-pre-wrap break-words">{authorization.reason || 'No reason was provided.'}</p>
                                </blockquote>
                                {authorization.notes ? (
                                    <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 sm:px-5 dark:border-sidebar-border dark:bg-sidebar-accent">
                                        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-sidebar-foreground/55">Additional notes</p>
                                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 dark:text-sidebar-foreground/80">{authorization.notes}</p>
                                    </div>
                                ) : (
                                    <p className="mt-6 text-sm text-slate-500 dark:text-sidebar-foreground/55">No additional notes were recorded.</p>
                                )}
                            </div>

                            {authorization.revoke_reason && (
                                <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 sm:p-7 dark:border-rose-900/50 dark:bg-rose-950/20">
                                    <p className="text-xs font-semibold tracking-[0.18em] text-rose-600 uppercase dark:text-rose-300">Revocation</p>
                                    <p className="mt-2 text-sm text-rose-800 dark:text-rose-100">{authorization.revoke_reason}</p>
                                    <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">
                                        {authorization.revoked_by_name ? `By ${authorization.revoked_by_name}` : 'Revoked'}
                                        {authorization.revoked_at_display ? ` · ${authorization.revoked_at_display}` : ''}
                                    </p>
                                </div>
                            )}

                            {bulkSiblings.length > 1 && (
                                <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-7 dark:border-sidebar-border dark:bg-card">
                                    <p className="text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase">Bulk group</p>
                                    <h2 className="mt-1 text-lg font-semibold text-slate-900 sm:text-xl dark:text-sidebar-foreground">
                                        Related schedules
                                    </h2>
                                    <div className="mt-5 space-y-3">
                                        {bulkSiblings.map((sibling) => (
                                            <Link
                                                key={sibling.id}
                                                href={route('teacher.unit.venue-change-authorizations.show', sibling.id)}
                                                className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 hover:border-emerald-200 dark:border-sidebar-border dark:bg-sidebar-accent"
                                            >
                                                <p className="font-semibold break-words text-slate-900 dark:text-sidebar-foreground">{sibling.session_label}</p>
                                                <p className="mt-1 text-xs text-slate-500 dark:text-sidebar-foreground/55">
                                                    {sibling.original_venue || 'Original venue'} · {sibling.status}
                                                </p>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {authorization.source_request_id && (
                                <Link
                                    href={route('teacher.unit.venue-change-requests.show', authorization.source_request_id)}
                                    className="flex min-h-11 items-center justify-between rounded-3xl border border-indigo-100 bg-indigo-50 px-4 py-4 text-sm font-medium text-indigo-800 hover:bg-indigo-100 dark:border-indigo-900/40 dark:bg-indigo-950/20 dark:text-indigo-100 dark:hover:bg-indigo-950/40"
                                >
                                    <span>View originating venue change request #{authorization.source_request_id}</span>
                                    <span aria-hidden>→</span>
                                </Link>
                            )}
                        </section>

                        <aside className="space-y-6 xl:col-span-4">
                            <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5 dark:border-sidebar-border dark:bg-card">
                                <p className="text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase">Staff member</p>
                                <div className="mt-4 space-y-4">
                                    <InfoRow icon={UserRound} label="Full name" value={authorization.staff_name} />
                                    <InfoRow icon={IdCard} label="Role" value={authorization.staff_role || 'Staff'} />
                                    <InfoRow icon={IdCard} label="Employee ID" value={authorization.employee_id || '—'} />
                                    <InfoRow icon={Building2} label="Directorate / Faculty" value={authorization.faculty_name || '—'} />
                                    <InfoRow icon={Building2} label="Department" value={authorization.department_name || '—'} />
                                </div>
                            </div>

                            <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5 dark:border-sidebar-border dark:bg-card">
                                <p className="text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase">Authorization details</p>
                                <div className="mt-4 space-y-4">
                                    <InfoRow icon={MapPin} label="Original venue" value={authorization.original_venue} />
                                    <InfoRow icon={ArrowRightLeft} label="Authorized venue" value={authorization.authorized_venue} />
                                    <InfoRow icon={CalendarDays} label="Period" value={authorization.period_label || '—'} />
                                    <InfoRow icon={Clock3} label="Daily window" value={dailyWindow || 'Full session'} />
                                    <InfoRow icon={FileText} label="Type" value={authorizationTypeLabel(authorization.authorization_type)} />
                                    <InfoRow icon={ShieldCheck} label="Approved by" value={authorization.approved_by_name || 'Administrator'} />
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
            <div className="flex items-center gap-2 text-[11px] font-medium tracking-wide text-emerald-100 uppercase">
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
                <Icon className="size-4 shrink-0 text-emerald-500" />
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
