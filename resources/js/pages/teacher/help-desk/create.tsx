import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { AlertCircle, ArrowLeft, FileText, LifeBuoy, Loader2, Paperclip, Send, UploadCloud, X } from 'lucide-react';
import { useRef, type DragEvent, type FormEvent } from 'react';

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

const DESCRIPTION_LIMIT = 10000;
const ACCEPTED_FILES = '.pdf,.jpg,.jpeg,.png,.doc,.docx';

const priorityStyles: Record<string, { dot: string; active: string }> = {
    low: { dot: 'bg-slate-400', active: 'border-slate-400 bg-slate-50 text-slate-900 dark:bg-slate-800/60 dark:text-white' },
    medium: { dot: 'bg-sky-500', active: 'border-sky-500 bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-100' },
    high: { dot: 'bg-amber-500', active: 'border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100' },
    urgent: { dot: 'bg-rose-500', active: 'border-rose-500 bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-100' },
};

const inputClass =
    'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:outline-none dark:border-sidebar-border dark:bg-background dark:text-sidebar-foreground';

function formatFileSize(bytes: number): string {
    if (bytes < 1024 * 1024) {
        return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FieldError({ message }: { message?: string }) {
    if (!message) {
        return null;
    }

    return (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-rose-600">
            <AlertCircle className="size-4 shrink-0" />
            {message}
        </p>
    );
}

export default function TeacherHelpDeskCreate({ categories, priorities }: PageProps) {
    const { flash } = usePage<{ flash?: PageProps['flash'] }>().props;
    const fileInputRef = useRef<HTMLInputElement | null>(null);
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

    const selectFile = (file: File | null) => {
        setData('attachment', file);
    };

    const clearFile = () => {
        selectFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        selectFile(event.dataTransfer.files?.[0] ?? null);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="New Help Desk Ticket" />

            <div className="min-h-full bg-gradient-to-b from-indigo-50/80 via-slate-50 to-slate-50 dark:from-indigo-950/20 dark:via-background dark:to-background">
                <div className="mx-auto flex w-full max-w-4xl min-w-0 flex-col gap-5 p-3 pb-10 sm:p-4 md:p-6 lg:p-8">
                    <section className="overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-sm shadow-indigo-100/70 dark:border-indigo-900/40 dark:bg-card dark:shadow-none">
                        <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-slate-800 px-5 py-6 text-white sm:px-8">
                            <Link
                                href={route('teacher.help-desk.index')}
                                className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium ring-1 ring-white/20 transition hover:bg-white/25"
                            >
                                <ArrowLeft className="size-3.5" />
                                Back to Help Desk
                            </Link>
                            <div className="mt-5 flex items-start gap-4">
                                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                                    <LifeBuoy className="size-6" />
                                </span>
                                <div className="min-w-0">
                                    <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Submit a ticket</h1>
                                    <p className="mt-2 max-w-2xl text-sm text-white/85">
                                        Describe your issue or request and our support team will follow up.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {flash?.error && (
                        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
                            <AlertCircle className="mt-0.5 size-4 shrink-0" />
                            {flash.error}
                        </div>
                    )}

                    <form
                        onSubmit={submit}
                        className="rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-sidebar-border dark:bg-card"
                    >
                        <div className="space-y-6 p-5 sm:p-7">
                            <div>
                                <label htmlFor="subject" className="mb-2 block text-sm font-semibold text-slate-800 dark:text-sidebar-foreground">
                                    Subject <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    id="subject"
                                    value={data.subject}
                                    onChange={(e) => setData('subject', e.target.value)}
                                    maxLength={255}
                                    placeholder="Short summary of the problem or request"
                                    className={cn(inputClass, errors.subject && 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/10')}
                                    required
                                />
                                <FieldError message={errors.subject} />
                            </div>

                            <div className="grid gap-6 lg:grid-cols-2">
                                <div>
                                    <label htmlFor="category" className="mb-2 block text-sm font-semibold text-slate-800 dark:text-sidebar-foreground">
                                        Category
                                    </label>
                                    <select
                                        id="category"
                                        value={data.category}
                                        onChange={(e) => setData('category', e.target.value)}
                                        className={inputClass}
                                    >
                                        {Object.entries(categories).map(([value, label]) => (
                                            <option key={value} value={value}>
                                                {label}
                                            </option>
                                        ))}
                                    </select>
                                    <FieldError message={errors.category} />
                                </div>

                                <div>
                                    <span className="mb-2 block text-sm font-semibold text-slate-800 dark:text-sidebar-foreground">Priority</span>
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Priority">
                                        {Object.entries(priorities).map(([value, label]) => {
                                            const style = priorityStyles[value] ?? priorityStyles.medium;
                                            const selected = data.priority === value;
                                            return (
                                                <button
                                                    key={value}
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={selected}
                                                    onClick={() => setData('priority', value)}
                                                    className={cn(
                                                        'flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-medium transition',
                                                        selected
                                                            ? style.active
                                                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-sidebar-border dark:bg-background dark:text-sidebar-foreground/70',
                                                    )}
                                                >
                                                    <span className={cn('size-2 rounded-full', style.dot)} />
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <FieldError message={errors.priority} />
                                </div>
                            </div>

                            <div>
                                <div className="mb-2 flex items-end justify-between gap-3">
                                    <label htmlFor="description" className="block text-sm font-semibold text-slate-800 dark:text-sidebar-foreground">
                                        Description <span className="text-rose-500">*</span>
                                    </label>
                                    <span className="text-xs text-slate-400">
                                        {data.description.length.toLocaleString()} / {DESCRIPTION_LIMIT.toLocaleString()}
                                    </span>
                                </div>
                                <textarea
                                    id="description"
                                    value={data.description}
                                    onChange={(e) => setData('description', e.target.value)}
                                    rows={7}
                                    maxLength={DESCRIPTION_LIMIT}
                                    placeholder="What were you trying to do, what happened, and what message did you see?"
                                    className={cn(
                                        inputClass,
                                        'resize-y leading-relaxed',
                                        errors.description && 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/10',
                                    )}
                                    required
                                />
                                <FieldError message={errors.description} />
                            </div>

                            <div>
                                <span className="mb-2 block text-sm font-semibold text-slate-800 dark:text-sidebar-foreground">
                                    Attachment <span className="font-normal text-slate-400">(optional)</span>
                                </span>

                                {data.attachment ? (
                                    <div className="flex items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 px-4 py-3 dark:border-indigo-900/60 dark:bg-indigo-950/20">
                                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm dark:bg-card">
                                            <FileText className="size-5" />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-slate-900 dark:text-sidebar-foreground">{data.attachment.name}</p>
                                            <p className="text-xs text-slate-500">{formatFileSize(data.attachment.size)}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={clearFile}
                                            className="rounded-xl p-2 text-slate-500 transition hover:bg-white hover:text-rose-600 dark:hover:bg-card"
                                            aria-label="Remove attachment"
                                        >
                                            <X className="size-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <label
                                        htmlFor="attachment"
                                        onDragOver={(event) => event.preventDefault()}
                                        onDrop={handleDrop}
                                        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center transition hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-sidebar-border dark:bg-background"
                                    >
                                        <span className="flex size-11 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm dark:bg-card">
                                            <UploadCloud className="size-5" />
                                        </span>
                                        <span className="text-sm font-medium text-slate-800 dark:text-sidebar-foreground">
                                            Click to upload or drag a file here
                                        </span>
                                        <span className="text-xs text-slate-500">PDF, JPG, PNG, DOC, or DOCX · up to 5 MB</span>
                                    </label>
                                )}

                                <input
                                    ref={fileInputRef}
                                    id="attachment"
                                    type="file"
                                    accept={ACCEPTED_FILES}
                                    onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
                                    className="sr-only"
                                />
                                <FieldError message={errors.attachment} />
                            </div>
                        </div>

                        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7 dark:border-sidebar-border dark:bg-background/40">
                            <p className="flex items-center gap-2 text-xs text-slate-500">
                                <Paperclip className="size-3.5" />
                                Fields marked <span className="text-rose-500">*</span> are required.
                            </p>
                            <div className="flex flex-col-reverse gap-3 sm:flex-row">
                                <Link
                                    href={route('teacher.help-desk.index')}
                                    className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-sidebar-border dark:bg-card dark:text-sidebar-foreground"
                                >
                                    Cancel
                                </Link>
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {processing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                                    {processing ? 'Submitting...' : 'Submit ticket'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </AppLayout>
    );
}
