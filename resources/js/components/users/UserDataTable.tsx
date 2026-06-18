import {
    columnLabels,
    defaultVisibleColumns,
    type PaginatedUsers,
    type UserColumnKey,
    type UserListItem,
} from '@/components/users/types';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { can } from '@/lib/can';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Columns3, Edit, Eye, Key, Loader2, MoreHorizontal, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface UserDataTableProps {
    users: PaginatedUsers;
    selectedIds: number[];
    bulkMode: boolean;
    sortBy: string;
    sortDir: 'asc' | 'desc';
    perPage: number;
    onSort: (column: string) => void;
    onPageChange: (page: number) => void;
    onPerPageChange: (perPage: number) => void;
    onToggleSelect: (id: number) => void;
    onToggleSelectAll: (ids: number[]) => void;
    onQuickView: (user: UserListItem) => void;
    onResetPassword: (user: UserListItem) => void;
    onDelete: (id: number) => void;
    loading?: boolean;
}

const badgeStyles: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-300',
    inactive: 'bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300',
    suspended: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-950/40 dark:text-rose-300',
    locked: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-300',
    reset_required: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-300',
    current: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-300',
};

function StatusBadge({ label, tone }: { label: string; tone: string }) {
    return (
        <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset', badgeStyles[tone] ?? badgeStyles.inactive)}>
            {label}
        </span>
    );
}

function SortButton({ label, column, sortBy, sortDir, onSort }: { label: string; column: string; sortBy: string; sortDir: 'asc' | 'desc'; onSort: (column: string) => void }) {
    const active = sortBy === column;

    return (
        <button type="button" onClick={() => onSort(column)} className="inline-flex items-center gap-1 text-xs font-semibold tracking-wide text-sidebar-foreground/60 uppercase">
            {label}
            {active ? (sortDir === 'asc' ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />) : null}
        </button>
    );
}

export default function UserDataTable({
    users,
    selectedIds,
    bulkMode,
    sortBy,
    sortDir,
    perPage,
    onSort,
    onPageChange,
    onPerPageChange,
    onToggleSelect,
    onToggleSelectAll,
    onQuickView,
    onResetPassword,
    onDelete,
    loading = false,
}: UserDataTableProps) {
    const [visibleColumns, setVisibleColumns] = useState<UserColumnKey[]>(defaultVisibleColumns);
    const [showColumnMenu, setShowColumnMenu] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem('user-management-columns');
        if (stored) {
            try {
                setVisibleColumns(JSON.parse(stored));
            } catch {
                setVisibleColumns(defaultVisibleColumns);
            }
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('user-management-columns', JSON.stringify(visibleColumns));
    }, [visibleColumns]);

    const toggleColumn = (column: UserColumnKey) => {
        setVisibleColumns((current) => {
            if (current.includes(column)) {
                if (column === 'actions' || current.length <= 3) {
                    return current;
                }

                return current.filter((item) => item !== column);
            }

            return [...current, column];
        });
    };

    const isVisible = (column: UserColumnKey) => visibleColumns.includes(column);

    const pageIds = useMemo(() => users.data.map((user) => user.id), [users.data]);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

    const passwordTone = (user: UserListItem) => (user.must_change_password ? 'reset_required' : 'current');

    const statusTone = (user: UserListItem) => (user.is_locked ? 'locked' : user.status);

    return (
        <div className="overflow-hidden rounded-xl border border-sidebar-border/70 bg-white shadow-sm dark:bg-sidebar-accent">
            <div className="flex flex-col gap-4 border-b border-sidebar-border/60 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-sidebar-foreground">User Directory</h2>
                    <p className="text-sm text-sidebar-foreground/60">
                        Showing {users.from ?? 0}-{users.to ?? 0} of {users.total} users
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <DropdownMenu open={showColumnMenu} onOpenChange={setShowColumnMenu}>
                        <DropdownMenuTrigger asChild>
                            <Button type="button" variant="outline" size="sm">
                                <Columns3 className="size-4" />
                                Columns
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                            {defaultVisibleColumns.map((column) => (
                                <DropdownMenuItem key={column} onClick={() => toggleColumn(column)}>
                                    <span className={cn(isVisible(column) ? 'font-semibold' : '')}>{columnLabels[column]}</span>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <select
                        value={perPage}
                        onChange={(event) => onPerPageChange(Number(event.target.value))}
                        className="h-9 rounded-lg border border-sidebar-border/70 bg-white px-3 text-sm dark:bg-sidebar-accent"
                    >
                        {[10, 15, 25, 50, 100].map((size) => (
                            <option key={size} value={size}>
                                {size} / page
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="relative overflow-x-auto">
                {loading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 dark:bg-sidebar-accent/60">
                        <Loader2 className="size-6 animate-spin text-primary" />
                    </div>
                )}

                <table className="min-w-full divide-y divide-sidebar-border/60">
                    <thead className="bg-muted/30">
                        <tr>
                            {bulkMode && (
                                <th className="px-4 py-3">
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={() => onToggleSelectAll(allSelected ? [] : pageIds)}
                                        aria-label="Select all users on page"
                                    />
                                </th>
                            )}
                            {isVisible('profile') && (
                                <th className="px-4 py-3 text-left">
                                    <SortButton label={columnLabels.profile} column="name" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                                </th>
                            )}
                            {isVisible('staff_id') && (
                                <th className="px-4 py-3 text-left">
                                    <SortButton label={columnLabels.staff_id} column="staff_id" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                                </th>
                            )}
                            {isVisible('email') && (
                                <th className="px-4 py-3 text-left">
                                    <SortButton label={columnLabels.email} column="email" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                                </th>
                            )}
                            {isVisible('roles') && <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-sidebar-foreground/60 uppercase">{columnLabels.roles}</th>}
                            {isVisible('status') && (
                                <th className="px-4 py-3 text-left">
                                    <SortButton label={columnLabels.status} column="status" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                                </th>
                            )}
                            {isVisible('password') && <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-sidebar-foreground/60 uppercase">{columnLabels.password}</th>}
                            {isVisible('last_login') && (
                                <th className="px-4 py-3 text-left">
                                    <SortButton label={columnLabels.last_login} column="last_login_at" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                                </th>
                            )}
                            {isVisible('created') && (
                                <th className="px-4 py-3 text-left">
                                    <SortButton label={columnLabels.created} column="created_at" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                                </th>
                            )}
                            {isVisible('actions') && <th className="px-4 py-3 text-right text-xs font-semibold tracking-wide text-sidebar-foreground/60 uppercase">{columnLabels.actions}</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-sidebar-border/60">
                        {users.data.map((user) => (
                            <tr key={user.id} className="transition-colors hover:bg-muted/20">
                                {bulkMode && (
                                    <td className="px-4 py-4">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(user.id)}
                                            onChange={() => onToggleSelect(user.id)}
                                            aria-label={`Select ${user.name}`}
                                        />
                                    </td>
                                )}
                                {isVisible('profile') && (
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                                                {user.initials}
                                            </div>
                                            <div>
                                                <p className="font-medium text-sidebar-foreground">{user.name}</p>
                                                <p className="text-xs text-sidebar-foreground/50">ID #{user.id}</p>
                                            </div>
                                        </div>
                                    </td>
                                )}
                                {isVisible('staff_id') && (
                                    <td className="px-4 py-4">
                                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                            {user.staff_id}
                                        </span>
                                    </td>
                                )}
                                {isVisible('email') && <td className="px-4 py-4 text-sm text-sidebar-foreground/80">{user.email}</td>}
                                {isVisible('roles') && (
                                    <td className="px-4 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {user.roles.length ? (
                                                user.roles.map((role) => (
                                                    <span key={role} className="rounded-full bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                                                        {role}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-sm text-sidebar-foreground/50">No roles</span>
                                            )}
                                        </div>
                                    </td>
                                )}
                                {isVisible('status') && (
                                    <td className="px-4 py-4">
                                        <StatusBadge label={user.is_locked ? 'Locked' : user.status_label} tone={statusTone(user)} />
                                    </td>
                                )}
                                {isVisible('password') && (
                                    <td className="px-4 py-4">
                                        <StatusBadge label={user.password_status} tone={passwordTone(user)} />
                                    </td>
                                )}
                                {isVisible('last_login') && (
                                    <td className="px-4 py-4 text-sm text-sidebar-foreground/70">{user.last_login_display ?? 'Never'}</td>
                                )}
                                {isVisible('created') && <td className="px-4 py-4 text-sm text-sidebar-foreground/70">{user.created_at}</td>}
                                {isVisible('actions') && (
                                    <td className="px-4 py-4">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button type="button" variant="ghost" size="icon" onClick={() => onQuickView(user)} title="Quick view">
                                                <Eye className="size-4" />
                                            </Button>

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button type="button" variant="ghost" size="icon">
                                                        <MoreHorizontal className="size-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    {can('admin.user-management.users.edit') && (
                                                        <DropdownMenuItem asChild>
                                                            <Link href={route('admin.user-management.users.edit', user.id)}>
                                                                <Edit className="size-4" />
                                                                Edit User
                                                            </Link>
                                                        </DropdownMenuItem>
                                                    )}
                                                    {can('admin.user-management.users.reset-password') && (
                                                        <DropdownMenuItem onClick={() => onResetPassword(user)}>
                                                            <Key className="size-4" />
                                                            Reset Password
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuSeparator />
                                                    {can('admin.user-management.users.delete') && (
                                                        <DropdownMenuItem className="text-rose-600 focus:text-rose-600" onClick={() => onDelete(user.id)}>
                                                            <Trash2 className="size-4" />
                                                            Delete User
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}

                        {users.data.length === 0 && (
                            <tr>
                                <td colSpan={visibleColumns.length} className="px-4 py-16 text-center text-sm text-sidebar-foreground/60">
                                    No users match the current filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {users.data.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-sidebar-border/60 px-4 py-4">
                    <p className="text-sm text-sidebar-foreground/60">
                        Page {users.current_page} of {users.last_page}
                    </p>
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" disabled={users.current_page === 1} onClick={() => onPageChange(users.current_page - 1)}>
                            <ChevronLeft className="size-4" />
                            Previous
                        </Button>
                        <Button type="button" variant="outline" size="sm" disabled={users.current_page === users.last_page} onClick={() => onPageChange(users.current_page + 1)}>
                            Next
                            <ChevronRight className="size-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
