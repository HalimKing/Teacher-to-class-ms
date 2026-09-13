export function communicationStatusClass(status: string): string {
    if (status === 'sent') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300';
    if (status === 'partial') return 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200';
    if (status === 'sending') return 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300';
    if (status === 'failed') return 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300';
    if (status === 'read') return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300';
    if (status === 'delivered') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300';
    return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
}

export function CommunicationStatusBadge({ status, label }: { status: string; label: string }) {
    return (
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${communicationStatusClass(status)}`}>
            {label}
        </span>
    );
}
