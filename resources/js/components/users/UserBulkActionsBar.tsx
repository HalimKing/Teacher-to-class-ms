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
        <div className="sticky top-4 z-10 flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
                <p className="text-sm font-semibold text-sidebar-foreground">
                    {selectedCount} user{selectedCount === 1 ? '' : 's'} selected
                </p>
                <p className="text-xs text-sidebar-foreground/60">Bulk actions apply only to selected records.</p>
            </div>

            <div className="flex flex-wrap gap-2">
                {can('admin.user-management.users.export') && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button type="button" variant="outline" size="sm">
                                <Download className="size-4" />
                                Export Selected
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
                        <Button type="button" variant="outline" size="sm" onClick={() => onSetStatus('active')}>
                            <UserCheck className="size-4" />
                            Activate
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => onSetStatus('inactive')}>
                            <UserX className="size-4" />
                            Deactivate
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={onRequirePasswordChange}>
                            <Key className="size-4" />
                            Require Password Change
                        </Button>
                    </>
                )}

                {can('admin.user-management.users.delete') && (
                    <Button type="button" variant="destructive" size="sm" onClick={onDeleteSelected}>
                        <Trash2 className="size-4" />
                        Delete Selected
                    </Button>
                )}

                <Button type="button" variant="ghost" size="sm" onClick={onClearSelection}>
                    Clear
                </Button>
            </div>
        </div>
    );
}
