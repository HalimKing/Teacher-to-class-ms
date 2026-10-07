import { StaffActivityIconBadge } from '@/components/staff-activity/activity-icon';
import type {
    PaginatedStaffActivities,
    StaffActivityFilters,
    StaffActivityItem,
    StaffActivityOption,
} from '@/components/staff-activity/types';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { History, Monitor, Search, Smartphone } from 'lucide-react';
import { FormEvent, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/teacher/dashboard' },
    { title: 'My Activities', href: '/staff/activities' },
];

export default function StaffActivitiesPage({
    activities,
    filters,
    options,
}: {
    activities: PaginatedStaffActivities;
    filters: StaffActivityFilters;
    options: {
        categories: StaffActivityOption[];
        statuses: StaffActivityOption[];
    };
}) {
    const [search, setSearch] = useState(filters.search || '');
    const [category, setCategory] = useState(filters.category || 'all');
    const [status, setStatus] = useState(filters.status || 'all');
    const [startDate, setStartDate] = useState(filters.start_date || '');
    const [endDate, setEndDate] = useState(filters.end_date || '');
    const [isFiltering, setIsFiltering] = useState(false);

    const applyFilters = (event?: FormEvent) => {
        event?.preventDefault();
        setIsFiltering(true);
        router.get(
            '/staff/activities',
            {
                search: search || undefined,
                category: category !== 'all' ? category : undefined,
                status: status !== 'all' ? status : undefined,
                start_date: startDate || undefined,
                end_date: endDate || undefined,
            },
            {
                preserveState: true,
                replace: true,
                onFinish: () => setIsFiltering(false),
            },
        );
    };

    const clearFilters = () => {
        setSearch('');
        setCategory('all');
        setStatus('all');
        setStartDate('');
        setEndDate('');
        setIsFiltering(true);
        router.get('/staff/activities', {}, { replace: true, onFinish: () => setIsFiltering(false) });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="My Activities" />

            <div className="min-h-full bg-gradient-to-b from-indigo-50/80 via-slate-50 to-slate-50 dark:from-indigo-950/20 dark:via-background dark:to-background">
                <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-5 p-3 pb-10 sm:p-4 md:p-6 lg:p-8">
                    <section className="overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-sm shadow-indigo-100/70 dark:border-indigo-900/40 dark:bg-card dark:shadow-none">
                        <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-slate-800 px-4 py-5 text-white sm:px-8 sm:py-6">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase ring-1 ring-white/20">
                                <History className="size-3.5" />
                                Activity history
                            </span>
                            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">My Activities</h1>
                            <p className="mt-2 max-w-2xl text-sm text-white/85">
                                A record of actions you have taken in the staff portal. Only your own activity is shown.
                            </p>
                        </div>
                    </section>

                    <form
                        onSubmit={applyFilters}
                        className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5 dark:border-sidebar-border dark:bg-card"
                    >
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                            <label className="block text-sm xl:col-span-2">
                                <span className="mb-1.5 block font-medium text-slate-700 dark:text-sidebar-foreground">Search</span>
                                <span className="relative block">
                                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        placeholder="Search description or action"
                                        className="h-11 w-full rounded-2xl border border-slate-200 bg-white pr-3 pl-10 text-sm dark:border-sidebar-border dark:bg-background"
                                    />
                                </span>
                            </label>
                            <label className="block text-sm">
                                <span className="mb-1.5 block font-medium text-slate-700 dark:text-sidebar-foreground">Module</span>
                                <select
                                    value={category}
                                    onChange={(event) => setCategory(event.target.value)}
                                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm dark:border-sidebar-border dark:bg-background"
                                >
                                    <option value="all">All modules</option>
                                    {options.categories.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="block text-sm">
                                <span className="mb-1.5 block font-medium text-slate-700 dark:text-sidebar-foreground">From</span>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(event) => setStartDate(event.target.value)}
                                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm dark:border-sidebar-border dark:bg-background"
                                />
                            </label>
                            <label className="block text-sm">
                                <span className="mb-1.5 block font-medium text-slate-700 dark:text-sidebar-foreground">To</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(event) => setEndDate(event.target.value)}
                                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm dark:border-sidebar-border dark:bg-background"
                                />
                            </label>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            <select
                                value={status}
                                onChange={(event) => setStatus(event.target.value)}
                                className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm dark:border-sidebar-border dark:bg-background"
                            >
                                <option value="all">All statuses</option>
                                {options.statuses.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="submit"
                                disabled={isFiltering}
                                className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                            >
                                {isFiltering ? 'Filtering…' : 'Apply filters'}
                            </button>
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-sidebar-border dark:text-sidebar-foreground dark:hover:bg-sidebar-accent"
                            >
                                Clear
                            </button>
                        </div>
                    </form>

                    <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6 dark:border-sidebar-border dark:bg-card">
                        {activities.data.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-16 text-center dark:border-sidebar-border">
                                <History className="mx-auto size-10 text-slate-300" />
                                <p className="mt-3 text-base font-semibold text-slate-900 dark:text-sidebar-foreground">No activities yet</p>
                                <p className="mt-1 text-sm text-slate-500 dark:text-sidebar-foreground/60">
                                    When you sign in, take attendance, send messages, or submit requests, they will appear here.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-3">
                                    {activities.data.map((activity) => (
                                        <ActivityRow key={activity.id} activity={activity} />
                                    ))}
                                </div>

                                {activities.links && activities.links.length > 3 ? (
                                    <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-sidebar-border">
                                        <span className="text-sm text-slate-500 dark:text-sidebar-foreground/55">
                                            Showing {activities.from ?? 0}-{activities.to ?? 0} of {activities.total ?? activities.data.length}
                                        </span>
                                        <div className="flex flex-wrap gap-2">
                                            {activities.links.map((link, index) =>
                                                link.url ? (
                                                    <Link
                                                        key={`${link.label}-${index}`}
                                                        href={link.url}
                                                        className={cn(
                                                            'min-h-10 rounded-xl px-3 py-2 text-sm',
                                                            link.active
                                                                ? 'bg-indigo-600 text-white'
                                                                : 'border border-slate-200 hover:bg-slate-50 dark:border-sidebar-border dark:hover:bg-sidebar-accent',
                                                        )}
                                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                                    />
                                                ) : null,
                                            )}
                                        </div>
                                    </div>
                                ) : null}
                            </>
                        )}
                    </section>
                </div>
            </div>
        </AppLayout>
    );
}

function ActivityRow({ activity }: { activity: StaffActivityItem }) {
    const failed = activity.status === 'failed';

    return (
        <article className="rounded-2xl border border-slate-200/80 p-4 dark:border-sidebar-border">
            <div className="flex items-start gap-3">
                <StaffActivityIconBadge icon={activity.icon} />
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold text-slate-900 dark:text-sidebar-foreground">{activity.title}</h2>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-sidebar-accent dark:text-sidebar-foreground/70">
                            {activity.module_label}
                        </span>
                        {failed ? (
                            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
                                Failed
                            </span>
                        ) : null}
                    </div>
                    {activity.description !== activity.title ? (
                        <p className="mt-1 text-sm text-slate-600 dark:text-sidebar-foreground/70">{activity.description}</p>
                    ) : null}
                    {activity.resource ? (
                        <p className="mt-1 truncate text-xs text-slate-500 dark:text-sidebar-foreground/55">Record: {activity.resource.label}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-sidebar-foreground/55">
                        <span>{activity.relative_time}</span>
                        <span>{activity.created_at_display}</span>
                        {activity.ip_address ? <span>IP {activity.ip_address}</span> : null}
                        {activity.browser || activity.device ? (
                            <span className="inline-flex items-center gap-1">
                                {activity.device === 'Mobile' ? <Smartphone className="size-3.5" /> : <Monitor className="size-3.5" />}
                                {[activity.device, activity.browser].filter(Boolean).join(' · ')}
                            </span>
                        ) : null}
                    </div>
                </div>
            </div>
        </article>
    );
}
