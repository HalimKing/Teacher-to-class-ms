import { SidebarProvider } from '@/components/ui/sidebar';
import { SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import type { CSSProperties } from 'react';

interface AppShellProps {
    children: React.ReactNode;
    variant?: 'header' | 'sidebar';
}

export function AppShell({ children, variant = 'header' }: AppShellProps) {
    const isOpen = usePage<SharedData>().props.sidebarOpen;

    if (variant === 'header') {
        return <div className="flex min-h-screen w-full min-w-0 flex-col overflow-x-hidden">{children}</div>;
    }

    return (
        <SidebarProvider defaultOpen={isOpen} className="min-w-0 overflow-x-hidden" style={{ '--sidebar-width': '18rem' } as CSSProperties}>
            {children}
        </SidebarProvider>
    );
}
