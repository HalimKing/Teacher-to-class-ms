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

const navDescriptions: Record<string, string> = {
    '/settings/profile': 'Your details',
    '/settings/password': 'Sign-in security',
    '/settings/appearance': 'Theme and display',
};

export default function SettingsLayout({ children }: PropsWithChildren) {
    const { url } = usePage();

    return (
        <div className="min-h-full bg-gradient-to-b from-sky-50/80 via-slate-50 to-slate-50 dark:from-sky-950/20 dark:via-background dark:to-background">
            <div className="mx-auto w-full max-w-6xl min-w-0 p-3 pb-10 sm:p-4 md:p-6 lg:p-8">
                <div className="mb-6">
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-sidebar-foreground">Settings</h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-sidebar-foreground/60">
                        Manage your profile, security, and appearance preferences.
                    </p>
                </div>

                <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
                    <aside className="w-full lg:w-64 lg:shrink-0">
                        <nav className="flex gap-2 overflow-x-auto pb-1 lg:sticky lg:top-6 lg:flex-col lg:overflow-visible lg:pb-0">
                            {sidebarNavItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = url.startsWith(item.href);

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        prefetch
                                        className={cn(
                                            'flex min-h-12 shrink-0 items-center gap-3 rounded-2xl border px-3 py-2 transition-colors',
                                            isActive
                                                ? 'border-sky-200 bg-white text-slate-900 shadow-sm dark:border-sky-900/50 dark:bg-card dark:text-sidebar-foreground'
                                                : 'border-transparent text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-sidebar-foreground/70 dark:hover:bg-card/60',
                                        )}
                                    >
                                        {Icon ? (
                                            <span
                                                className={cn(
                                                    'flex size-9 shrink-0 items-center justify-center rounded-xl',
                                                    isActive
                                                        ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-200'
                                                        : 'bg-slate-100 text-slate-500 dark:bg-sidebar-accent dark:text-sidebar-foreground/60',
                                                )}
                                            >
                                                <Icon className="size-4" />
                                            </span>
                                        ) : null}
                                        <span className="min-w-0">
                                            <span className="block text-sm font-medium">{item.title}</span>
                                            <span className="hidden text-xs text-slate-500 lg:block dark:text-sidebar-foreground/50">
                                                {navDescriptions[item.href]}
                                            </span>
                                        </span>
                                    </Link>
                                );
                            })}
                        </nav>
                    </aside>

                    <div className="min-w-0 flex-1">
                        <section className="mx-auto max-w-3xl space-y-6">{children}</section>
                    </div>
                </div>
            </div>
        </div>
    );
}
