import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { can } from '@/lib/can';
import { Download, Mail, MoreHorizontal, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import { toast } from 'react-toastify';

interface TeacherBulkActionsBarProps {
    selectedCount: number;
    onExportSelected: (format: 'excel' | 'csv' | 'pdf') => void;
    onClearSelection: () => void;
    onFaceEnrollmentReminder: () => void;
}

export default function TeacherBulkActionsBar({
    selectedCount,
    onExportSelected,
    onClearSelection,
    onFaceEnrollmentReminder,
}: TeacherBulkActionsBarProps) {
    if (selectedCount === 0) {
        return null;
    }

    return (
        <div className="sticky top-4 z-10 flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
                <p className="text-sm font-semibold text-sidebar-foreground">
                    {selectedCount} teacher{selectedCount === 1 ? '' : 's'} selected
                </p>
                <p className="text-xs text-sidebar-foreground/60">Bulk actions apply only to selected records.</p>
            </div>

            <div className="flex flex-wrap gap-2">
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

                {can('admin.teachers.edit') && (
                    <>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                toast.info('Assign timetables from School Management → Timetables for the selected teachers.', {
                                    theme: 'dark',
                                })
                            }
                        >
                            <UserCheck className="size-4" />
                            Assign Timetables
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={onFaceEnrollmentReminder}>
                            <ShieldCheck className="size-4" />
                            Enrollment Reminder
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                toast.info('Account activation follows timetable assignment in this system.', { theme: 'dark' })
                            }
                        >
                            <UserCheck className="size-4" />
                            Activate
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                toast.info('Account deactivation requires removing timetable assignments first.', { theme: 'dark' })
                            }
                        >
                            <UserX className="size-4" />
                            Deactivate
                        </Button>
                    </>
                )}

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button type="button" variant="outline" size="sm">
                            <MoreHorizontal className="size-4" />
                            More
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem
                            onClick={() =>
                                toast.info('Notification delivery is not configured yet for bulk teacher alerts.', { theme: 'dark' })
                            }
                        >
                            <Mail className="size-4" />
                            Send Notifications
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <Button type="button" variant="ghost" size="sm" onClick={onClearSelection}>
                    Clear Selection
                </Button>
            </div>
        </div>
    );
}
