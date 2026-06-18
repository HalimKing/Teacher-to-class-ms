import {
    columnLabels,
    defaultVisibleColumns,
    type PaginatedTeachers,
    type TeacherColumnKey,
    type TeacherListItem,
} from '@/components/teachers/types';
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
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Columns3, Edit, Eye, Loader2, MoreHorizontal, ShieldCheck, Trash2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

interface TeacherDataTableProps {
    teachers: PaginatedTeachers;
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
    onQuickView: (teacher: TeacherListItem) => void;
    onDelete: (id: number) => void;
    loading?: boolean;
}

const badgeStyles: Record<string, string> = {
    present: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-300',
    absent: 'bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300',
    late: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-300',
    checked_out: 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-950/40 dark:text-blue-300',
    unverified: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-950/40 dark:text-rose-300',
    enrolled: 'bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-950/40 dark:text-violet-300',
    not_enrolled: 'bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300',
    assigned: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-300',
    unassigned: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-300',
    active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-300',
    inactive: 'bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300',
    lecturer: 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-950/40 dark:text-blue-300',
    administrator: 'bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-950/40 dark:text-purple-300',
};

function StatusBadge({ label, tone }: { label: string; tone: string }) {
    return (
        <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset', badgeStyles[tone] ?? badgeStyles.absent)}>
            {label}
        </span>
    );
}

export default function TeacherDataTable({
    teachers,
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
    onDelete,
    loading = false,
}: TeacherDataTableProps) {
    const [visibleColumns, setVisibleColumns] = useState<TeacherColumnKey[]>(defaultVisibleColumns);
    const [showColumnMenu, setShowColumnMenu] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem('teacher-management-columns');
        if (stored) {
            try {
                setVisibleColumns(JSON.parse(stored));
            } catch {
                setVisibleColumns(defaultVisibleColumns);
            }
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('teacher-management-columns', JSON.stringify(visibleColumns));
    }, [visibleColumns]);

    const pageIds = useMemo(() => teachers.data.map((teacher) => teacher.id), [teachers.data]);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

    const toggleColumn = (column: TeacherColumnKey) => {
        setVisibleColumns((current) => {
            if (current.includes(column)) {
                return current.filter((item) => item !== column);
            }

            return [...current, column];
        });
    };

    const moveColumn = (column: TeacherColumnKey, direction: 'up' | 'down') => {
        setVisibleColumns((current) => {
            const index = current.indexOf(column);
            if (index === -1) {
                return current;
            }

            const targetIndex = direction === 'up' ? index - 1 : index + 1;
            if (targetIndex < 0 || targetIndex >= current.length) {
                return current;
            }

            const next = [...current];
            [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
            return next;
        });
    };

    const renderSortButton = (column: string, label: string) => (
        <button type="button" onClick={() => onSort(column)} className="inline-flex items-center gap-1 hover:text-sidebar-foreground">
            {label}
            {sortBy === column && <span className="text-[10px] uppercase">{sortDir}</span>}
        </button>
    );

    const renderHeaderCell = (column: TeacherColumnKey) => {
        const className = 'px-4 py-3 text-left text-xs font-semibold tracking-wide text-sidebar-foreground/60 uppercase';

        switch (column) {
            case 'profile':
                return <th className={className}>{renderSortButton('name', columnLabels.profile)}</th>;
            case 'department':
                return <th className={className}>{renderSortButton('department', columnLabels.department)}</th>;
            case 'created':
                return <th className={className}>{renderSortButton('created_at', columnLabels.created)}</th>;
            case 'actions':
                return <th className={className}>Actions</th>;
            default:
                return <th className={className}>{columnLabels[column]}</th>;
        }
    };

    const renderActionsMenu = (teacher: TeacherListItem) => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" title="Actions">
                    <MoreHorizontal className="size-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onQuickView(teacher)}>
                    <Eye className="size-4" />
                    Quick View
                </DropdownMenuItem>
                {can('admin.teachers.edit') && (
                    <>
                        <DropdownMenuItem onClick={() => onQuickView(teacher)}>
                            <ShieldCheck className="size-4" />
                            Face Enrollment
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link href={route('admin.teachers.edit', teacher.id)}>
                                <Edit className="size-4" />
                                Edit Teacher
                            </Link>
                        </DropdownMenuItem>
                    </>
                )}
                {can('admin.teachers.delete') && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => onDelete(teacher.id)}>
                            <Trash2 className="size-4" />
                            Delete Teacher
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );

    const renderBodyCell = (column: TeacherColumnKey, teacher: TeacherListItem) => {
        switch (column) {
            case 'profile':
                return (
                    <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                            <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/80 to-primary text-sm font-semibold text-primary-foreground">
                                {teacher.initials}
                            </div>
                            <div>
                                <div className="font-medium text-sidebar-foreground">{teacher.full_name}</div>
                                <div className="mt-1">
                                    <StatusBadge label={teacher.staff_type} tone={teacher.staff_type} />
                                </div>
                            </div>
                        </div>
                    </td>
                );
            case 'staff_id':
                return <td className="px-4 py-4 text-sm text-sidebar-foreground">{teacher.employee_id}</td>;
            case 'email':
                return <td className="px-4 py-4 text-sm text-sidebar-foreground/80">{teacher.email}</td>;
            case 'phone':
                return <td className="px-4 py-4 text-sm text-sidebar-foreground/80">{teacher.phone || '—'}</td>;
            case 'department':
                return (
                    <td className="px-4 py-4 text-sm text-sidebar-foreground/80">
                        <div>{teacher.department}</div>
                        <div className="text-xs text-sidebar-foreground/50">{teacher.faculty}</div>
                    </td>
                );
            case 'classes':
                return <td className="px-4 py-4 text-sm text-sidebar-foreground">{teacher.assigned_classes_count}</td>;
            case 'timetable':
                return (
                    <td className="px-4 py-4">
                        <StatusBadge label={teacher.timetable_status === 'assigned' ? 'Assigned' : 'Unassigned'} tone={teacher.timetable_status} />
                    </td>
                );
            case 'face':
                return (
                    <td className="px-4 py-4">
                        <StatusBadge
                            label={teacher.face_enrollment_status === 'enrolled' ? 'Enrolled' : 'Not Enrolled'}
                            tone={teacher.face_enrollment_status}
                        />
                    </td>
                );
            case 'attendance':
                return (
                    <td className="px-4 py-4">
                        <StatusBadge label={teacher.attendance_status} tone={teacher.attendance_badge} />
                    </td>
                );
            case 'account':
                return (
                    <td className="px-4 py-4">
                        <StatusBadge label={teacher.account_status === 'active' ? 'Active' : 'Inactive'} tone={teacher.account_status} />
                    </td>
                );
            case 'created':
                return <td className="px-4 py-4 text-sm text-sidebar-foreground/70">{teacher.created_at}</td>;
            case 'actions':
                return <td className="px-4 py-4">{renderActionsMenu(teacher)}</td>;
            default:
                return null;
        }
    };

    return (
        <div className="relative overflow-hidden rounded-xl border border-sidebar-border/70 bg-white shadow-sm dark:bg-sidebar-accent">
            {loading && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-[1px] dark:bg-sidebar-accent/70">
                    <div className="flex items-center gap-2 rounded-lg border border-sidebar-border/60 bg-white px-4 py-2 text-sm shadow-sm dark:bg-sidebar-accent">
                        <Loader2 className="size-4 animate-spin text-primary" />
                        Updating results...
                    </div>
                </div>
            )}
            <div className="flex flex-col gap-3 border-b border-sidebar-border/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-sidebar-foreground">Teacher Directory</h2>
                    <p className="text-sm text-sidebar-foreground/60">
                        Showing {teachers.from ?? 0}-{teachers.to ?? 0} of {teachers.total} teachers
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                        <Button type="button" variant="outline" size="sm" onClick={() => setShowColumnMenu((current) => !current)}>
                            <Columns3 className="size-4" />
                            Columns
                        </Button>
                        {showColumnMenu && (
                            <div className="absolute right-0 z-20 mt-2 max-h-80 w-64 overflow-y-auto rounded-xl border border-sidebar-border/70 bg-white p-3 shadow-lg dark:bg-sidebar-accent">
                                {defaultVisibleColumns.map((column, index) => (
                                    <div key={column} className="flex items-center justify-between gap-2 py-1">
                                        <label className="flex flex-1 items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={visibleColumns.includes(column)}
                                                onChange={() => toggleColumn(column)}
                                            />
                                            {columnLabels[column]}
                                        </label>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                className="rounded p-1 hover:bg-muted/50 disabled:opacity-30"
                                                disabled={index === 0}
                                                onClick={() => moveColumn(column, 'up')}
                                                aria-label={`Move ${columnLabels[column]} up`}
                                            >
                                                <ChevronUp className="size-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                className="rounded p-1 hover:bg-muted/50 disabled:opacity-30"
                                                disabled={index === defaultVisibleColumns.length - 1}
                                                onClick={() => moveColumn(column, 'down')}
                                                aria-label={`Move ${columnLabels[column]} down`}
                                            >
                                                <ChevronDown className="size-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

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

            <div className="space-y-3 p-4 lg:hidden">
                {teachers.data.map((teacher) => (
                    <div key={teacher.id} className="rounded-xl border border-sidebar-border/60 bg-muted/10 p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                {bulkMode && (
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.includes(teacher.id)}
                                        onChange={() => onToggleSelect(teacher.id)}
                                        aria-label={`Select ${teacher.full_name}`}
                                    />
                                )}
                                <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/80 to-primary text-sm font-semibold text-primary-foreground">
                                    {teacher.initials}
                                </div>
                                <div>
                                    <p className="font-medium text-sidebar-foreground">{teacher.full_name}</p>
                                    <p className="text-xs text-sidebar-foreground/60">{teacher.employee_id}</p>
                                </div>
                            </div>
                            {renderActionsMenu(teacher)}
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div><p className="text-xs text-sidebar-foreground/50">Department</p><p>{teacher.department}</p></div>
                            <div><p className="text-xs text-sidebar-foreground/50">Attendance</p><StatusBadge label={teacher.attendance_status} tone={teacher.attendance_badge} /></div>
                            <div><p className="text-xs text-sidebar-foreground/50">Face</p><StatusBadge label={teacher.face_enrollment_status === 'enrolled' ? 'Enrolled' : 'Not Enrolled'} tone={teacher.face_enrollment_status} /></div>
                            <div><p className="text-xs text-sidebar-foreground/50">Timetable</p><StatusBadge label={teacher.timetable_status === 'assigned' ? 'Assigned' : 'Unassigned'} tone={teacher.timetable_status} /></div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="hidden overflow-x-auto lg:block">
                <table className="min-w-full divide-y divide-sidebar-border/60">
                    <thead className="bg-muted/40">
                        <tr>
                            {bulkMode && (
                                <th className="px-4 py-3">
                                    <input type="checkbox" checked={allSelected} onChange={() => onToggleSelectAll(pageIds)} aria-label="Select all teachers" />
                                </th>
                            )}
                            {visibleColumns.map((column) => (
                                <React.Fragment key={column}>{renderHeaderCell(column)}</React.Fragment>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-sidebar-border/50">
                        {teachers.data.map((teacher) => (
                            <tr key={teacher.id} className="transition-colors hover:bg-muted/30">
                                {bulkMode && (
                                    <td className="px-4 py-4">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(teacher.id)}
                                            onChange={() => onToggleSelect(teacher.id)}
                                            aria-label={`Select ${teacher.full_name}`}
                                        />
                                    </td>
                                )}
                                {visibleColumns.map((column) => (
                                    <React.Fragment key={`${teacher.id}-${column}`}>{renderBodyCell(column, teacher)}</React.Fragment>
                                ))}
                            </tr>
                        ))}

                        {teachers.data.length === 0 && (
                            <tr>
                                <td colSpan={visibleColumns.length + (bulkMode ? 1 : 0)} className="px-6 py-16 text-center">
                                    <div className="mx-auto max-w-md space-y-2">
                                        <p className="text-lg font-medium text-sidebar-foreground">No teachers found</p>
                                        <p className="text-sm text-sidebar-foreground/60">Try adjusting your search or filters to find the teacher you need.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-sidebar-border/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-sidebar-foreground/60">
                    Page {teachers.current_page} of {teachers.last_page}
                </p>
                <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={teachers.current_page === 1} onClick={() => onPageChange(teachers.current_page - 1)}>
                        <ChevronLeft className="size-4" />
                        Previous
                    </Button>
                    <Button type="button" variant="outline" size="sm" disabled={teachers.current_page === teachers.last_page} onClick={() => onPageChange(teachers.current_page + 1)}>
                        Next
                        <ChevronRight className="size-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
