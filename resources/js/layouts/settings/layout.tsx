import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { type NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { Palette, Shield, UserRound } from 'lucide-react';
import { type PropsWithChildren } from 'react';

const sidebarNavItems: NavItem[] = [
    {
        title: 'Profile',
        href: '/settings/profile',
        icon: UserRound,
    },
    {
        title: 'Password',
        href: '/settings/password',
        icon: Shield,
    },
    {
        title: 'Appearance',
        href: '/settings/appearance',
        icon: Palette,
    },
];

export default function SettingsLayout({ children }: PropsWithChildren) {
    const { url } = usePage();

    return (
        <div className="px-4 py-6 md:px-6 lg:px-8">
            <Heading title="Settings" description="Manage your profile, security, and appearance preferences" />

            <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
                <aside className="w-full lg:w-56 lg:shrink-0">
                    <nav className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
                        {sidebarNavItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = url.startsWith(item.href);

                            return (
                                <Button
                                    key={item.href}
                                    size="sm"
                                    variant="ghost"
                                    asChild
                                    className={cn(
                                        'h-10 shrink-0 justify-start px-3 lg:w-full',
                                        isActive && 'bg-sidebar-accent text-sidebar-foreground shadow-sm',
                                    )}
                                >
                                    <Link href={item.href} prefetch>
                                        {Icon ? <Icon className="mr-2 size-4" /> : null}
                                        {item.title}
                                    </Link>
                                </Button>
                            );
                        })}
                    </nav>
                </aside>

                <Separator className="lg:hidden" />

                <div className="min-w-0 flex-1">
                    <section className="mx-auto max-w-3xl space-y-6">{children}</section>
                </div>
            </div>
        </div>
    );
}
