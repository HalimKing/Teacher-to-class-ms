import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { can } from '@/lib/can';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem, type PagePropsWithFlash } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    CalendarDays,
    Eye,
    FileWarning,
    Filter,
    Loader2,
    MapPin,
    Plus,
    Search,
    ShieldCheck,
    UserRound,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Bounce, ToastContainer, toast } from 'react-toastify';

interface AuthorizationRow {
    id: number;
    status: string;
    authorization_type: string;
    start_date?: string;
    end_date?: string;
    period_label?: string;
    authorization_date?: string;
    reason: string;
    bulk_group_id?: string | null;
    bulk_schedule_count?: number;
    staff?: { first_name?: string; last_name?: string; employee_id?: string };
    original_classroom?: { name?: string };
    authorized_classroom?: { name?: string };
    approver?: { name?: string };
    timetable?: {
        day_of_week?: string;
        day?: string;
        start_time?: string;
        end_time?: string;
        course?: { name?: string } | null;
    } | null;
}

interface PageProps {
    authorizations: {
        data: AuthorizationRow[];
        links: Array<{ url: string | null; label: string; active: boolean }>;
        current_page?: number;
        last_page?: number;
        from?: number | null;
        to?: number | null;
        total?: number;
    };
    filters: {
        status?: string;
        search?: string;
        active_on?: string;
        date?: string;
        start_date?: string;
        end_date?: string;
    };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/admin/dashboard' },
    { title: 'Venue Change Authorizations', href: '/admin/venue-change-authorizations' },
];

const statusStyles: Record<string, string> = {
    active: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300',
    revoked: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300',
    expired: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

function formatType(type: string) {
    return type.replace(/_/g, ' ');
}

export default function VenueChangeAuthorizationIndex({ authorizations, filters }: PageProps) {
    const { flash } = usePage().props as PagePropsWithFlash;
    const [search, setSearch] = useState(filters.search || '');
    const [status, setStatus] = useState(filters.status || '');
    const [activeOn, setActiveOn] = useState(filters.active_on || filters.date || '');
    const [startDate, setStartDate] = useState(filters.start_date || '');
    const [endDate, setEndDate] = useState(filters.end_date || '');
    const [isFiltering, setIsFiltering] = useState(false);

    const canManage = can('admin.venue-change-authorizations.manage');

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success, { position: 'top-right', autoClose: 4000, theme: 'dark', transition: Bounce });
        }
        if (flash?.error) {
            toast.error(flash.error, { position: 'top-right', autoClose: 5000, theme: 'dark', transition: Bounce });
        }
    }, [flash?.success, flash?.error]);

    const applyFilters = () => {
        setIsFiltering(true);
        router.get(
            route('admin.venue-change-authorizations.index'),
            {
                search: search || undefined,
                status: status || undefined,
                active_on: activeOn || undefined,
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
        setStatus('');
        setActiveOn('');
        setStartDate('');
        setEndDate('');
        setIsFiltering(true);
        router.get(route('admin.venue-change-authorizations.index'), {}, {
            preserveState: false,
            replace: true,
            onFinish: () => setIsFiltering(false),
        });
    };

    const hasActiveFilters = Boolean(filters.search || filters.status || filters.active_on || filters.date || filters.start_date || filters.end_date);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Venue Change Authorizations" />
            <ToastContainer />

            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto p-4 md:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 rounded-full border border-sidebar-border/70 bg-white px-3 py-1 text-xs font-medium text-sidebar-foreground/70 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                            <ShieldCheck className="size-3.5 text-emerald-600" />
                            Attendance venue overrides
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-sidebar-foreground md:text-3xl">
                            Venue Change Authorizations
                        </h1>
                        <p className="max-w-2xl text-sm text-sidebar-foreground/60">
                            Authorize administrators to check in or out at an alternate venue for one or more schedules.
                        </p>
                    </div>

                    {canManage && (
                        <Button asChild size="lg" className="shrink-0 transition-transform hover:scale-[1.01]">
                            <Link href={route('admin.venue-change-authorizations.create')}>
                                <Plus className="size-4" />
                                New Authorization
                            </Link>
                        </Button>
                    )}
                </div>

                <Card className="border-sidebar-border/70 bg-white shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Filter className="size-4 text-sidebar-foreground/50" />
                            Filters
                        </CardTitle>
                        <CardDescription>Search by staff, status, or authorization period (active on / start / end date).</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                            <div className="space-y-2 2xl:col-span-2">
                                <Label htmlFor="search">Search staff</Label>
                                <div className="relative">
                                    <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
                                    <Input
                                        id="search"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                                        placeholder="Name, employee ID, email..."
                                        className="pl-9"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="status">Status</Label>
                                <select
                                    id="status"
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                    className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                                >
                                    <option value="">All statuses</option>
                                    <option value="active">Active</option>
                                    <option value="expired">Expired</option>
                                    <option value="revoked">Revoked</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="active_on">Active on date</Label>
                                <Input id="active_on" type="date" value={activeOn} onChange={(e) => setActiveOn(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="start_date">Start date</Label>
                                <Input id="start_date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="end_date">End date</Label>
                                <Input id="end_date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                            </div>
                            <div className="flex items-end gap-2 md:col-span-2 xl:col-span-3 2xl:col-span-6">
                                <Button type="button" onClick={applyFilters} disabled={isFiltering}>
                                    {isFiltering ? <Loader2 className="size-4 animate-spin" /> : <Filter className="size-4" />}
                                    Apply
                                </Button>
                                {hasActiveFilters && (
                                    <Button type="button" variant="outline" onClick={clearFilters} aria-label="Clear filters">
                                        <X className="size-4" />
                                        Clear
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="overflow-hidden border-sidebar-border/70 bg-white py-0 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                    <CardHeader className="border-b border-sidebar-border/50 px-4 py-4 sm:px-6">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <CardTitle className="text-base">Authorizations</CardTitle>
                                <CardDescription>
                                    {authorizations.total != null
                                        ? `Showing ${authorizations.from ?? 0}–${authorizations.to ?? 0} of ${authorizations.total}`
                                        : `${authorizations.data.length} result${authorizations.data.length === 1 ? '' : 's'}`}
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>

                    {authorizations.data.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                            <div className="rounded-full bg-sidebar-accent p-4 dark:bg-sidebar">
                                <FileWarning className="size-8 text-sidebar-foreground/40" />
                            </div>
                            <div className="space-y-1">
                                <p className="font-semibold text-sidebar-foreground">No authorizations found</p>
                                <p className="max-w-sm text-sm text-sidebar-foreground/60">
                                    {hasActiveFilters
                                        ? 'Try adjusting your filters, or clear them to see all records.'
                                        : 'Create a venue change authorization to allow attendance at an alternate location.'}
                                </p>
                            </div>
                            {canManage && !hasActiveFilters && (
                                <Button asChild className="mt-2">
                                    <Link href={route('admin.venue-change-authorizations.create')}>
                                        <Plus className="size-4" />
                                        Create authorization
                                    </Link>
                                </Button>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="hidden overflow-x-auto md:block">
                                <table className="min-w-full text-sm">
                                    <thead className="sticky top-0 z-10 bg-sidebar-accent/80 text-left text-xs font-semibold tracking-wide text-sidebar-foreground/60 uppercase backdrop-blur">
                                        <tr>
                                            <th className="px-4 py-3 lg:px-6">Staff</th>
                                            <th className="px-4 py-3">Schedule</th>
                                            <th className="px-4 py-3">Venues</th>
                                            <th className="px-4 py-3">Type</th>
                                            <th className="px-4 py-3">Period</th>
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3">Approved by</th>
                                            <th className="px-4 py-3 text-right lg:px-6">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-sidebar-border/40">
                                        {authorizations.data.map((row) => (
                                            <tr
                                                key={row.id}
                                                className="transition-colors hover:bg-sidebar-accent/40"
                                            >
                                                <td className="px-4 py-4 lg:px-6">
                                                    <div className="flex items-start gap-3">
                                                        <div className="mt-0.5 rounded-lg bg-sidebar-accent p-2 dark:bg-sidebar">
                                                            <UserRound className="size-4 text-sidebar-foreground/50" />
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-sidebar-foreground">
                                                                {row.staff?.first_name} {row.staff?.last_name}
                                                            </p>
                                                            <p className="text-xs text-sidebar-foreground/50">{row.staff?.employee_id}</p>
                                                            {(row.bulk_schedule_count ?? 1) > 1 && (
                                                                <Badge variant="secondary" className="mt-1.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                                                                    Bulk · {row.bulk_schedule_count} schedules
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-sidebar-foreground/80">
                                                    {row.timetable ? (
                                                        <div>
                                                            <p>{row.timetable.course?.name || 'Work period'}</p>
                                                            <p className="text-xs text-sidebar-foreground/50">
                                                                {row.timetable.day_of_week || row.timetable.day} {row.timetable.start_time}–{row.timetable.end_time}
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        'Day-wide'
                                                    )}
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="flex max-w-[220px] items-center gap-1.5 text-sidebar-foreground/80">
                                                        <MapPin className="size-3.5 shrink-0 text-sidebar-foreground/40" />
                                                        <span className="truncate">
                                                            {row.original_classroom?.name}
                                                            <ArrowRight className="mx-1 inline size-3" />
                                                            {row.authorized_classroom?.name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 capitalize text-sidebar-foreground/80">{formatType(row.authorization_type)}</td>
                                                <td className="px-4 py-4">
                                                    <div className="inline-flex items-center gap-1.5 text-sidebar-foreground/80">
                                                        <CalendarDays className="size-3.5 text-sidebar-foreground/40" />
                                                        {row.period_label || row.authorization_date || '—'}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <span className={cn('inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize', statusStyles[row.status] || statusStyles.expired)}>
                                                        {row.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-sidebar-foreground/80">{row.approver?.name || '—'}</td>
                                                <td className="px-4 py-4 text-right lg:px-6">
                                                    <Button asChild variant="ghost" size="sm" className="text-primary">
                                                        <Link href={route('admin.venue-change-authorizations.show', row.id)}>
                                                            <Eye className="size-4" />
                                                            View
                                                        </Link>
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="space-y-3 p-4 md:hidden">
                                {authorizations.data.map((row) => (
                                    <div
                                        key={row.id}
                                        className="rounded-xl border border-sidebar-border/60 bg-sidebar-accent/30 p-4 transition-colors dark:bg-sidebar/40"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="font-semibold text-sidebar-foreground">
                                                    {row.staff?.first_name} {row.staff?.last_name}
                                                </p>
                                                <p className="text-xs text-sidebar-foreground/50">{row.staff?.employee_id}</p>
                                            </div>
                                            <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize', statusStyles[row.status] || statusStyles.expired)}>
                                                {row.status}
                                            </span>
                                        </div>
                                        <div className="mt-3 space-y-2 text-sm text-sidebar-foreground/70">
                                            <p className="flex items-center gap-1.5">
                                                <MapPin className="size-3.5" />
                                                {row.original_classroom?.name} → {row.authorized_classroom?.name}
                                            </p>
                                            <p className="flex items-center gap-1.5">
                                                <CalendarDays className="size-3.5" />
                                                {row.period_label || row.authorization_date || '—'} · {formatType(row.authorization_type)}
                                            </p>
                                            {(row.bulk_schedule_count ?? 1) > 1 && (
                                                <Badge variant="secondary" className="bg-indigo-50 text-indigo-700">
                                                    Bulk · {row.bulk_schedule_count} schedules
                                                </Badge>
                                            )}
                                        </div>
                                        <Button asChild variant="outline" size="sm" className="mt-4 w-full">
                                            <Link href={route('admin.venue-change-authorizations.show', row.id)}>
                                                <Eye className="size-4" />
                                                View details
                                            </Link>
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {authorizations.links && authorizations.links.length > 3 && (
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sidebar-border/50 px-4 py-4 sm:px-6">
                            <p className="text-xs text-sidebar-foreground/50">
                                Page {authorizations.current_page ?? 1}
                                {authorizations.last_page ? ` of ${authorizations.last_page}` : ''}
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {(authorizations.links || []).map((link, index) => (
                                    <Button
                                        key={`${link.label}-${index}`}
                                        type="button"
                                        size="sm"
                                        variant={link.active ? 'default' : 'outline'}
                                        disabled={!link.url}
                                        className="min-w-9"
                                        onClick={() => link.url && router.get(link.url, {}, { preserveState: true, preserveScroll: true })}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </Card>
            </div>
        </AppLayout>
    );
}
