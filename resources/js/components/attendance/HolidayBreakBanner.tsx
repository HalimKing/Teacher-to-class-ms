import { formatLongDateRange } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { CalendarOff, ShieldAlert } from 'lucide-react';

export interface HolidayContext {
    mode: string;
    title: string;
    message: string;
    attendance_required: boolean;
    break?: {
        id: number;
        name: string;
        type_label: string;
        start_date?: string | null;
        end_date?: string | null;
    } | null;
}

export function HolidayBreakBanner({ context, className }: { context?: HolidayContext | null; className?: string }) {
    if (!context || context.mode === 'open') {
        return null;
    }

    const isDuty = context.mode === 'break_duty';

    return (
        <section
            role="status"
            className={cn(
                'rounded-3xl border px-4 py-4 shadow-sm sm:px-5',
                isDuty
                    ? 'border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-violet-100'
                    : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100',
                className,
            )}
        >
            <div className="flex items-start gap-3">
                {isDuty ? <ShieldAlert className="mt-0.5 size-5 shrink-0" /> : <CalendarOff className="mt-0.5 size-5 shrink-0" />}
                <div>
                    <h2 className="font-semibold">{context.title}</h2>
                    <p className="mt-1 text-sm opacity-90">{context.message}</p>
                    {context.break ? (
                        <p className="mt-2 text-xs opacity-80">
                            {context.break.name} ({context.break.type_label})
                            {context.break.start_date && context.break.end_date
                                ? ` · ${formatLongDateRange(context.break.start_date, context.break.end_date)}`
                                : ''}
                        </p>
                    ) : null}
                </div>
            </div>
        </section>
    );
}
