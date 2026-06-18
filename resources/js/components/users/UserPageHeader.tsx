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
        <div className="rounded-2xl border border-sidebar-border/70 bg-gradient-to-br from-white via-white to-primary/5 p-6 shadow-sm dark:from-sidebar-accent dark:via-sidebar-accent dark:to-primary/10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                        <Users className="size-3.5" />
                        Administration
                    </div>
                    <div>
                        <h1 className="text-3xl font-semibold tracking-tight text-sidebar-foreground">User Management</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-sidebar-foreground/70">
                            Manage admin accounts, roles, access status, password security, and account activity.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
                        <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
                        {refreshing ? 'Refreshing...' : 'Refresh Data'}
                    </Button>
                    <Button type="button" variant={bulkMode ? 'secondary' : 'outline'} size="sm" onClick={onToggleBulk}>
                        {bulkMode ? 'Exit Bulk Actions' : 'Bulk Actions'}
                    </Button>

                    {can('admin.user-management.users.export') && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button type="button" variant="outline" size="sm">
                                    <Download className="size-4" />
                                    Export Users
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
                        <Button asChild size="sm">
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
