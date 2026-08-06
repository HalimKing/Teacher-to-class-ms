import ComboBox from '@/components/combobox';
import AppLayout from '@/layouts/app-layout';
import { PagePropsWithFlash } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { AlertCircle, ArrowLeft, Copy, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';

interface Option {
    label: string;
    value: string | number;
    staff_type?: string;
    employee_id?: string;
    academic_year_id?: number;
}

interface ScheduleRow {
    key: string;
    staff_type: string;
    teacher_id: string;
    course_id: string;
    class_room_id: string;
    day: string;
    start_time: string;
    end_time: string;
}

interface BulkCreatePageProps {
    academicYear: { id: number; name: string } | null;
    academicYearOptions: Option[];
    courses: Option[];
    classRooms: Option[];
    teachers: Option[];
    staffTypeOptions: Option[];
    days: string[];
}

interface BulkResult {
    created: number;
    failed: number;
    total: number;
    errors: Array<{ index: number; errors: string[] }>;
}

const emptyRow = (): ScheduleRow => ({
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    staff_type: 'lecturer',
    teacher_id: '',
    course_id: '',
    class_room_id: '',
    day: '',
    start_time: '',
    end_time: '',
});

export default function BulkCreateTimeTablePage({
    academicYear,
    academicYearOptions,
    courses,
    classRooms,
    teachers,
    staffTypeOptions,
    days,
}: BulkCreatePageProps) {
    const { flash } = usePage().props as PagePropsWithFlash & { bulk_result?: BulkResult };
    const [academicYearId, setAcademicYearId] = useState<string>(academicYear ? String(academicYear.id) : '');
    const [rows, setRows] = useState<ScheduleRow[]>([emptyRow(), emptyRow()]);
    const [processing, setProcessing] = useState(false);
    const [rowErrors, setRowErrors] = useState<Record<number, string[]>>({});

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success, { theme: 'dark', position: 'top-right' });
        }
        if (flash?.error) {
            toast.error(flash.error, { theme: 'dark', position: 'top-right' });
        }
        if (flash?.bulk_result?.errors?.length) {
            const mapped: Record<number, string[]> = {};
            flash.bulk_result.errors.forEach((item) => {
                mapped[item.index] = item.errors;
            });
            setRowErrors(mapped);
        }
    }, [flash]);

    const teachersForType = useMemo(() => {
        return (staffType: string) => teachers.filter((teacher) => !teacher.staff_type || teacher.staff_type === staffType);
    }, [teachers]);

    const updateRow = (index: number, patch: Partial<ScheduleRow>) => {
        setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
        setRowErrors((prev) => {
            if (!prev[index]) return prev;
            const next = { ...prev };
            delete next[index];
            return next;
        });
    };

    const addRow = () => setRows((prev) => [...prev, emptyRow()]);

    const duplicateRow = (index: number) => {
        setRows((prev) => {
            const copy = { ...prev[index], key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
            const next = [...prev];
            next.splice(index + 1, 0, copy);
            return next;
        });
    };

    const removeRow = (index: number) => {
        setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
        setRowErrors((prev) => {
            const next: Record<number, string[]> = {};
            Object.entries(prev).forEach(([key, value]) => {
                const i = Number(key);
                if (i < index) next[i] = value;
                if (i > index) next[i - 1] = value;
            });
            return next;
        });
    };

    const validateClient = (): boolean => {
        const errors: Record<number, string[]> = {};

        rows.forEach((row, index) => {
            const messages: string[] = [];
            if (!row.staff_type) messages.push('Staff type is required.');
            if (!row.teacher_id) messages.push('Staff member is required.');
            if (row.staff_type === 'lecturer' && !row.course_id) messages.push('Course is required for lecturers.');
            if (!row.class_room_id) messages.push('Venue is required.');
            if (!row.day) messages.push('Day is required.');
            if (!row.start_time) messages.push('Start time is required.');
            if (!row.end_time) messages.push('End time is required.');
            if (row.start_time && row.end_time && row.end_time <= row.start_time) {
                messages.push('End time must be after start time.');
            }
            if (messages.length) errors[index] = messages;
        });

        setRowErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();

        if (!academicYearId) {
            toast.error('Please select an academic year.', { theme: 'dark' });
            return;
        }

        if (!validateClient()) {
            toast.error('Please fix validation errors before saving.', { theme: 'dark' });
            return;
        }

        setProcessing(true);
        router.post(
            route('admin.academics.time-tables.bulk-store'),
            {
                academic_year_id: Number(academicYearId),
                schedules: rows.map((row) => ({
                    staff_type: row.staff_type,
                    teacher_id: Number(row.teacher_id),
                    course_id: row.staff_type === 'lecturer' && row.course_id ? Number(row.course_id) : null,
                    class_room_id: Number(row.class_room_id),
                    day: row.day,
                    start_time: row.start_time,
                    end_time: row.end_time,
                })),
            },
            {
                preserveScroll: true,
                onFinish: () => setProcessing(false),
            },
        );
    };

    const selectedYearOption = academicYearOptions.find((option) => String(option.value) === academicYearId) ?? null;

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Dashboard', href: '/admin/dashboard' },
                { title: 'Assigned Schedules', href: '/admin/academics/time-tables' },
                { title: 'Bulk Create', href: '/admin/academics/time-tables/bulk-create' },
            ]}
        >
            <Head title="Bulk Create Schedules" />
            <ToastContainer />

            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-4 md:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-sidebar-foreground">Bulk Create Schedules</h1>
                        <p className="mt-1 text-sm text-sidebar-foreground/60">
                            Add multiple session schedules in one save. Duplicate rows to speed up entry — valid rows are saved even if some fail.
                        </p>
                    </div>
                    <Link
                        href={route('admin.academics.time-tables.index')}
                        className="inline-flex items-center gap-2 rounded-lg border border-sidebar-border/70 px-4 py-2 text-sm font-medium hover:bg-muted/40"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Schedules
                    </Link>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="rounded-xl border border-sidebar-border/70 bg-white p-4 shadow-sm dark:bg-sidebar-accent md:p-6">
                        <label className="mb-2 block text-sm font-medium text-sidebar-foreground">Academic Year</label>
                        <div className="max-w-md">
                            <ComboBox
                                options={academicYearOptions}
                                label="Select academic year"
                                defaultValue={selectedYearOption}
                                externalValue={(value) => setAcademicYearId(value ? String(value) : '')}
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        {rows.map((row, index) => {
                            const teacherOptions = teachersForType(row.staff_type);
                            const selectedTeacher = teacherOptions.find((option) => String(option.value) === row.teacher_id) ?? null;
                            const selectedCourse = courses.find((option) => String(option.value) === row.course_id) ?? null;
                            const selectedRoom = classRooms.find((option) => String(option.value) === row.class_room_id) ?? null;
                            const errors = rowErrors[index] ?? [];

                            return (
                                <div
                                    key={row.key}
                                    className={`rounded-xl border bg-white p-4 shadow-sm dark:bg-sidebar-accent md:p-5 ${
                                        errors.length ? 'border-rose-300' : 'border-sidebar-border/70'
                                    }`}
                                >
                                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                                        <h2 className="text-sm font-semibold text-sidebar-foreground">Schedule #{index + 1}</h2>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => duplicateRow(index)}
                                                className="inline-flex items-center gap-1 rounded-lg border border-sidebar-border/70 px-3 py-1.5 text-xs font-medium hover:bg-muted/40"
                                            >
                                                <Copy className="h-3.5 w-3.5" />
                                                Duplicate
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => removeRow(index)}
                                                disabled={rows.length <= 1}
                                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                                Remove
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                        <div>
                                            <label className="mb-1 block text-xs font-semibold text-sidebar-foreground/70">Staff Type</label>
                                            <select
                                                value={row.staff_type}
                                                onChange={(event) =>
                                                    updateRow(index, {
                                                        staff_type: event.target.value,
                                                        teacher_id: '',
                                                        course_id: event.target.value === 'administrator' ? '' : row.course_id,
                                                    })
                                                }
                                                className="w-full rounded-lg border border-sidebar-border/70 bg-white px-3 py-2.5 text-sm"
                                            >
                                                {staffTypeOptions.map((option) => (
                                                    <option key={String(option.value)} value={String(option.value)}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="mb-1 block text-xs font-semibold text-sidebar-foreground/70">Staff Member</label>
                                            <ComboBox
                                                key={`${row.key}-teacher-${row.staff_type}`}
                                                options={teacherOptions}
                                                label="Select staff"
                                                defaultValue={selectedTeacher}
                                                externalValue={(value) => updateRow(index, { teacher_id: value ? String(value) : '' })}
                                            />
                                        </div>

                                        {row.staff_type === 'lecturer' && (
                                            <div>
                                                <label className="mb-1 block text-xs font-semibold text-sidebar-foreground/70">Course</label>
                                                <ComboBox
                                                    key={`${row.key}-course`}
                                                    options={courses}
                                                    label="Select course"
                                                    defaultValue={selectedCourse}
                                                    externalValue={(value) => updateRow(index, { course_id: value ? String(value) : '' })}
                                                />
                                            </div>
                                        )}

                                        <div>
                                            <label className="mb-1 block text-xs font-semibold text-sidebar-foreground/70">Venue</label>
                                            <ComboBox
                                                key={`${row.key}-venue`}
                                                options={classRooms}
                                                label="Select venue"
                                                defaultValue={selectedRoom}
                                                externalValue={(value) => updateRow(index, { class_room_id: value ? String(value) : '' })}
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-1 block text-xs font-semibold text-sidebar-foreground/70">Day</label>
                                            <select
                                                value={row.day}
                                                onChange={(event) => updateRow(index, { day: event.target.value })}
                                                className="w-full rounded-lg border border-sidebar-border/70 bg-white px-3 py-2.5 text-sm"
                                            >
                                                <option value="">Select day</option>
                                                {days.map((day) => (
                                                    <option key={day} value={day}>
                                                        {day}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="mb-1 block text-xs font-semibold text-sidebar-foreground/70">Start Time</label>
                                            <input
                                                type="time"
                                                value={row.start_time}
                                                onChange={(event) => updateRow(index, { start_time: event.target.value })}
                                                className="w-full rounded-lg border border-sidebar-border/70 bg-white px-3 py-2.5 text-sm"
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-1 block text-xs font-semibold text-sidebar-foreground/70">End Time</label>
                                            <input
                                                type="time"
                                                value={row.end_time}
                                                onChange={(event) => updateRow(index, { end_time: event.target.value })}
                                                className="w-full rounded-lg border border-sidebar-border/70 bg-white px-3 py-2.5 text-sm"
                                            />
                                        </div>
                                    </div>

                                    {errors.length > 0 && (
                                        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                                            <div className="mb-1 flex items-center gap-2 font-medium">
                                                <AlertCircle className="h-4 w-4" />
                                                Validation errors
                                            </div>
                                            <ul className="list-disc space-y-0.5 pl-5">
                                                {errors.map((error) => (
                                                    <li key={error}>{error}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <button
                            type="button"
                            onClick={addRow}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-sidebar-border/70 px-4 py-2.5 text-sm font-medium hover:bg-muted/40"
                        >
                            <Plus className="h-4 w-4" />
                            Add Schedule Row
                        </button>

                        <button
                            type="submit"
                            disabled={processing}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                        >
                            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {processing ? 'Saving schedules...' : `Save ${rows.length} Schedule${rows.length === 1 ? '' : 's'}`}
                        </button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
