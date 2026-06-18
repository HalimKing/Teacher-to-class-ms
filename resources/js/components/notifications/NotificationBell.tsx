import {
    categoryLabels,
    formatNotificationTime,
    getCategoryIcon,
    priorityStyles,
} from '@/components/notifications/notification-utils';
import { type TeacherNotificationItem } from '@/components/notifications/types';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Link, router, usePage } from '@inertiajs/react';
import { Bell, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface NotificationBellProps {
    className?: string;
    pollIntervalMs?: number;
}

export default function NotificationBell({ className, pollIntervalMs = 60000 }: NotificationBellProps) {
    const page = usePage();
    const initialItems =
        (page.props as { unreadNotifications?: TeacherNotificationItem[] }).unreadNotifications ?? [];
    const initialCount = (page.props as { unreadNotificationsCount?: number }).unreadNotificationsCount ?? 0;

    const [items, setItems] = useState<TeacherNotificationItem[]>(initialItems);
    const [unreadCount, setUnreadCount] = useState(initialCount);
    const [refreshing, setRefreshing] = useState(false);

    const refreshSummary = useCallback(async () => {
        setRefreshing(true);
        try {
            const response = await fetch(route('teacher.notifications.summary'), {
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });
            const payload = await response.json();
            if (response.ok && payload.success) {
                setUnreadCount(payload.unreadCount ?? 0);
                setItems(payload.items ?? []);
            }
        } finally {
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        setItems(initialItems);
        setUnreadCount(initialCount);
    }, [initialCount, initialItems]);

    useEffect(() => {
        const intervalId = window.setInterval(refreshSummary, pollIntervalMs);
        return () => window.clearInterval(intervalId);
    }, [pollIntervalMs, refreshSummary]);

    const markAsRead = (id: string) => {
        router.post(route('teacher.notifications.mark-read', id), {}, {
            preserveScroll: true,
            onSuccess: refreshSummary,
        });
    };

    return (
        <div className={cn('relative', className)}>
            <DropdownMenu onOpenChange={(open) => open && refreshSummary()}>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative h-9 w-9 cursor-pointer">
                        <Bell className="h-5 w-5" />
                        {unreadCount > 0 && (
                            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-96" align="end" sideOffset={8}>
                    <div className="flex items-center justify-between border-b px-3 py-2">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold">Notifications</span>
                            {refreshing && <Loader2 className="size-3.5 animate-spin text-sidebar-foreground/50" />}
                        </div>
                        {unreadCount > 0 && (
                            <button
                                type="button"
                                onClick={() =>
                                    router.post(route('teacher.notifications.mark-all-read'), {}, {
                                        preserveScroll: true,
                                        onSuccess: refreshSummary,
                                    })
                                }
                                className="text-xs text-blue-600 hover:underline"
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-[360px] overflow-y-auto">
                        {items.length > 0 ? (
                            items.map((notification) => {
                                const Icon = getCategoryIcon(notification.data?.category);
                                const priority = notification.data?.priority ?? 'medium';

                                return (
                                    <div
                                        key={notification.id}
                                        className="border-b px-3 py-3 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/40"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
                                                <Icon className="size-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="font-medium text-sidebar-foreground">
                                                        {notification.data?.title ?? 'Notification'}
                                                    </p>
                                                    <span
                                                        className={cn(
                                                            'inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ring-inset',
                                                            priorityStyles[priority] ?? priorityStyles.medium,
                                                        )}
                                                    >
                                                        {priority}
                                                    </span>
                                                </div>
                                                {notification.data?.message && (
                                                    <p className="mt-1 text-sm text-sidebar-foreground/70">
                                                        {notification.data.message}
                                                    </p>
                                                )}
                                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-sidebar-foreground/50">
                                                    <span>{categoryLabels[notification.data?.category ?? 'system']}</span>
                                                    <span>·</span>
                                                    <span>{formatNotificationTime(notification.created_at)}</span>
                                                </div>
                                                <div className="mt-2 flex gap-2">
                                                    <Link
                                                        href={notification.data?.url ?? route('teacher.notifications.index')}
                                                        className="text-xs font-medium text-blue-600 hover:underline"
                                                    >
                                                        Open
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        onClick={() => markAsRead(notification.id)}
                                                        className="text-xs font-medium text-sidebar-foreground/70 hover:underline"
                                                    >
                                                        Mark read
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="px-3 py-8 text-center text-sm text-sidebar-foreground/60">No new notifications</p>
                        )}
                    </div>

                    <div className="flex items-center justify-between border-t px-3 py-2">
                        <Link href={route('teacher.notifications.index')} className="text-sm font-medium text-blue-600 hover:underline">
                            View all notifications
                        </Link>
                        <Link
                            href={route('teacher.notifications.preferences')}
                            className="text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground"
                        >
                            Preferences
                        </Link>
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
