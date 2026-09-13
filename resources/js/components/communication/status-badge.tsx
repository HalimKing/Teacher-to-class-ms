export function communicationStatusClass(status: string): string {
    if (status === 'sent') return 'bg-emerald-100 text-emerald-800';
    if (status === 'partial') return 'bg-amber-100 text-amber-800';
    if (status === 'sending') return 'bg-sky-100 text-sky-800';
    if (status === 'failed') return 'bg-rose-100 text-rose-800';
    if (status === 'read') return 'bg-indigo-100 text-indigo-800';
    if (status === 'delivered') return 'bg-emerald-100 text-emerald-800';
    return 'bg-slate-100 text-slate-700';
}

export function CommunicationStatusBadge({ status, label }: { status: string; label: string }) {
    return (
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${communicationStatusClass(status)}`}>
            {label}
        </span>
    );
}
