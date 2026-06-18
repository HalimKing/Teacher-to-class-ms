import { type DepartmentOption, type FacultyOption, type TeacherFilters } from '@/components/teachers/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Calendar, ChevronDown, Filter, Search, ShieldCheck, User, X } from 'lucide-react';
import { useMemo, useState } from 'react';

interface TeacherFiltersPanelProps {
    filters: TeacherFilters;
    faculties: FacultyOption[];
    departments: DepartmentOption[];
    onChange: (key: keyof TeacherFilters, value: string) => void;
    onClear: () => void;
}

const selectClass =
    'h-10 w-full rounded-lg border border-sidebar-border/70 bg-white px-3 text-sm text-sidebar-foreground shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:bg-sidebar-accent';

function FilterSection({ title, icon: Icon, children }: { title: string; icon: typeof Search; children: React.ReactNode }) {
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-sidebar-foreground/60 uppercase">
                <Icon className="size-3.5" />
                {title}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
        </div>
    );
}

export default function TeacherFiltersPanel({ filters, faculties, departments, onChange, onClear }: TeacherFiltersPanelProps) {
    const [expanded, setExpanded] = useState(false);

    const filteredDepartments = useMemo(() => {
        if (!filters.faculty || filters.faculty === 'all') {
            return departments;
        }

        return departments.filter((department) => String(department.faculty_id) === String(filters.faculty));
    }, [departments, filters.faculty]);

    const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
        if (['sort_by', 'sort_dir', 'per_page'].includes(key)) {
            return false;
        }

        return value && value !== 'all';
    });

    const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
        if (['sort_by', 'sort_dir', 'per_page'].includes(key)) {
            return false;
        }

        return value && value !== 'all';
    }).length;

    return (
        <div className="overflow-hidden rounded-xl border border-sidebar-border/70 bg-white shadow-sm dark:bg-sidebar-accent">
            <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-sidebar-foreground/40" />
                    <input
                        type="search"
                        value={filters.search ?? ''}
                        onChange={(event) => onChange('search', event.target.value)}
                        placeholder="Search name, email, staff ID, or phone..."
                        className={cn(selectClass, 'pl-10')}
                    />
                </div>

                <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <select value={filters.faculty ?? 'all'} onChange={(event) => onChange('faculty', event.target.value)} className={selectClass}>
                        <option value="all">All Faculties</option>
                        {faculties.map((faculty) => (
                            <option key={faculty.id} value={faculty.id}>
                                {faculty.name}
                            </option>
                        ))}
                    </select>

                    <select value={filters.department ?? 'all'} onChange={(event) => onChange('department', event.target.value)} className={selectClass}>
                        <option value="all">All Departments</option>
                        {filteredDepartments.map((department) => (
                            <option key={department.id} value={department.id}>
                                {department.name}
                            </option>
                        ))}
                    </select>

                    <select value={filters.staffType ?? 'all'} onChange={(event) => onChange('staffType', event.target.value)} className={selectClass}>
                        <option value="all">All Staff Types</option>
                        <option value="lecturer">Lecturers</option>
                        <option value="administrator">Administrators</option>
                    </select>

                    <Button type="button" variant="outline" onClick={() => setExpanded((current) => !current)}>
                        <Filter className="size-4" />
                        Advanced Filters
                        {activeFilterCount > 0 && (
                            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                                {activeFilterCount}
                            </span>
                        )}
                        <ChevronDown className={cn('size-4 transition-transform', expanded && 'rotate-180')} />
                    </Button>
                </div>
            </div>

            {expanded && (
                <div className="space-y-6 border-t border-sidebar-border/60 p-4">
                    <FilterSection title="Facial Recognition" icon={ShieldCheck}>
                        <select value={filters.faceEnrollment ?? 'all'} onChange={(event) => onChange('faceEnrollment', event.target.value)} className={selectClass}>
                            <option value="all">All Enrollment Statuses</option>
                            <option value="enrolled">Enrolled</option>
                            <option value="not_enrolled">Not Enrolled</option>
                        </select>
                        <select value={filters.faceVerification ?? 'all'} onChange={(event) => onChange('faceVerification', event.target.value)} className={selectClass}>
                            <option value="all">All Verification Statuses</option>
                            <option value="verification_failed">Verification Failed Today</option>
                        </select>
                    </FilterSection>

                    <FilterSection title="Attendance & Timetable" icon={Calendar}>
                        <select value={filters.attendanceToday ?? 'all'} onChange={(event) => onChange('attendanceToday', event.target.value)} className={selectClass}>
                            <option value="all">All Attendance Today</option>
                            <option value="present">Present Today</option>
                            <option value="absent">Absent Today</option>
                        </select>
                        <select value={filters.timetable ?? 'all'} onChange={(event) => onChange('timetable', event.target.value)} className={selectClass}>
                            <option value="all">All Timetable Statuses</option>
                            <option value="assigned">Assigned</option>
                            <option value="unassigned">Unassigned</option>
                        </select>
                    </FilterSection>

                    <FilterSection title="Account & Dates" icon={User}>
                        <select value={filters.accountStatus ?? 'all'} onChange={(event) => onChange('accountStatus', event.target.value)} className={selectClass}>
                            <option value="all">All Account Statuses</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                        <input
                            type="date"
                            value={filters.created_from ?? ''}
                            onChange={(event) => onChange('created_from', event.target.value)}
                            className={selectClass}
                            aria-label="Created from"
                        />
                        <input
                            type="date"
                            value={filters.created_to ?? ''}
                            onChange={(event) => onChange('created_to', event.target.value)}
                            className={selectClass}
                            aria-label="Created to"
                        />
                        <input
                            type="date"
                            value={filters.last_attendance_from ?? ''}
                            onChange={(event) => onChange('last_attendance_from', event.target.value)}
                            className={selectClass}
                            aria-label="Last attendance from"
                        />
                        <input
                            type="date"
                            value={filters.last_attendance_to ?? ''}
                            onChange={(event) => onChange('last_attendance_to', event.target.value)}
                            className={selectClass}
                            aria-label="Last attendance to"
                        />
                    </FilterSection>
                </div>
            )}

            {hasActiveFilters && (
                <div className="flex justify-end border-t border-sidebar-border/60 px-4 py-3">
                    <Button type="button" variant="ghost" size="sm" onClick={onClear}>
                        <X className="size-4" />
                        Clear Filters
                    </Button>
                </div>
            )}
        </div>
    );
}
