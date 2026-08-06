import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent, useEffect, useMemo, useState } from 'react';

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
    has_conflict?: boolean;
    search_text?: string;
}

interface PageProps {
    venues: Venue[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/teacher/dashboard' },
    { title: 'Venue Change Requests', href: '/teacher/venue-change-requests' },
    { title: 'New request', href: '/teacher/venue-change-requests/create' },
];

function formatTime(time?: string | null) {
    if (!time) return '—';
    const normalized = time.length === 5 ? `${time}:00` : time;
    return new Date(`2000-01-01T${normalized}`).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
}

export default function TeacherVenueChangeRequestCreate({ venues }: PageProps) {
    const today = new Date().toISOString().slice(0, 10);
    const { data, setData, post, processing, errors } = useForm({
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

    useEffect(() => {
        setLoadingSchedules(true);
        const params = new URLSearchParams({
            start_date: data.start_date,
            end_date: data.end_date || data.start_date,
        });
        fetch(`${route('teacher.venue-change-requests.my-schedules')}?${params}`, {
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
    }, [data.start_date, data.end_date]);

    const filteredSchedules = useMemo(() => {
        const term = scheduleSearch.trim().toLowerCase();
        if (!term) return schedules;
        return schedules.filter((schedule) => (schedule.search_text || '').includes(term));
    }, [schedules, scheduleSearch]);

    const toggleSchedule = (schedule: Schedule) => {
        if (schedule.has_conflict) return;
        const selected = data.timetable_ids.includes(schedule.id);
        setData(
            'timetable_ids',
            selected ? data.timetable_ids.filter((id) => id !== schedule.id) : [...data.timetable_ids, schedule.id],
        );
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        post(route('teacher.venue-change-requests.store'));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Submit Venue Change Request" />
            <form onSubmit={submit} className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Submit Venue Change Request</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Your request will remain pending until an authorized administrator approves it. Approval creates a
                        Venue Change Authorization.
                    </p>
                </div>

                <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-2">
                    <label className="space-y-1.5 text-sm">
                        <span className="font-medium">Start date</span>
                        <input
                            type="date"
                            value={data.start_date}
                            onChange={(e) => setData('start_date', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2"
                        />
                        {errors.start_date && <p className="text-xs text-rose-600">{errors.start_date}</p>}
                    </label>
                    <label className="space-y-1.5 text-sm">
                        <span className="font-medium">End date</span>
                        <input
                            type="date"
                            value={data.end_date}
                            onChange={(e) => setData('end_date', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2"
                        />
                        {errors.end_date && <p className="text-xs text-rose-600">{errors.end_date}</p>}
                    </label>
                    <label className="space-y-1.5 text-sm">
                        <span className="font-medium">Daily start time (optional)</span>
                        <input
                            type="time"
                            value={data.start_time}
                            onChange={(e) => setData('start_time', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2"
                        />
                    </label>
                    <label className="space-y-1.5 text-sm">
                        <span className="font-medium">Daily end time (optional)</span>
                        <input
                            type="time"
                            value={data.end_time}
                            onChange={(e) => setData('end_time', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2"
                        />
                    </label>
                    <label className="space-y-1.5 text-sm sm:col-span-2">
                        <span className="font-medium">Replacement venue</span>
                        <select
                            value={data.authorized_classroom_id}
                            onChange={(e) => setData('authorized_classroom_id', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2"
                        >
                            <option value="">Select venue</option>
                            {venues.map((venue) => (
                                <option key={venue.id} value={venue.id}>
                                    {venue.name}
                                </option>
                            ))}
                        </select>
                        {errors.authorized_classroom_id && (
                            <p className="text-xs text-rose-600">{errors.authorized_classroom_id}</p>
                        )}
                    </label>
                    <label className="space-y-1.5 text-sm sm:col-span-2">
                        <span className="font-medium">Authorization type</span>
                        <select
                            value={data.authorization_type}
                            onChange={(e) => setData('authorization_type', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2"
                        >
                            <option value="both">Check-in and check-out</option>
                            <option value="check_in">Check-in only</option>
                            <option value="check_out">Check-out only</option>
                        </select>
                    </label>
                    <label className="space-y-1.5 text-sm sm:col-span-2">
                        <span className="font-medium">Reason</span>
                        <input
                            value={data.reason}
                            onChange={(e) => setData('reason', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2"
                            maxLength={500}
                        />
                        {errors.reason && <p className="text-xs text-rose-600">{errors.reason}</p>}
                    </label>
                    <label className="space-y-1.5 text-sm sm:col-span-2">
                        <span className="font-medium">Supporting notes (optional)</span>
                        <textarea
                            value={data.notes}
                            onChange={(e) => setData('notes', e.target.value)}
                            className="min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2"
                        />
                    </label>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-6">
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <h2 className="text-sm font-semibold text-slate-900">Affected schedules</h2>
                        <input
                            value={scheduleSearch}
                            onChange={(e) => setScheduleSearch(e.target.value)}
                            placeholder="Search schedules..."
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                    </div>
                    {errors.timetable_ids && <p className="mb-3 text-xs text-rose-600">{errors.timetable_ids}</p>}
                    {loadingSchedules ? (
                        <p className="text-sm text-slate-500">Loading schedules…</p>
                    ) : filteredSchedules.length === 0 ? (
                        <p className="text-sm text-slate-500">No schedules found for this period.</p>
                    ) : (
                        <ul className="space-y-2">
                            {filteredSchedules.map((schedule) => {
                                const selected = data.timetable_ids.includes(schedule.id);
                                return (
                                    <li key={schedule.id}>
                                        <button
                                            type="button"
                                            disabled={schedule.has_conflict}
                                            onClick={() => toggleSchedule(schedule)}
                                            className={`w-full rounded-lg border px-3 py-3 text-left text-sm transition ${
                                                schedule.has_conflict
                                                    ? 'cursor-not-allowed border-amber-200 bg-amber-50 text-amber-900'
                                                    : selected
                                                      ? 'border-slate-900 bg-slate-900 text-white'
                                                      : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}
                                        >
                                            <div className="font-medium">{schedule.course || 'Work period'}</div>
                                            <div className={selected && !schedule.has_conflict ? 'text-white/80' : 'text-slate-500'}>
                                                {schedule.day} · {formatTime(schedule.start_time)} – {formatTime(schedule.end_time)}
                                                {schedule.classroom ? ` · ${schedule.classroom}` : ''}
                                            </div>
                                            {schedule.has_conflict && (
                                                <div className="mt-1 text-xs">Conflict: existing request or authorization for this period</div>
                                            )}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    <p className="mt-3 text-xs text-slate-500">{data.timetable_ids.length} schedule(s) selected</p>
                </div>

                <div className="flex gap-3">
                    <button
                        type="submit"
                        disabled={processing}
                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                        Submit for approval
                    </button>
                    <Link href={route('teacher.venue-change-requests.index')} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium">
                        Cancel
                    </Link>
                </div>
            </form>
        </AppLayout>
    );
}
