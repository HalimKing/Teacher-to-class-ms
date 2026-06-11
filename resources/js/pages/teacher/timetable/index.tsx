import AppLayout from '@/layouts/app-layout';
import { Head, usePage, useForm } from '@inertiajs/react';
import { ToastContainer, toast, Bounce } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Printer } from 'lucide-react';
import { Calendar, Clock, Download, Search as SearchIcon, Users } from 'lucide-react';
import { useState, useEffect } from 'react';

function formatTime12(timeStr: string | undefined | null) {
    if (!timeStr) return '';
    // accept 'HH:MM' or 'HH:MM:SS' or 'H:MM'
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    let hour = parseInt(parts[0], 10);
    const minute = parts[1];
    if (Number.isNaN(hour)) return timeStr;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${ampm}`;
}

interface TimeTableItem {
    id: number;
    day: string;
    start_time: string;
    end_time: string;
    course?: { name: string; course_code?: string };
    program?: { name: string };
    classroom?: { name: string };
    academic_year?: { name: string };
}

export default function TeacherTimeTableIndex() {
    const { props } = usePage();
    const timeTables: TimeTableItem[] = props.timeTables || [];
    const reschedules: any[] = props.reschedules || [];
    const [query, setQuery] = useState('');
    const [tab, setTab] = useState<'timetable' | 'reschedules'>('timetable');
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

    const { flash } = usePage().props as any;

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success, {
                position: 'top-right',
                autoClose: 4000,
                hideProgressBar: false,
                pauseOnHover: true,
                draggable: true,
                transition: Bounce,
            });
        }
        if (flash?.error) {
            toast.error(flash.error, {
                position: 'top-right',
                autoClose: 4000,
                hideProgressBar: false,
                pauseOnHover: true,
                draggable: true,
                transition: Bounce,
            });
        }
    }, [flash?.success, flash?.error]);

    function nextDateOfWeek(dayName: string) {
        const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const target = dayNames.indexOf(dayName);
        if (target === -1) return new Date().toISOString().slice(0,10);
        const today = new Date();
        const todayIdx = today.getDay();
        let daysAhead = target - todayIdx;
        if (daysAhead <= 0) daysAhead += 7;
        const dt = new Date(today);
        dt.setDate(today.getDate() + daysAhead);
        return dt.toISOString().slice(0,10);
    }

    // Derived stats
    const totalSessions = timeTables.length;
    const totalCourses = Array.from(new Set(timeTables.map((t) => t.course?.name).filter(Boolean))).length;
    const totalMinutes = timeTables.reduce((sum, t) => {
        const [sh, sm] = t.start_time.split(':').map(Number);
        const [eh, em] = t.end_time.split(':').map(Number);
        const start = sh * 60 + sm;
        const end = eh * 60 + em;
        return sum + Math.max(0, end - start);
    }, 0);
    const totalHours = (totalMinutes / 60).toFixed(1);

    const exportCsvUrl = route('teacher.timetable.export') + '?format=csv';
    const printUrl = route('teacher.timetable.print') + '?format=print';

    return (
        <AppLayout breadcrumbs={[{ title: 'My Timetable', href: '/teacher/timetable' }]}>
            <Head title="My Timetable" />
            <ToastContainer />

            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-4 md:p-6">
                {/* Header */}
                <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-sidebar-foreground">My Timetable</h1>
                        <p className="mt-1 text-sm text-sidebar-foreground/60">My Timetable</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <a
                            href={exportCsvUrl}
                            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                        >
                            <Download className="h-4 w-4" />
                            CSV
                        </a>
                        <a
                            href={printUrl}
                            target="_blank"
                            className="flex items-center gap-2 rounded-lg border border-sidebar-border/50 px-4 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-gray-50"
                        >
                            <Printer className="h-4 w-4" />
                            Print
                        </a>
                    </div>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-sidebar-border/70 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <p className="text-sm font-medium text-sidebar-foreground/60">Total Sessions</p>
                                <p className="mt-1 text-2xl font-bold text-sidebar-foreground">{totalSessions}</p>
                            </div>
                            <div className="rounded-xl p-3 bg-blue-100">
                                <Calendar className="h-6 w-6 text-blue-500" />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border border-sidebar-border/70 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <p className="text-sm font-medium text-sidebar-foreground/60">Total Courses</p>
                                <p className="mt-1 text-2xl font-bold text-sidebar-foreground">{totalCourses}</p>
                            </div>
                            <div className="rounded-xl p-3 bg-green-100">
                                <Users className="h-6 w-6 text-green-500" />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border border-sidebar-border/70 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <p className="text-sm font-medium text-sidebar-foreground/60">Total Hours</p>
                                <p className="mt-1 text-2xl font-bold text-sidebar-foreground">{totalHours} hrs</p>
                            </div>
                            <div className="rounded-xl p-3 bg-yellow-100">
                                <Clock className="h-6 w-6 text-orange-500" />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border border-sidebar-border/70 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <p className="text-sm font-medium text-sidebar-foreground/60">Actions</p>
                                <p className="mt-1 text-sm text-sidebar-foreground/60">Use header actions to download or print</p>
                            </div>
                            <div className="rounded-xl p-3 bg-gray-100">
                                <Download className="h-6 w-6 text-gray-700" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2">
                    <button className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'timetable' ? 'bg-blue-600 text-white' : 'border border-sidebar-border/50'}`} onClick={() => setTab('timetable')}>Timetable</button>
                    <button className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'reschedules' ? 'bg-blue-600 text-white' : 'border border-sidebar-border/50'}`} onClick={() => setTab('reschedules')}>Reschedules</button>
                </div>

                {/* Filters / Search */}
                <div className="rounded-xl border border-sidebar-border/70 bg-white p-4 shadow-sm">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                            <label className="mb-2 block text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">Search</label>
                            <div className="relative">
                                <SearchIcon className="absolute top-3 left-3 h-4 w-4 text-sidebar-foreground/40" />
                                <input
                                    type="text"
                                    placeholder="Search by course or classroom"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    className="w-full rounded-lg border border-sidebar-border/50 bg-white py-2 pr-4 pl-10 text-sm text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-end">
                            <p className="text-sm text-sidebar-foreground/60">Showing {timeTables.length} items</p>
                        </div>
                    </div>
                </div>

                {tab === 'timetable' && (
                    <div className="overflow-hidden rounded-xl border border-sidebar-border/70 bg-white shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">Day</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">Start</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">End</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">Course</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">Program</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">Classroom</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">Academic Year</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {timeTables
                                        .filter((t) => {
                                            if (!query) return true;
                                            const q = query.toLowerCase();
                                            return (t.course?.name || '').toLowerCase().includes(q) || (t.classroom?.name || '').toLowerCase().includes(q);
                                        })
                                        .map((t) => (
                                            <tr key={t.id} className="border-b last:border-b-0 hover:bg-gray-50">
                                                <td className="px-4 py-4">{t.day}</td>
                                                <td className="px-4 py-4">{formatTime12(t.start_time)}</td>
                                                <td className="px-4 py-4">{formatTime12(t.end_time)}</td>
                                                <td className="px-4 py-4">{t.course?.name}</td>
                                                <td className="px-4 py-4">{t.program?.name}</td>
                                                <td className="px-4 py-4">{t.classroom?.name}</td>
                                                <td className="px-4 py-4">{t.academic_year?.name}</td>
                                                <td className="px-4 py-4 text-right">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedTimetable(t);
                                                            const orig = nextDateOfWeek(t.day);
                                                            rescheduleForm.reset();
                                                            rescheduleForm.setData({
                                                                timetable_id: String(t.id),
                                                                classroom_id: (t as any)?.classroom?.id ?? (t as any)?.classroom_id ?? '',
                                                                original_date: orig,
                                                                original_start_time: t.start_time,
                                                                original_end_time: t.end_time,
                                                                new_date: orig,
                                                                new_start_time: t.start_time,
                                                                new_end_time: t.end_time,
                                                                reason: '',
                                                                note: '',
                                                            });
                                                            setOpenReschedule(true);
                                                        }}
                                                        className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
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

                {tab === 'reschedules' && (
                    <div className="rounded-xl border border-sidebar-border/70 bg-white p-4 shadow-sm">
                        <h3 className="text-lg font-semibold text-sidebar-foreground">Your rescheduled requests</h3>

                        <div className="mt-4 mb-3 flex gap-2">
                            <button onClick={() => setResTab('upcoming')} className={`rounded-lg px-3 py-1 text-sm font-medium ${resTab === 'upcoming' ? 'bg-blue-600 text-white' : 'border'}`}>Upcoming</button>
                            <button onClick={() => setResTab('past')} className={`rounded-lg px-3 py-1 text-sm font-medium ${resTab === 'past' ? 'bg-blue-600 text-white' : 'border'}`}>Past</button>
                            <button onClick={() => setResTab('all')} className={`rounded-lg px-3 py-1 text-sm font-medium ${resTab === 'all' ? 'bg-blue-600 text-white' : 'border'}`}>All</button>
                        </div>

                        <div className="mt-3">
                            {reschedules.length === 0 && <p className="text-sm text-sidebar-foreground/60">No reschedule requests found.</p>}
                            {reschedules
                                .filter((r:any) => {
                                    if (resTab === 'all') return true;
                                    try {
                                        const today = new Date();
                                        const rd = new Date(r.new_date + 'T00:00:00');
                                        if (resTab === 'upcoming') return rd >= new Date(today.toISOString().slice(0,10) + 'T00:00:00');
                                        if (resTab === 'past') return rd < new Date(today.toISOString().slice(0,10) + 'T00:00:00');
                                    } catch (e) {
                                        return true;
                                    }
                                    return true;
                                })
                                .map((r:any) => (
                                <div key={r.id} className="flex items-center justify-between border-b py-3 last:border-b-0">
                                    <div>
                                        <div className="text-sm"><strong>Course:</strong> {r.course_name ?? '—'}</div>
                                        <div className="text-xs text-sidebar-foreground/60"><strong>Original day:</strong> {r.original_day ?? '—'}</div>
                                        <div className="text-xs mt-1"><strong>Original:</strong> {r.original_date} {formatTime12(r.original_start_time)} - {formatTime12(r.original_end_time)}</div>
                                        <div className="text-xs"><strong>New:</strong> {r.new_date} {formatTime12(r.new_start_time)} - {formatTime12(r.new_end_time)}</div>
                                        {r.reason && <div className="text-xs mt-1"><strong>Reason:</strong> {r.reason}</div>}
                                    </div>
                                    <div className="text-right">
                                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${r.status === 'approved' ? 'bg-green-100 text-green-700' : r.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{r.status}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <RescheduleDialog open={openReschedule} onClose={() => setOpenReschedule(false)} form={rescheduleForm} selected={selectedTimetable} />
        </AppLayout>
    );
}

// Reschedule dialog placed after component to keep file organized
// Render dialog near bottom of file by default
// Note: we render the dialog from the same module to keep markup colocated.

// Export default component's dialog usage via named export import if needed.

// If running in the browser, attach dialog render via global mount point in the parent page.

export function RescheduleDialog({ open, onClose, form, selected }: { open: boolean; onClose: () => void; form: any; selected: TimeTableItem | null }) {
    if (!selected || !open) return null;
    const { props } = usePage();
    const timeTables: TimeTableItem[] = props.timeTables || [];
    const classrooms: { id: number | string; name: string }[] = (props.classrooms || []).map((c: any) => ({ id: c.id, name: c.name }));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
            <div className="relative w-full max-w-lg rounded-lg bg-white p-6 shadow-lg">
                <div className="flex items-start justify-between">
                    <h3 className="text-lg font-semibold">Request reschedule for {selected.course?.name ?? 'session'}</h3>
                    <button onClick={onClose} className="text-sidebar-foreground/60">✕</button>
                </div>

                <div className="mt-4 space-y-3">
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-sidebar-foreground/60">Original date</label>
                        <input type="date" className="w-full rounded-lg border px-3 py-2" value={form.data.original_date} onChange={(e) => form.setData('original_date', e.target.value)} />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-sidebar-foreground/60">Original start</label>
                            <input type="time" className="w-full rounded-lg border px-3 py-2" value={form.data.original_start_time} onChange={(e) => form.setData('original_start_time', e.target.value)} />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-sidebar-foreground/60">Original end</label>
                            <input type="time" className="w-full rounded-lg border px-3 py-2" value={form.data.original_end_time} onChange={(e) => form.setData('original_end_time', e.target.value)} />
                        </div>
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-semibold text-sidebar-foreground/60">New date</label>
                        <input type="date" className="w-full rounded-lg border px-3 py-2" value={form.data.new_date} onChange={(e) => form.setData('new_date', e.target.value)} />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-sidebar-foreground/60">Start time</label>
                            <input type="time" className="w-full rounded-lg border px-3 py-2" value={form.data.new_start_time} onChange={(e) => form.setData('new_start_time', e.target.value)} />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-sidebar-foreground/60">End time</label>
                            <input type="time" className="w-full rounded-lg border px-3 py-2" value={form.data.new_end_time} onChange={(e) => form.setData('new_end_time', e.target.value)} />
                        </div>
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-semibold text-sidebar-foreground/60">Classroom (optional)</label>
                        <select required className="w-full rounded-lg border px-3 py-2" value={form.data.classroom_id || ''} onChange={(e) => { form.setData('classroom_id', e.target.value); }}>
                            <option value="">-- Use default / None --</option>
                            {classrooms.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-semibold text-sidebar-foreground/60">Reason (optional)</label>
                        <input type="text" className="w-full rounded-lg border px-3 py-2" value={form.data.reason} onChange={(e) => form.setData('reason', e.target.value)} />
                    </div>

                    {form.errors && Object.keys(form.errors).length > 0 && (
                        <div className="text-sm text-red-600">
                            {Object.values(form.errors).map((err:any, idx:number) => <div key={idx}>{err}</div>)}
                        </div>
                    )}
                </div>

                <div className="mt-4 flex justify-end gap-2">
                    <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
                    <button
                        onClick={() => {
                            if (!form.data.classroom_id) {
                                form.setError('classroom_id', 'Please select a classroom');
                                return;
                            }
                            if (form.data.new_start_time >= form.data.new_end_time) {
                                form.setError('new_start_time', 'Start time must be before end time');
                                return;
                            }
                            form.post(route('teacher.reschedules.store'), {
                                onSuccess: () => onClose(),
                            });
                        }}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                        Submit request
                    </button>
                </div>
            </div>
        </div>
    );
}

