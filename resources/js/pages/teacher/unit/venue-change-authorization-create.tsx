import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    ArrowRightLeft,
    CalendarDays,
    Check,
    Clock3,
    Loader2,
    MapPin,
    Search,
    ShieldCheck,
    Sparkles,
    UserRound,
} from 'lucide-react';
import { FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';

interface StaffMember {
    id: number;
    title?: string;
    first_name: string;
    last_name: string;
    employee_id?: string;
}

interface Venue {
    id: number;
    name: string;
}

interface Schedule {
    id: number;
    day: string;
    start_time: string;
    end_time: string;
    classroom_id: number | null;
    classroom?: string | null;
    course?: string;
    course_code?: string | null;
    class_label?: string;
    has_conflict?: boolean;
    search_text?: string;
}

interface PageProps {
    staffMembers: StaffMember[];
    venues: Venue[];
    leadershipScope?: { role_label?: string | null; faculty_name?: string | null; department_name?: string | null } | null;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/teacher/dashboard' },
    { title: 'Venue Change Authorizations', href: '/teacher/unit/venue-change-authorizations' },
    { title: 'Create', href: '/teacher/unit/venue-change-authorizations/create' },
];

const fieldClass =
    'h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 md:text-sm dark:border-sidebar-border dark:bg-background dark:text-sidebar-foreground dark:focus:ring-emerald-950';

function formatTime(time?: string | null) {
    if (!time) return '—';
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

function staffLabel(member?: StaffMember | null) {
    if (!member) return 'Not selected';

    return `${member.title || ''} ${member.first_name} ${member.last_name}`.trim();
}

export default function UnitVenueChangeAuthorizationCreate({ staffMembers, venues, leadershipScope }: PageProps) {
    const today = new Date().toISOString().slice(0, 10);
    const { data, setData, post, processing, errors } = useForm({
        staff_id: '',
        timetable_ids: [] as number[],
        authorized_classroom_id: '',
        authorization_type: 'both',
        start_date: today,
        end_date: today,
        start_time: '',
        end_time: '',
        reason: '',
        notes: '',
    });

    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [loadingSchedules, setLoadingSchedules] = useState(false);
    const [scheduleSearch, setScheduleSearch] = useState('');
    const [dayFilter, setDayFilter] = useState('');

    const unitLabel = leadershipScope?.department_name || leadershipScope?.faculty_name || 'your unit';
    const selectedStaff = staffMembers.find((member) => String(member.id) === data.staff_id) ?? null;
    const selectedVenue = venues.find((venue) => String(venue.id) === data.authorized_classroom_id) ?? null;
    const periodLabel =
        data.start_date && data.end_date
            ? data.start_date === data.end_date
                ? data.start_date
                : `${data.start_date} – ${data.end_date}`
            : 'Choose dates';

    useEffect(() => {
        if (!data.staff_id) {
            setSchedules([]);
            setData('timetable_ids', []);
            return;
        }

        setLoadingSchedules(true);
        const params = new URLSearchParams({
            start_date: data.start_date,
            end_date: data.end_date || data.start_date,
        });
        fetch(`${route('teacher.unit.venue-change-authorizations.staff-schedules', data.staff_id)}?${params}`, {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
        })
            .then((response) => response.json())
            .then((payload) => {
                const next: Schedule[] = payload.data || [];
                setSchedules(next);
                setData(
                    'timetable_ids',
                    data.timetable_ids.filter((id) => next.some((schedule) => schedule.id === id)),
                );
            })
            .catch(() => {
                setSchedules([]);
                setData('timetable_ids', []);
            })
            .finally(() => setLoadingSchedules(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data.staff_id, data.start_date, data.end_date]);

    const dayOptions = useMemo(() => Array.from(new Set(schedules.map((schedule) => schedule.day).filter(Boolean))), [schedules]);

    const filteredSchedules = useMemo(() => {
        const term = scheduleSearch.trim().toLowerCase();

        return schedules.filter((schedule) => {
            if (dayFilter && schedule.day !== dayFilter) return false;
            if (!term) return true;

            return (schedule.search_text || '').includes(term);
        });
    }, [schedules, scheduleSearch, dayFilter]);

    const selectedSchedules = useMemo(
        () => schedules.filter((schedule) => data.timetable_ids.includes(schedule.id)),
        [schedules, data.timetable_ids],
    );

    const selectableFiltered = filteredSchedules.filter((schedule) => !schedule.has_conflict);
    const readyToSave = data.timetable_ids.length > 0 && Boolean(data.staff_id && data.authorized_classroom_id && data.reason);

    const toggleSchedule = (schedule: Schedule) => {
        if (schedule.has_conflict) return;

        const selected = data.timetable_ids.includes(schedule.id);
        setData(
            'timetable_ids',
            selected ? data.timetable_ids.filter((id) => id !== schedule.id) : [...data.timetable_ids, schedule.id],
        );
    };

    const selectAllFiltered = () => {
        const ids = new Set(data.timetable_ids);
        selectableFiltered.forEach((schedule) => ids.add(schedule.id));
        setData('timetable_ids', Array.from(ids));
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        post(route('teacher.unit.venue-change-authorizations.store'));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Authorize Venue Change" />

            <form
                onSubmit={submit}
                className="min-h-full bg-gradient-to-b from-emerald-50/80 via-slate-50 to-slate-50 dark:from-emerald-950/20 dark:via-background dark:to-background"
            >
                <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-5 p-3 pb-10 sm:p-4 md:p-6 lg:p-8">
                    <Link
                        href={route('teacher.unit.venue-change-authorizations.index')}
                        className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                    >
                        <ArrowLeft className="size-4" />
                        Back to authorizations
                    </Link>

                    <section className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm shadow-emerald-100/70 dark:border-emerald-900/40 dark:bg-card dark:shadow-none">
                        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-slate-800 px-4 py-5 text-white sm:px-8 sm:py-6">
                            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase ring-1 ring-white/20">
                                            <Sparkles className="size-3.5" />
                                            New authorization
                                        </span>
                                        <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold tracking-wide text-emerald-700 uppercase">
                                            {leadershipScope?.role_label || 'Leadership'}
                                        </span>
                                    </div>
                                    <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Move attendance to the right room</h1>
                                    <p className="mt-2 max-w-2xl text-sm text-emerald-50/90">
                                        Approve a replacement venue for an administrator in {unitLabel}. The change applies as soon as you save.
                                    </p>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[28rem]">
                                    <HeroStat label="Staff" value={selectedStaff ? staffLabel(selectedStaff) : 'Pick staff'} />
                                    <HeroStat label="Venue" value={selectedVenue?.name || 'Pick venue'} />
                                    <HeroStat label="Schedules" value={`${data.timetable_ids.length} selected`} />
                                </div>
                            </div>
                        </div>
                    </section>

                    <div className="grid gap-6 xl:grid-cols-12">
                        <div className="space-y-6 xl:col-span-8">
                            <Section step="01" title="Who and when" subtitle="Choose the staff member and the dates this override covers.">
                                <div className="grid gap-4">
                                    <Field label="Staff member" htmlFor="staff_id" error={errors.staff_id} required>
                                        <select
                                            id="staff_id"
                                            value={data.staff_id}
                                            onChange={(event) => {
                                                setData('staff_id', event.target.value);
                                                setData('timetable_ids', []);
                                                setScheduleSearch('');
                                                setDayFilter('');
                                            }}
                                            className={cn(fieldClass, errors.staff_id && 'border-rose-400')}
                                            required
                                        >
                                            <option value="">Select an administrator in your unit</option>
                                            {staffMembers.map((member) => (
                                                <option key={member.id} value={member.id}>
                                                    {staffLabel(member)}
                                                    {member.employee_id ? ` · ${member.employee_id}` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <Field label="Start date" htmlFor="start_date" error={errors.start_date} required>
                                            <input
                                                id="start_date"
                                                type="date"
                                                value={data.start_date}
                                                onChange={(event) => {
                                                    const nextStart = event.target.value;
                                                    setData('start_date', nextStart);
                                                    if (data.end_date && data.end_date < nextStart) {
                                                        setData('end_date', nextStart);
                                                    }
                                                }}
                                                className={fieldClass}
                                                required
                                            />
                                        </Field>
                                        <Field label="End date" htmlFor="end_date" error={errors.end_date} required>
                                            <input
                                                id="end_date"
                                                type="date"
                                                value={data.end_date}
                                                min={data.start_date}
                                                onChange={(event) => setData('end_date', event.target.value)}
                                                className={fieldClass}
                                                required
                                            />
                                        </Field>
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <Field label="Daily start time" htmlFor="start_time" error={errors.start_time} hint="Optional">
                                            <input
                                                id="start_time"
                                                type="time"
                                                value={data.start_time}
                                                onChange={(event) => setData('start_time', event.target.value)}
                                                className={fieldClass}
                                            />
                                        </Field>
                                        <Field label="Daily end time" htmlFor="end_time" error={errors.end_time} hint="Optional">
                                            <input
                                                id="end_time"
                                                type="time"
                                                value={data.end_time}
                                                onChange={(event) => setData('end_time', event.target.value)}
                                                className={fieldClass}
                                            />
                                        </Field>
                                    </div>
                                </div>
                            </Section>

                            <Section
                                step="02"
                                title="Which sessions"
                                subtitle="Select one or more administrator schedules. Conflicting rows stay locked."
                                action={
                                    <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                                        {data.timetable_ids.length} selected
                                    </span>
                                }
                            >
                                <div className="flex flex-col gap-3 lg:flex-row">
                                    <div className="relative min-w-0 flex-1">
                                        <Search className="pointer-events-none absolute top-3.5 left-4 size-4 text-slate-400" />
                                        <input
                                            value={scheduleSearch}
                                            onChange={(event) => setScheduleSearch(event.target.value)}
                                            placeholder="Search course, venue, day, or time"
                                            disabled={!data.staff_id}
                                            className={cn(fieldClass, 'pl-11')}
                                        />
                                    </div>
                                    <select
                                        value={dayFilter}
                                        onChange={(event) => setDayFilter(event.target.value)}
                                        disabled={!data.staff_id}
                                        className={cn(fieldClass, 'lg:w-44')}
                                    >
                                        <option value="">All days</option>
                                        {dayOptions.map((day) => (
                                            <option key={day} value={day}>
                                                {day}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={selectAllFiltered}
                                            disabled={!data.staff_id || selectableFiltered.length === 0}
                                            className="min-h-12 rounded-2xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-sidebar-border dark:text-sidebar-foreground dark:hover:bg-sidebar-accent"
                                        >
                                            Select filtered
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setData('timetable_ids', [])}
                                            disabled={data.timetable_ids.length === 0}
                                            className="min-h-12 rounded-2xl px-4 text-sm font-medium text-slate-500 hover:text-slate-800 disabled:opacity-50 dark:text-sidebar-foreground/60"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>

                                {errors.timetable_ids && (
                                    <div className="mt-4 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
                                        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                                        <span>{errors.timetable_ids}</span>
                                    </div>
                                )}

                                <div className="mt-4 space-y-3">
                                    {!data.staff_id ? (
                                        <EmptyState title="Start with a staff member" description="Their eligible schedules will appear here." />
                                    ) : loadingSchedules ? (
                                        <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 px-4 py-14 text-sm text-slate-500 dark:border-sidebar-border">
                                            <Loader2 className="size-4 animate-spin" />
                                            Loading schedules…
                                        </div>
                                    ) : filteredSchedules.length === 0 ? (
                                        <EmptyState title="No matching schedules" description="Try another search term or day filter." />
                                    ) : (
                                        filteredSchedules.map((schedule) => {
                                            const selected = data.timetable_ids.includes(schedule.id);

                                            return (
                                                <button
                                                    key={schedule.id}
                                                    type="button"
                                                    disabled={schedule.has_conflict}
                                                    onClick={() => toggleSchedule(schedule)}
                                                    className={cn(
                                                        'flex w-full min-h-16 items-start justify-between gap-3 rounded-2xl border px-4 py-4 text-left transition',
                                                        schedule.has_conflict
                                                            ? 'cursor-not-allowed border-amber-200 bg-amber-50/80 opacity-70 dark:border-amber-900/40 dark:bg-amber-950/20'
                                                            : selected
                                                              ? 'border-emerald-300 bg-emerald-50 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/30'
                                                              : 'border-slate-200 bg-white hover:border-emerald-200 dark:border-sidebar-border dark:bg-card',
                                                    )}
                                                >
                                                    <div className="min-w-0">
                                                        <p className="font-semibold break-words text-slate-900 dark:text-sidebar-foreground">{schedule.course}</p>
                                                        <p className="mt-1 text-sm text-slate-600 dark:text-sidebar-foreground/70">
                                                            {schedule.day} · {formatTime(schedule.start_time)} – {formatTime(schedule.end_time)}
                                                        </p>
                                                        <p className="mt-1 text-xs text-slate-500 dark:text-sidebar-foreground/55">
                                                            {schedule.classroom || 'No venue'}
                                                            {schedule.course_code ? ` · ${schedule.course_code}` : ''}
                                                        </p>
                                                        {schedule.has_conflict && (
                                                            <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                                                                Already authorized for this period
                                                            </p>
                                                        )}
                                                    </div>
                                                    <span
                                                        className={cn(
                                                            'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border',
                                                            selected
                                                                ? 'border-emerald-600 bg-emerald-600 text-white'
                                                                : 'border-slate-300 text-transparent dark:border-sidebar-border',
                                                        )}
                                                    >
                                                        <Check className="size-3.5" />
                                                    </span>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </Section>

                            <Section step="03" title="Where and why" subtitle="These settings apply to every selected schedule.">
                                <div className="grid gap-4">
                                    <Field label="Replacement venue" htmlFor="authorized_classroom_id" error={errors.authorized_classroom_id} required>
                                        <select
                                            id="authorized_classroom_id"
                                            value={data.authorized_classroom_id}
                                            onChange={(event) => setData('authorized_classroom_id', event.target.value)}
                                            className={cn(fieldClass, errors.authorized_classroom_id && 'border-rose-400')}
                                            required
                                        >
                                            <option value="">Select the new venue</option>
                                            {venues.map((venue) => (
                                                <option key={venue.id} value={venue.id}>
                                                    {venue.name}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>

                                    <Field label="Authorization type" htmlFor="authorization_type" error={errors.authorization_type} required>
                                        <div className="grid gap-2 sm:grid-cols-3">
                                            {[
                                                { value: 'check_in', label: 'Check-in only' },
                                                { value: 'check_out', label: 'Check-out only' },
                                                { value: 'both', label: 'Both' },
                                            ].map((option) => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => setData('authorization_type', option.value)}
                                                    className={cn(
                                                        'min-h-12 rounded-2xl border px-3 text-sm font-semibold transition',
                                                        data.authorization_type === option.value
                                                            ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100'
                                                            : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200 dark:border-sidebar-border dark:bg-card dark:text-sidebar-foreground/70',
                                                    )}
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                    </Field>

                                    <Field label="Reason" htmlFor="reason" error={errors.reason} required>
                                        <input
                                            id="reason"
                                            value={data.reason}
                                            onChange={(event) => setData('reason', event.target.value)}
                                            maxLength={500}
                                            required
                                            placeholder="e.g. Original hall is booked for an event"
                                            className={cn(fieldClass, errors.reason && 'border-rose-400')}
                                        />
                                    </Field>

                                    <Field label="Notes" htmlFor="notes" error={errors.notes} hint="Optional">
                                        <textarea
                                            id="notes"
                                            value={data.notes}
                                            onChange={(event) => setData('notes', event.target.value)}
                                            rows={4}
                                            placeholder="Anything else the staff member or audit trail should know"
                                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 md:text-sm dark:border-sidebar-border dark:bg-background dark:text-sidebar-foreground dark:focus:ring-emerald-950"
                                        />
                                    </Field>
                                </div>
                            </Section>
                        </div>

                        <aside className="xl:col-span-4">
                            <div className="space-y-4 xl:sticky xl:top-6">
                                <div className="rounded-3xl border border-emerald-100 bg-emerald-50/80 p-5 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
                                    <p className="text-xs font-semibold tracking-[0.18em] text-emerald-700 uppercase dark:text-emerald-300">Live preview</p>
                                    <h2 className="mt-2 text-lg font-semibold text-emerald-950 dark:text-emerald-50">What you’re authorizing</h2>
                                    <div className="mt-5 space-y-4">
                                        <PreviewRow icon={UserRound} label="Staff" value={staffLabel(selectedStaff)} />
                                        <PreviewRow icon={ArrowRightLeft} label="New venue" value={selectedVenue?.name || 'Not selected'} />
                                        <PreviewRow icon={CalendarDays} label="Period" value={periodLabel} />
                                        <PreviewRow icon={Clock3} label="Type" value={data.authorization_type.replaceAll('_', ' ')} />
                                        <PreviewRow icon={MapPin} label="Sessions" value={`${data.timetable_ids.length} selected`} />
                                    </div>

                                    {selectedSchedules.length > 0 ? (
                                        <ul className="mt-5 space-y-2 rounded-2xl border border-emerald-100 bg-white/80 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/30">
                                            {selectedSchedules.slice(0, 5).map((schedule) => (
                                                <li key={schedule.id} className="text-sm text-emerald-950 dark:text-emerald-50">
                                                    <span className="font-medium">{schedule.course}</span>
                                                    <span className="block text-xs text-emerald-800/70 dark:text-emerald-200/70">
                                                        {schedule.day} · {formatTime(schedule.start_time)} – {formatTime(schedule.end_time)}
                                                    </span>
                                                </li>
                                            ))}
                                            {selectedSchedules.length > 5 && (
                                                <li className="text-xs font-medium text-emerald-800 dark:text-emerald-200">
                                                    +{selectedSchedules.length - 5} more
                                                </li>
                                            )}
                                        </ul>
                                    ) : (
                                        <p className="mt-5 rounded-2xl border border-dashed border-emerald-200 px-3 py-4 text-center text-xs text-emerald-800/70 dark:border-emerald-900/50 dark:text-emerald-200/70">
                                            Select at least one schedule to preview the authorization.
                                        </p>
                                    )}
                                </div>

                                <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-sidebar-border dark:bg-card">
                                    <button
                                        type="submit"
                                        disabled={processing || !readyToSave}
                                        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {processing ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                                        {processing
                                            ? 'Saving…'
                                            : data.timetable_ids.length > 1
                                              ? `Authorize ${data.timetable_ids.length} sessions`
                                              : 'Create authorization'}
                                    </button>
                                    <Link
                                        href={route('teacher.unit.venue-change-authorizations.index')}
                                        className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-sidebar-border dark:text-sidebar-foreground dark:hover:bg-sidebar-accent"
                                    >
                                        Cancel
                                    </Link>
                                    {!readyToSave && (
                                        <p className="mt-3 text-center text-xs text-slate-500 dark:text-sidebar-foreground/55">
                                            Choose staff, at least one schedule, a venue, and a reason to continue.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </aside>
                    </div>
                </div>
            </form>
        </AppLayout>
    );
}

function Section({
    step,
    title,
    subtitle,
    action,
    children,
}: {
    step: string;
    title: string;
    subtitle: string;
    action?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6 dark:border-sidebar-border dark:bg-card">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-xs font-bold tracking-wide text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                        {step}
                    </span>
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-sidebar-foreground">{title}</h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-sidebar-foreground/60">{subtitle}</p>
                    </div>
                </div>
                {action}
            </div>
            <div className="mt-5">{children}</div>
        </section>
    );
}

function Field({
    label,
    htmlFor,
    error,
    hint,
    required,
    children,
}: {
    label: string;
    htmlFor: string;
    error?: string;
    hint?: string;
    required?: boolean;
    children: ReactNode;
}) {
    return (
        <label htmlFor={htmlFor} className="block space-y-2">
            <span className="flex items-center justify-between gap-2 text-sm font-medium text-slate-800 dark:text-sidebar-foreground">
                <span>
                    {label}
                    {required ? <span className="text-rose-500"> *</span> : null}
                </span>
                {hint && !error ? <span className="text-xs font-normal text-slate-400">{hint}</span> : null}
            </span>
            {children}
            {error ? <span className="text-xs text-rose-600">{error}</span> : null}
        </label>
    );
}

function HeroStat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15">
            <p className="text-[11px] font-medium tracking-wide text-emerald-100 uppercase">{label}</p>
            <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
        </div>
    );
}

function PreviewRow({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
    return (
        <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200">
                <Icon className="size-4" />
            </div>
            <div className="min-w-0">
                <p className="text-xs font-medium text-emerald-800/70 dark:text-emerald-200/70">{label}</p>
                <p className="mt-0.5 break-words text-sm font-semibold capitalize text-emerald-950 dark:text-emerald-50">{value}</p>
            </div>
        </div>
    );
}

function EmptyState({ title, description }: { title: string; description: string }) {
    return (
        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center dark:border-sidebar-border">
            <p className="font-medium text-slate-800 dark:text-sidebar-foreground">{title}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-sidebar-foreground/55">{description}</p>
        </div>
    );
}
