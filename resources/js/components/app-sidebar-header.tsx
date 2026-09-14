import { Breadcrumbs } from '@/components/breadcrumbs';
import { GlobalSearchDialog } from '@/components/global-search-dialog';
import NotificationBell from '@/components/notifications/NotificationBell';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { getUserDisplayName } from '@/components/user-info';
import { UserMenuContent } from '@/components/user-menu-content';
import { useInitials } from '@/hooks/use-initials';
import { useAppNavigation } from '@/lib/navigation';
import { type BreadcrumbItem as BreadcrumbItemType, type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import AppLogoIcon from './app-logo-icon';

export function AppSidebarHeader({ breadcrumbs = [] }: { breadcrumbs?: BreadcrumbItemType[] }) {
    const { auth } = usePage<SharedData>().props;
    const { homeHref, isTeacher } = useAppNavigation();
    const getInitials = useInitials();
    const displayName = getUserDisplayName(auth.user);

    return (
        <header className="sticky top-0 z-20 min-w-0 shrink-0 border-b border-sidebar-border/70 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
            <div className="flex h-14 min-w-0 items-center gap-2 px-3 sm:px-4">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    <SidebarTrigger className="size-11 shrink-0 md:size-8" />
                    <Link href={homeHref} prefetch className="shrink-0 md:hidden">
                        <span className="flex size-9 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-sidebar-border/60">
                            <AppLogoIcon className="size-8" />
                        </span>
                        <span className="sr-only">Home</span>
                    </Link>
                    {breadcrumbs.length > 0 ? (
                        <div className="hidden min-w-0 flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] md:block [&::-webkit-scrollbar]:hidden">
                            <Breadcrumbs breadcrumbs={breadcrumbs} />
                        </div>
                    ) : null}
                </div>

                <div className="ml-auto flex shrink-0 items-center gap-1">
                    <GlobalSearchDialog variant="header" />
                    {isTeacher ? <NotificationBell /> : null}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="size-11 rounded-full p-0.5 md:size-9">
                                <Avatar className="size-8 overflow-hidden rounded-full">
                                    <AvatarImage src={auth.user.avatar || ''} alt={displayName} />
                                    <AvatarFallback className="rounded-lg bg-neutral-200 text-black dark:bg-neutral-700 dark:text-white">
                                        {getInitials(displayName)}
                                    </AvatarFallback>
                                </Avatar>
                                <span className="sr-only">Account menu</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56" align="end" forceMount>
                            <UserMenuContent user={auth.user} />
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            {breadcrumbs.length > 0 ? (
                <div className="min-w-0 overflow-x-auto border-t border-sidebar-border/60 px-3 py-2 [-ms-overflow-style:none] [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
                    <Breadcrumbs breadcrumbs={breadcrumbs} />
                </div>
            ) : null}
        </header>
    );
}
