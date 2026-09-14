import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { AlertTriangle, CalendarDays, Check, Clock3, Loader2, ScrollText, Sparkles, Upload } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';

interface EligibleRecord {
    attendance_type: string;
    attendance_id: number;
    timetable_id?: number | null;
    attendance_date: string;
    explanation_type: string;
    label: string;
}

interface ExplanationRow {
    id: number;
    status: string;
    explanation_type: string;
    reason_category: string;
    attendance_date: string;
    explanation: string;
    admin_comments?: string | null;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface PageProps {
    explanations: {
        data: ExplanationRow[];
        links?: PaginationLink[];
        from?: number;
        to?: number;
        total?: number;
    };
    eligibleRecords: EligibleRecord[];
    reasonCategories: Record<string, string>;
    flash?: { success?: string; error?: string };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/teacher/dashboard' },
    { title: 'Attendance Explanations', href: '/teacher/attendance-explanations' },
];

function recordKey(record: EligibleRecord) {
    return `${record.attendance_type}-${record.attendance_id}-${record.explanation_type}`;
}

function formatDate(value?: string | null) {
    if (!value) return '—';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function typeLabel(type: string) {
    return type.replaceAll('_', ' ');
}

function statusTone(status: string) {
    if (status === 'approved') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200';
    if (status === 'rejected') return 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200';
    return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200';
}

export default function TeacherAttendanceExplanations({ explanations, eligibleRecords, reasonCategories }: PageProps) {
    const { flash } = usePage().props as PageProps;
    const [selectedKey, setSelectedKey] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'absence' | 'early_departure'>('all');

    const { data, setData, post, processing, errors, reset } = useForm({
        attendance_type: '',
        attendance_id: '',
        timetable_id: '',
        attendance_date: '',
        explanation_type: 'absence',
        reason_category: 'sick_leave',
        explanation: '',
        supporting_document: null as File | null,
    });

    const selected = useMemo(() => eligibleRecords.find((item) => recordKey(item) === selectedKey), [eligibleRecords, selectedKey]);

    const filteredRecords = useMemo(() => {
        if (typeFilter === 'all') return eligibleRecords;
        return eligibleRecords.filter((record) => record.explanation_type === typeFilter);
    }, [eligibleRecords, typeFilter]);

    const pendingCount = explanations.data.filter((row) => row.status === 'pending').length;
    const readyToSubmit = Boolean(selected && data.reason_category && data.explanation.trim());

    const onSelect = (key: string) => {
        setSelectedKey(key);
        const record = eligibleRecords.find((item) => recordKey(item) === key);
        if (!record) return;

        setData({
            attendance_type: record.attendance_type,
            attendance_id: String(record.attendance_id),
            timetable_id: record.timetable_id ? String(record.timetable_id) : '',
            attendance_date: record.attendance_date,
            explanation_type: record.explanation_type,
            reason_category: data.reason_category || 'sick_leave',
            explanation: data.explanation,
            supporting_document: null,
        });
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        post(route('teacher.attendance-explanations.store'), {
            forceFormData: true,
            onSuccess: () => {
                reset('explanation', 'supporting_document');
                setSelectedKey('');
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Attendance Explanations" />

            <div className="min-h-full bg-gradient-to-b from-amber-50/80 via-slate-50 to-slate-50 dark:from-amber-950/20 dark:via-background dark:to-background">
                <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-5 p-3 pb-10 sm:p-4 md:p-6 lg:p-8">
                    <section className="overflow-hidden rounded-3xl border border-amber-100 bg-white shadow-sm shadow-amber-100/70 dark:border-amber-900/40 dark:bg-card dark:shadow-none">
                        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-slate-800 px-4 py-5 text-white sm:px-8 sm:py-6">
                            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                                <div className="min-w-0">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase ring-1 ring-white/20">
                                        <Sparkles className="size-3.5" />
                                        Attendance review
                                    </span>
                                    <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Explain an absence or early departure</h1>
                                    <p className="mt-2 max-w-2xl text-sm text-amber-50/90">
                                        Choose a record from the last 14 days, add a reason, and submit it for review.
                                    </p>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[28rem]">
                                    <HeroStat label="Eligible" value={`${eligibleRecords.length} records`} />
                                    <HeroStat label="Pending" value={`${pendingCount} waiting`} />
                                    <HeroStat label="Submitted" value={`${explanations.total ?? explanations.data.length}`} />
                                </div>
                            </div>
                        </div>
                    </section>

                    {(flash?.success || flash?.error) && (
                        <div
                            className={cn(
                                'flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm',
                                flash.success
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100'
                                    : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-100',
                            )}
                        >
                            {flash.success ? <Check className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" />}
                            <span>{flash.success || flash.error}</span>
                        </div>
                    )}

                    <div className="grid gap-6 xl:grid-cols-12">
                        <form onSubmit={submit} className="space-y-6 xl:col-span-7">
                            <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6 dark:border-sidebar-border dark:bg-card">
                                <div className="flex items-start gap-3">
                                    <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-xs font-bold tracking-wide text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                                        01
                                    </span>
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900 dark:text-sidebar-foreground">Choose a record</h2>
                                        <p className="mt-1 text-sm text-slate-500 dark:text-sidebar-foreground/60">
                                            Only unexplained absences and early departures from the last 14 days appear here.
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-wrap gap-2">
                                    {[
                                        { value: 'all', label: 'All' },
                                        { value: 'absence', label: 'Absences' },
                                        { value: 'early_departure', label: 'Early departures' },
                                    ].map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setTypeFilter(option.value as typeof typeFilter)}
                                            className={cn(
                                                'min-h-10 rounded-full border px-3 text-sm font-medium transition',
                                                typeFilter === option.value
                                                    ? 'border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100'
                                                    : 'border-slate-200 bg-white text-slate-600 hover:border-amber-200 dark:border-sidebar-border dark:bg-card dark:text-sidebar-foreground/70',
                                            )}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>

                                {errors.attendance_id || errors.attendance_type ? (
                                    <p className="mt-3 text-xs text-rose-600">{errors.attendance_id || errors.attendance_type}</p>
                                ) : null}

                                <div className="mt-4 space-y-2">
                                    {filteredRecords.length === 0 ? (
                                        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center dark:border-sidebar-border">
                                            <p className="font-medium text-slate-800 dark:text-sidebar-foreground">No eligible records</p>
                                            <p className="mt-1 text-sm text-slate-500 dark:text-sidebar-foreground/55">
                                                {eligibleRecords.length === 0
                                                    ? 'There is nothing from the last 14 days that still needs an explanation.'
                                                    : 'Try another filter to see remaining records.'}
                                            </p>
                                        </div>
                                    ) : (
                                        filteredRecords.map((record) => {
                                            const active = selectedKey === recordKey(record);

                                            return (
                                                <button
                                                    key={recordKey(record)}
                                                    type="button"
                                                    onClick={() => onSelect(recordKey(record))}
                                                    className={cn(
                                                        'flex min-h-16 w-full items-start justify-between gap-3 rounded-2xl border px-4 py-4 text-left transition',
                                                        active
                                                            ? 'border-amber-300 bg-amber-50 shadow-sm dark:border-amber-800 dark:bg-amber-950/30'
                                                            : 'border-slate-200 bg-white hover:border-amber-200 dark:border-sidebar-border dark:bg-card',
                                                    )}
                                                >
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-slate-900 capitalize dark:text-sidebar-foreground">
                                                            {typeLabel(record.explanation_type)}
                                                        </p>
                                                        <p className="mt-1 text-sm break-words text-slate-600 dark:text-sidebar-foreground/70">
                                                            {record.label}
                                                        </p>
                                                    </div>
                                                    <span
                                                        className={cn(
                                                            'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border',
                                                            active
                                                                ? 'border-amber-600 bg-amber-600 text-white'
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
                            </section>

                            <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6 dark:border-sidebar-border dark:bg-card">
                                <div className="flex items-start gap-3">
                                    <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-xs font-bold tracking-wide text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                                        02
                                    </span>
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900 dark:text-sidebar-foreground">Add your explanation</h2>
                                        <p className="mt-1 text-sm text-slate-500 dark:text-sidebar-foreground/60">
                                            A category, details, and an optional document help reviewers decide faster.
                                        </p>
                                    </div>
                                </div>

                                {selected ? (
                                    <div className="mt-5 space-y-4">
                                        <div className="rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
                                            <p className="font-medium text-amber-950 dark:text-amber-50">{selected.label}</p>
                                            <p className="mt-1 text-amber-800/80 capitalize dark:text-amber-200/80">
                                                {typeLabel(selected.explanation_type)} · {formatDate(selected.attendance_date)}
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <span className="text-sm font-medium text-slate-800 dark:text-sidebar-foreground">
                                                Reason category <span className="text-rose-500">*</span>
                                            </span>
                                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                                {Object.entries(reasonCategories).map(([key, label]) => (
                                                    <button
                                                        key={key}
                                                        type="button"
                                                        onClick={() => setData('reason_category', key)}
                                                        className={cn(
                                                            'min-h-11 rounded-2xl border px-3 text-sm font-semibold transition',
                                                            data.reason_category === key
                                                                ? 'border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100'
                                                                : 'border-slate-200 bg-white text-slate-600 hover:border-amber-200 dark:border-sidebar-border dark:bg-card dark:text-sidebar-foreground/70',
                                                        )}
                                                    >
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                            {errors.reason_category ? <span className="text-xs text-rose-600">{errors.reason_category}</span> : null}
                                        </div>

                                        <label className="block space-y-2">
                                            <span className="text-sm font-medium text-slate-800 dark:text-sidebar-foreground">
                                                Detailed explanation <span className="text-rose-500">*</span>
                                            </span>
                                            <textarea
                                                value={data.explanation}
                                                onChange={(event) => setData('explanation', event.target.value)}
                                                rows={5}
                                                required
                                                placeholder="Explain what happened, including dates, times, and anything reviewers should know."
                                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 md:text-sm dark:border-sidebar-border dark:bg-background dark:text-sidebar-foreground dark:focus:ring-amber-950"
                                            />
                                            {errors.explanation ? <span className="text-xs text-rose-600">{errors.explanation}</span> : null}
                                        </label>

                                        <label className="block space-y-2">
                                            <span className="text-sm font-medium text-slate-800 dark:text-sidebar-foreground">
                                                Supporting document <span className="text-xs font-normal text-slate-400">Optional</span>
                                            </span>
                                            <div className="relative flex min-h-24 cursor-pointer items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 dark:border-sidebar-border dark:bg-background">
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                                                        <Upload className="size-4" />
                                                    </span>
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-medium text-slate-800 dark:text-sidebar-foreground">
                                                            {data.supporting_document?.name || 'PDF, image, or Word file'}
                                                        </p>
                                                        <p className="text-xs text-slate-500 dark:text-sidebar-foreground/55">Max 5 MB</p>
                                                    </div>
                                                </div>
                                                <span className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 dark:border-sidebar-border dark:bg-card dark:text-sidebar-foreground">
                                                    Browse
                                                </span>
                                                <input
                                                    type="file"
                                                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                                    onChange={(event) => setData('supporting_document', event.target.files?.[0] || null)}
                                                    className="absolute inset-0 cursor-pointer opacity-0"
                                                />
                                            </div>
                                            {errors.supporting_document ? (
                                                <span className="text-xs text-rose-600">{errors.supporting_document}</span>
                                            ) : null}
                                        </label>

                                        <button
                                            type="submit"
                                            disabled={processing || !readyToSubmit}
                                            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {processing ? <Loader2 className="size-4 animate-spin" /> : <ScrollText className="size-4" />}
                                            {processing ? 'Submitting…' : 'Submit explanation'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="mt-5 rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center dark:border-sidebar-border">
                                        <p className="font-medium text-slate-800 dark:text-sidebar-foreground">Select a record first</p>
                                        <p className="mt-1 text-sm text-slate-500 dark:text-sidebar-foreground/55">
                                            The reason form appears after you choose an attendance record.
                                        </p>
                                    </div>
                                )}
                            </section>
                        </form>

                        <aside className="xl:col-span-5">
                            <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6 xl:sticky xl:top-6 dark:border-sidebar-border dark:bg-card">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900 dark:text-sidebar-foreground">Your submissions</h2>
                                        <p className="mt-1 text-sm text-slate-500 dark:text-sidebar-foreground/60">
                                            Recent explanations and reviewer notes.
                                        </p>
                                    </div>
                                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-sidebar-accent dark:text-sidebar-foreground">
                                        {explanations.data.length}
                                    </span>
                                </div>

                                <div className="mt-5 space-y-3">
                                    {explanations.data.length === 0 ? (
                                        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center dark:border-sidebar-border">
                                            <p className="font-medium text-slate-800 dark:text-sidebar-foreground">No explanations yet</p>
                                            <p className="mt-1 text-sm text-slate-500 dark:text-sidebar-foreground/55">
                                                Submitted records will show their status here.
                                            </p>
                                        </div>
                                    ) : (
                                        explanations.data.map((row) => (
                                            <article
                                                key={row.id}
                                                className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 dark:border-sidebar-border dark:bg-sidebar-accent/40"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-slate-900 capitalize dark:text-sidebar-foreground">
                                                            {typeLabel(row.explanation_type)}
                                                        </p>
                                                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-sidebar-foreground/55">
                                                            <span className="inline-flex items-center gap-1">
                                                                <CalendarDays className="size-3.5" />
                                                                {formatDate(row.attendance_date)}
                                                            </span>
                                                            <span className="inline-flex items-center gap-1 capitalize">
                                                                <Clock3 className="size-3.5" />
                                                                {reasonCategories[row.reason_category] || typeLabel(row.reason_category)}
                                                            </span>
                                                        </p>
                                                    </div>
                                                    <span
                                                        className={cn(
                                                            'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize',
                                                            statusTone(row.status),
                                                        )}
                                                    >
                                                        {row.status}
                                                    </span>
                                                </div>
                                                <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-sidebar-foreground/80">
                                                    {row.explanation}
                                                </p>
                                                {row.admin_comments ? (
                                                    <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs text-slate-600 dark:bg-background dark:text-sidebar-foreground/70">
                                                        Reviewer: {row.admin_comments}
                                                    </p>
                                                ) : null}
                                            </article>
                                        ))
                                    )}
                                </div>

                                {explanations.links && explanations.links.length > 3 ? (
                                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 text-sm dark:border-sidebar-border">
                                        <span className="text-slate-500 dark:text-sidebar-foreground/55">
                                            Showing {explanations.from ?? 0}-{explanations.to ?? 0} of{' '}
                                            {explanations.total ?? explanations.data.length}
                                        </span>
                                        <div className="flex flex-wrap gap-2">
                                            {explanations.links.map((link, index) =>
                                                link.url ? (
                                                    <Link
                                                        key={`${link.label}-${index}`}
                                                        href={link.url}
                                                        className={cn(
                                                            'min-h-10 rounded-xl px-3 py-2 text-sm',
                                                            link.active
                                                                ? 'bg-amber-600 text-white'
                                                                : 'border border-slate-200 hover:bg-slate-50 dark:border-sidebar-border dark:hover:bg-sidebar-accent',
                                                        )}
                                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                                    />
                                                ) : null,
                                            )}
                                        </div>
                                    </div>
                                ) : null}
                            </section>
                        </aside>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

function HeroStat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15">
            <p className="text-[11px] font-medium tracking-wide text-amber-100 uppercase">{label}</p>
            <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
        </div>
    );
}
