import { Check, Clock3, X } from 'lucide-react';

export interface VenueChangeApprovalItem {
    id: number;
    role: string;
    role_label: string;
    status: string;
    status_label: string;
    assigned_name?: string | null;
    decided_by_name?: string | null;
    comments?: string | null;
    decided_at_display?: string | null;
}

const statusClass = (status: string) => {
    if (status === 'approved') {
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200';
    }

    if (status === 'rejected') {
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200';
    }

    return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200';
};

function actorLabel(approval: VenueChangeApprovalItem) {
    if (approval.decided_by_name) {
        return `Recorded by ${approval.decided_by_name}`;
    }

    if (approval.assigned_name) {
        return `Assigned to ${approval.assigned_name}`;
    }

    return 'Any authorized administrator';
}

function TimelineIcon({ status }: { status: string }) {
    if (status === 'approved') {
        return (
            <span className="flex size-9 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                <Check className="size-4" />
            </span>
        );
    }

    if (status === 'rejected') {
        return (
            <span className="flex size-9 items-center justify-center rounded-full bg-rose-600 text-white shadow-sm">
                <X className="size-4" />
            </span>
        );
    }

    return (
        <span className="flex size-9 items-center justify-center rounded-full bg-amber-100 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/60">
            <Clock3 className="size-4" />
        </span>
    );
}

export default function VenueChangeApprovalStatus({
    approvals = [],
    progress,
    variant = 'cards',
}: {
    approvals?: VenueChangeApprovalItem[];
    progress?: string | null;
    variant?: 'cards' | 'timeline';
}) {
    if (approvals.length === 0) {
        return null;
    }

    if (variant === 'timeline') {
        return (
            <ol className="space-y-0">
                {approvals.map((approval, index) => (
                    <li key={approval.id} className="relative flex gap-4 pb-6 last:pb-0">
                        {index < approvals.length - 1 && (
                            <span className="absolute top-9 bottom-0 left-[17px] w-px bg-slate-200 dark:bg-sidebar-border" />
                        )}
                        <div className="relative z-10 shrink-0">
                            <TimelineIcon status={approval.status} />
                        </div>
                        <div className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-sidebar-border dark:bg-sidebar-accent">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="font-semibold text-slate-900 dark:text-sidebar-foreground">{approval.role_label}</p>
                                    <p className="mt-0.5 text-xs text-slate-500 dark:text-sidebar-foreground/55">
                                        {actorLabel(approval)}
                                        {approval.decided_at_display ? ` · ${approval.decided_at_display}` : ''}
                                    </p>
                                </div>
                                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass(approval.status)}`}>
                                    {approval.status_label}
                                </span>
                            </div>
                            {approval.comments && (
                                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 dark:text-sidebar-foreground/75">
                                    {approval.comments}
                                </p>
                            )}
                        </div>
                    </li>
                ))}
            </ol>
        );
    }

    return (
        <div className="space-y-3">
            {progress && <p className="text-sm font-medium text-sidebar-foreground">{progress}</p>}
            <ol className="space-y-3">
                {approvals.map((approval) => (
                    <li key={approval.id} className="rounded-xl border border-sidebar-border/60 bg-card px-4 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="font-medium text-sidebar-foreground">{approval.role_label}</p>
                                <p className="mt-0.5 text-xs text-sidebar-foreground/60">
                                    {actorLabel(approval)}
                                    {approval.decided_at_display ? ` · ${approval.decided_at_display}` : ''}
                                </p>
                            </div>
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass(approval.status)}`}>
                                {approval.status_label}
                            </span>
                        </div>
                        {approval.comments && <p className="mt-2 text-sm text-sidebar-foreground/70">{approval.comments}</p>}
                    </li>
                ))}
            </ol>
        </div>
    );
}
