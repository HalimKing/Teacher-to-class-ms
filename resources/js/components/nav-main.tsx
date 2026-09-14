import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    useSidebar,
} from '@/components/ui/sidebar';
import { isNavItemActive, useAppNavigation } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { type NavGroup, type NavItem } from '@/types';
import { Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';

function UnreadBadge({ count }: { count: number }) {
    if (count <= 0) {
        return null;
    }

    return (
        <SidebarMenuBadge className="rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
            {count > 99 ? '99+' : count}
        </SidebarMenuBadge>
    );
}

function NavLinkItem({
    item,
    currentUrl,
    unreadCount,
    onNavigate,
}: {
    item: NavItem;
    currentUrl: string;
    unreadCount: number;
    onNavigate: () => void;
}) {
    const active = isNavItemActive(item, currentUrl);

    return (
        <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={active} tooltip={item.title} className="min-h-10 md:min-h-8">
                <Link href={item.href} prefetch onClick={onNavigate}>
                    {item.icon ? <item.icon /> : null}
                    <span>{item.title}</span>
                </Link>
            </SidebarMenuButton>
            {item.badge === 'unread' ? <UnreadBadge count={unreadCount} /> : null}
        </SidebarMenuItem>
    );
}

function NavCollapsibleItem({
    item,
    currentUrl,
    unreadCount,
    onNavigate,
}: {
    item: NavItem;
    currentUrl: string;
    unreadCount: number;
    onNavigate: () => void;
}) {
    const { state, isMobile } = useSidebar();
    const active = isNavItemActive(item, currentUrl);
    const [open, setOpen] = useState(active);
    const collapsed = state === 'collapsed' && !isMobile;

    useEffect(() => {
        setOpen(active);
    }, [active, currentUrl]);

    if (collapsed) {
        return <NavLinkItem item={item} currentUrl={currentUrl} unreadCount={unreadCount} onNavigate={onNavigate} />;
    }

    return (
        <Collapsible open={open} onOpenChange={setOpen} className="group/collapsible">
            <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                        isActive={active}
                        tooltip={item.title}
                        className={cn('min-h-10 md:min-h-8', !active && 'data-[state=open]:bg-transparent')}
                    >
                        {item.icon ? <item.icon /> : null}
                        <span>{item.title}</span>
                        {item.badge === 'unread' && unreadCount > 0 ? (
                            <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        ) : null}
                        <ChevronRight className={cn('size-4 transition-transform', item.badge !== 'unread' && 'ml-auto', open && 'rotate-90')} />
                    </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <SidebarMenuSub>
                        {item.subItems?.map((subItem) => {
                            const subActive = isNavItemActive(subItem, currentUrl);

                            return (
                                <SidebarMenuSubItem key={`${subItem.title}-${subItem.href}`}>
                                    <SidebarMenuSubButton asChild isActive={subActive} className="min-h-10 md:min-h-7">
                                        <Link href={subItem.href} prefetch onClick={onNavigate}>
                                            <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                                                <span className="truncate">{subItem.title}</span>
                                                {subItem.badge === 'unread' && unreadCount > 0 ? (
                                                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                                                        {unreadCount > 99 ? '99+' : unreadCount}
                                                    </span>
                                                ) : null}
                                            </span>
                                        </Link>
                                    </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                            );
                        })}
                    </SidebarMenuSub>
                </CollapsibleContent>
            </SidebarMenuItem>
        </Collapsible>
    );
}

function NavGroupSection({
    group,
    currentUrl,
    unreadCount,
    onNavigate,
}: {
    group: NavGroup;
    currentUrl: string;
    unreadCount: number;
    onNavigate: () => void;
}) {
    const { state, isMobile } = useSidebar();
    const hasActive = group.items.some((item) => isNavItemActive(item, currentUrl));
    const [open, setOpen] = useState(hasActive);
    const iconCollapsed = state === 'collapsed' && !isMobile;
    const canCollapse = group.items.length > 1 && !iconCollapsed;

    useEffect(() => {
        setOpen(hasActive);
    }, [hasActive, currentUrl]);

    const items = (
        <SidebarGroupContent>
            <SidebarMenu>
                {group.items.map((item) =>
                    item.subItems && item.subItems.length > 0 ? (
                        <NavCollapsibleItem
                            key={`${item.title}-${item.href}`}
                            item={item}
                            currentUrl={currentUrl}
                            unreadCount={unreadCount}
                            onNavigate={onNavigate}
                        />
                    ) : (
                        <NavLinkItem
                            key={`${item.title}-${item.href}`}
                            item={item}
                            currentUrl={currentUrl}
                            unreadCount={unreadCount}
                            onNavigate={onNavigate}
                        />
                    ),
                )}
            </SidebarMenu>
        </SidebarGroupContent>
    );

    if (!canCollapse) {
        return (
            <SidebarGroup className="px-2 py-1">
                <SidebarGroupLabel className="text-[11px] font-semibold tracking-[0.14em] uppercase">{group.title}</SidebarGroupLabel>
                {items}
            </SidebarGroup>
        );
    }

    return (
        <Collapsible open={open} onOpenChange={setOpen}>
            <SidebarGroup className="px-2 py-1">
                <SidebarGroupLabel asChild>
                    <CollapsibleTrigger className="flex min-h-8 w-full cursor-pointer items-center rounded-md px-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                        <span className="text-[11px] font-semibold tracking-[0.14em] uppercase">{group.title}</span>
                        <ChevronRight className={cn('ml-auto size-3.5 transition-transform', open && 'rotate-90')} />
                    </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>{items}</CollapsibleContent>
            </SidebarGroup>
        </Collapsible>
    );
}

export function NavMain() {
    const { groups, currentUrl, unreadConversationsCount } = useAppNavigation();
    const { isMobile, setOpenMobile } = useSidebar();

    const onNavigate = () => {
        if (isMobile) {
            setOpenMobile(false);
        }
    };

    return (
        <>
            {groups.map((group) => (
                <NavGroupSection
                    key={group.title}
                    group={group}
                    currentUrl={currentUrl}
                    unreadCount={unreadConversationsCount}
                    onNavigate={onNavigate}
                />
            ))}
        </>
    );
}
