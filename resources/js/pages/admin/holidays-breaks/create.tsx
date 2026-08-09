import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent, useMemo, useState, type ReactNode } from 'react';

interface TeacherOption {
    id: number;
    name: string;
    employee_id?: string | null;
    staff_type?: string | null;
    department?: string | null;
}

interface CreateProps {
    typeOptions: Record<string, string>;
    coverageOptions: Record<string, string>;
    coverageDescriptions: Record<string, string>;
    teachers: TeacherOption[];
    staffCounts: { all: number; administrators: number; lecturers: number };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Holidays & Breaks', href: '/admin/holidays-breaks' },
    { title: 'Create', href: '/admin/holidays-breaks/create' },
];

const SELECTED_COVERAGES = new Set(['selected_staff', 'selected_administrators', 'selected_lecturers']);

function staffTypeForCoverage(coverage: string): string | null {
    if (coverage === 'all_administrators' || coverage === 'selected_administrators') {
        return 'administrator';
    }
    if (coverage === 'all_lecturers' || coverage === 'selected_lecturers') {
        return 'lecturer';
    }
    return null;
}

export default function HolidayBreakCreate({
    typeOptions,
    coverageOptions,
    coverageDescriptions,
    teachers,
    staffCounts,
}: CreateProps) {
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        type: Object.keys(typeOptions)[0] || 'public_holiday',
        start_date: '',
        end_date: '',
        description: '',
        status: 'active',
        coverage_type: 'all_staff',
        coverage_teacher_ids: [] as number[],
    });
    const [teacherSearch, setTeacherSearch] = useState('');

    const requiresSelection = SELECTED_COVERAGES.has(data.coverage_type);
    const typeFilter = staffTypeForCoverage(data.coverage_type);

    const selectableTeachers = useMemo(() => {
        const term = teacherSearch.trim().toLowerCase();
        return teachers
            .filter((teacher) => (typeFilter ? teacher.staff_type === typeFilter : true))
            .filter((teacher) => {
                if (!term) {
                    return true;
                }
                return (
                    teacher.name.toLowerCase().includes(term) ||
                    (teacher.employee_id || '').toLowerCase().includes(term) ||
                    (teacher.department || '').toLowerCase().includes(term)
                );
            });
    }, [teachers, typeFilter, teacherSearch]);

    const affectedCount = useMemo(() => {
        if (data.coverage_type === 'all_staff') {
            return staffCounts.all;
        }
        if (data.coverage_type === 'all_administrators') {
            return staffCounts.administrators;
        }
        if (data.coverage_type === 'all_lecturers') {
            return staffCounts.lecturers;
        }
        return data.coverage_teacher_ids.length;
    }, [data.coverage_type, data.coverage_teacher_ids.length, staffCounts]);

    const setCoverageType = (value: string) => {
        setData((current) => ({
            ...current,
            coverage_type: value,
            coverage_teacher_ids: SELECTED_COVERAGES.has(value) ? current.coverage_teacher_ids : [],
        }));
        setTeacherSearch('');
    };

    const toggleTeacher = (teacherId: number) => {
        const next = data.coverage_teacher_ids.includes(teacherId)
            ? data.coverage_teacher_ids.filter((id) => id !== teacherId)
            : [...data.coverage_teacher_ids, teacherId];
        setData('coverage_teacher_ids', next);
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        post(route('admin.holidays-breaks.store'));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Create Holiday / Break" />

            <div className="mx-auto w-full max-w-3xl space-y-5 p-4 md:p-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Create Holiday / Break</h1>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        Choose who the period applies to. Covered staff without break duty will not be required to take
                        attendance. Historical records are never changed.
                    </p>
                </div>

                <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <Field label="Name / Title" error={errors.name}>
                        <input
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                            required
                        />
                    </Field>

                    <Field label="Type" error={errors.type}>
                        <select
                            value={data.type}
                            onChange={(e) => setData('type', e.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                        >
                            {Object.entries(typeOptions).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </Field>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Start date" error={errors.start_date}>
                            <input
                                type="date"
                                value={data.start_date}
                                onChange={(e) => setData('start_date', e.target.value)}
                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                                required
                            />
                        </Field>
                        <Field label="End date" error={errors.end_date}>
                            <input
                                type="date"
                                value={data.end_date}
                                onChange={(e) => setData('end_date', e.target.value)}
                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                                required
                            />
                        </Field>
                    </div>

                    <Field label="Applies To (Staff Coverage)" error={errors.coverage_type}>
                        <select
                            value={data.coverage_type}
                            onChange={(e) => setCoverageType(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                        >
                            {Object.entries(coverageOptions).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                        <p className="mt-1.5 text-xs text-slate-500">{coverageDescriptions[data.coverage_type]}</p>
                        <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-200">
                            Affected staff: {affectedCount}
                        </p>
                    </Field>

                    {requiresSelection && (
                        <div className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Select covered staff</p>
                                <p className="text-xs text-slate-500">{data.coverage_teacher_ids.length} selected</p>
                            </div>
                            <input
                                value={teacherSearch}
                                onChange={(e) => setTeacherSearch(e.target.value)}
                                placeholder="Search name, employee ID, or department"
                                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                            />
                            <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
                                {selectableTeachers.length === 0 ? (
                                    <p className="px-3 py-4 text-sm text-slate-500">No matching staff found.</p>
                                ) : (
                                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {selectableTeachers.map((teacher) => (
                                            <li key={teacher.id}>
                                                <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                                                    <input
                                                        type="checkbox"
                                                        checked={data.coverage_teacher_ids.includes(teacher.id)}
                                                        onChange={() => toggleTeacher(teacher.id)}
                                                        className="mt-1 size-4 rounded border-slate-300 text-emerald-600"
                                                    />
                                                    <span>
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
                                        ))}
                                    </ul>
                                )}
                            </div>
                            {errors.coverage_teacher_ids ? (
                                <p className="text-xs text-red-600">{errors.coverage_teacher_ids}</p>
                            ) : null}
                        </div>
                    )}

                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                        After saving, use the break detail page to assign <strong>Break Duty</strong> staff who must still
                        report for attendance. Only covered staff can be placed on break duty.
                    </div>

                    <Field label="Description / Notes" error={errors.description}>
                        <textarea
                            value={data.description}
                            onChange={(e) => setData('description', e.target.value)}
                            rows={4}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                        />
                    </Field>

                    <Field label="Status" error={errors.status}>
                        <select
                            value={data.status}
                            onChange={(e) => setData('status', e.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                        >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </Field>

                    <div className="flex justify-end gap-2 pt-2">
                        <Link
                            href={route('admin.holidays-breaks.index')}
                            className="rounded-xl border px-4 py-2.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={processing || (requiresSelection && data.coverage_teacher_ids.length === 0)}
                            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
    return (
        <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</span>
            {children}
            {error ? <span className="block text-xs text-red-600">{error}</span> : null}
        </label>
    );
}
