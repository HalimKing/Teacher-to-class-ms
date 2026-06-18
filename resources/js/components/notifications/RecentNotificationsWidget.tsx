import {
    categoryLabels,
    formatNotificationTime,
    getCategoryIcon,
    priorityStyles,
} from '@/components/notifications/notification-utils';
import { type TeacherNotificationItem } from '@/components/notifications/types';
import { cn } from '@/lib/utils';
import { Link, router } from '@inertiajs/react';
import { Bell } from 'lucide-react';

interface RecentNotificationsWidgetProps {
    notifications: TeacherNotificationItem[];
    className?: string;
}

export default function RecentNotificationsWidget({ notifications, className }: RecentNotificationsWidgetProps) {
    if (notifications.length === 0) {
        return null;
    }

    return (
        <div className={cn('rounded-xl border border-blue-200 bg-blue-50/70 p-4 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/20', className)}>
            <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <h2 className="font-semibold text-sidebar-foreground">Recent Notifications</h2>
                </div>
                <Link href={route('teacher.notifications.index')} className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">
                    View all
                </Link>
            </div>

            <ul className="space-y-2">
                {notifications.slice(0, 5).map((notification) => {
                    const Icon = getCategoryIcon(notification.data?.category);
                    const priority = notification.data?.priority ?? 'medium';

                    return (
                        <li key={notification.id}>
                            <Link
                                href={notification.data?.url ?? route('teacher.notifications.index')}
                                className="flex items-start gap-3 rounded-lg border border-white/70 bg-white/80 p-3 transition-colors hover:bg-white dark:border-sidebar-border/50 dark:bg-sidebar-accent/80 dark:hover:bg-sidebar-accent"
                            >
                                <div className="rounded-md bg-primary/10 p-2 text-primary">
                                    <Icon className="size-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="truncate text-sm font-medium text-sidebar-foreground">
                                            {notification.data?.title ?? 'Notification'}
                                        </p>
                                        <span
                                            className={cn(
                                                'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ring-inset',
                                                priorityStyles[priority] ?? priorityStyles.medium,
                                            )}
                                        >
                                            {priority}
                                        </span>
                                    </div>
                                    {notification.data?.message && (
                                        <p className="mt-0.5 line-clamp-2 text-sm text-sidebar-foreground/70">{notification.data.message}</p>
                                    )}
                                    <p className="mt-1 text-xs text-sidebar-foreground/50">
                                        {categoryLabels[notification.data?.category ?? 'system']} · {formatNotificationTime(notification.created_at)}
                                    </p>
                                </div>
                            </Link>
                        </li>
                    );
                })}
            </ul>

            <div className="mt-3 flex items-center justify-between">
                <button
                    type="button"
                    onClick={() => router.post(route('teacher.notifications.mark-all-read'))}
                    className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                    Mark all read
                </button>
                <Link href={route('teacher.notifications.preferences')} className="text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground">
                    Preferences
                </Link>
            </div>
        </div>
    );
}
