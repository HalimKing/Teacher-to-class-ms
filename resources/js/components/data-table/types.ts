import type { ReactNode } from 'react';

export type SortDir = 'asc' | 'desc';

export interface PaginatedCollection<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

export interface DataTableColumn<T> {
    key: string;
    label: string;
    sortable?: boolean;
    sortKey?: string;
    className?: string;
    headerClassName?: string;
    hideOnMobile?: boolean;
    render: (row: T) => ReactNode;
}

export interface DataTableEmptyState {
    title: string;
    description?: string;
    action?: ReactNode;
}
