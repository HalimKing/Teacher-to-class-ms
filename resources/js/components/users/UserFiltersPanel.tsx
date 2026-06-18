import { type RoleOption, type UserFilters } from '@/components/users/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Calendar, ChevronDown, Filter, Key, Search, ShieldCheck, User, X } from 'lucide-react';
import { useState } from 'react';

interface UserFiltersPanelProps {
    filters: UserFilters;
    roles: RoleOption[];
    statusOptions: string[];
    onChange: (key: keyof UserFilters, value: string) => void;
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

export default function UserFiltersPanel({ filters, roles, statusOptions, onChange, onClear }: UserFiltersPanelProps) {
    const [expanded, setExpanded] = useState(false);

    const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
        if (['sort_by', 'sort_dir', 'per_page'].includes(key)) {
            return false;
        }

        return value && value !== 'all';
    }).length;

    const hasActiveFilters = activeFilterCount > 0;

    return (
        <div className="overflow-hidden rounded-xl border border-sidebar-border/70 bg-white shadow-sm dark:bg-sidebar-accent">
            <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-sidebar-foreground/40" />
                    <input
                        type="search"
                        value={filters.search ?? ''}
                        onChange={(event) => onChange('search', event.target.value)}
                        placeholder="Search name, email, or staff ID..."
                        className={cn(selectClass, 'pl-10')}
                    />
                </div>

                <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <select value={filters.role ?? 'all'} onChange={(event) => onChange('role', event.target.value)} className={selectClass}>
                        <option value="all">All Roles</option>
                        {roles.map((role) => (
                            <option key={role.id} value={role.name}>
                                {role.name}
                            </option>
                        ))}
                    </select>

                    <select value={filters.status ?? 'all'} onChange={(event) => onChange('status', event.target.value)} className={selectClass}>
                        <option value="all">All Statuses</option>
                        {statusOptions.map((status) => (
                            <option key={status} value={status}>
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                            </option>
                        ))}
                        <option value="locked">Locked</option>
                    </select>

                    <select
                        value={filters.password_status ?? 'all'}
                        onChange={(event) => onChange('password_status', event.target.value)}
                        className={selectClass}
                    >
                        <option value="all">All Password States</option>
                        <option value="reset_required">Reset Required</option>
                        <option value="current">Current</option>
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
                    <FilterSection title="Login Activity" icon={User}>
                        <select
                            value={filters.login_status ?? 'all'}
                            onChange={(event) => onChange('login_status', event.target.value)}
                            className={selectClass}
                        >
                            <option value="all">All Login Activity</option>
                            <option value="never">Never Logged In</option>
                            <option value="recent">Logged In (7 days)</option>
                        </select>
                    </FilterSection>

                    <FilterSection title="Created Date" icon={Calendar}>
                        <input
                            type="date"
                            value={filters.created_from ?? ''}
                            onChange={(event) => onChange('created_from', event.target.value)}
                            className={selectClass}
                        />
                        <input
                            type="date"
                            value={filters.created_to ?? ''}
                            onChange={(event) => onChange('created_to', event.target.value)}
                            className={selectClass}
                        />
                    </FilterSection>

                    <FilterSection title="Last Login" icon={Key}>
                        <input
                            type="date"
                            value={filters.last_login_from ?? ''}
                            onChange={(event) => onChange('last_login_from', event.target.value)}
                            className={selectClass}
                        />
                        <input
                            type="date"
                            value={filters.last_login_to ?? ''}
                            onChange={(event) => onChange('last_login_to', event.target.value)}
                            className={selectClass}
                        />
                    </FilterSection>

                    <FilterSection title="Security" icon={ShieldCheck}>
                        <div className="col-span-full flex flex-wrap items-center gap-2">
                            {hasActiveFilters && (
                                <Button type="button" variant="outline" size="sm" onClick={onClear}>
                                    <X className="size-4" />
                                    Clear Filters
                                </Button>
                            )}
                        </div>
                    </FilterSection>
                </div>
            )}

            {!expanded && hasActiveFilters && (
                <div className="border-t border-sidebar-border/60 px-4 py-3">
                    <Button type="button" variant="ghost" size="sm" onClick={onClear}>
                        <X className="size-4" />
                        Clear Filters
                    </Button>
                </div>
            )}
        </div>
    );
}
