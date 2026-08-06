import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm, usePage } from '@inertiajs/react';
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

interface PageProps {
    explanations: { data: ExplanationRow[] };
    eligibleRecords: EligibleRecord[];
    reasonCategories: Record<string, string>;
    flash?: { success?: string; error?: string };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/teacher/dashboard' },
    { title: 'Attendance Explanations', href: '/teacher/attendance-explanations' },
];

export default function TeacherAttendanceExplanations({ explanations, eligibleRecords, reasonCategories }: PageProps) {
    const { flash } = usePage().props as PageProps;
    const [selectedKey, setSelectedKey] = useState('');

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

    const selected = useMemo(
        () => eligibleRecords.find((item) => `${item.attendance_type}-${item.attendance_id}-${item.explanation_type}` === selectedKey),
        [eligibleRecords, selectedKey],
    );

    const onSelect = (key: string) => {
        setSelectedKey(key);
        const record = eligibleRecords.find((item) => `${item.attendance_type}-${item.attendance_id}-${item.explanation_type}` === key);
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
            <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Absence & Early Departure Explanations</h1>
                    <p className="mt-1 text-sm text-slate-500">Submit an explanation for absences or early departures within the last 14 days.</p>
                </div>

                {(flash?.success || flash?.error) && (
                    <div className={`rounded-xl border px-4 py-3 text-sm ${flash.success ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
                        {flash.success || flash.error}
                    </div>
                )}

                <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
                    <label className="block space-y-1.5">
                        <span className="text-sm font-medium">Attendance record</span>
                        <select value={selectedKey} onChange={(e) => onSelect(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" required>
                            <option value="">Select a record</option>
                            {eligibleRecords.map((record) => (
                                <option key={`${record.attendance_type}-${record.attendance_id}-${record.explanation_type}`} value={`${record.attendance_type}-${record.attendance_id}-${record.explanation_type}`}>
                                    {record.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    {selected && (
                        <>
                            <label className="block space-y-1.5">
                                <span className="text-sm font-medium">Reason category</span>
                                <select
                                    value={data.reason_category}
                                    onChange={(e) => setData('reason_category', e.target.value)}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                    required
                                >
                                    {Object.entries(reasonCategories).map(([key, label]) => (
                                        <option key={key} value={key}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                                {errors.reason_category && <span className="text-xs text-red-600">{errors.reason_category}</span>}
                            </label>

                            <label className="block space-y-1.5">
                                <span className="text-sm font-medium">Detailed explanation</span>
                                <textarea
                                    value={data.explanation}
                                    onChange={(e) => setData('explanation', e.target.value)}
                                    className="min-h-28 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                    required
                                />
                                {errors.explanation && <span className="text-xs text-red-600">{errors.explanation}</span>}
                            </label>

                            <label className="block space-y-1.5">
                                <span className="text-sm font-medium">Supporting document (optional)</span>
                                <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                    onChange={(e) => setData('supporting_document', e.target.files?.[0] || null)}
                                    className="w-full text-sm"
                                />
                                {errors.supporting_document && <span className="text-xs text-red-600">{errors.supporting_document}</span>}
                            </label>

                            <button type="submit" disabled={processing} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
                                {processing ? 'Submitting...' : 'Submit explanation'}
                            </button>
                        </>
                    )}
                </form>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">Your submissions</div>
                    <div className="divide-y divide-slate-100">
                        {explanations.data.length === 0 ? (
                            <p className="px-4 py-8 text-center text-sm text-slate-400">No explanations submitted yet.</p>
                        ) : (
                            explanations.data.map((row) => (
                                <div key={row.id} className="px-4 py-3 text-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="font-medium capitalize text-slate-900">
                                            {row.explanation_type.replace('_', ' ')} · {row.attendance_date}
                                        </p>
                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold capitalize text-slate-700">{row.status}</span>
                                    </div>
                                    <p className="mt-1 text-slate-600">{row.explanation}</p>
                                    {row.admin_comments && <p className="mt-1 text-xs text-slate-500">Admin: {row.admin_comments}</p>}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
