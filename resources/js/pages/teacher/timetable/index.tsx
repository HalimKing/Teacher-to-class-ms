import { filterInputClass } from '@/components/reports/shared';
import AppLayout from '@/layouts/app-layout';
import { Head, useForm, usePage } from '@inertiajs/react';
import {
    BookOpen,
    Calendar,
    CalendarClock,
    Clock,
    Download,
    Grid3X3,
    List,
    MapPin,
    Printer,
    RefreshCw,
    Search,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Bounce, ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

function formatTime12(timeStr: string | undefined | null) {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    let hour = parseInt(parts[0], 10);
    const minute = parts[1];
    if (Number.isNaN(hour)) return timeStr;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${ampm}`;
}

function sessionDurationMinutes(start: string, end: string) {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

function nextDateOfWeek(dayName: string) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const target = dayNames.indexOf(dayName);
    if (target === -1) return new Date().toISOString().slice(0, 10);
    const today = new Date();
    const todayIdx = today.getDay();
    let daysAhead = target - todayIdx;
    if (daysAhead < 0) daysAhead += 7;
    const dt = new Date(today);
    dt.setDate(today.getDate() + daysAhead);
    return dt.toISOString().slice(0, 10);
}

interface TimeTableItem {
    id: number;
    day: string;
    start_time: string;
    end_time: string;
    course?: { id?: number; name: string; course_code?: string };
    program?: { name: string };
    classroom?: { id?: number; name: string };
    academic_year?: { name: string };
}

interface RescheduleItem {
    id: number;
    timetable_id: number;
    course_name?: string;
    original_day?: string;
    original_date: string;
    original_start_time: string;
    original_end_time: string;
    new_date: string;
    new_start_time: string;
    new_end_time: string;
    reason?: string;
    note?: string;
    status: string;
    created_at?: string;
}

function statusBadgeClass(status: string) {
    switch (status) {
        case 'approved':
        case 'active':
            return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
        case 'rejected':
            return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
        default:
            return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    }
}

function SessionCard({ session, onReschedule }: { session: TimeTableItem; onReschedule: (session: TimeTableItem) => void }) {
    const duration = sessionDurationMinutes(session.start_time, session.end_time);

    return (
        <div className="group rounded-xl border border-sidebar-border/60 bg-white p-4 shadow-sm transition-all hover:border-blue-300 hover:shadow-md dark:border-sidebar-border dark:bg-sidebar-accent">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-sidebar-foreground">{session.course?.name ?? 'Untitled session'}</p>
                    {session.course?.course_code && (
                        <p className="mt-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">{session.course.course_code}</p>
                    )}
                </div>
                <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                    {Math.round(duration / 60) > 0 ? `${(duration / 60).toFixed(1)}h` : `${duration}m`}
                </span>
            </div>

            <div className="mt-3 space-y-1.5 text-xs text-sidebar-foreground/70">
                <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span>
                        {formatTime12(session.start_time)} – {formatTime12(session.end_time)}
                    </span>
                </div>
                {session.classroom?.name && (
                    <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span>{session.classroom.name}</span>
                    </div>
                )}
                {session.program?.name && (
                    <div className="flex items-center gap-2">
                        <BookOpen className="h-3.5 w-3.5 shrink-0" />
                        <span>{session.program.name}</span>
                    </div>
                )}
            </div>

            <button
                type="button"
                onClick={() => onReschedule(session)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-950/50"
            >
                <RefreshCw className="h-3.5 w-3.5" />
                Request reschedule
            </button>
        </div>
    );
}

export default function TeacherTimeTableIndex() {
    const { props } = usePage();
    const timeTables: TimeTableItem[] = (props as any).timeTables || [];
    const reschedules: RescheduleItem[] = (props as any).reschedules || [];
    const { flash } = props as any;

    const [query, setQuery] = useState('');
    const [tab, setTab] = useState<'timetable' | 'reschedules'>('timetable');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [dayFilter, setDayFilter] = useState<string>('all');
    const [resTab, setResTab] = useState<'upcoming' | 'past' | 'all'>('upcoming');
    const [openReschedule, setOpenReschedule] = useState(false);
    const [selectedTimetable, setSelectedTimetable] = useState<TimeTableItem | null>(null);

    const rescheduleForm = useForm({
        timetable_id: '',
        classroom_id: '',
        original_date: '',
        original_start_time: '',
        original_end_time: '',
        new_date: '',
        new_start_time: '',
        new_end_time: '',
        reason: '',
        note: '',
    });

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success, { position: 'top-right', autoClose: 4000, transition: Bounce });
        }
        if (flash?.error) {
            toast.error(flash.error, { position: 'top-right', autoClose: 4000, transition: Bounce });
        }
    }, [flash?.success, flash?.error]);

    const todayName = WEEKDAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];

    const filteredSessions = useMemo(() => {
        return timeTables.filter((session) => {
            if (dayFilter !== 'all' && session.day !== dayFilter) return false;
            if (!query) return true;
            const q = query.toLowerCase();
            return (
                (session.course?.name || '').toLowerCase().includes(q) ||
                (session.course?.course_code || '').toLowerCase().includes(q) ||
                (session.classroom?.name || '').toLowerCase().includes(q) ||
                (session.program?.name || '').toLowerCase().includes(q)
            );
        });
    }, [timeTables, query, dayFilter]);

    const sessionsByDay = useMemo(() => {
        const grouped: Record<string, TimeTableItem[]> = {};
        WEEKDAYS.forEach((day) => {
            grouped[day] = filteredSessions
                .filter((s) => s.day === day)
                .sort((a, b) => a.start_time.localeCompare(b.start_time));
        });
        return grouped;
    }, [filteredSessions]);

    const totalSessions = timeTables.length;
    const totalCourses = new Set(timeTables.map((t) => t.course?.name).filter(Boolean)).size;
    const totalMinutes = timeTables.reduce((sum, t) => sum + sessionDurationMinutes(t.start_time, t.end_time), 0);
    const totalHours = (totalMinutes / 60).toFixed(1);
    const pendingReschedules = reschedules.filter((r) => r.status === 'pending').length;

    const filteredReschedules = useMemo(() => {
        return reschedules.filter((r) => {
            if (resTab === 'all') return true;
            try {
                const today = new Date();
                const rd = new Date(r.new_date + 'T00:00:00');
                const todayStart = new Date(today.toISOString().slice(0, 10) + 'T00:00:00');
                if (resTab === 'upcoming') return rd >= todayStart;
                if (resTab === 'past') return rd < todayStart;
            } catch {
                return true;
            }
            return true;
        });
    }, [reschedules, resTab]);

    const openRescheduleDialog = (session: TimeTableItem) => {
        setSelectedTimetable(session);
        const orig = nextDateOfWeek(session.day);
        rescheduleForm.reset();
        rescheduleForm.setData({
            timetable_id: String(session.id),
            classroom_id: session.classroom?.id ? String(session.classroom.id) : '',
            original_date: orig,
            original_start_time: session.start_time,
            original_end_time: session.end_time,
            new_date: orig,
            new_start_time: session.start_time,
            new_end_time: session.end_time,
            reason: '',
            note: '',
        });
        setOpenReschedule(true);
    };

    const exportCsvUrl = route('teacher.timetable.export') + '?format=csv';
    const printUrl = route('teacher.timetable.print') + '?format=print';

    const kpiCards = [
        { title: 'Weekly Sessions', value: String(totalSessions), icon: Calendar, tone: 'blue' },
        { title: 'Courses', value: String(totalCourses), icon: BookOpen, tone: 'green' },
        { title: 'Teaching Hours', value: `${totalHours}h`, icon: Clock, tone: 'amber' },
        { title: 'Pending Requests', value: String(pendingReschedules), icon: CalendarClock, tone: 'purple' },
    ];

    const toneClasses: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40',
        green: 'bg-green-50 text-green-600 dark:bg-green-950/40',
        amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40',
        purple: 'bg-purple-50 text-purple-600 dark:bg-purple-950/40',
    };

    return (
        <AppLayout breadcrumbs={[{ title: 'My Timetable', href: '/teacher/timetable' }]}>
            <Head title="My Timetable" />
            <ToastContainer />

            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-4 md:p-6">
                {/* Header */}
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-sidebar-foreground">My Timetable</h1>
                        <p className="mt-1 text-sm text-sidebar-foreground/60">
                            View your weekly teaching schedule, manage sessions, and track reschedule requests
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <a
                            href={exportCsvUrl}
                            className="inline-flex items-center gap-2 rounded-lg border border-sidebar-border/60 bg-white px-4 py-2 text-sm font-medium text-sidebar-foreground shadow-sm transition-colors hover:bg-sidebar-accent dark:bg-sidebar-accent"
                        >
                            <Download className="h-4 w-4" />
                            Export CSV
                        </a>
                        <a
                            href={printUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 dark:bg-gray-800"
                        >
                            <Printer className="h-4 w-4" />
                            Print
                        </a>
                    </div>
                </div>

                {/* KPI cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {kpiCards.map((card) => {
                        const Icon = card.icon;
                        return (
                            <div
                                key={card.title}
                                className="rounded-xl border border-sidebar-border/70 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-sidebar-border dark:bg-sidebar-accent"
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">{card.title}</p>
                                        <p className="mt-2 text-3xl font-bold tabular-nums text-sidebar-foreground">{card.value}</p>
                                    </div>
                                    <div className={`rounded-xl p-3 ${toneClasses[card.tone]}`}>
                                        <Icon className="h-5 w-5" />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Main tabs */}
                <div className="flex flex-wrap gap-2 rounded-xl border border-sidebar-border/50 bg-white p-1.5 dark:bg-sidebar-accent">
                    {([
                        { key: 'timetable', label: 'Weekly Schedule' },
                        { key: 'reschedules', label: `Reschedules${pendingReschedules > 0 ? ` (${pendingReschedules})` : ''}` },
                    ] as const).map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => setTab(item.key)}
                            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                                tab === item.key
                                    ? 'bg-gray-900 text-white shadow-sm dark:bg-gray-800'
                                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent'
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                {tab === 'timetable' && (
                    <>
                        {/* Toolbar */}
                        <div className="rounded-xl border border-sidebar-border/70 bg-white p-4 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                <div className="relative max-w-md flex-1">
                                    <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-sidebar-foreground/40" />
                                    <input
                                        type="text"
                                        placeholder="Search course, code, classroom, program..."
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        className={`${filterInputClass} pl-9`}
                                    />
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="flex rounded-lg border border-sidebar-border/50 p-1">
                                        <button
                                            type="button"
                                            onClick={() => setViewMode('grid')}
                                            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                                                viewMode === 'grid' ? 'bg-gray-900 text-white' : 'text-sidebar-foreground/70'
                                            }`}
                                        >
                                            <Grid3X3 className="h-3.5 w-3.5" />
                                            Week grid
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setViewMode('list')}
                                            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                                                viewMode === 'list' ? 'bg-gray-900 text-white' : 'text-sidebar-foreground/70'
                                            }`}
                                        >
                                            <List className="h-3.5 w-3.5" />
                                            List
                                        </button>
                                    </div>
                                    <span className="text-sm text-sidebar-foreground/60">{filteredSessions.length} sessions</span>
                                </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => setDayFilter('all')}
                                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                        dayFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-sidebar-accent text-sidebar-foreground/70'
                                    }`}
                                >
                                    All days
                                </button>
                                {WEEKDAYS.map((day) => (
                                    <button
                                        key={day}
                                        type="button"
                                        onClick={() => setDayFilter(day)}
                                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                            dayFilter === day
                                                ? 'bg-gray-900 text-white'
                                                : day === todayName
                                                  ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300'
                                                  : 'bg-sidebar-accent text-sidebar-foreground/70'
                                        }`}
                                    >
                                        {day.slice(0, 3)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {filteredSessions.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-sidebar-border/70 bg-white p-12 text-center dark:bg-sidebar-accent">
                                <Calendar className="mx-auto h-10 w-10 text-sidebar-foreground/30" />
                                <p className="mt-4 text-sm font-medium text-sidebar-foreground">No sessions found</p>
                                <p className="mt-1 text-sm text-sidebar-foreground/60">Try adjusting your search or day filter</p>
                            </div>
                        ) : viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
                                {WEEKDAYS.map((day) => {
                                    const sessions = sessionsByDay[day] ?? [];
                                    if (dayFilter !== 'all' && dayFilter !== day) return null;

                                    return (
                                        <div
                                            key={day}
                                            className={`rounded-xl border bg-white shadow-sm dark:bg-sidebar-accent ${
                                                day === todayName
                                                    ? 'border-blue-300 ring-2 ring-blue-100 dark:border-blue-800 dark:ring-blue-950/40'
                                                    : 'border-sidebar-border/70 dark:border-sidebar-border'
                                            }`}
                                        >
                                            <div
                                                className={`border-b px-4 py-3 ${
                                                    day === todayName ? 'bg-blue-50/80 dark:bg-blue-950/20' : 'bg-sidebar-accent/40'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-sm font-semibold text-sidebar-foreground">{day}</h3>
                                                    {day === todayName && (
                                                        <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                                                            Today
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="mt-0.5 text-xs text-sidebar-foreground/60">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</p>
                                            </div>
                                            <div className="space-y-3 p-3">
                                                {sessions.length === 0 ? (
                                                    <p className="py-6 text-center text-xs text-sidebar-foreground/40">No classes</p>
                                                ) : (
                                                    sessions.map((session) => (
                                                        <SessionCard key={session.id} session={session} onReschedule={openRescheduleDialog} />
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="overflow-hidden rounded-xl border border-sidebar-border/70 bg-white shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-sidebar-accent/50 text-left text-xs uppercase tracking-wider text-sidebar-foreground/60">
                                            <tr>
                                                <th className="px-4 py-3">Day</th>
                                                <th className="px-4 py-3">Time</th>
                                                <th className="px-4 py-3">Course</th>
                                                <th className="px-4 py-3">Program</th>
                                                <th className="px-4 py-3">Classroom</th>
                                                <th className="px-4 py-3">Academic Year</th>
                                                <th className="px-4 py-3 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredSessions.map((session) => (
                                                <tr key={session.id} className="border-t border-sidebar-border/40 hover:bg-sidebar-accent/30">
                                                    <td className="px-4 py-4 font-medium">
                                                        {session.day}
                                                        {session.day === todayName && (
                                                            <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Today</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-4 whitespace-nowrap text-sidebar-foreground/80">
                                                        {formatTime12(session.start_time)} – {formatTime12(session.end_time)}
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <div className="font-medium">{session.course?.name}</div>
                                                        {session.course?.course_code && (
                                                            <div className="text-xs text-sidebar-foreground/60">{session.course.course_code}</div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-4">{session.program?.name ?? '—'}</td>
                                                    <td className="px-4 py-4">{session.classroom?.name ?? '—'}</td>
                                                    <td className="px-4 py-4">{session.academic_year?.name ?? '—'}</td>
                                                    <td className="px-4 py-4 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() => openRescheduleDialog(session)}
                                                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                                                        >
                                                            Reschedule
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {tab === 'reschedules' && (
                    <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                            {(['upcoming', 'past', 'all'] as const).map((key) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setResTab(key)}
                                    className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize ${
                                        resTab === key ? 'bg-gray-900 text-white' : 'bg-white text-sidebar-foreground/70 ring-1 ring-sidebar-border/50'
                                    }`}
                                >
                                    {key}
                                </button>
                            ))}
                        </div>

                        {filteredReschedules.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-sidebar-border/70 bg-white p-12 text-center dark:bg-sidebar-accent">
                                <CalendarClock className="mx-auto h-10 w-10 text-sidebar-foreground/30" />
                                <p className="mt-4 text-sm font-medium text-sidebar-foreground">No reschedule requests</p>
                                <p className="mt-1 text-sm text-sidebar-foreground/60">
                                    {resTab === 'upcoming' ? 'You have no upcoming rescheduled sessions' : 'Nothing to show for this filter'}
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                {filteredReschedules.map((r) => (
                                    <div
                                        key={r.id}
                                        className="rounded-xl border border-sidebar-border/70 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-sidebar-border dark:bg-sidebar-accent"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="font-semibold text-sidebar-foreground">{r.course_name ?? 'Session'}</p>
                                                <p className="mt-1 text-xs text-sidebar-foreground/60">
                                                    Submitted {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                                                </p>
                                            </div>
                                            <span className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusBadgeClass(r.status)}`}>
                                                {r.status}
                                            </span>
                                        </div>

                                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                            <div className="rounded-lg border border-sidebar-border/40 bg-sidebar-accent/30 p-3">
                                                <p className="text-[10px] font-bold tracking-wider text-sidebar-foreground/50 uppercase">Original</p>
                                                <p className="mt-1 text-sm font-medium">{r.original_day ?? '—'}</p>
                                                <p className="text-xs text-sidebar-foreground/70">{r.original_date}</p>
                                                <p className="mt-1 text-xs text-sidebar-foreground/80">
                                                    {formatTime12(r.original_start_time)} – {formatTime12(r.original_end_time)}
                                                </p>
                                            </div>
                                            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900 dark:bg-blue-950/20">
                                                <p className="text-[10px] font-bold tracking-wider text-blue-600 uppercase dark:text-blue-400">New schedule</p>
                                                <p className="mt-1 text-sm font-medium text-sidebar-foreground">{r.new_date}</p>
                                                <p className="text-xs text-sidebar-foreground/80">
                                                    {formatTime12(r.new_start_time)} – {formatTime12(r.new_end_time)}
                                                </p>
                                            </div>
                                        </div>

                                        {r.reason && (
                                            <p className="mt-3 text-sm text-sidebar-foreground/70">
                                                <span className="font-medium text-sidebar-foreground">Reason:</span> {r.reason}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <RescheduleDialog open={openReschedule} onClose={() => setOpenReschedule(false)} form={rescheduleForm} selected={selectedTimetable} />
        </AppLayout>
    );
}

export function RescheduleDialog({
    open,
    onClose,
    form,
    selected,
}: {
    open: boolean;
    onClose: () => void;
    form: ReturnType<typeof useForm>;
    selected: TimeTableItem | null;
}) {
    const { props } = usePage();
    const classrooms: { id: number | string; name: string }[] = ((props as any).classrooms || []).map((c: { id: number; name: string }) => ({
        id: c.id,
        name: c.name,
    }));

    if (!selected || !open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
            <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-sidebar-border/60 bg-white shadow-2xl dark:bg-sidebar-accent">
                <div className="sticky top-0 z-10 flex items-start justify-between border-b border-sidebar-border/50 bg-white px-6 py-4 dark:bg-sidebar-accent">
                    <div>
                        <h3 className="text-lg font-semibold text-sidebar-foreground">Request reschedule</h3>
                        <p className="mt-1 text-sm text-sidebar-foreground/60">{selected.course?.name ?? 'Teaching session'}</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-sidebar-accent">
                        <X className="h-5 w-5 text-sidebar-foreground/60" />
                    </button>
                </div>

                <div className="space-y-4 px-6 py-5">
                    <div className="rounded-lg border border-sidebar-border/40 bg-sidebar-accent/30 p-3 text-sm">
                        <p className="font-medium text-sidebar-foreground">{selected.day}</p>
                        <p className="text-sidebar-foreground/70">
                            {formatTime12(selected.start_time)} – {formatTime12(selected.end_time)} · {selected.classroom?.name ?? 'Default room'}
                        </p>
                    </div>

                    <div>
                        <label className="mb-1.5 block text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">Original date</label>
                        <input type="date" className={filterInputClass} value={form.data.original_date} onChange={(e) => form.setData('original_date', e.target.value)} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">Original start</label>
                            <input type="time" className={filterInputClass} value={form.data.original_start_time} onChange={(e) => form.setData('original_start_time', e.target.value)} />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">Original end</label>
                            <input type="time" className={filterInputClass} value={form.data.original_end_time} onChange={(e) => form.setData('original_end_time', e.target.value)} />
                        </div>
                    </div>

                    <div>
                        <label className="mb-1.5 block text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">New date</label>
                        <input type="date" className={filterInputClass} value={form.data.new_date} onChange={(e) => form.setData('new_date', e.target.value)} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">New start</label>
                            <input type="time" className={filterInputClass} value={form.data.new_start_time} onChange={(e) => form.setData('new_start_time', e.target.value)} />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">New end</label>
                            <input type="time" className={filterInputClass} value={form.data.new_end_time} onChange={(e) => form.setData('new_end_time', e.target.value)} />
                        </div>
                    </div>

                    <div>
                        <label className="mb-1.5 block text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">Classroom</label>
                        <select required className={filterInputClass} value={form.data.classroom_id || ''} onChange={(e) => form.setData('classroom_id', e.target.value)}>
                            <option value="">Select classroom</option>
                            {classrooms.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1.5 block text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">Reason</label>
                        <input type="text" className={filterInputClass} placeholder="Optional reason for reschedule" value={form.data.reason} onChange={(e) => form.setData('reason', e.target.value)} />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">Notes</label>
                        <textarea
                            rows={3}
                            className={filterInputClass}
                            placeholder="Additional details for admin review"
                            value={form.data.note}
                            onChange={(e) => form.setData('note', e.target.value)}
                        />
                    </div>

                    {form.errors && Object.keys(form.errors).length > 0 && (
                        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
                            {Object.values(form.errors).map((err: unknown, idx: number) => (
                                <div key={idx}>{String(err)}</div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="sticky bottom-0 flex justify-end gap-2 border-t border-sidebar-border/50 bg-white px-6 py-4 dark:bg-sidebar-accent">
                    <button type="button" onClick={onClose} className="rounded-lg border border-sidebar-border/60 px-4 py-2 text-sm font-medium hover:bg-sidebar-accent">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (!form.data.classroom_id) {
                                form.setError('classroom_id', 'Please select a classroom');
                                return;
                            }
                            if (form.data.new_start_time >= form.data.new_end_time) {
                                form.setError('new_start_time', 'Start time must be before end time');
                                return;
                            }
                            form.post(route('teacher.reschedules.store'), { onSuccess: () => onClose() });
                        }}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                        Submit request
                    </button>
                </div>
            </div>
        </div>
    );
}
