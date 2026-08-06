import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem, type PagePropsWithFlash } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    CalendarDays,
    Clock3,
    ExternalLink,
    Loader2,
    MapPin,
    ShieldAlert,
    ShieldCheck,
    UserRound,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Bounce, ToastContainer, toast } from 'react-toastify';

interface Authorization {
    id: number;
    status: string;
    authorization_type: string;
    start_date?: string;
    end_date?: string;
    period_label?: string;
    authorization_date?: string;
    start_time?: string | null;
    end_time?: string | null;
    reason: string;
    notes?: string | null;
    approved_at?: string;
    revoke_reason?: string | null;
    bulk_group_id?: string | null;
    staff?: { title?: string; first_name?: string; last_name?: string; employee_id?: string; email?: string };
    original_classroom?: { name?: string };
    authorized_classroom?: { name?: string };
    approver?: { name?: string };
    revoker?: { name?: string } | null;
    timetable?: {
        day_of_week?: string;
        day?: string;
        start_time?: string;
        end_time?: string;
        course?: { name?: string } | null;
        class_room?: { name?: string } | null;
    } | null;
}

interface BulkSibling {
    id: number;
    status: string;
    original_classroom?: { name?: string } | null;
    timetable?: {
        day_of_week?: string;
        day?: string;
        start_time?: string;
        end_time?: string;
        course?: { name?: string } | null;
        class_room?: { name?: string } | null;
    } | null;
}

const breadcrumbs = (id: number): BreadcrumbItem[] => [
    { title: 'Dashboard', href: '/admin/dashboard' },
    { title: 'Venue Change Authorizations', href: '/admin/venue-change-authorizations' },
    { title: `Authorization #${id}`, href: `/admin/venue-change-authorizations/${id}` },
];

const statusStyles: Record<string, string> = {
    active: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300',
    revoked: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300',
    expired: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

export default function VenueChangeAuthorizationShow({
    authorization,
    bulkSiblings = [],
}: {
    authorization: Authorization;
    bulkSiblings?: BulkSibling[];
}) {
    const { flash } = usePage().props as PagePropsWithFlash;
    const [revokeReason, setRevokeReason] = useState('');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success, { position: 'top-right', autoClose: 4000, theme: 'dark', transition: Bounce });
        }
        if (flash?.error) {
            toast.error(flash.error, { position: 'top-right', autoClose: 5000, theme: 'dark', transition: Bounce });
        }
    }, [flash?.success, flash?.error]);

    const revoke = (bulk = false) => {
        const message = bulk
            ? `Revoke all ${bulkSiblings.length} authorizations in this bulk group?`
            : 'Revoke this authorization?';
        if (!confirm(message)) return;

        setProcessing(true);
        router.post(
            route('admin.venue-change-authorizations.revoke', authorization.id),
            {
                revoke_reason: revokeReason,
                revoke_bulk_group: bulk,
            },
            {
                onFinish: () => setProcessing(false),
            },
        );
    };

    const staffName = `${authorization.staff?.title || ''} ${authorization.staff?.first_name || ''} ${authorization.staff?.last_name || ''}`.trim();

    return (
        <AppLayout breadcrumbs={breadcrumbs(authorization.id)}>
            <Head title={`Venue Authorization #${authorization.id}`} />
            <ToastContainer />

            <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={cn('inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize', statusStyles[authorization.status] || statusStyles.expired)}>
                                {authorization.status}
                            </span>
                            {authorization.bulk_group_id && (
                                <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                                    Bulk · {bulkSiblings.length} schedules
                                </Badge>
                            )}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-sidebar-foreground md:text-3xl">
                                Authorization #{authorization.id}
                            </h1>
                            <p className="mt-1 text-sm text-sidebar-foreground/60">
                                Approved by {authorization.approver?.name || 'admin'}
                                {authorization.approved_at ? ` · ${authorization.approved_at}` : ''}
                            </p>
                        </div>
                    </div>
                    <Button asChild variant="outline">
                        <Link href={route('admin.venue-change-authorizations.index')}>
                            <ArrowLeft className="size-4" />
                            Back to list
                        </Link>
                    </Button>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    <Card className="border-sidebar-border/70 bg-white shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <ShieldCheck className="size-4 text-sidebar-foreground/50" />
                                Authorization details
                            </CardTitle>
                            <CardDescription>Core information for this venue override.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Info icon={UserRound} label="Staff" value={staffName || '—'} />
                                <Info icon={UserRound} label="Employee ID" value={authorization.staff?.employee_id || '—'} />
                                <Info icon={CalendarDays} label="Course / Subject" value={authorization.timetable?.course?.name || 'Work period'} />
                                <Info
                                    icon={Clock3}
                                    label="Schedule"
                                    value={
                                        authorization.timetable
                                            ? `${authorization.timetable.day_of_week || authorization.timetable.day} ${authorization.timetable.start_time}–${authorization.timetable.end_time}`
                                            : 'Day-wide'
                                    }
                                />
                                <Info icon={MapPin} label="Original venue" value={authorization.original_classroom?.name || '—'} />
                                <Info icon={MapPin} label="Authorized venue" value={authorization.authorized_classroom?.name || '—'} />
                                <Info icon={ShieldCheck} label="Type" value={authorization.authorization_type.replace(/_/g, ' ')} />
                                <Info
                                    icon={CalendarDays}
                                    label="Authorization period"
                                    value={authorization.period_label || authorization.authorization_date || '—'}
                                />
                                <Info
                                    icon={Clock3}
                                    label="Daily time window"
                                    value={`${authorization.start_time || 'All day'} – ${authorization.end_time || 'All day'}`}
                                />
                                <Info icon={UserRound} label="Approved by" value={authorization.approver?.name || '—'} />
                            </div>

                            <div className="mt-6 space-y-4 border-t border-sidebar-border/50 pt-6">
                                <div>
                                    <p className="text-xs font-semibold tracking-wide text-sidebar-foreground/50 uppercase">Reason</p>
                                    <p className="mt-1.5 text-sm leading-relaxed text-sidebar-foreground">{authorization.reason}</p>
                                </div>
                                {authorization.notes && (
                                    <div>
                                        <p className="text-xs font-semibold tracking-wide text-sidebar-foreground/50 uppercase">Notes</p>
                                        <p className="mt-1.5 text-sm leading-relaxed text-sidebar-foreground/80">{authorization.notes}</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-sidebar-border/70 bg-white shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                        <CardHeader>
                            <CardTitle className="text-base">Venue change</CardTitle>
                            <CardDescription>Visual summary of the override.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="rounded-xl border border-sidebar-border/60 bg-sidebar-accent/40 p-4 dark:bg-sidebar/40">
                                <p className="text-xs font-medium uppercase tracking-wide text-sidebar-foreground/50">From</p>
                                <p className="mt-1 font-semibold text-sidebar-foreground">{authorization.original_classroom?.name || '—'}</p>
                            </div>
                            <div className="flex justify-center">
                                <Badge variant="secondary">Authorized to</Badge>
                            </div>
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/30">
                                <p className="text-xs font-medium uppercase tracking-wide text-emerald-700/80 dark:text-emerald-300/80">To</p>
                                <p className="mt-1 font-semibold text-emerald-900 dark:text-emerald-100">
                                    {authorization.authorized_classroom?.name || '—'}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {bulkSiblings.length > 1 && (
                    <Card className="overflow-hidden border-sidebar-border/70 bg-white py-0 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                        <CardHeader className="border-b border-sidebar-border/50 px-4 py-4 sm:px-6">
                            <CardTitle className="text-base">Schedules in this bulk authorization</CardTitle>
                            <CardDescription>All schedule-level records created in the same transaction.</CardDescription>
                        </CardHeader>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="sticky top-0 z-10 bg-sidebar-accent/80 text-left text-xs font-semibold tracking-wide text-sidebar-foreground/60 uppercase backdrop-blur">
                                    <tr>
                                        <th className="px-4 py-3">ID</th>
                                        <th className="px-4 py-3">Course</th>
                                        <th className="px-4 py-3">Original Venue</th>
                                        <th className="px-4 py-3">Schedule</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-sidebar-border/40">
                                    {bulkSiblings.map((sibling) => (
                                        <tr
                                            key={sibling.id}
                                            className={cn(
                                                'transition-colors',
                                                sibling.id === authorization.id ? 'bg-sky-50 dark:bg-sky-950/20' : 'hover:bg-sidebar-accent/40',
                                            )}
                                        >
                                            <td className="px-4 py-3 font-medium">#{sibling.id}</td>
                                            <td className="px-4 py-3">{sibling.timetable?.course?.name || 'Work period'}</td>
                                            <td className="px-4 py-3">{sibling.original_classroom?.name || '—'}</td>
                                            <td className="px-4 py-3 text-sidebar-foreground/80">
                                                {sibling.timetable
                                                    ? `${sibling.timetable.day_of_week || sibling.timetable.day} ${sibling.timetable.start_time}–${sibling.timetable.end_time}`
                                                    : '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={cn('inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize', statusStyles[sibling.status] || statusStyles.expired)}>
                                                    {sibling.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {sibling.id !== authorization.id ? (
                                                    <Button asChild variant="ghost" size="sm">
                                                        <Link href={route('admin.venue-change-authorizations.show', sibling.id)}>
                                                            <ExternalLink className="size-4" />
                                                            Open
                                                        </Link>
                                                    </Button>
                                                ) : (
                                                    <span className="text-xs text-sidebar-foreground/40">Current</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}

                {authorization.status === 'active' && (
                    <Card className="border-amber-200 bg-amber-50/80 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base text-amber-950 dark:text-amber-100">
                                <ShieldAlert className="size-4" />
                                Revoke authorization
                            </CardTitle>
                            <CardDescription className="text-amber-800/80 dark:text-amber-200/70">
                                Revoking immediately invalidates this venue override for attendance checks.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="revoke_reason">Revoke reason (optional)</Label>
                                <textarea
                                    id="revoke_reason"
                                    value={revokeReason}
                                    onChange={(e) => setRevokeReason(e.target.value)}
                                    placeholder="Explain why this authorization is being revoked"
                                    className="min-h-24 w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] dark:border-amber-900/40 dark:bg-amber-950/30"
                                />
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Button
                                    type="button"
                                    variant="destructive"
                                    disabled={processing}
                                    onClick={() => revoke(false)}
                                >
                                    {processing ? <Loader2 className="size-4 animate-spin" /> : null}
                                    Revoke this schedule
                                </Button>
                                {authorization.bulk_group_id && bulkSiblings.length > 1 && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={processing}
                                        onClick={() => revoke(true)}
                                        className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300"
                                    >
                                        Revoke entire bulk group
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {authorization.status === 'revoked' && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                        Revoked by {authorization.revoker?.name || 'admin'}
                        {authorization.revoke_reason ? `. ${authorization.revoke_reason}` : '.'}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

function Info({
    icon: Icon,
    label,
    value,
}: {
    icon: typeof MapPin;
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-xl border border-sidebar-border/50 bg-sidebar-accent/30 p-4 transition-colors dark:bg-sidebar/30">
            <div className="flex items-start gap-3">
                <div className="rounded-lg bg-white p-2 shadow-xs dark:bg-sidebar-accent">
                    <Icon className="size-4 text-sidebar-foreground/50" />
                </div>
                <div className="min-w-0">
                    <p className="text-xs font-semibold tracking-wide text-sidebar-foreground/50 uppercase">{label}</p>
                    <p className="mt-1 text-sm font-medium capitalize text-sidebar-foreground">{value}</p>
                </div>
            </div>
        </div>
    );
}
