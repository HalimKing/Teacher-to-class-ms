import AppLayout from '@/layouts/app-layout';
import { can } from '@/lib/can';
import { formatLongDate, formatLongDateRange } from '@/lib/dates';
import { type BreadcrumbItem, type PagePropsWithFlash } from '@/types';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Bounce, toast, ToastContainer } from 'react-toastify';

interface HolidayBreak {
    id: number;
    name: string;
    type: string;
    type_label: string;
    coverage_type: string;
    coverage_label: string;
    coverage_description: string;
    requires_staff_selection: boolean;
    start_date: string;
    end_date: string;
    description?: string | null;
    status: string;
    created_by_name?: string | null;
    created_at?: string | null;
    duty_assignments_count: number;
    coverage_assignments_count: number;
    covered_staff_count: number;
}

interface CoverageAssignment {
    id: number;
    teacher_id: number;
    teacher_name: string;
    employee_id?: string | null;
    staff_type?: string | null;
    department?: string | null;
}

interface DutyAssignment {
    id: number;
    teacher_id: number;
    teacher_name: string;
    employee_id?: string | null;
    staff_type?: string | null;
    department?: string | null;
    duty_dates?: string[] | null;
    notes?: string | null;
}

interface TeacherOption {
    id: number;
    name: string;
    employee_id?: string | null;
    staff_type?: string | null;
    department?: string | null;
    faculty?: string | null;
}

interface ShowProps {
    holidayBreak: HolidayBreak;
    coverageAssignments: CoverageAssignment[];
    dutyAssignments: DutyAssignment[];
    eligibleDutyTeachers: TeacherOption[];
    canAssignAllEligible: boolean;
    eligibleDutyCount: number;
}

export default function HolidayBreakShow({
    holidayBreak,
    coverageAssignments,
    dutyAssignments,
    eligibleDutyTeachers,
    canAssignAllEligible,
    eligibleDutyCount,
}: ShowProps) {
    const { flash } = usePage().props as PagePropsWithFlash;
    const [teacherSearch, setTeacherSearch] = useState('');
    const [dutyDateInput, setDutyDateInput] = useState('');

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Holidays & Breaks', href: '/admin/holidays-breaks' },
        { title: holidayBreak.name, href: `/admin/holidays-breaks/${holidayBreak.id}` },
    ];

    const availableTeachers = useMemo(() => {
        const term = teacherSearch.trim().toLowerCase();
        return eligibleDutyTeachers.filter((teacher) => {
            if (!term) {
                return true;
            }
            return (
                teacher.name.toLowerCase().includes(term) ||
                (teacher.employee_id || '').toLowerCase().includes(term) ||
                (teacher.department || '').toLowerCase().includes(term)
            );
        });
    }, [eligibleDutyTeachers, teacherSearch]);

    const { data, setData, post, processing, errors, reset } = useForm<{
        teacher_ids: number[];
        duty_dates: string[];
        notes: string;
    }>({
        teacher_ids: [],
        duty_dates: [],
        notes: '',
    });

    const [assigningAll, setAssigningAll] = useState(false);

    const selectedTeachers = useMemo(
        () => eligibleDutyTeachers.filter((teacher) => data.teacher_ids.includes(teacher.id)),
        [eligibleDutyTeachers, data.teacher_ids],
    );

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success, { theme: 'dark', transition: Bounce });
        }
        if (flash?.error) {
            toast.error(flash.error, { theme: 'dark', transition: Bounce });
        }
    }, [flash]);

    const toggleTeacher = (teacherId: number) => {
        if (data.teacher_ids.includes(teacherId)) {
            setData(
                'teacher_ids',
                data.teacher_ids.filter((id) => id !== teacherId),
            );
            return;
        }

        setData('teacher_ids', [...data.teacher_ids, teacherId]);
    };

    const selectAllVisible = () => {
        const visibleIds = availableTeachers.map((teacher) => teacher.id);
        setData('teacher_ids', Array.from(new Set([...data.teacher_ids, ...visibleIds])));
    };

    const clearSelection = () => {
        setData('teacher_ids', []);
    };

    const addDutyDate = () => {
        if (!dutyDateInput) {
            return;
        }
        if (dutyDateInput < holidayBreak.start_date || dutyDateInput > holidayBreak.end_date) {
            toast.error('Duty date must fall within the break period.', { theme: 'dark' });
            return;
        }
        if (data.duty_dates.includes(dutyDateInput)) {
            return;
        }
        setData('duty_dates', [...data.duty_dates, dutyDateInput].sort());
        setDutyDateInput('');
    };

    const submitDuty = (event: FormEvent) => {
        event.preventDefault();
        if (data.teacher_ids.length === 0) {
            toast.error('Select at least one covered staff member.', { theme: 'dark' });
            return;
        }

        post(route('admin.holidays-breaks.duty.store', holidayBreak.id), {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                setTeacherSearch('');
            },
        });
    };

    const assignAllEligible = () => {
        if (!confirm(`Assign all ${eligibleDutyCount} eligible covered staff to break duty?`)) {
            return;
        }

        setAssigningAll(true);
        router.post(
            route('admin.holidays-breaks.duty.assign-all', holidayBreak.id),
            {
                duty_dates: data.duty_dates,
                notes: data.notes,
            },
            {
                preserveScroll: true,
                onFinish: () => setAssigningAll(false),
                onSuccess: () => {
                    reset();
                    setTeacherSearch('');
                },
            },
        );
    };

    const removeDuty = (assignment: DutyAssignment) => {
        if (!confirm(`Remove ${assignment.teacher_name} from break duty?`)) {
            return;
        }
        router.delete(route('admin.holidays-breaks.duty.destroy', [holidayBreak.id, assignment.id]), {
            preserveScroll: true,
        });
    };

    const deleteBreak = () => {
        if (!confirm('Delete this holiday/break period? Historical attendance records will not be modified.')) {
            return;
        }
        router.delete(route('admin.holidays-breaks.destroy', holidayBreak.id));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={holidayBreak.name} />
            <ToastContainer />

            <div className="mx-auto w-full max-w-5xl space-y-5 p-4 md:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{holidayBreak.name}</h1>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            {holidayBreak.type_label} · {formatLongDateRange(holidayBreak.start_date, holidayBreak.end_date)}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {can('admin.holidays-breaks.edit') && (
                            <Link
                                href={route('admin.holidays-breaks.edit', holidayBreak.id)}
                                className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                                Edit
                            </Link>
                        )}
                        {can('admin.holidays-breaks.delete') && (
                            <button
                                type="button"
                                onClick={deleteBreak}
                                className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                            >
                                Delete
                            </button>
                        )}
                    </div>
                </div>

                <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2">
                    <Info label="Status" value={holidayBreak.status} />
                    <Info label="Applies to" value={holidayBreak.coverage_label} />
                    <Info label="Covered staff" value={String(holidayBreak.covered_staff_count)} />
                    <Info label="Break duty staff" value={String(holidayBreak.duty_assignments_count)} />
                    <Info label="Created by" value={holidayBreak.created_by_name || '—'} />
                    <Info label="Created at" value={formatLongDate(holidayBreak.created_at)} />
                    <div className="sm:col-span-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Coverage rules</p>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{holidayBreak.coverage_description}</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600 dark:text-slate-300">
                            <li>Covered staff without break duty: attendance not required</li>
                            <li>Covered staff on break duty: normal attendance (face, location, check-in/out)</li>
                            <li>Staff not covered: follow their normal schedule</li>
                        </ul>
                    </div>
                    {holidayBreak.description ? (
                        <div className="sm:col-span-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</p>
                            <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{holidayBreak.description}</p>
                        </div>
                    ) : null}
                </section>

                {holidayBreak.requires_staff_selection && (
                    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Covered Staff</h2>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                Only these staff members are exempt from attendance unless assigned to break duty.
                            </p>
                        </div>
                        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                                <thead className="bg-slate-50 dark:bg-slate-950/50">
                                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        <th className="px-4 py-3">Staff</th>
                                        <th className="px-4 py-3">Type</th>
                                        <th className="px-4 py-3">Department</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {coverageAssignments.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                                                No covered staff selected.
                                            </td>
                                        </tr>
                                    ) : (
                                        coverageAssignments.map((assignment) => (
                                            <tr key={assignment.id}>
                                                <td className="px-4 py-3">
                                                    <p className="font-medium text-slate-900 dark:text-white">
                                                        {assignment.teacher_name}
                                                    </p>
                                                    <p className="text-xs text-slate-500">{assignment.employee_id || '—'}</p>
                                                </td>
                                                <td className="px-4 py-3 capitalize text-slate-600 dark:text-slate-300">
                                                    {assignment.staff_type || '—'}
                                                </td>
                                                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                                    {assignment.department || '—'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Break Duty / Essential Staff</h2>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            Break duty can only be assigned to staff covered by this holiday/break. Assigned staff continue
                            normal attendance. Leave duty dates empty to require attendance on all days in the range.
                        </p>
                        <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-200">
                            Eligible for duty: {eligibleDutyCount} · Currently on duty: {dutyAssignments.length}
                        </p>
                    </div>

                    {can('admin.holidays-breaks.edit') && (
                        <form onSubmit={submitDuty} className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                            {canAssignAllEligible && eligibleDutyTeachers.length > 0 && (
                                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                                    <p className="text-xs text-emerald-900 dark:text-emerald-100">
                                        Assign every eligible covered staff member to break duty in one step.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={assignAllEligible}
                                        disabled={assigningAll}
                                        className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                                    >
                                        Assign all eligible to break duty
                                    </button>
                                </div>
                            )}

                            <div>
                                <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">Search covered staff</label>
                                <input
                                    value={teacherSearch}
                                    onChange={(e) => setTeacherSearch(e.target.value)}
                                    placeholder="Name, employee ID, or department"
                                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                                />
                            </div>

                            <div>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                        Select staff for break duty
                                    </label>
                                    <div className="flex gap-2 text-xs">
                                        <button
                                            type="button"
                                            onClick={selectAllVisible}
                                            className="font-medium text-emerald-700 hover:underline"
                                        >
                                            Select all shown
                                        </button>
                                        <button
                                            type="button"
                                            onClick={clearSelection}
                                            className="font-medium text-slate-500 hover:underline"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>

                                {selectedTeachers.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {selectedTeachers.map((teacher) => (
                                            <button
                                                key={teacher.id}
                                                type="button"
                                                onClick={() => toggleTeacher(teacher.id)}
                                                className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800"
                                            >
                                                {teacher.name}
                                                {teacher.employee_id ? ` (${teacher.employee_id})` : ''} ×
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
                                    {availableTeachers.length === 0 ? (
                                        <p className="px-3 py-4 text-sm text-slate-500">
                                            No eligible covered staff available for duty assignment.
                                        </p>
                                    ) : (
                                        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {availableTeachers.map((teacher) => {
                                                const checked = data.teacher_ids.includes(teacher.id);
                                                return (
                                                    <li key={teacher.id}>
                                                        <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={() => toggleTeacher(teacher.id)}
                                                                className="mt-1 size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                                            />
                                                            <span className="min-w-0">
                                                                <span className="block text-sm font-medium text-slate-900 dark:text-white">
                                                                    {teacher.name}
                                                                </span>
                                                                <span className="block text-xs text-slate-500">
                                                                    {teacher.employee_id || '—'}
                                                                    {teacher.staff_type ? ` · ${teacher.staff_type}` : ''}
                                                                    {teacher.department ? ` · ${teacher.department}` : ''}
                                                                </span>
                                                            </span>
                                                        </label>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </div>
                                <p className="mt-1.5 text-xs text-slate-500">
                                    {data.teacher_ids.length} selected
                                    {availableTeachers.length > 0 ? ` · ${availableTeachers.length} shown` : ''}
                                </p>
                                {errors.teacher_ids ? <p className="mt-1 text-xs text-red-600">{errors.teacher_ids}</p> : null}
                            </div>

                            <div>
                                <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                    Optional duty dates
                                </label>
                                <div className="mt-1.5 flex gap-2">
                                    <input
                                        type="date"
                                        min={holidayBreak.start_date}
                                        max={holidayBreak.end_date}
                                        value={dutyDateInput}
                                        onChange={(e) => setDutyDateInput(e.target.value)}
                                        className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                                    />
                                    <button
                                        type="button"
                                        onClick={addDutyDate}
                                        className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                                    >
                                        Add date
                                    </button>
                                </div>
                                {data.duty_dates.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {data.duty_dates.map((date) => (
                                            <button
                                                key={date}
                                                type="button"
                                                onClick={() =>
                                                    setData(
                                                        'duty_dates',
                                                        data.duty_dates.filter((item) => item !== date),
                                                    )
                                                }
                                                className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                                            >
                                                {formatLongDate(date)} ×
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">Notes</label>
                                <textarea
                                    value={data.notes}
                                    onChange={(e) => setData('notes', e.target.value)}
                                    rows={2}
                                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={processing || data.teacher_ids.length === 0}
                                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                                {data.teacher_ids.length > 1
                                    ? `Assign ${data.teacher_ids.length} staff to break duty`
                                    : 'Assign to break duty'}
                            </button>
                        </form>
                    )}

                    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                            <thead className="bg-slate-50 dark:bg-slate-950/50">
                                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    <th className="px-4 py-3">Staff</th>
                                    <th className="px-4 py-3">Duty dates</th>
                                    <th className="px-4 py-3">Notes</th>
                                    <th className="px-4 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {dutyAssignments.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                                            No essential staff assigned yet.
                                        </td>
                                    </tr>
                                ) : (
                                    dutyAssignments.map((assignment) => (
                                        <tr key={assignment.id}>
                                            <td className="px-4 py-3">
                                                <p className="font-medium text-slate-900 dark:text-white">
                                                    {assignment.teacher_name}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {assignment.employee_id || '—'}
                                                    {assignment.staff_type ? ` · ${assignment.staff_type}` : ''}
                                                    {assignment.department ? ` · ${assignment.department}` : ''}
                                                </p>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                                {assignment.duty_dates && assignment.duty_dates.length > 0
                                                    ? assignment.duty_dates.map((date) => formatLongDate(date)).join(', ')
                                                    : 'All days in period'}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                                {assignment.notes || '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                {can('admin.holidays-breaks.edit') && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeDuty(assignment)}
                                                        className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                                                    >
                                                        Remove
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </AppLayout>
    );
}

function Info({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-sm font-medium capitalize text-slate-900 dark:text-white">{value}</p>
        </div>
    );
}
