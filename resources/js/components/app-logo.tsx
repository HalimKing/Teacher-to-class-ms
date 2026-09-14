import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import AppLogoIcon from './app-logo-icon';

export default function AppLogo() {
    const { name } = usePage<SharedData>().props;

    return (
        <div className="flex min-w-0 items-center gap-2">
            <div className="flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-sidebar-border/60">
                <AppLogoIcon className="size-7" />
            </div>
            <div className="grid min-w-0 flex-1 text-left text-sm group-data-[collapsible=icon]:hidden">
                <span className="truncate leading-tight font-semibold text-sidebar-foreground">{name || 'UBIDS ATTENDANCE'}</span>
                <span className="truncate text-[11px] leading-tight text-sidebar-foreground/60">Attendance</span>
            </div>
        </div>
    );
}
