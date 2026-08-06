import { usePage } from '@inertiajs/react';
import { type SharedData } from '@/types';
import AppLogoIcon from './app-logo-icon';

export default function AppLogo() {
    const { name } = usePage<SharedData>().props;

    return (
        <>
            <div className="flex aspect-square size-9 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-sidebar-border/60">
                <AppLogoIcon className="size-8" />
            </div>
            <div className="ml-2 grid flex-1 text-left text-sm">
                <span className="truncate leading-tight font-semibold text-sidebar-foreground">
                    {name || 'UBIDS ATTENDANCE'}
                </span>
            </div>
        </>
    );
}
