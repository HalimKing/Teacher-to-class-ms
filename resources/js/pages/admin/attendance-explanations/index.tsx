import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

interface ExplanationRow {
    id: number;
    status: string;
    explanation_type: string;
    reason_category: string;
    attendance_date: string;
    staff?: { first_name?: string; last_name?: string; employee_id?: string };
}

interface PageProps {
    explanations: {
        data: ExplanationRow[];
    };
    filters: { status?: string; type?: string; search?: string };
    reasonCategories: Record<string, string>;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/admin/dashboard' },
    { title: 'Attendance Explanations', href: '/admin/attendance-explanations' },
];

export default function AttendanceExplanationIndex({ explanations, filters, reasonCategories }: PageProps) {
    const [search, setSearch] = useState(filters.search || '');
    const [status, setStatus] = useState(filters.status || '');
    const [type, setType] = useState(filters.type || '');

    const applyFilters = () => {
        router.get(route('admin.attendance-explanations.index'), { search, status, type }, { preserveState: true, replace: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Attendance Explanations" />
            <div className="space-y-6 p-4 md:p-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Attendance Explanations</h1>
                    <p className="mt-1 text-sm text-slate-500">Review absence and early departure explanations submitted by staff.</p>
                </div>

                <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff..." className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                        <option value="">All statuses</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                    <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                        <option value="">All types</option>
                        <option value="absence">Absence</option>
                        <option value="early_departure">Early departure</option>
                    </select>
                    <button type="button" onClick={applyFilters} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200">
                        Filter
                    </button>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <tr>
                                <th className="px-4 py-3">Staff</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">Category</th>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {explanations.data.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                                        No explanations found.
                                    </td>
                                </tr>
                            ) : (
                                explanations.data.map((row) => (
                                    <tr key={row.id}>
                                        <td className="px-4 py-3 font-medium">
                                            {row.staff?.first_name} {row.staff?.last_name}
                                        </td>
                                        <td className="px-4 py-3 capitalize">{row.explanation_type.replace('_', ' ')}</td>
                                        <td className="px-4 py-3">{reasonCategories[row.reason_category] || row.reason_category}</td>
                                        <td className="px-4 py-3">{row.attendance_date}</td>
                                        <td className="px-4 py-3 capitalize">{row.status}</td>
                                        <td className="px-4 py-3 text-right">
                                            <Link href={route('admin.attendance-explanations.show', row.id)} className="font-medium text-blue-600 hover:underline">
                                                Review
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </AppLayout>
    );
}
