import ComboBox from '@/components/combobox';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { PagePropsWithFlash, type BreadcrumbItem } from '@/types';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    BookOpen,
    Building2,
    CalendarDays,
    Check,
    Clock3,
    Loader2,
    MapPin,
    Plus,
    Save,
    Sparkles,
    UserRound,
} from 'lucide-react';
import { FormEvent, MouseEvent, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ToastContainer, toast } from 'react-toastify';

interface AcademicYear {
    id: number;
    name: string;
    start_year: number;
    end_year: number;
}

interface Option {
    label: string;
    value: string;
    employee_id?: string;
    staff_type?: string;
}

interface CreateTimeTablePageProps {
    academicYear: AcademicYear;
    courses: Option[];
    classRooms: Option[];
    teachers: Array<Option & { staff_type?: string; employee_id?: string }>;
    staffTypeOptions: Option[];
    days: string[];
}

interface CreateTimeTableForm {
    academic_year_id: number;
    staff_type: string;
    teacher_id: string;
    course_id: string;
    class_room_id: string;
    day: string;
    days: string[];
    start_time: string;
    end_time: string;
    create_another: boolean;
}

const daysOptions: Option[] = [
    { label: 'Monday', value: 'Monday' },
    { label: 'Tuesday', value: 'Tuesday' },
    { label: 'Wednesday', value: 'Wednesday' },
    { label: 'Thursday', value: 'Thursday' },
    { label: 'Friday', value: 'Friday' },
    { label: 'Saturday', value: 'Saturday' },
    { label: 'Sunday', value: 'Sunday' },
];

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/admin/dashboard' },
    { title: 'Assigned Schedules', href: '/admin/academics/time-tables' },
    { title: 'Create Schedule', href: '/admin/academics/time-tables/create' },
];

const fieldClass =
    'h-12 w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 md:text-sm dark:border-sidebar-border dark:bg-background dark:text-sidebar-foreground dark:focus:ring-indigo-950';

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

function durationLabel(startTime: string, endTime: string) {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    const diffMs = end.getTime() - start.getTime();

    if (Number.isNaN(diffMs) || diffMs <= 0) {
        return 'Check times';
    }

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours === 0) return `${diffMinutes} min`;
    if (diffMinutes === 0) return `${diffHours} hr${diffHours > 1 ? 's' : ''}`;

    return `${diffHours}h ${diffMinutes}m`;
}

export default function CreateTimeTablePage({ academicYear, courses, classRooms, teachers, staffTypeOptions }: CreateTimeTablePageProps) {
    const [checkingConflict, setCheckingConflict] = useState(false);
    const [hasConflict, setHasConflict] = useState(false);
    const [conflictMessage, setConflictMessage] = useState('');
    const [formKey, setFormKey] = useState(0);
    const { flash } = usePage().props as PagePropsWithFlash;

    const { data, setData, post, processing, errors, transform } = useForm<CreateTimeTableForm>({
        academic_year_id: academicYear.id,
        staff_type: 'lecturer',
        teacher_id: '',
        course_id: '',
        class_room_id: '',
        day: '',
        days: [],
        start_time: '',
        end_time: '',
        create_another: false,
    });

    const isAdministrator = data.staff_type === 'administrator';
    const selectedDays = isAdministrator ? data.days : data.day ? [data.day] : [];
    const staffOptions = useMemo(
        () => teachers.filter((teacher) => !teacher.staff_type || teacher.staff_type === data.staff_type),
        [teachers, data.staff_type],
    );
    const selectedStaff = staffOptions.find((teacher) => teacher.value === data.teacher_id) ?? null;
    const selectedCourse = courses.find((course) => course.value === data.course_id) ?? null;
    const selectedVenue = classRooms.find((room) => room.value === data.class_room_id) ?? null;
    const timeRange = data.start_time && data.end_time ? `${formatTime(data.start_time)} – ${formatTime(data.end_time)}` : 'Set times';
    const readyToSave =
        Boolean(data.teacher_id && data.class_room_id && data.start_time && data.end_time && selectedDays.length > 0) &&
        (isAdministrator || Boolean(data.course_id)) &&
        !hasConflict;

    const handleValueChange = (name: keyof CreateTimeTableForm) => (value: string | number | undefined) => {
        setData(name, String(value ?? ''));
    };

    const showFormErrorToast = (formErrors: Record<string, string>) => {
        const firstError = Object.values(formErrors)[0];
        toast.error(firstError || 'Failed to save the schedule. Please check the form.', {
            position: 'top-right',
            theme: 'dark',
        });
    };

    const resetSlotFields = () => {
        setData({
            academic_year_id: academicYear.id,
            staff_type: data.staff_type,
            teacher_id: '',
            course_id: '',
            class_room_id: '',
            day: '',
            days: [],
            start_time: '',
            end_time: '',
            create_another: false,
        });
        setHasConflict(false);
        setConflictMessage('');
        setFormKey((value) => value + 1);
    };

    const handleAdministratorDayToggle = (day: string) => {
        setData('days', data.days.includes(day) ? data.days.filter((selectedDay) => selectedDay !== day) : [...data.days, day]);
    };

    useEffect(() => {
        const checkConflict = async () => {
            if (isAdministrator) {
                setHasConflict(false);
                setConflictMessage('');
                setCheckingConflict(false);
                return;
            }

            if (data.academic_year_id && data.teacher_id && selectedDays.length > 0 && data.start_time && data.end_time) {
                setCheckingConflict(true);
                try {
                    const results = await Promise.all(
                        selectedDays.map(async (day) => {
                            const response = await fetch('/api/time-tables/check-conflict', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    Accept: 'application/json',
                                    'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '',
                                },
                                body: JSON.stringify({
                                    academic_year_id: data.academic_year_id,
                                    staff_type: data.staff_type,
                                    teacher_id: data.teacher_id,
                                    course_id: data.course_id,
                                    class_room_id: data.class_room_id,
                                    day,
                                    start_time: data.start_time,
                                    end_time: data.end_time,
                                }),
                            });

                            return { day, result: await response.json() };
                        }),
                    );

                    const conflict = results.find(({ result }) => result.has_conflict);
                    setHasConflict(!!conflict);

                    if (conflict) {
                        const { day, result } = conflict;
                        if (result.conflict_type === 'classroom') {
                            setConflictMessage(
                                `This time slot conflicts with an existing schedule for ${result.classroom_name || 'the selected venue'} on ${day}.`,
                            );
                        } else if (result.conflict_type === 'both') {
                            setConflictMessage(
                                `This time slot conflicts with both the staff member's schedule and the venue availability on ${day}.`,
                            );
                        } else {
                            setConflictMessage(`This time slot conflicts with an existing schedule on ${day}.`);
                        }
                    } else {
                        setConflictMessage('');
                    }
                } catch (error) {
                    console.error('Error checking conflict:', error);
                } finally {
                    setCheckingConflict(false);
                }
            }
        };

        const timeoutId = setTimeout(checkConflict, 500);
        return () => clearTimeout(timeoutId);
    }, [
        data.academic_year_id,
        data.staff_type,
        data.teacher_id,
        data.course_id,
        data.class_room_id,
        data.day,
        data.days,
        data.start_time,
        data.end_time,
    ]);

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success, {
                position: 'top-right',
                theme: 'dark',
            });
        }

        if (flash?.error) {
            toast.error(flash.error, {
                position: 'top-right',
                theme: 'dark',
            });
        }
    }, [flash?.success, flash?.error]);

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();

        if (hasConflict) {
            toast.error('Please resolve the time conflict before saving.', {
                position: 'top-right',
                theme: 'dark',
            });
            return;
        }

        transform((formData) => ({
            ...formData,
            create_another: false,
        }));

        post(route('admin.academics.time-tables.store'), {
            onError: showFormErrorToast,
        });
    };

    const handleSaveAndAddAnother = (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();

        if (hasConflict) {
            toast.error('Please resolve the time conflict before saving.', {
                position: 'top-right',
                theme: 'dark',
            });
            return;
        }

        transform((formData) => ({
            ...formData,
            create_another: true,
        }));

        post(route('admin.academics.time-tables.store'), {
            onSuccess: resetSlotFields,
            onError: showFormErrorToast,
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Create Schedule" />

            <form
                onSubmit={handleSubmit}
                className="min-h-full bg-gradient-to-b from-indigo-50/80 via-slate-50 to-slate-50 dark:from-indigo-950/20 dark:via-background dark:to-background"
            >
                <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-5 p-3 pb-10 sm:p-4 md:p-6 lg:p-8">
                    <Link
                        href={route('admin.academics.time-tables.index')}
                        className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                    >
                        <ArrowLeft className="size-4" />
                        Back to schedules
                    </Link>

                    <section className="overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-sm shadow-indigo-100/70 dark:border-indigo-900/40 dark:bg-card dark:shadow-none">
                        <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-slate-800 px-4 py-5 text-white sm:px-8 sm:py-6">
                            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase ring-1 ring-white/20">
                                            <Sparkles className="size-3.5" />
                                            New schedule
                                        </span>
                                        <span className="inline-flex max-w-full rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold tracking-wide text-indigo-700 uppercase">
                                            {academicYear.name}
                                        </span>
                                    </div>
                                    <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Assign staff to a venue and time</h1>
                                    <p className="mt-2 max-w-2xl text-sm text-indigo-50/90">
                                        Create a single session for a lecturer, or repeat a staff schedule across the days you choose.
                                    </p>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[28rem]">
                                    <HeroStat label="Staff" value={selectedStaff?.label || 'Pick staff'} />
                                    <HeroStat label="Venue" value={selectedVenue?.label || 'Pick venue'} />
                                    <HeroStat
                                        label="When"
                                        value={selectedDays.length ? `${selectedDays.length} day${selectedDays.length > 1 ? 's' : ''}` : 'Pick day'}
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    <div className="grid gap-6 xl:grid-cols-12">
                        <div className="space-y-6 xl:col-span-8">
                            <Section
                                step="01"
                                title="Who is assigned"
                                subtitle="Pick the staff type, then choose the person. Lecturers also need a course."
                            >
                                <div className="grid gap-4">
                                    <Field label="Staff type" error={errors.staff_type} required>
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            {staffTypeOptions.map((option) => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => {
                                                        setData('staff_type', option.value);
                                                        setData('teacher_id', '');
                                                        setFormKey((value) => value + 1);
                                                        if (option.value === 'administrator') {
                                                            setData('course_id', '');
                                                            setData('day', '');
                                                        } else {
                                                            setData('days', []);
                                                        }
                                                    }}
                                                    className={cn(
                                                        'flex min-h-14 items-center justify-between rounded-2xl border px-4 text-left transition',
                                                        data.staff_type === option.value
                                                            ? 'border-indigo-500 bg-indigo-50 text-indigo-900 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-100'
                                                            : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 dark:border-sidebar-border dark:bg-card dark:text-sidebar-foreground/70',
                                                    )}
                                                >
                                                    <span className="font-semibold">{option.label}</span>
                                                    <span
                                                        className={cn(
                                                            'flex size-6 items-center justify-center rounded-full border',
                                                            data.staff_type === option.value
                                                                ? 'border-indigo-600 bg-indigo-600 text-white'
                                                                : 'border-slate-300 text-transparent dark:border-sidebar-border',
                                                        )}
                                                    >
                                                        <Check className="size-3.5" />
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </Field>

                                    <div className="grid gap-4 md:grid-cols-2">
                                        <Field label="Assigned staff" error={errors.teacher_id} required>
                                            <ComboBox
                                                key={`staff-${formKey}-${data.staff_type}`}
                                                options={staffOptions}
                                                label="Search staff"
                                                externalValue={handleValueChange('teacher_id')}
                                                defaultValue={null}
                                            />
                                        </Field>
                                        {isAdministrator ? (
                                            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500 dark:border-sidebar-border dark:text-sidebar-foreground/60">
                                                Administrative staff schedules do not need a course.
                                            </div>
                                        ) : (
                                            <Field label="Course" error={errors.course_id} required>
                                                <ComboBox
                                                    key={`course-${formKey}`}
                                                    options={courses}
                                                    label="Search course"
                                                    externalValue={handleValueChange('course_id')}
                                                    defaultValue={null}
                                                />
                                            </Field>
                                        )}
                                    </div>
                                </div>
                            </Section>

                            <Section step="02" title="Where it takes place" subtitle="Choose the venue for this schedule.">
                                <Field label="Venue" error={errors.class_room_id} required>
                                    <ComboBox
                                        key={`venue-${formKey}`}
                                        options={classRooms}
                                        label="Search venue"
                                        externalValue={handleValueChange('class_room_id')}
                                        defaultValue={null}
                                    />
                                </Field>
                            </Section>

                            <Section
                                step="03"
                                title="When it runs"
                                subtitle={
                                    isAdministrator ? 'Select every day this schedule should repeat.' : 'Choose the day and time for this session.'
                                }
                            >
                                <div className="grid gap-4">
                                    <Field label={isAdministrator ? 'Days' : 'Day'} error={errors.days || errors['days.0'] || errors.day} required>
                                        {isAdministrator ? (
                                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                                {daysOptions.map((day) => {
                                                    const selected = data.days.includes(day.value);

                                                    return (
                                                        <button
                                                            key={day.value}
                                                            type="button"
                                                            onClick={() => handleAdministratorDayToggle(day.value)}
                                                            className={cn(
                                                                'min-h-12 rounded-2xl border px-3 text-sm font-semibold transition',
                                                                selected
                                                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-800 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-100'
                                                                    : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 dark:border-sidebar-border dark:bg-card dark:text-sidebar-foreground/70',
                                                            )}
                                                        >
                                                            {day.label.slice(0, 3)}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                                {daysOptions.map((day) => (
                                                    <button
                                                        key={day.value}
                                                        type="button"
                                                        onClick={() => setData('day', day.value)}
                                                        className={cn(
                                                            'min-h-12 rounded-2xl border px-3 text-sm font-semibold transition',
                                                            data.day === day.value
                                                                ? 'border-indigo-500 bg-indigo-50 text-indigo-800 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-100'
                                                                : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 dark:border-sidebar-border dark:bg-card dark:text-sidebar-foreground/70',
                                                        )}
                                                    >
                                                        {day.label.slice(0, 3)}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {isAdministrator ? (
                                            <p className="mt-2 text-xs text-slate-500 dark:text-sidebar-foreground/55">
                                                One schedule will be created for each selected day.
                                            </p>
                                        ) : null}
                                    </Field>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <Field label="Start time" htmlFor="start_time" error={errors.start_time} required>
                                            <input
                                                id="start_time"
                                                type="time"
                                                value={data.start_time}
                                                onChange={(event) => setData('start_time', event.target.value)}
                                                className={fieldClass}
                                                required
                                            />
                                        </Field>
                                        <Field label="End time" htmlFor="end_time" error={errors.end_time} required>
                                            <input
                                                id="end_time"
                                                type="time"
                                                value={data.end_time}
                                                onChange={(event) => setData('end_time', event.target.value)}
                                                className={fieldClass}
                                                required
                                            />
                                        </Field>
                                    </div>

                                    {checkingConflict ? (
                                        <div className="flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800 dark:border-indigo-900/40 dark:bg-indigo-950/30 dark:text-indigo-100">
                                            <Loader2 className="size-4 animate-spin" />
                                            Checking for time conflicts…
                                        </div>
                                    ) : hasConflict ? (
                                        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-100">
                                            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                                            <div>
                                                <p className="font-semibold">Time conflict detected</p>
                                                <p className="mt-1">{conflictMessage}</p>
                                                <p className="mt-2 text-xs">Adjust the time, venue, staff member, or day to continue.</p>
                                            </div>
                                        </div>
                                    ) : data.start_time && data.end_time ? (
                                        <div className="flex flex-col gap-1 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-900/40 dark:bg-emerald-950/20">
                                            <div>
                                                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">Ready to save</p>
                                                <p className="text-sm text-emerald-800 dark:text-emerald-200">
                                                    {durationLabel(data.start_time, data.end_time)} · {timeRange}
                                                </p>
                                            </div>
                                            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">No conflicts found</p>
                                        </div>
                                    ) : null}
                                </div>
                            </Section>
                        </div>

                        <aside className="xl:col-span-4">
                            <div className="space-y-4 xl:sticky xl:top-6">
                                <div className="rounded-3xl border border-indigo-100 bg-indigo-50/80 p-5 shadow-sm dark:border-indigo-900/40 dark:bg-indigo-950/20">
                                    <p className="text-xs font-semibold tracking-[0.18em] text-indigo-700 uppercase dark:text-indigo-300">
                                        Live preview
                                    </p>
                                    <h2 className="mt-2 text-lg font-semibold text-indigo-950 dark:text-indigo-50">What you’re assigning</h2>
                                    <div className="mt-5 space-y-4">
                                        <PreviewRow icon={UserRound} label="Staff" value={selectedStaff?.label || 'Not selected'} />
                                        <PreviewRow
                                            icon={BookOpen}
                                            label="Course"
                                            value={isAdministrator ? 'Not needed' : selectedCourse?.label || 'Not selected'}
                                        />
                                        <PreviewRow icon={MapPin} label="Venue" value={selectedVenue?.label || 'Not selected'} />
                                        <PreviewRow
                                            icon={CalendarDays}
                                            label="Days"
                                            value={selectedDays.length ? selectedDays.join(', ') : 'Not selected'}
                                        />
                                        <PreviewRow icon={Clock3} label="Time" value={timeRange} />
                                        <PreviewRow icon={Building2} label="Academic year" value={academicYear.name} />
                                    </div>
                                </div>

                                <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-sidebar-border dark:bg-card">
                                    <button
                                        type="submit"
                                        disabled={processing || !readyToSave}
                                        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {processing ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                                        {processing ? 'Saving…' : 'Save schedule'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSaveAndAddAnother}
                                        disabled={processing || !readyToSave}
                                        className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 text-sm font-semibold text-indigo-800 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-100"
                                    >
                                        <Plus className="size-4" />
                                        Save and add another
                                    </button>
                                    <Link
                                        href={route('admin.academics.time-tables.index')}
                                        className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-sidebar-border dark:text-sidebar-foreground dark:hover:bg-sidebar-accent"
                                    >
                                        Cancel
                                    </Link>
                                    {!readyToSave && !hasConflict ? (
                                        <p className="mt-3 text-center text-xs text-slate-500 dark:text-sidebar-foreground/55">
                                            Complete staff, venue, day, and time to continue.
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                        </aside>
                    </div>
                </div>
            </form>
            <ToastContainer />
        </AppLayout>
    );
}

function Section({ step, title, subtitle, children }: { step: string; title: string; subtitle: string; children: ReactNode }) {
    return (
        <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6 dark:border-sidebar-border dark:bg-card">
            <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-xs font-bold tracking-wide text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200">
                    {step}
                </span>
                <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-sidebar-foreground">{title}</h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-sidebar-foreground/60">{subtitle}</p>
                </div>
            </div>
            <div className="mt-5">{children}</div>
        </section>
    );
}

function Field({
    label,
    htmlFor,
    error,
    required,
    children,
}: {
    label: string;
    htmlFor?: string;
    error?: string;
    required?: boolean;
    children: ReactNode;
}) {
    const Wrapper = htmlFor ? 'label' : 'div';

    return (
        <Wrapper {...(htmlFor ? { htmlFor } : {})} className="block min-w-0 space-y-2">
            <span className="text-sm font-medium text-slate-800 dark:text-sidebar-foreground">
                {label}
                {required ? <span className="text-rose-500"> *</span> : null}
            </span>
            {children}
            {error ? (
                <span className="flex items-center gap-1 text-xs text-rose-600">
                    <AlertTriangle className="size-3.5" />
                    {error}
                </span>
            ) : null}
        </Wrapper>
    );
}

function HeroStat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15">
            <p className="text-[11px] font-medium tracking-wide text-indigo-100 uppercase">{label}</p>
            <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
        </div>
    );
}

function PreviewRow({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
    return (
        <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-200">
                <Icon className="size-4" />
            </div>
            <div className="min-w-0">
                <p className="text-xs font-medium text-indigo-800/70 dark:text-indigo-200/70">{label}</p>
                <p className="mt-0.5 text-sm font-semibold break-words text-indigo-950 dark:text-indigo-50">{value}</p>
            </div>
        </div>
    );
}
