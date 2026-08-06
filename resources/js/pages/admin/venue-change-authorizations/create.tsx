import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    CalendarClock,
    CheckSquare,
    Clock3,
    Loader2,
    MapPin,
    Save,
    Search,
    ShieldCheck,
    Square,
    UserRound,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';

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
    authorization_date?: string;
    has_conflict?: boolean;
    search_text?: string;
}

interface PageProps {
    staffMembers: StaffMember[];
    venues: Venue[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/admin/dashboard' },
    { title: 'Venue Change Authorizations', href: '/admin/venue-change-authorizations' },
    { title: 'Create', href: '/admin/venue-change-authorizations/create' },
];

const inputClass =
    'border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50';

function formatTime(time?: string | null) {
    if (!time) return '—';
    const normalized = time.length === 5 ? `${time}:00` : time;
    return new Date(`2000-01-01T${normalized}`).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
}

export default function VenueChangeAuthorizationCreate({ staffMembers, venues }: PageProps) {
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
        fetch(`${route('admin.venue-change-authorizations.staff-schedules', data.staff_id)}?${params}`, {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
        })
            .then((r) => r.json())
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

    const dayOptions = useMemo(
        () => Array.from(new Set(schedules.map((schedule) => schedule.day).filter(Boolean))),
        [schedules],
    );

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

    const clearSelection = () => setData('timetable_ids', []);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        post(route('admin.venue-change-authorizations.store'));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Authorize Venue Change" />

            <form onSubmit={submit} className="flex h-full flex-1 flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 rounded-full border border-sidebar-border/70 bg-white px-3 py-1 text-xs font-medium text-sidebar-foreground/70 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                            <ShieldCheck className="size-3.5 text-emerald-600" />
                            Bulk or single schedule support
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-sidebar-foreground md:text-3xl">
                            Authorize Venue Change
                        </h1>
                        <p className="max-w-2xl text-sm text-sidebar-foreground/60">
                            Select one or more schedules for the same administrator, then apply a shared replacement venue
                            and authorization settings.
                        </p>
                    </div>
                    <Button asChild variant="outline" className="shrink-0">
                        <Link href={route('admin.venue-change-authorizations.index')}>
                            <ArrowLeft className="size-4" />
                            Back to list
                        </Link>
                    </Button>
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
                    <div className="space-y-6">
                        <Card className="border-sidebar-border/70 bg-white shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <UserRound className="size-4 text-sidebar-foreground/50" />
                                    Staff & timing
                                </CardTitle>
                                <CardDescription>Choose the administrator and the authorization period.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Field
                                    label="Staff member"
                                    htmlFor="staff_id"
                                    error={errors.staff_id}
                                    required
                                >
                                    <select
                                        id="staff_id"
                                        value={data.staff_id}
                                        onChange={(e) => {
                                            setData('staff_id', e.target.value);
                                            setData('timetable_ids', []);
                                            setScheduleSearch('');
                                            setDayFilter('');
                                        }}
                                        className={cn(inputClass, errors.staff_id && 'border-destructive')}
                                        required
                                        aria-invalid={Boolean(errors.staff_id)}
                                    >
                                        <option value="">Select administrator</option>
                                        {staffMembers.map((member) => (
                                            <option key={member.id} value={member.id}>
                                                {member.title} {member.first_name} {member.last_name} ({member.employee_id})
                                            </option>
                                        ))}
                                    </select>
                                </Field>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Field label="Start date" htmlFor="start_date" error={errors.start_date} required>
                                        <Input
                                            id="start_date"
                                            type="date"
                                            value={data.start_date}
                                            onChange={(e) => {
                                                const nextStart = e.target.value;
                                                setData('start_date', nextStart);
                                                if (data.end_date && data.end_date < nextStart) {
                                                    setData('end_date', nextStart);
                                                }
                                            }}
                                            required
                                            aria-invalid={Boolean(errors.start_date)}
                                        />
                                    </Field>
                                    <Field
                                        label="End date"
                                        htmlFor="end_date"
                                        error={errors.end_date}
                                        hint="Must be on or after start date"
                                        required
                                    >
                                        <Input
                                            id="end_date"
                                            type="date"
                                            value={data.end_date}
                                            min={data.start_date}
                                            onChange={(e) => setData('end_date', e.target.value)}
                                            required
                                            aria-invalid={Boolean(errors.end_date)}
                                        />
                                    </Field>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Field label="Daily start time" htmlFor="start_time" error={errors.start_time} hint="Optional window each day">
                                        <Input
                                            id="start_time"
                                            type="time"
                                            value={data.start_time}
                                            onChange={(e) => setData('start_time', e.target.value)}
                                        />
                                    </Field>
                                    <Field label="Daily end time" htmlFor="end_time" error={errors.end_time} hint="Optional">
                                        <Input
                                            id="end_time"
                                            type="time"
                                            value={data.end_time}
                                            onChange={(e) => setData('end_time', e.target.value)}
                                        />
                                    </Field>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-sidebar-border/70 bg-white shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                            <CardHeader>
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2 text-base">
                                            <CalendarClock className="size-4 text-sidebar-foreground/50" />
                                            Schedules
                                        </CardTitle>
                                        <CardDescription className="mt-1.5">
                                            Search and select eligible schedules. Conflicting rows are disabled.
                                        </CardDescription>
                                    </div>
                                    <Badge variant="secondary" className="w-fit">
                                        {data.timetable_ids.length} selected
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex flex-col gap-3 lg:flex-row">
                                    <div className="relative min-w-0 flex-1">
                                        <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
                                        <Input
                                            value={scheduleSearch}
                                            onChange={(e) => setScheduleSearch(e.target.value)}
                                            placeholder="Search course, venue, day, time..."
                                            className="pl-9"
                                            disabled={!data.staff_id}
                                            aria-label="Search schedules"
                                        />
                                    </div>
                                    <select
                                        value={dayFilter}
                                        onChange={(e) => setDayFilter(e.target.value)}
                                        className={cn(inputClass, 'lg:w-44')}
                                        disabled={!data.staff_id}
                                        aria-label="Filter by day"
                                    >
                                        <option value="">All days</option>
                                        {dayOptions.map((day) => (
                                            <option key={day} value={day}>
                                                {day}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="flex gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={selectAllFiltered}
                                            disabled={!data.staff_id || selectableFiltered.length === 0}
                                        >
                                            Select filtered
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={clearSelection}
                                            disabled={data.timetable_ids.length === 0}
                                        >
                                            Clear
                                        </Button>
                                    </div>
                                </div>

                                {errors.timetable_ids && (
                                    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                                        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                                        <span>{errors.timetable_ids}</span>
                                    </div>
                                )}

                                <div className="overflow-hidden rounded-xl border border-sidebar-border/60">
                                    <div className="max-h-[22rem] overflow-auto">
                                        {!data.staff_id ? (
                                            <EmptyState
                                                icon={UserRound}
                                                title="Select a staff member"
                                                description="Schedules will appear here once an administrator is selected."
                                            />
                                        ) : loadingSchedules ? (
                                            <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-sidebar-foreground/60">
                                                <Loader2 className="size-4 animate-spin" />
                                                Loading schedules...
                                            </div>
                                        ) : filteredSchedules.length === 0 ? (
                                            <EmptyState
                                                icon={Search}
                                                title="No matching schedules"
                                                description="Try a different search term or day filter."
                                            />
                                        ) : (
                                            <>
                                                <div className="hidden md:block">
                                                    <table className="min-w-full text-sm">
                                                        <thead className="sticky top-0 z-10 bg-sidebar-accent/90 text-left text-xs font-semibold tracking-wide text-sidebar-foreground/60 uppercase backdrop-blur">
                                                            <tr>
                                                                <th className="w-10 px-3 py-2.5" />
                                                                <th className="px-3 py-2.5">Course / Subject</th>
                                                                <th className="px-3 py-2.5">Class</th>
                                                                <th className="px-3 py-2.5">Original Venue</th>
                                                                <th className="px-3 py-2.5">Day</th>
                                                                <th className="px-3 py-2.5">Start</th>
                                                                <th className="px-3 py-2.5">End</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-sidebar-border/40">
                                                            {filteredSchedules.map((schedule) => {
                                                                const selected = data.timetable_ids.includes(schedule.id);
                                                                return (
                                                                    <tr
                                                                        key={schedule.id}
                                                                        tabIndex={schedule.has_conflict ? -1 : 0}
                                                                        role="checkbox"
                                                                        aria-checked={selected}
                                                                        aria-disabled={schedule.has_conflict}
                                                                        onClick={() => toggleSchedule(schedule)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === ' ' || e.key === 'Enter') {
                                                                                e.preventDefault();
                                                                                toggleSchedule(schedule);
                                                                            }
                                                                        }}
                                                                        className={cn(
                                                                            'transition-colors outline-none focus-visible:bg-sky-50 dark:focus-visible:bg-sky-950/20',
                                                                            schedule.has_conflict
                                                                                ? 'cursor-not-allowed bg-amber-50/70 opacity-75 dark:bg-amber-950/20'
                                                                                : selected
                                                                                  ? 'cursor-pointer bg-sky-50 dark:bg-sky-950/30'
                                                                                  : 'cursor-pointer hover:bg-sidebar-accent/50',
                                                                        )}
                                                                    >
                                                                        <td className="px-3 py-3">
                                                                            {selected ? (
                                                                                <CheckSquare className="size-4 text-sky-600" />
                                                                            ) : (
                                                                                <Square className="size-4 text-sidebar-foreground/35" />
                                                                            )}
                                                                        </td>
                                                                        <td className="px-3 py-3">
                                                                            <p className="font-medium text-sidebar-foreground">{schedule.course}</p>
                                                                            {schedule.course_code && (
                                                                                <p className="text-xs text-sidebar-foreground/50">{schedule.course_code}</p>
                                                                            )}
                                                                            {schedule.has_conflict && (
                                                                                <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                                                                                    Already authorized for this date
                                                                                </p>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-3 py-3 text-sidebar-foreground/80">{schedule.class_label}</td>
                                                                        <td className="px-3 py-3 text-sidebar-foreground/80">{schedule.classroom || '—'}</td>
                                                                        <td className="px-3 py-3 text-sidebar-foreground/80">{schedule.day}</td>
                                                                        <td className="px-3 py-3 text-sidebar-foreground/80">{formatTime(schedule.start_time)}</td>
                                                                        <td className="px-3 py-3 text-sidebar-foreground/80">{formatTime(schedule.end_time)}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                <div className="space-y-2 p-3 md:hidden">
                                                    {filteredSchedules.map((schedule) => {
                                                        const selected = data.timetable_ids.includes(schedule.id);
                                                        return (
                                                            <button
                                                                key={schedule.id}
                                                                type="button"
                                                                disabled={schedule.has_conflict}
                                                                onClick={() => toggleSchedule(schedule)}
                                                                className={cn(
                                                                    'w-full rounded-xl border p-3 text-left transition-all',
                                                                    schedule.has_conflict
                                                                        ? 'border-amber-200 bg-amber-50/70 opacity-70'
                                                                        : selected
                                                                          ? 'border-sky-300 bg-sky-50 shadow-sm'
                                                                          : 'border-sidebar-border/60 bg-white hover:border-sidebar-border',
                                                                )}
                                                            >
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div>
                                                                        <p className="font-medium text-sidebar-foreground">{schedule.course}</p>
                                                                        <p className="mt-1 text-xs text-sidebar-foreground/60">
                                                                            {schedule.class_label} · {schedule.classroom || 'No venue'}
                                                                        </p>
                                                                        <p className="mt-1 text-xs text-sidebar-foreground/60">
                                                                            {schedule.day} · {formatTime(schedule.start_time)}–{formatTime(schedule.end_time)}
                                                                        </p>
                                                                    </div>
                                                                    {selected ? (
                                                                        <CheckSquare className="size-4 text-sky-600" />
                                                                    ) : (
                                                                        <Square className="size-4 text-sidebar-foreground/35" />
                                                                    )}
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-sidebar-border/70 bg-white shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <MapPin className="size-4 text-sidebar-foreground/50" />
                                    Venue & authorization details
                                </CardTitle>
                                <CardDescription>These settings apply to every selected schedule.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Field
                                    label="Replacement venue"
                                    htmlFor="authorized_classroom_id"
                                    error={errors.authorized_classroom_id}
                                    hint="Each schedule keeps its own original venue for audit."
                                    required
                                >
                                    <select
                                        id="authorized_classroom_id"
                                        value={data.authorized_classroom_id}
                                        onChange={(e) => setData('authorized_classroom_id', e.target.value)}
                                        className={cn(inputClass, errors.authorized_classroom_id && 'border-destructive')}
                                        required
                                        aria-invalid={Boolean(errors.authorized_classroom_id)}
                                    >
                                        <option value="">Select venue</option>
                                        {venues.map((venue) => (
                                            <option key={venue.id} value={venue.id}>
                                                {venue.name}
                                            </option>
                                        ))}
                                    </select>
                                </Field>

                                <Field label="Authorization type" htmlFor="authorization_type" error={errors.authorization_type} required>
                                    <select
                                        id="authorization_type"
                                        value={data.authorization_type}
                                        onChange={(e) => setData('authorization_type', e.target.value)}
                                        className={inputClass}
                                    >
                                        <option value="check_in">Check-in only</option>
                                        <option value="check_out">Check-out only</option>
                                        <option value="both">Both check-in and check-out</option>
                                    </select>
                                </Field>

                                <Field label="Reason" htmlFor="reason" error={errors.reason} hint="Shared across all selected schedules" required>
                                    <Input
                                        id="reason"
                                        value={data.reason}
                                        onChange={(e) => setData('reason', e.target.value)}
                                        required
                                        maxLength={500}
                                        placeholder="e.g. Original venue unavailable due to maintenance"
                                        aria-invalid={Boolean(errors.reason)}
                                    />
                                </Field>

                                <Field label="Notes" htmlFor="notes" error={errors.notes} hint="Optional">
                                    <textarea
                                        id="notes"
                                        value={data.notes}
                                        onChange={(e) => setData('notes', e.target.value)}
                                        className="border-input bg-background min-h-28 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                                        placeholder="Additional context for reviewers or audit"
                                    />
                                </Field>
                            </CardContent>
                        </Card>
                    </div>

                    <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
                        <Card className="border-sky-200/80 bg-sky-50/80 shadow-sm dark:border-sky-900/40 dark:bg-sky-950/20">
                            <CardHeader>
                                <CardTitle className="text-base text-sky-950 dark:text-sky-100">Selection summary</CardTitle>
                                <CardDescription className="text-sky-800/80 dark:text-sky-200/70">
                                    Review what will be authorized before saving.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <SummaryRow icon={UserRound} label="Staff" value={
                                    data.staff_id
                                        ? (() => {
                                              const member = staffMembers.find((item) => String(item.id) === data.staff_id);
                                              return member
                                                  ? `${member.title || ''} ${member.first_name} ${member.last_name}`.trim()
                                                  : 'Selected';
                                          })()
                                        : 'Not selected'
                                } />
                                <SummaryRow icon={MapPin} label="Replacement venue" value={
                                    venues.find((venue) => String(venue.id) === data.authorized_classroom_id)?.name || 'Not selected'
                                } />
                                <SummaryRow
                                    icon={CalendarClock}
                                    label="Period"
                                    value={
                                        data.start_date && data.end_date
                                            ? data.start_date === data.end_date
                                                ? data.start_date
                                                : `${data.start_date} – ${data.end_date}`
                                            : 'Not selected'
                                    }
                                />
                                <SummaryRow icon={Clock3} label="Type" value={data.authorization_type.replace(/_/g, ' ')} />
                                <SummaryRow
                                    icon={CalendarClock}
                                    label="Schedules"
                                    value={`${data.timetable_ids.length} selected`}
                                />

                                {selectedSchedules.length > 0 ? (
                                    <ul className="space-y-2 rounded-xl border border-sky-200/70 bg-white/70 p-3 text-xs text-sky-950 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-100">
                                        {selectedSchedules.slice(0, 6).map((schedule) => (
                                            <li key={schedule.id} className="leading-relaxed">
                                                <span className="font-medium">{schedule.course}</span>
                                                <span className="text-sky-800/70 dark:text-sky-200/70">
                                                    {' '}
                                                    · {schedule.classroom || 'No venue'} · {schedule.day}{' '}
                                                    {formatTime(schedule.start_time)}–{formatTime(schedule.end_time)}
                                                </span>
                                            </li>
                                        ))}
                                        {selectedSchedules.length > 6 && (
                                            <li className="font-medium">+{selectedSchedules.length - 6} more</li>
                                        )}
                                    </ul>
                                ) : (
                                    <p className="rounded-xl border border-dashed border-sky-200/80 px-3 py-4 text-center text-xs text-sky-800/70 dark:border-sky-900/50 dark:text-sky-200/70">
                                        No schedules selected yet.
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="border-sidebar-border/70 bg-white shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                            <CardContent className="flex flex-col gap-3 pt-6">
                                <Button
                                    type="submit"
                                    size="lg"
                                    disabled={processing || data.timetable_ids.length === 0}
                                    className="w-full transition-transform hover:scale-[1.01]"
                                >
                                    {processing ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                                    {processing
                                        ? 'Saving...'
                                        : data.timetable_ids.length > 1
                                          ? `Authorize ${data.timetable_ids.length} Schedules`
                                          : 'Create Authorization'}
                                </Button>
                                <Button asChild type="button" variant="outline" className="w-full">
                                    <Link href={route('admin.venue-change-authorizations.index')}>Cancel</Link>
                                </Button>
                                {data.timetable_ids.length === 0 && (
                                    <p className="text-center text-xs text-sidebar-foreground/50">
                                        Select at least one schedule to enable save.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </aside>
                </div>
            </form>
        </AppLayout>
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
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
                <Label htmlFor={htmlFor}>
                    {label}
                    {required && <span className="text-destructive"> *</span>}
                </Label>
                {hint && !error && <span className="text-xs text-muted-foreground">{hint}</span>}
            </div>
            {children}
            {error && (
                <p className="text-xs text-destructive" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}

function EmptyState({
    icon: Icon,
    title,
    description,
}: {
    icon: typeof Search;
    title: string;
    description: string;
}) {
    return (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
            <div className="rounded-full bg-sidebar-accent p-3 dark:bg-sidebar">
                <Icon className="size-5 text-sidebar-foreground/40" />
            </div>
            <p className="font-medium text-sidebar-foreground">{title}</p>
            <p className="max-w-xs text-sm text-sidebar-foreground/55">{description}</p>
        </div>
    );
}

function SummaryRow({
    icon: Icon,
    label,
    value,
}: {
    icon: typeof Search;
    label: string;
    value: string;
}) {
    return (
        <div className="flex items-start gap-3">
            <div className="rounded-lg bg-white/80 p-2 dark:bg-sky-950/40">
                <Icon className="size-4 text-sky-700 dark:text-sky-300" />
            </div>
            <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-sky-800/70 dark:text-sky-200/60">{label}</p>
                <p className="mt-0.5 truncate text-sm font-semibold capitalize text-sky-950 dark:text-sky-50">{value}</p>
            </div>
        </div>
    );
}
