import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';

interface RowActionsMenuProps {
    children: ReactNode;
    label?: string;
}

export default function RowActionsMenu({ children, label = 'Open actions' }: RowActionsMenuProps) {
    return (
        <div className="flex justify-end">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="size-10 lg:size-9" aria-label={label}>
                        <MoreHorizontal className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">{children}</DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
