import { Loader2 } from 'lucide-react';
import { ExternalLink } from 'lucide-react';
import { Link } from '@inertiajs/react';
import { PaginatedRecords, TableColumn } from '@/components/reports/shared';
import { ReportEmptyState } from '@/components/reports/ReportStates';

interface ReportAttendanceTableProps<T extends { id: number }> {
    title?: string;
    records: PaginatedRecords<T> | null;
    columns: TableColumn<T>[];
    visibleColumnKeys?: string[];
    sortBy: string;
    sortDir: 'asc' | 'desc';
    perPage: number;
    isLoading: boolean;
    detailHref?: (record: T) => string;
    onRowClick?: (record: T) => void;
    onSort: (column: string) => void;
    onPerPageChange: (size: number) => void;
    onPageChange: (page: number) => void;
}

export function ReportAttendanceTable<T extends { id: number }>({
    title = 'Attendance Records',
    records,
    columns,
    visibleColumnKeys,
    sortBy,
    sortDir,
    perPage,
    isLoading,
    detailHref,
    onRowClick,
    onSort,
    onPerPageChange,
    onPageChange,
}: ReportAttendanceTableProps<T>) {
    const activeColumns = visibleColumnKeys?.length
        ? columns.filter((column) => visibleColumnKeys.includes(column.key))
        : columns;
    return (
        <div className="rounded-xl border border-sidebar-border/70 bg-white shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
            <div className="flex flex-col gap-3 border-b border-sidebar-border/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-sidebar-foreground">{title}</h2>
                    <p className="text-sm text-sidebar-foreground/60">
                        {records ? `Showing ${records.from ?? 0}-${records.to ?? 0} of ${records.total} records` : 'No records'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-sm text-sidebar-foreground/60">Per page</label>
                    <select value={perPage} onChange={(e) => onPerPageChange(Number(e.target.value))} className="rounded-lg border border-sidebar-border/50 px-2 py-1 text-sm">
                        {[10, 15, 25, 50, 100].map((size) => (
                            <option key={size} value={size}>{size}</option>
                        ))}
                    </select>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>
            ) : records && records.data.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-sidebar-accent/50 text-left text-xs uppercase tracking-wider text-sidebar-foreground/60">
                            <tr>
                                {activeColumns.map((column) => (
                                    <th key={column.key} className="px-4 py-3">
                                        {column.sortable !== false ? (
                                            <button onClick={() => onSort(column.key)} className="inline-flex items-center gap-1 hover:text-sidebar-foreground">
                                                {column.label}
                                                {sortBy === column.key && (sortDir === 'asc' ? '↑' : '↓')}
                                            </button>
                                        ) : column.label}
                                    </th>
                                ))}
                                {detailHref && <th className="px-4 py-3">Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {records.data.map((record) => (
                                <tr
                                    key={record.id}
                                    className={`border-t border-sidebar-border/40 ${onRowClick ? 'cursor-pointer hover:bg-sidebar-accent/40' : ''}`}
                                    onClick={() => onRowClick?.(record)}
                                >
                                    {activeColumns.map((column) => (
                                        <td key={column.key} className="px-4 py-3">
                                            {column.render ? column.render(record) : String((record as Record<string, unknown>)[column.key] ?? '—')}
                                        </td>
                                    ))}
                                    {detailHref && (
                                        <td className="px-4 py-3">
                                            <Link href={detailHref(record)} className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700">
                                                View <ExternalLink className="h-3.5 w-3.5" />
                                            </Link>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <ReportEmptyState />
            )}

            {records && records.last_page > 1 && (
                <div className="flex items-center justify-between border-t border-sidebar-border/50 p-4">
                    <button disabled={records.current_page <= 1} onClick={() => onPageChange(records.current_page - 1)} className="rounded-lg border border-sidebar-border px-3 py-1.5 text-sm disabled:opacity-50">Previous</button>
                    <span className="text-sm text-sidebar-foreground/60">Page {records.current_page} of {records.last_page}</span>
                    <button disabled={records.current_page >= records.last_page} onClick={() => onPageChange(records.current_page + 1)} className="rounded-lg border border-sidebar-border px-3 py-1.5 text-sm disabled:opacity-50">Next</button>
                </div>
            )}
        </div>
    );
}
