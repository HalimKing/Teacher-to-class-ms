import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { FormEvent } from 'react';

interface PageProps {
    categories: Record<string, string>;
    priorities: Record<string, string>;
    flash?: { success?: string; error?: string };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/teacher/dashboard' },
    { title: 'Help Desk', href: '/teacher/help-desk' },
    { title: 'New Ticket', href: '/teacher/help-desk/create' },
];

export default function TeacherHelpDeskCreate({ categories, priorities }: PageProps) {
    const { flash } = usePage().props as PageProps;
    const { data, setData, post, processing, errors } = useForm<{
        subject: string;
        description: string;
        category: string;
        priority: string;
        attachment: File | null;
    }>({
        subject: '',
        description: '',
        category: 'technical',
        priority: 'medium',
        attachment: null,
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        post(route('teacher.help-desk.store'), { forceFormData: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="New Help Desk Ticket" />
            <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Submit a ticket</h1>
                    <p className="mt-1 text-sm text-slate-500">Describe your issue or request and our support team will follow up.</p>
                </div>

                {flash?.error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{flash.error}</div>}

                <form onSubmit={submit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Subject</label>
                        <input
                            value={data.subject}
                            onChange={(e) => setData('subject', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            required
                        />
                        {errors.subject && <p className="mt-1 text-sm text-rose-600">{errors.subject}</p>}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
                            <select
                                value={data.category}
                                onChange={(e) => setData('category', e.target.value)}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            >
                                {Object.entries(categories).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                            {errors.category && <p className="mt-1 text-sm text-rose-600">{errors.category}</p>}
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">Priority</label>
                            <select
                                value={data.priority}
                                onChange={(e) => setData('priority', e.target.value)}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            >
                                {Object.entries(priorities).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                            {errors.priority && <p className="mt-1 text-sm text-rose-600">{errors.priority}</p>}
                        </div>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                        <textarea
                            value={data.description}
                            onChange={(e) => setData('description', e.target.value)}
                            rows={6}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            required
                        />
                        {errors.description && <p className="mt-1 text-sm text-rose-600">{errors.description}</p>}
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Attachment (optional)</label>
                        <input
                            type="file"
                            onChange={(e) => setData('attachment', e.target.files?.[0] || null)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                        {errors.attachment && <p className="mt-1 text-sm text-rose-600">{errors.attachment}</p>}
                    </div>

                    <div className="flex items-center justify-end gap-3">
                        <Link href={route('teacher.help-desk.index')} className="rounded-lg border px-4 py-2 text-sm">
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={processing}
                            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                        >
                            {processing ? 'Submitting...' : 'Submit ticket'}
                        </button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
