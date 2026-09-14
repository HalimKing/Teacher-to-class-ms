import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from '@/components/ui/sidebar';
import { useAppNavigation } from '@/lib/navigation';
import { Link } from '@inertiajs/react';
import AppLogo from './app-logo';

export function AppSidebar() {
    const { homeHref, leadership } = useAppNavigation();

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader className="border-b border-sidebar-border/60">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={homeHref} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
                {leadership?.role_label ? (
                    <div className="px-2 pb-2 group-data-[collapsible=icon]:hidden">
                        <p className="truncate rounded-md bg-sidebar-accent px-2 py-1 text-[11px] font-medium text-sidebar-accent-foreground">
                            {leadership.role_label}
                            {leadership.department_name || leadership.faculty_name
                                ? ` · ${leadership.department_name || leadership.faculty_name}`
                                : ''}
                        </p>
                    </div>
                ) : null}
            </SidebarHeader>

            <SidebarContent className="gap-0">
                <NavMain />
            </SidebarContent>

            <SidebarFooter className="border-t border-sidebar-border/60">
                <NavUser />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}
