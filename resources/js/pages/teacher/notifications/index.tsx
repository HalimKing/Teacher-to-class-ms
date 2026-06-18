import {
    categoryLabels,
    formatNotificationTime,
    getCategoryIcon,
    priorityLabels,
    priorityStyles,
} from '@/components/notifications/notification-utils';
import { type PaginatedNotifications, type TeacherNotificationItem } from '@/components/notifications/types';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Bell, Search, Settings } from 'lucide-react';
import { useMemo, useState } from 'react';

interface NotificationFilters {
    search?: string;
    status?: string;
    category?: string;
    priority?: string;
    sort?: string;
    per_page?: string;
}

interface NotificationsIndexProps {
    notifications: PaginatedNotifications;
    filters: NotificationFilters;
    unreadCount: number;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/teacher/dashboard' },
    { title: 'Notifications', href: '/teacher/notifications' },
];

export default function TeacherNotificationsIndex({ notifications, filters, unreadCount }: NotificationsIndexProps) {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [search, setSearch] = useState(filters.search ?? '');

    const allVisibleIds = useMemo(() => notifications.data.map((item) => item.id), [notifications.data]);

    const applyFilters = (next: Partial<NotificationFilters>) => {
        router.get(
            route('teacher.notifications.index'),
            {
                ...filters,
                ...next,
                page: 1,
            },
            { preserveState: true, replace: true },
        );
    };

    const toggleSelect = (id: string) => {
        setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
    };

    const toggleSelectAll = () => {
        setSelectedIds((current) =>
            allVisibleIds.every((id) => current.includes(id))
                ? current.filter((id) => !allVisibleIds.includes(id))
                : [...new Set([...current, ...allVisibleIds])],
        );
    };

    const bulkMarkRead = () => {
        router.post(
            route('teacher.notifications.bulk-read'),
            { ids: selectedIds },
            {
                preserveScroll: true,
                onSuccess: () => setSelectedIds([]),
            },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Notifications" />

            <div className="space-y-6 p-4 sm:p-6 lg:p-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                            <Bell className="size-3.5" />
                            Notification Center
                        </div>
                        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-sidebar-foreground">Notifications</h1>
                        <p className="mt-2 text-sm text-sidebar-foreground/70">
                            {unreadCount} unread notification{unreadCount === 1 ? '' : 's'}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline" size="sm">
                            <Link href={route('teacher.notifications.preferences')}>
                                <Settings className="size-4" />
                                Preferences
                            </Link>
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => router.post(route('teacher.notifications.mark-all-read'))}
                        >
                            Mark all read
                        </Button>
                    </div>
                </div>

                <div className="rounded-xl border border-sidebar-border/70 bg-white p-4 shadow-sm dark:bg-sidebar-accent">
                    <div className="grid gap-3 lg:grid-cols-6">
                        <div className="relative lg:col-span-2">
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-sidebar-foreground/40" />
                            <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                onKeyDown={(event) => event.key === 'Enter' && applyFilters({ search })}
                                placeholder="Search notifications..."
                                className="h-10 w-full rounded-lg border border-sidebar-border/70 bg-white pl-10 pr-3 text-sm dark:bg-sidebar-accent"
                            />
                        </div>
                        <select
                            value={filters.status ?? 'all'}
                            onChange={(event) => applyFilters({ status: event.target.value })}
                            className="h-10 rounded-lg border border-sidebar-border/70 bg-white px-3 text-sm dark:bg-sidebar-accent"
                        >
                            <option value="all">All statuses</option>
                            <option value="unread">Unread</option>
                            <option value="read">Read</option>
                        </select>
                        <select
                            value={filters.category ?? 'all'}
                            onChange={(event) => applyFilters({ category: event.target.value })}
                            className="h-10 rounded-lg border border-sidebar-border/70 bg-white px-3 text-sm dark:bg-sidebar-accent"
                        >
                            <option value="all">All categories</option>
                            <option value="attendance">Attendance</option>
                            <option value="timetable">Timetable</option>
                            <option value="administrative">Administrative</option>
                            <option value="system">System</option>
                        </select>
                        <select
                            value={filters.priority ?? 'all'}
                            onChange={(event) => applyFilters({ priority: event.target.value })}
                            className="h-10 rounded-lg border border-sidebar-border/70 bg-white px-3 text-sm dark:bg-sidebar-accent"
                        >
                            <option value="all">All priorities</option>
                            <option value="critical">Critical</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                        </select>
                        <select
                            value={filters.sort ?? 'latest'}
                            onChange={(event) => applyFilters({ sort: event.target.value })}
                            className="h-10 rounded-lg border border-sidebar-border/70 bg-white px-3 text-sm dark:bg-sidebar-accent"
                        >
                            <option value="latest">Latest first</option>
                            <option value="oldest">Oldest first</option>
                        </select>
                        <Button type="button" variant="outline" onClick={() => applyFilters({ search })}>
                            Apply
                        </Button>
                    </div>

                    {selectedIds.length > 0 && (
                        <div className="mt-4 flex items-center justify-between rounded-lg bg-primary/5 px-4 py-3">
                            <p className="text-sm font-medium">{selectedIds.length} selected</p>
                            <Button type="button" size="sm" variant="outline" onClick={bulkMarkRead}>
                                Mark selected read
                            </Button>
                        </div>
                    )}
                </div>

                <div className="overflow-hidden rounded-xl border border-sidebar-border/70 bg-white shadow-sm dark:bg-sidebar-accent">
                    <div className="border-b border-sidebar-border/60 px-4 py-3">
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.includes(id))}
                                onChange={toggleSelectAll}
                            />
                            Select all on this page
                        </label>
                    </div>

                    {notifications.data.length === 0 ? (
                        <div className="px-6 py-16 text-center">
                            <Bell className="mx-auto mb-3 size-10 text-sidebar-foreground/30" />
                            <p className="text-lg font-medium text-sidebar-foreground">No notifications found</p>
                            <p className="mt-1 text-sm text-sidebar-foreground/60">Try adjusting your filters or check back later.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-sidebar-border/50">
                            {notifications.data.map((notification) => (
                                <NotificationRow
                                    key={notification.id}
                                    notification={notification}
                                    selected={selectedIds.includes(notification.id)}
                                    onToggleSelect={toggleSelect}
                                />
                            ))}
                        </div>
                    )}

                    <div className="flex items-center justify-between border-t border-sidebar-border/60 px-4 py-4 text-sm text-sidebar-foreground/60">
                        <span>
                            Showing {notifications.from ?? 0}-{notifications.to ?? 0} of {notifications.total}
                        </span>
                        <div className="flex gap-2">
                            {notifications.links.map((link, index) =>
                                link.url ? (
                                    <Link
                                        key={`${link.label}-${index}`}
                                        href={link.url}
                                        className={cn(
                                            'rounded-lg px-3 py-1.5',
                                            link.active ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted/40',
                                        )}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ) : null,
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

function NotificationRow({
    notification,
    selected,
    onToggleSelect,
}: {
    notification: TeacherNotificationItem;
    selected: boolean;
    onToggleSelect: (id: string) => void;
}) {
    const Icon = getCategoryIcon(notification.data?.category);
    const priority = notification.data?.priority ?? 'medium';
    const isUnread = !notification.read_at;

    return (
        <div className={cn('px-4 py-4', isUnread && 'bg-blue-50/40 dark:bg-blue-950/10')}>
            <div className="flex items-start gap-3">
                <input type="checkbox" checked={selected} onChange={() => onToggleSelect(notification.id)} className="mt-1" />
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-sidebar-foreground">{notification.data?.title ?? 'Notification'}</h3>
                        {isUnread && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">Unread</span>}
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ring-inset', priorityStyles[priority])}>
                            {priorityLabels[priority] ?? priority}
                        </span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-sidebar-foreground/70">
                            {categoryLabels[notification.data?.category ?? 'system']}
                        </span>
                    </div>
                    {notification.data?.message && <p className="mt-2 text-sm text-sidebar-foreground/70">{notification.data.message}</p>}
                    <p className="mt-2 text-xs text-sidebar-foreground/50">{formatNotificationTime(notification.created_at)}</p>
                    <div className="mt-3 flex gap-3">
                        <Link href={notification.data?.url ?? route('teacher.notifications.index')} className="text-sm font-medium text-blue-600 hover:underline">
                            Open
                        </Link>
                        {isUnread && (
                            <button
                                type="button"
                                onClick={() => router.post(route('teacher.notifications.mark-read', notification.id), {}, { preserveScroll: true })}
                                className="text-sm font-medium text-sidebar-foreground/70 hover:underline"
                            >
                                Mark read
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
