import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Inbox, Loader2, Search, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { DataTableColumn, DataTableEmptyState, PaginatedCollection, SortDir } from './types';

interface DataTableProps<T extends { id: number | string }> {
    title: string;
    description?: string;
    records: PaginatedCollection<T>;
    columns: DataTableColumn<T>[];
    sortBy: string;
    sortDir: SortDir;
    onSort: (column: string) => void;
    perPage: number;
    onPerPageChange: (perPage: number) => void;
    onPageChange: (page: number) => void;
    loading?: boolean;
    search?: string;
    searchPlaceholder?: string;
    onSearchChange?: (value: string) => void;
    toolbar?: ReactNode;
    empty: DataTableEmptyState;
    noResults: DataTableEmptyState;
    hasActiveQuery?: boolean;
    recordLabel?: string;
}

function SortButton({
    label,
    column,
    sortBy,
    sortDir,
    onSort,
}: {
    label: string;
    column: string;
    sortBy: string;
    sortDir: SortDir;
    onSort: (column: string) => void;
}) {
    const active = sortBy === column;

    return (
        <button
            type="button"
            onClick={() => onSort(column)}
            className={cn(
                'inline-flex items-center gap-1 text-xs font-semibold tracking-wide uppercase transition-colors',
                active ? 'text-sidebar-foreground' : 'text-sidebar-foreground/60 hover:text-sidebar-foreground',
            )}
            aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
        >
            {label}
            {active ? (
                sortDir === 'asc' ? (
                    <ChevronUp className="size-3.5" aria-hidden />
                ) : (
                    <ChevronDown className="size-3.5" aria-hidden />
                )
            ) : (
                <span className="inline-flex flex-col leading-none text-sidebar-foreground/30" aria-hidden>
                    <ChevronUp className="size-3 -mb-1" />
                    <ChevronDown className="size-3" />
                </span>
            )}
        </button>
    );
}

function EmptyState({ state }: { state: DataTableEmptyState }) {
    return (
        <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
                <Inbox className="size-5 text-sidebar-foreground/50" />
            </div>
            <p className="text-sm font-medium text-sidebar-foreground">{state.title}</p>
            {state.description && <p className="mt-1 max-w-sm text-sm text-sidebar-foreground/60">{state.description}</p>}
            {state.action && <div className="mt-4">{state.action}</div>}
        </div>
    );
}

export default function DataTable<T extends { id: number | string }>({
    title,
    description,
    records,
    columns,
    sortBy,
    sortDir,
    onSort,
    perPage,
    onPerPageChange,
    onPageChange,
    loading = false,
    search,
    searchPlaceholder = 'Search...',
    onSearchChange,
    toolbar,
    empty,
    noResults,
    hasActiveQuery = false,
    recordLabel = 'records',
}: DataTableProps<T>) {
    const isEmpty = records.data.length === 0;
    const emptyState = hasActiveQuery ? noResults : empty;

    return (
        <div className="overflow-hidden rounded-xl border border-sidebar-border/70 bg-white shadow-sm dark:bg-sidebar-accent">
            <div className="flex flex-col gap-4 border-b border-sidebar-border/60 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                    <h2 className="text-base font-semibold text-sidebar-foreground sm:text-lg">{title}</h2>
                    <p className="text-sm text-sidebar-foreground/60">
                        {description ?? `Showing ${records.from ?? 0}–${records.to ?? 0} of ${records.total} ${recordLabel}`}
                    </p>
                </div>

                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {onSearchChange && (
                        <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-sidebar-foreground/40" />
                            <input
                                type="search"
                                value={search ?? ''}
                                onChange={(event) => onSearchChange(event.target.value)}
                                placeholder={searchPlaceholder}
                                className="h-10 w-full rounded-lg border border-sidebar-border/70 bg-white py-2 pr-9 pl-9 text-sm text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none sm:h-9 dark:bg-sidebar-accent"
                                aria-label={searchPlaceholder}
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => onSearchChange('')}
                                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-sidebar-foreground/40 hover:text-sidebar-foreground"
                                    aria-label="Clear search"
                                >
                                    <X className="size-4" />
                                </button>
                            )}
                        </div>
                    )}

                    {toolbar}

                    <select
                        value={perPage}
                        onChange={(event) => onPerPageChange(Number(event.target.value))}
                        className="h-10 min-w-0 flex-1 rounded-lg border border-sidebar-border/70 bg-white px-3 text-sm sm:h-9 sm:flex-none dark:bg-sidebar-accent"
                        aria-label="Items per page"
                    >
                        {[10, 15, 25, 50, 100].map((size) => (
                            <option key={size} value={size}>
                                {size} / page
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="relative">
                {loading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-sidebar-accent/70">
                        <Loader2 className="size-6 animate-spin text-primary" />
                        <span className="sr-only">Loading</span>
                    </div>
                )}

                <div className="space-y-3 p-4 lg:hidden">
                    {records.data.map((row) => (
                        <div key={row.id} className="rounded-xl border border-sidebar-border/60 bg-muted/10 p-4">
                            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                                {columns.map((column) => (
                                    <div
                                        key={column.key}
                                        className={cn(
                                            column.key === 'actions' ? 'sm:col-span-2 flex items-start justify-between gap-3' : 'min-w-0',
                                            column.hideOnMobile && 'hidden',
                                        )}
                                    >
                                        {column.key !== 'actions' && (
                                            <dt className="text-xs font-medium tracking-wide text-sidebar-foreground/50 uppercase">{column.label}</dt>
                                        )}
                                        <dd className={cn(column.key === 'actions' ? 'ml-auto' : 'mt-1')}>{column.render(row)}</dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    ))}

                    {isEmpty && <EmptyState state={emptyState} />}
                </div>

                <div className="hidden overflow-x-auto lg:block">
                    <table className="min-w-full divide-y divide-sidebar-border/60">
                        <thead className="bg-muted/30">
                            <tr>
                                {columns.map((column) => (
                                    <th
                                        key={column.key}
                                        className={cn(
                                            'px-4 py-3 text-left text-xs font-semibold tracking-wide text-sidebar-foreground/60 uppercase',
                                            column.key === 'actions' && 'text-right',
                                            column.headerClassName,
                                        )}
                                        scope="col"
                                    >
                                        {column.sortable ? (
                                            <SortButton
                                                label={column.label}
                                                column={column.sortKey ?? column.key}
                                                sortBy={sortBy}
                                                sortDir={sortDir}
                                                onSort={onSort}
                                            />
                                        ) : (
                                            column.label
                                        )}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-sidebar-border/60">
                            {records.data.map((row) => (
                                <tr key={row.id} className="transition-colors hover:bg-muted/20">
                                    {columns.map((column) => (
                                        <td key={column.key} className={cn('px-4 py-4 align-middle', column.className)}>
                                            {column.render(row)}
                                        </td>
                                    ))}
                                </tr>
                            ))}

                            {isEmpty && (
                                <tr>
                                    <td colSpan={columns.length}>
                                        <EmptyState state={emptyState} />
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {records.total > 0 && (
                <div className="flex flex-col gap-3 border-t border-sidebar-border/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-sidebar-foreground/60">
                        Page {records.current_page} of {Math.max(records.last_page, 1)}
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                        <Button
                            type="button"
                            variant="outline"
                            className="h-10 sm:h-9"
                            disabled={records.current_page <= 1}
                            onClick={() => onPageChange(records.current_page - 1)}
                        >
                            <ChevronLeft className="size-4" />
                            Previous
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="h-10 sm:h-9"
                            disabled={records.current_page >= records.last_page}
                            onClick={() => onPageChange(records.current_page + 1)}
                        >
                            Next
                            <ChevronRight className="size-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
