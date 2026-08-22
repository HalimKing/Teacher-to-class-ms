import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { can } from '@/lib/can';
import { Link } from '@inertiajs/react';
import { ChevronDown, Download, FileSpreadsheet, FileText, Plus, Printer, RefreshCw, Users } from 'lucide-react';

interface UserPageHeaderProps {
    onRefresh: () => void;
    onExport: (format: 'excel' | 'csv' | 'pdf' | 'print') => void;
    onToggleBulk: () => void;
    bulkMode: boolean;
    refreshing?: boolean;
}

export default function UserPageHeader({ onRefresh, onExport, onToggleBulk, bulkMode, refreshing = false }: UserPageHeaderProps) {
    return (
        <div className="rounded-2xl border border-sidebar-border/70 bg-gradient-to-br from-white via-white to-primary/5 p-4 shadow-sm sm:p-6 dark:from-sidebar-accent dark:via-sidebar-accent dark:to-primary/10">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-3">
                    <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                        <Users className="size-3.5" />
                        Administration
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-sidebar-foreground sm:text-3xl">User Management</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-sidebar-foreground/70">
                            Manage admin accounts, roles, access status, password security, and account activity.
                        </p>
                    </div>
                </div>

                <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
                    <Button type="button" variant="outline" className="h-10 sm:h-9" onClick={onRefresh} disabled={refreshing}>
                        <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
                        {refreshing ? 'Refreshing...' : (
                            <>
                                <span className="sm:hidden">Refresh</span>
                                <span className="hidden sm:inline">Refresh Data</span>
                            </>
                        )}
                    </Button>
                    <Button type="button" variant={bulkMode ? 'secondary' : 'outline'} className="h-10 sm:h-9" onClick={onToggleBulk}>
                        {bulkMode ? (
                            <>
                                <span className="sm:hidden">Exit Bulk</span>
                                <span className="hidden sm:inline">Exit Bulk Actions</span>
                            </>
                        ) : (
                            'Bulk Actions'
                        )}
                    </Button>

                    {can('admin.user-management.users.export') && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button type="button" variant="outline" className="h-10 sm:h-9">
                                    <Download className="size-4" />
                                    <span className="sm:hidden">Export</span>
                                    <span className="hidden sm:inline">Export Users</span>
                                    <ChevronDown className="size-4 opacity-60" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => onExport('excel')}>
                                    <FileSpreadsheet className="size-4" />
                                    Excel Export
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onExport('csv')}>
                                    <FileText className="size-4" />
                                    CSV Export
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onExport('pdf')}>
                                    <Download className="size-4" />
                                    PDF Export
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onExport('print')}>
                                    <Printer className="size-4" />
                                    Print View
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}

                    {can('admin.user-management.users.create') && (
                        <Button asChild className="h-10 sm:h-9">
                            <Link href={route('admin.user-management.users.create')}>
                                <Plus className="size-4" />
                                Add User
                            </Link>
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
