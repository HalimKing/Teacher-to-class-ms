import { StaffActivityIconBadge } from '@/components/staff-activity/activity-icon';
import type { StaffActivityItem } from '@/components/staff-activity/types';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { ArrowRight, History } from 'lucide-react';

export default function RecentActivities({
    activities,
    className,
}: {
    activities: StaffActivityItem[];
    className?: string;
}) {
    return (
        <section
            className={cn(
                'rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6 dark:border-sidebar-border dark:bg-card',
                className,
            )}
        >
            <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200">
                        <History className="size-5" />
                    </span>
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-sidebar-foreground">Recent activities</h2>
                        <p className="text-sm text-slate-500 dark:text-sidebar-foreground/60">Your latest actions in the staff portal</p>
                    </div>
                </div>
                <Link
                    href="/staff/activities"
                    className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-2xl px-3 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-300"
                >
                    View all activities
                    <ArrowRight className="size-4" />
                </Link>
            </div>

            {activities.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-sidebar-border dark:text-sidebar-foreground/60">
                    No recent activities to show yet.
                </p>
            ) : (
                <ul className="space-y-2">
                    {activities.map((activity) => (
                        <li
                            key={activity.id}
                            className="flex items-start gap-3 rounded-2xl border border-slate-200/80 p-3 dark:border-sidebar-border"
                        >
                            <StaffActivityIconBadge icon={activity.icon} className="size-9" iconClassName="size-4" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-slate-900 dark:text-sidebar-foreground">{activity.title}</p>
                                <p className="mt-0.5 text-xs text-slate-500 dark:text-sidebar-foreground/60">
                                    {activity.relative_time || activity.created_at_display}
                                    {activity.module_label ? ` · ${activity.module_label}` : ''}
                                </p>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
