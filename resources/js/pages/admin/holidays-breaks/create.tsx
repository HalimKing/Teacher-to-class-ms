import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { formatLongDateRange } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem, type PagePropsWithFlash } from '@/types';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    CalendarDays,
    CalendarRange,
    Check,
    Info,
    Loader2,
    Save,
    Search,
    ShieldCheck,
    Users,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Bounce, toast, ToastContainer } from 'react-toastify';

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

const selectClass =
    'border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50';

const textareaClass =
    'border-input bg-background min-h-28 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50';

function staffTypeForCoverage(coverage: string): string | null {
    if (coverage === 'all_administrators' || coverage === 'selected_administrators') {
        return 'administrator';
    }
    if (coverage === 'all_lecturers' || coverage === 'selected_lecturers') {
        return 'lecturer';
    }
    return null;
}

function inclusiveDayCount(startDate: string, endDate: string): number | null {
    if (!startDate || !endDate) {
        return null;
    }

    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
        return null;
    }

    return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

export default function HolidayBreakCreate({
    typeOptions,
    coverageOptions,
    coverageDescriptions,
    teachers,
    staffCounts,
}: CreateProps) {
    const { flash } = usePage().props as PagePropsWithFlash;
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
    const errorList = Object.values(errors).filter(Boolean);
    const durationDays = inclusiveDayCount(data.start_date, data.end_date);
    const cannotSubmit = processing || (requiresSelection && data.coverage_teacher_ids.length === 0);

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

    const selectedTeachers = useMemo(
        () => teachers.filter((teacher) => data.coverage_teacher_ids.includes(teacher.id)),
        [teachers, data.coverage_teacher_ids],
    );

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

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success, { theme: 'dark', transition: Bounce });
        }
        if (flash?.error) {
            toast.error(flash.error, { theme: 'dark', transition: Bounce });
        }
    }, [flash?.success, flash?.error]);

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

    const selectAllVisible = () => {
        const visibleIds = selectableTeachers.map((teacher) => teacher.id);
        setData('coverage_teacher_ids', Array.from(new Set([...data.coverage_teacher_ids, ...visibleIds])));
    };

    const clearSelection = () => {
        setData('coverage_teacher_ids', []);
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        post(route('admin.holidays-breaks.store'), {
            onError: (formErrors) => {
                const firstError = Object.values(formErrors)[0];
                toast.error(firstError || 'Please review the highlighted fields and try again.', {
                    theme: 'dark',
                    transition: Bounce,
                });
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Create Holiday / Break" />
            <ToastContainer />

            <form onSubmit={submit} className="flex h-full flex-1 flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 rounded-full border border-sidebar-border/70 bg-white px-3 py-1 text-xs font-medium text-sidebar-foreground/70 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                            <CalendarDays className="size-3.5 text-emerald-600" />
                            Attendance exception period
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-sidebar-foreground md:text-3xl">
                            Create Holiday / Break
                        </h1>
                        <p className="max-w-2xl text-sm text-sidebar-foreground/60">
                            Choose who the period applies to. Covered staff without break duty will not be required to take
                            attendance. Historical records are never changed.
                        </p>
                    </div>
                    <Button asChild variant="outline" className="shrink-0">
                        <Link href={route('admin.holidays-breaks.index')}>
                            <ArrowLeft className="size-4" />
                            Back to list
                        </Link>
                    </Button>
                </div>

                {errorList.length > 0 && (
                    <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100">
                        <AlertTriangle />
                        <AlertTitle>Please fix the highlighted fields</AlertTitle>
                        <AlertDescription>{errorList[0]}</AlertDescription>
                    </Alert>
                )}

                <div className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
                    <div className="space-y-6">
                        <Card className="border-sidebar-border/70 bg-white shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <CalendarRange className="size-4 text-sidebar-foreground/50" />
                                    Period details
                                </CardTitle>
                                <CardDescription>Name the holiday or break and set when it runs.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Field label="Name / title" htmlFor="name" error={errors.name} required hint="Shown on the holidays list">
                                    <Input
                                        id="name"
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        placeholder="e.g. Christmas Break 2026"
                                        required
                                        aria-invalid={Boolean(errors.name)}
                                    />
                                </Field>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <Field label="Type" htmlFor="type" error={errors.type} required>
                                        <select
                                            id="type"
                                            value={data.type}
                                            onChange={(e) => setData('type', e.target.value)}
                                            className={cn(selectClass, errors.type && 'border-destructive')}
                                            aria-invalid={Boolean(errors.type)}
                                        >
                                            {Object.entries(typeOptions).map(([value, label]) => (
                                                <option key={value} value={value}>
                                                    {label}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>

                                    <Field label="Status" htmlFor="status" error={errors.status} required hint="Inactive periods are ignored">
                                        <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="status">
                                            {[
                                                { value: 'active', label: 'Active' },
                                                { value: 'inactive', label: 'Inactive' },
                                            ].map((option) => {
                                                const selected = data.status === option.value;
                                                return (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => setData('status', option.value)}
                                                        className={cn(
                                                            'flex h-9 items-center justify-center rounded-md border text-sm font-medium transition-colors',
                                                            selected
                                                                ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                                                                : 'border-input bg-background text-sidebar-foreground hover:bg-accent',
                                                        )}
                                                        aria-pressed={selected}
                                                    >
                                                        {option.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </Field>
                                </div>

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
                                        required
                                        hint={durationDays ? `${durationDays} day${durationDays === 1 ? '' : 's'}` : 'On or after start date'}
                                    >
                                        <Input
                                            id="end_date"
                                            type="date"
                                            value={data.end_date}
                                            min={data.start_date || undefined}
                                            onChange={(e) => setData('end_date', e.target.value)}
                                            required
                                            aria-invalid={Boolean(errors.end_date)}
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
                                            <Users className="size-4 text-sidebar-foreground/50" />
                                            Staff coverage
                                        </CardTitle>
                                        <CardDescription className="mt-1.5">
                                            Decide who is covered. Everyone else keeps their normal attendance schedule.
                                        </CardDescription>
                                    </div>
                                    <Badge variant="secondary" className="w-fit">
                                        {affectedCount} affected
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Field label="Applies to" htmlFor="coverage_type" error={errors.coverage_type} required>
                                    <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Staff coverage">
                                        {Object.entries(coverageOptions).map(([value, label]) => {
                                            const selected = data.coverage_type === value;
                                            return (
                                                <label
                                                    key={value}
                                                    className={cn(
                                                        'flex cursor-pointer gap-3 rounded-xl border p-3 text-left transition-colors',
                                                        selected
                                                            ? 'border-emerald-500 bg-emerald-50/90 ring-1 ring-emerald-500/20 dark:border-emerald-400/50 dark:bg-emerald-950/30'
                                                            : 'border-sidebar-border/70 bg-background hover:border-emerald-300 dark:border-sidebar-border',
                                                    )}
                                                >
                                                    <input
                                                        type="radio"
                                                        name="coverage_type"
                                                        value={value}
                                                        checked={selected}
                                                        onChange={() => setCoverageType(value)}
                                                        className="mt-1 size-4 accent-emerald-600"
                                                    />
                                                    <span className="min-w-0">
                                                        <span className="block text-sm font-medium text-sidebar-foreground">
                                                            {label}
                                                        </span>
                                                        <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                                                            {coverageDescriptions[value]}
                                                        </span>
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </Field>

                                <p className="rounded-lg border border-dashed border-sidebar-border/80 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                                    {coverageDescriptions[data.coverage_type]}
                                </p>

                                {requiresSelection && (
                                    <div className="space-y-3 rounded-xl border border-sidebar-border/70 p-3 dark:border-sidebar-border">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <p className="text-sm font-semibold text-sidebar-foreground">Select covered staff</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {data.coverage_teacher_ids.length} selected
                                                    {typeFilter ? ` · ${typeFilter}s only` : ''}
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <Button type="button" variant="outline" size="sm" onClick={selectAllVisible}>
                                                    Select visible
                                                </Button>
                                                <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
                                                    Clear
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="relative">
                                            <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
                                            <Input
                                                value={teacherSearch}
                                                onChange={(e) => setTeacherSearch(e.target.value)}
                                                placeholder="Search name, employee ID, or department"
                                                className="pl-9"
                                                aria-label="Search staff"
                                            />
                                        </div>
                                        <div className="max-h-64 overflow-y-auto rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
                                            {selectableTeachers.length === 0 ? (
                                                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                                                    No matching staff found.
                                                </p>
                                            ) : (
                                                <ul className="divide-y divide-border">
                                                    {selectableTeachers.map((teacher) => {
                                                        const checked = data.coverage_teacher_ids.includes(teacher.id);
                                                        return (
                                                            <li key={teacher.id}>
                                                                <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-muted/50">
                                                                    <Checkbox
                                                                        checked={checked}
                                                                        onCheckedChange={() => toggleTeacher(teacher.id)}
                                                                        className="mt-0.5"
                                                                        aria-label={`Cover ${teacher.name}`}
                                                                    />
                                                                    <span className="min-w-0">
                                                                        <span className="block text-sm font-medium text-sidebar-foreground">
                                                                            {teacher.name}
                                                                        </span>
                                                                        <span className="block text-xs text-muted-foreground">
                                                                            {teacher.employee_id || 'No employee ID'}
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
                                        {errors.coverage_teacher_ids ? (
                                            <p className="text-xs text-destructive" role="alert">
                                                {errors.coverage_teacher_ids}
                                            </p>
                                        ) : null}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="border-sidebar-border/70 bg-white shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Info className="size-4 text-sidebar-foreground/50" />
                                    Notes
                                </CardTitle>
                                <CardDescription>Optional context for administrators reviewing this period later.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Field label="Description" htmlFor="description" error={errors.description} hint="Optional">
                                    <textarea
                                        id="description"
                                        value={data.description}
                                        onChange={(e) => setData('description', e.target.value)}
                                        rows={4}
                                        className={cn(textareaClass, errors.description && 'border-destructive')}
                                        placeholder="Campus closed, reduced services, or other notes"
                                        aria-invalid={Boolean(errors.description)}
                                    />
                                </Field>

                                <Alert className="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                                    <ShieldCheck />
                                    <AlertTitle>Break duty is assigned next</AlertTitle>
                                    <AlertDescription>
                                        After saving, use the break detail page to assign break duty staff who must still
                                        report for attendance. Only covered staff can be placed on break duty.
                                    </AlertDescription>
                                </Alert>
                            </CardContent>
                        </Card>
                    </div>

                    <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
                        <Card className="border-emerald-200/80 bg-emerald-50/70 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
                            <CardHeader>
                                <CardTitle className="text-base text-emerald-950 dark:text-emerald-100">Review before saving</CardTitle>
                                <CardDescription className="text-emerald-800/80 dark:text-emerald-200/70">
                                    Confirm the period and who it will cover.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <SummaryRow label="Title" value={data.name.trim() || 'Untitled period'} />
                                <SummaryRow label="Type" value={typeOptions[data.type] || data.type} />
                                <SummaryRow
                                    label="Dates"
                                    value={
                                        data.start_date || data.end_date
                                            ? formatLongDateRange(data.start_date, data.end_date, 'Not set')
                                            : 'Not set'
                                    }
                                />
                                <SummaryRow
                                    label="Duration"
                                    value={
                                        durationDays
                                            ? `${durationDays} day${durationDays === 1 ? '' : 's'}`
                                            : 'Select start and end dates'
                                    }
                                />
                                <SummaryRow label="Status" value={data.status === 'active' ? 'Active' : 'Inactive'} />
                                <SummaryRow label="Applies to" value={coverageOptions[data.coverage_type] || data.coverage_type} />
                                <SummaryRow label="Affected staff" value={String(affectedCount)} />

                                {requiresSelection ? (
                                    selectedTeachers.length > 0 ? (
                                        <ul className="space-y-1.5 rounded-xl border border-emerald-200/70 bg-white/70 p-3 text-xs text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
                                            {selectedTeachers.slice(0, 6).map((teacher) => (
                                                <li key={teacher.id} className="flex items-start gap-2">
                                                    <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                                                    <span>
                                                        <span className="font-medium">{teacher.name}</span>
                                                        {teacher.employee_id ? (
                                                            <span className="text-emerald-800/70 dark:text-emerald-200/70">
                                                                {' '}
                                                                · {teacher.employee_id}
                                                            </span>
                                                        ) : null}
                                                    </span>
                                                </li>
                                            ))}
                                            {selectedTeachers.length > 6 && (
                                                <li className="font-medium">+{selectedTeachers.length - 6} more</li>
                                            )}
                                        </ul>
                                    ) : (
                                        <p className="rounded-xl border border-dashed border-emerald-200/80 px-3 py-4 text-center text-xs text-emerald-800/80 dark:border-emerald-900/50 dark:text-emerald-200/70">
                                            Select at least one staff member to enable Save.
                                        </p>
                                    )
                                ) : null}
                            </CardContent>
                        </Card>

                        <Card className="hidden border-sidebar-border/70 bg-white shadow-sm xl:block dark:border-sidebar-border dark:bg-sidebar-accent">
                            <CardContent className="flex flex-col gap-3 pt-6">
                                <Button
                                    type="submit"
                                    disabled={cannotSubmit}
                                    className="h-10 bg-emerald-600 text-white hover:bg-emerald-700"
                                >
                                    {processing ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                                    {processing ? 'Saving…' : 'Save holiday / break'}
                                </Button>
                                <Button asChild type="button" variant="outline">
                                    <Link href={route('admin.holidays-breaks.index')}>Cancel</Link>
                                </Button>
                                <p className="text-center text-xs text-muted-foreground">
                                    Required fields are marked with <span className="text-destructive">*</span>
                                </p>
                            </CardContent>
                        </Card>
                    </aside>
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-sidebar-border/70 pt-4 sm:flex-row sm:justify-end xl:hidden">
                    <Button asChild type="button" variant="outline" className="sm:min-w-28">
                        <Link href={route('admin.holidays-breaks.index')}>Cancel</Link>
                    </Button>
                    <Button
                        type="submit"
                        disabled={cannotSubmit}
                        className="bg-emerald-600 text-white hover:bg-emerald-700 sm:min-w-44"
                    >
                        {processing ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                        {processing ? 'Saving…' : 'Save holiday / break'}
                    </Button>
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
    children: ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
                <Label htmlFor={htmlFor}>
                    {label}
                    {required ? <span className="text-destructive"> *</span> : null}
                </Label>
                {hint && !error ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
            </div>
            {children}
            {error ? (
                <p className="text-xs text-destructive" role="alert">
                    {error}
                </p>
            ) : null}
        </div>
    );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-start justify-between gap-3 text-sm">
            <span className="text-emerald-800/80 dark:text-emerald-200/70">{label}</span>
            <span className="max-w-[60%] text-right font-medium text-emerald-950 dark:text-emerald-100">{value}</span>
        </div>
    );
}
