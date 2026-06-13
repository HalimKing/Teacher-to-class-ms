import { KpiCard, type KpiCardData } from '@/components/dashboard/kpi-card';
import { ReportFilterField, StatusBadge, filterInputClass } from '@/components/reports/shared';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import { can } from '@/lib/can';
import { type BreadcrumbItem, type PagePropsWithFlash } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import axios from 'axios';
import {
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    Download,
    Eye,
    Loader2,
    RefreshCw,
    Search,
    ShieldAlert,
    Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bounce, ToastContainer, toast } from 'react-toastify';

const EXPORT_FILTER_KEYS = [
    'search',
    'actor_id',
    'actor_role',
    'event_type',
    'event_category',
    'status',
    'ip_address',
    'security_only',
    'start_date',
    'end_date',
] as const;

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/admin/dashboard' },
    { title: 'System Logs', href: '/admin/system-logs' },
];

interface FilterOptions {
    categories: string[];
    statuses: string[];
    roles: string[];
    eventTypes: string[];
    users: Array<{ id: number; name: string; role: string; type: string }>;
}

interface ActivityLogRecord {
    id: number;
    event_type: string;
    event_category: string;
    description: string;
    status: string;
    actor_name: string;
    actor_role: string;
    actor_id: number | null;
    ip_address: string | null;
    route: string | null;
    method: string | null;
    is_security_flag: boolean;
    created_at: string;
    created_at_human: string;
    user_agent?: string | null;
    metadata?: Record<string, unknown>;
    browser?: string;
    device?: string;
}

interface PaginatedRecords {
    data: ActivityLogRecord[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

interface SystemLogsPageProps {
    filterOptions: FilterOptions;
    initialFilters: {
        start_date: string;
        end_date: string;
    };
    logRetentionDays: number;
}

export default function SystemLogsIndex({ filterOptions, initialFilters, logRetentionDays }: SystemLogsPageProps) {
    const { flash } = usePage().props as PagePropsWithFlash;
    const [filters, setFilters] = useState({
        search: '',
        actor_id: 'all',
        actor_role: 'all',
        event_type: 'all',
        event_category: 'all',
        status: 'all',
        ip_address: '',
        security_only: false,
        start_date: initialFilters.start_date,
        end_date: initialFilters.end_date,
        sort_by: 'created_at',
        sort_dir: 'desc',
        per_page: 15,
        page: 1,
    });

    const [summaryCards, setSummaryCards] = useState<KpiCardData[]>([]);
    const [securityHighlights, setSecurityHighlights] = useState<ActivityLogRecord[]>([]);
    const [records, setRecords] = useState<PaginatedRecords | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedLog, setSelectedLog] = useState<ActivityLogRecord | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [pruneDialogOpen, setPruneDialogOpen] = useState(false);
    const [pruning, setPruning] = useState(false);
    const [exportingFormat, setExportingFormat] = useState<'csv' | 'xlsx' | 'pdf' | null>(null);

    const canExport = can('admin.system-logs.export');
    const canManage = can('admin.system-logs.manage');

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success, {
                position: 'top-right',
                autoClose: 5000,
                theme: 'dark',
                transition: Bounce,
            });
        }
        if (flash?.error) {
            toast.error(flash.error, {
                position: 'top-right',
                autoClose: 5000,
                theme: 'dark',
                transition: Bounce,
            });
        }
    }, [flash]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await axios.get(route('admin.system-logs.data'), { params: filters });
            const payload = response.data.data;
            setSummaryCards(
                payload.summaryCards.map((card: { title: string; value: string; icon: string }) => ({
                    title: card.title,
                    value: card.value,
                    change: '',
                    changeType: 'neutral' as const,
                    icon: card.icon,
                    group: 'system',
                })),
            );
            setSecurityHighlights(payload.securityHighlights ?? []);
            setRecords(payload.records);
        } catch {
            setError('Failed to load system logs. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const openDetail = async (log: ActivityLogRecord) => {
        setDetailLoading(true);
        setSelectedLog(log);

        try {
            const response = await axios.get(route('admin.system-logs.show', log.id));
            setSelectedLog(response.data.data);
        } catch {
            setError('Failed to load log details.');
        } finally {
            setDetailLoading(false);
        }
    };

    const buildExportParams = useCallback(
        (format: 'csv' | 'xlsx' | 'pdf') => {
            const params = new URLSearchParams();
            EXPORT_FILTER_KEYS.forEach((key) => {
                const value = filters[key];
                if (value === '' || value === 'all' || value === false) {
                    return;
                }
                params.append(key, String(value));
            });
            params.set('format', format);
            return params;
        },
        [filters],
    );

    const exportLogs = (format: 'csv' | 'xlsx' | 'pdf') => {
        if (!canExport) {
            toast.error('You do not have permission to export system logs.');
            return;
        }

        setExportingFormat(format);
        window.open(`${route('admin.system-logs.export')}?${buildExportParams(format).toString()}`, '_blank');
        toast.success(`Export started (${format.toUpperCase()}).`, {
            position: 'top-right',
            autoClose: 3000,
            theme: 'dark',
            transition: Bounce,
        });
        window.setTimeout(() => setExportingFormat(null), 1500);
    };

    const confirmPrune = () => {
        if (!canManage) {
            return;
        }

        setPruning(true);
        router.post(
            route('admin.system-logs.prune'),
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    setPruneDialogOpen(false);
                    fetchData();
                },
                onError: () => {
                    toast.error('Failed to prune expired logs.', {
                        position: 'top-right',
                        autoClose: 5000,
                        theme: 'dark',
                        transition: Bounce,
                    });
                },
                onFinish: () => setPruning(false),
            },
        );
    };

    const securityGroups = useMemo(() => {
        return {
            failedLogins: securityHighlights.filter((item) => item.event_type === 'failed_login'),
            permissionDenied: securityHighlights.filter((item) => item.event_type === 'permission_denied'),
            verificationFailures: securityHighlights.filter((item) =>
                ['face_verification_failed', 'geolocation_verification_failed', 'attendance_attempt_failed'].includes(item.event_type),
            ),
        };
    }, [securityHighlights]);

    const pageNumbers = useMemo(() => {
        if (!records || records.last_page <= 1) {
            return records ? [1] : [];
        }

        const { current_page: current, last_page: last } = records;
        const pages = new Set<number>([1, last, current, current - 1, current + 1]);
        return [...pages].filter((page) => page >= 1 && page <= last).sort((a, b) => a - b);
    }, [records]);

    const goToPage = (page: number) => {
        if (!records) {
            return;
        }

        const nextPage = Math.min(Math.max(page, 1), records.last_page);
        if (nextPage !== filters.page) {
            setFilters((current) => ({ ...current, page: nextPage }));
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="System Logs" />

            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-sidebar-foreground">System Logs</h1>
                        <p className="text-sm text-sidebar-foreground/60">
                            Monitor authentication, attendance, administrative actions, and security events.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                            <RefreshCw className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        {canExport && (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => exportLogs('csv')}
                                    disabled={exportingFormat !== null}
                                >
                                    <Download className="mr-2 size-4" />
                                    {exportingFormat === 'csv' ? 'Exporting…' : 'CSV'}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => exportLogs('xlsx')}
                                    disabled={exportingFormat !== null}
                                >
                                    <Download className="mr-2 size-4" />
                                    {exportingFormat === 'xlsx' ? 'Exporting…' : 'Excel'}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => exportLogs('pdf')}
                                    disabled={exportingFormat !== null}
                                >
                                    <Download className="mr-2 size-4" />
                                    {exportingFormat === 'pdf' ? 'Exporting…' : 'PDF'}
                                </Button>
                            </>
                        )}
                        {canManage && (
                            <Button variant="destructive" size="sm" onClick={() => setPruneDialogOpen(true)}>
                                <Trash2 className="mr-2 size-4" />
                                Prune Expired
                            </Button>
                        )}
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    {summaryCards.map((card) => (
                        <KpiCard key={card.title} card={card} />
                    ))}
                </div>

                <section className="rounded-xl border border-red-200/60 bg-red-50/40 p-5 dark:border-red-900/40 dark:bg-red-950/20">
                    <div className="mb-4 flex items-center gap-2">
                        <ShieldAlert className="size-5 text-red-600" />
                        <h2 className="text-lg font-semibold text-sidebar-foreground">Security Monitoring</h2>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-3">
                        {[
                            { title: 'Failed Login Attempts', items: securityGroups.failedLogins },
                            { title: 'Permission Denials', items: securityGroups.permissionDenied },
                            { title: 'Verification Failures', items: securityGroups.verificationFailures },
                        ].map((group) => (
                            <div key={group.title} className="rounded-lg border border-sidebar-border/60 bg-white p-4 dark:bg-sidebar-accent">
                                <h3 className="mb-3 text-sm font-semibold text-sidebar-foreground">{group.title}</h3>
                                {group.items.length === 0 ? (
                                    <p className="text-sm text-sidebar-foreground/50">No recent events.</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {group.items.slice(0, 4).map((item) => (
                                            <li key={item.id} className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                                                <p className="font-medium text-sidebar-foreground">{item.description}</p>
                                                <p className="text-xs text-sidebar-foreground/60">
                                                    {item.actor_name} · {item.created_at_human}
                                                </p>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                <section className="rounded-xl border border-sidebar-border/70 bg-white p-5 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                    <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <ReportFilterField label="Search">
                            <div className="relative">
                                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-sidebar-foreground/40" />
                                <input
                                    className={`${filterInputClass} pl-10`}
                                    placeholder="Search description, user, IP..."
                                    value={filters.search}
                                    onChange={(e) => setFilters((current) => ({ ...current, search: e.target.value, page: 1 }))}
                                />
                            </div>
                        </ReportFilterField>
                        <ReportFilterField label="User">
                            <select
                                className={filterInputClass}
                                value={filters.actor_id}
                                onChange={(e) => setFilters((current) => ({ ...current, actor_id: e.target.value, page: 1 }))}
                            >
                                <option value="all">All users</option>
                                {filterOptions.users.map((user) => (
                                    <option key={`${user.type}-${user.id}`} value={user.id}>
                                        {user.name} ({user.role})
                                    </option>
                                ))}
                            </select>
                        </ReportFilterField>
                        <ReportFilterField label="Role">
                            <select
                                className={filterInputClass}
                                value={filters.actor_role}
                                onChange={(e) => setFilters((current) => ({ ...current, actor_role: e.target.value, page: 1 }))}
                            >
                                <option value="all">All roles</option>
                                {filterOptions.roles.map((role) => (
                                    <option key={role} value={role}>
                                        {role}
                                    </option>
                                ))}
                            </select>
                        </ReportFilterField>
                        <ReportFilterField label="Category">
                            <select
                                className={filterInputClass}
                                value={filters.event_category}
                                onChange={(e) => setFilters((current) => ({ ...current, event_category: e.target.value, page: 1 }))}
                            >
                                <option value="all">All categories</option>
                                {filterOptions.categories.map((category) => (
                                    <option key={category} value={category}>
                                        {category.replace(/_/g, ' ')}
                                    </option>
                                ))}
                            </select>
                        </ReportFilterField>
                        <ReportFilterField label="Event Type">
                            <select
                                className={filterInputClass}
                                value={filters.event_type}
                                onChange={(e) => setFilters((current) => ({ ...current, event_type: e.target.value, page: 1 }))}
                            >
                                <option value="all">All event types</option>
                                {filterOptions.eventTypes.map((eventType) => (
                                    <option key={eventType} value={eventType}>
                                        {eventType.replace(/_/g, ' ')}
                                    </option>
                                ))}
                            </select>
                        </ReportFilterField>
                        <ReportFilterField label="Status">
                            <select
                                className={filterInputClass}
                                value={filters.status}
                                onChange={(e) => setFilters((current) => ({ ...current, status: e.target.value, page: 1 }))}
                            >
                                <option value="all">All statuses</option>
                                {filterOptions.statuses.map((status) => (
                                    <option key={status} value={status}>
                                        {status}
                                    </option>
                                ))}
                            </select>
                        </ReportFilterField>
                        <ReportFilterField label="Start Date">
                            <input
                                type="date"
                                className={filterInputClass}
                                value={filters.start_date}
                                onChange={(e) => setFilters((current) => ({ ...current, start_date: e.target.value, page: 1 }))}
                            />
                        </ReportFilterField>
                        <ReportFilterField label="End Date">
                            <input
                                type="date"
                                className={filterInputClass}
                                value={filters.end_date}
                                onChange={(e) => setFilters((current) => ({ ...current, end_date: e.target.value, page: 1 }))}
                            />
                        </ReportFilterField>
                        <ReportFilterField label="IP Address">
                            <input
                                className={filterInputClass}
                                placeholder="Filter by IP"
                                value={filters.ip_address}
                                onChange={(e) => setFilters((current) => ({ ...current, ip_address: e.target.value, page: 1 }))}
                            />
                        </ReportFilterField>
                        <ReportFilterField label="Security Only">
                            <label className="flex h-10 items-center gap-2 rounded-lg border border-sidebar-border/50 px-3 text-sm">
                                <input
                                    type="checkbox"
                                    checked={filters.security_only}
                                    onChange={(e) => setFilters((current) => ({ ...current, security_only: e.target.checked, page: 1 }))}
                                />
                                Show flagged security events only
                            </label>
                        </ReportFilterField>
                    </div>

                    {error && (
                        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                            <AlertTriangle className="size-4" />
                            {error}
                        </div>
                    )}

                    <div className="mb-4 flex flex-col gap-3 border-b border-sidebar-border/50 pb-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-sidebar-foreground">Activity Logs</h2>
                            <p className="text-sm text-sidebar-foreground/60">
                                {loading
                                    ? 'Loading records...'
                                    : records
                                      ? records.total > 0
                                          ? `Showing ${records.from ?? 0} to ${records.to ?? 0} of ${records.total} records`
                                          : 'No records match the selected filters'
                                      : 'No records'}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <label htmlFor="system-logs-per-page" className="text-sm text-sidebar-foreground/60">
                                Rows per page
                            </label>
                            <select
                                id="system-logs-per-page"
                                className={`${filterInputClass} w-auto min-w-[5.5rem] py-1.5`}
                                value={filters.per_page}
                                disabled={loading}
                                onChange={(e) =>
                                    setFilters((current) => ({ ...current, per_page: Number(e.target.value), page: 1 }))
                                }
                            >
                                {[10, 15, 25, 50, 100].map((size) => (
                                    <option key={size} value={size}>
                                        {size}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-sidebar-border/50">
                        <table className="min-w-[960px] w-full">
                            <thead className="bg-muted/30">
                                <tr>
                                    {['User', 'Role', 'Event', 'Category', 'Description', 'Status', 'IP', 'Date & Time', ''].map((heading) => (
                                        <th key={heading || 'actions'} className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                                            {heading}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={9} className="px-4 py-12 text-center text-sm text-sidebar-foreground/60">
                                            <Loader2 className="mx-auto mb-2 size-6 animate-spin" />
                                            Loading activity logs...
                                        </td>
                                    </tr>
                                ) : records && records.data.length > 0 ? (
                                    records.data.map((record) => (
                                        <tr key={record.id} className="border-t border-sidebar-border/30 hover:bg-muted/20">
                                            <td className="px-4 py-3 text-sm font-medium">{record.actor_name}</td>
                                            <td className="px-4 py-3 text-sm capitalize">{record.actor_role}</td>
                                            <td className="px-4 py-3 text-sm">{record.event_type.replace(/_/g, ' ')}</td>
                                            <td className="px-4 py-3 text-sm capitalize">{record.event_category.replace(/_/g, ' ')}</td>
                                            <td className="max-w-xs px-4 py-3 text-sm text-sidebar-foreground/80">{record.description}</td>
                                            <td className="px-4 py-3">
                                                <StatusBadge status={record.status} />
                                            </td>
                                            <td className="px-4 py-3 text-sm">{record.ip_address ?? '—'}</td>
                                            <td className="px-4 py-3 text-sm whitespace-nowrap">{record.created_at}</td>
                                            <td className="px-4 py-3">
                                                <Button variant="ghost" size="sm" onClick={() => openDetail(record)}>
                                                    <Eye className="size-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={9} className="px-4 py-12 text-center text-sm text-sidebar-foreground/50">
                                            No activity logs found for the selected filters.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {records && !loading && (
                        <div className="mt-4 flex flex-col gap-3 border-t border-sidebar-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm text-sidebar-foreground/60">
                                {records.total > 0
                                    ? `Showing ${records.data.length} row${records.data.length === 1 ? '' : 's'} on this page`
                                    : '0 rows'}
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={records.current_page <= 1}
                                    onClick={() => goToPage(records.current_page - 1)}
                                >
                                    <ChevronLeft className="size-4" />
                                    Previous
                                </Button>
                                <div className="flex items-center gap-1">
                                    {pageNumbers.map((page, index) => {
                                        const previousPage = pageNumbers[index - 1];
                                        const showEllipsis = previousPage !== undefined && page - previousPage > 1;

                                        return (
                                            <span key={page} className="flex items-center gap-1">
                                                {showEllipsis && (
                                                    <span className="px-1 text-sm text-sidebar-foreground/40">…</span>
                                                )}
                                                <Button
                                                    variant={records.current_page === page ? 'default' : 'outline'}
                                                    size="sm"
                                                    className="min-w-9"
                                                    onClick={() => goToPage(page)}
                                                >
                                                    {page}
                                                </Button>
                                            </span>
                                        );
                                    })}
                                </div>
                                <span className="text-sm text-sidebar-foreground/60">
                                    Page {records.current_page} of {records.last_page}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={records.current_page >= records.last_page}
                                    onClick={() => goToPage(records.current_page + 1)}
                                >
                                    Next
                                    <ChevronRight className="size-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </section>
            </div>

            <Dialog open={pruneDialogOpen} onOpenChange={setPruneDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Prune expired logs?</DialogTitle>
                        <DialogDescription>
                            This permanently deletes activity logs older than {logRetentionDays} days (configured retention
                            period). This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPruneDialogOpen(false)} disabled={pruning}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={confirmPrune} disabled={pruning}>
                            {pruning ? (
                                <>
                                    <Loader2 className="mr-2 size-4 animate-spin" />
                                    Pruning…
                                </>
                            ) : (
                                <>
                                    <Trash2 className="mr-2 size-4" />
                                    Prune Expired
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={selectedLog !== null} onOpenChange={(open) => !open && setSelectedLog(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Activity Details</DialogTitle>
                    </DialogHeader>
                    {detailLoading || !selectedLog ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="size-6 animate-spin" />
                        </div>
                    ) : (
                        <div className="space-y-4 text-sm">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <DetailField label="User" value={selectedLog.actor_name} />
                                <DetailField label="Role" value={selectedLog.actor_role} />
                                <DetailField label="Event Type" value={selectedLog.event_type.replace(/_/g, ' ')} />
                                <DetailField label="Category" value={selectedLog.event_category.replace(/_/g, ' ')} />
                                <DetailField label="Status" value={selectedLog.status} />
                                <DetailField label="Timestamp" value={selectedLog.created_at ?? ''} />
                                <DetailField label="IP Address" value={selectedLog.ip_address ?? '—'} />
                                <DetailField label="Route" value={selectedLog.route ?? '—'} />
                                <DetailField label="Browser" value={selectedLog.browser ?? 'Unknown'} />
                                <DetailField label="Device" value={selectedLog.device ?? 'Unknown'} />
                            </div>
                            <DetailField label="Description" value={selectedLog.description} />
                            <div>
                                <p className="mb-2 text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">Metadata</p>
                                <pre className="max-h-56 overflow-auto rounded-lg bg-muted/40 p-3 text-xs whitespace-pre-wrap">
                                    {JSON.stringify(selectedLog.metadata ?? {}, null, 2)}
                                </pre>
                            </div>
                            {selectedLog.user_agent && (
                                <DetailField label="User Agent" value={selectedLog.user_agent} />
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <ToastContainer />
        </AppLayout>
    );
}

function DetailField({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">{label}</p>
            <p className="mt-1 text-sidebar-foreground">{value}</p>
        </div>
    );
}
