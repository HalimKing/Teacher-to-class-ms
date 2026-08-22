import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { can } from '@/lib/can';
import { Download, Key, Trash2, UserCheck, UserX } from 'lucide-react';

interface UserBulkActionsBarProps {
    selectedCount: number;
    onExportSelected: (format: 'excel' | 'csv' | 'pdf') => void;
    onClearSelection: () => void;
    onSetStatus: (status: 'active' | 'inactive' | 'suspended') => void;
    onRequirePasswordChange: () => void;
    onDeleteSelected: () => void;
}

export default function UserBulkActionsBar({
    selectedCount,
    onExportSelected,
    onClearSelection,
    onSetStatus,
    onRequirePasswordChange,
    onDeleteSelected,
}: UserBulkActionsBarProps) {
    if (selectedCount === 0) {
        return null;
    }

    return (
        <div className="sticky top-16 z-10 flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3 shadow-sm backdrop-blur-sm sm:top-4 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
                <p className="text-sm font-semibold text-sidebar-foreground">
                    {selectedCount} user{selectedCount === 1 ? '' : 's'} selected
                </p>
                <p className="text-xs text-sidebar-foreground/60">Bulk actions apply only to selected records.</p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                {can('admin.user-management.users.export') && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button type="button" variant="outline" className="h-10 sm:h-9">
                                <Download className="size-4" />
                                <span className="sm:hidden">Export</span>
                                <span className="hidden sm:inline">Export Selected</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onExportSelected('excel')}>Excel</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onExportSelected('csv')}>CSV</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onExportSelected('pdf')}>PDF</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}

                {can('admin.user-management.users.edit') && (
                    <>
                        <Button type="button" variant="outline" className="h-10 sm:h-9" onClick={() => onSetStatus('active')}>
                            <UserCheck className="size-4" />
                            Activate
                        </Button>
                        <Button type="button" variant="outline" className="h-10 sm:h-9" onClick={() => onSetStatus('inactive')}>
                            <UserX className="size-4" />
                            Deactivate
                        </Button>
                        <Button type="button" variant="outline" className="h-10 col-span-2 sm:col-auto sm:h-9" onClick={onRequirePasswordChange}>
                            <Key className="size-4" />
                            Require Password Change
                        </Button>
                    </>
                )}

                {can('admin.user-management.users.delete') && (
                    <Button type="button" variant="destructive" className="h-10 sm:h-9" onClick={onDeleteSelected}>
                        <Trash2 className="size-4" />
                        <span className="sm:hidden">Delete</span>
                        <span className="hidden sm:inline">Delete Selected</span>
                    </Button>
                )}

                <Button type="button" variant="ghost" className="h-10 sm:h-9" onClick={onClearSelection}>
                    Clear
                </Button>
            </div>
        </div>
    );
}
