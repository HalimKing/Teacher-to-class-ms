import AppLogoIcon from '@/components/app-logo-icon';
import AppearanceToggleDropdown from '@/components/appearance-dropdown';
import { type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { CalendarCheck, MapPin, ShieldCheck } from 'lucide-react';
import { type PropsWithChildren } from 'react';

interface AuthLayoutProps {
    title?: string;
    description?: string;
}

const highlights = [
    {
        icon: CalendarCheck,
        title: 'Attendance tracking',
        description: 'Monitor teacher and staff check-ins in real time.',
    },
    {
        icon: MapPin,
        title: 'Location verification',
        description: 'GPS-backed attendance for accurate on-site records.',
    },
    {
        icon: ShieldCheck,
        title: 'Secure access',
        description: 'Role-based dashboards for administrators and teachers.',
    },
];

export default function AuthSplitLayout({ children, title, description }: PropsWithChildren<AuthLayoutProps>) {
    const { name, quote } = usePage<SharedData>().props;

    return (
        <div className="relative min-h-dvh bg-background">
            <div className="absolute top-4 right-4 z-30 lg:top-6 lg:right-6">
                <AppearanceToggleDropdown />
            </div>

            <div className="grid min-h-dvh lg:grid-cols-2">
                {/* Branding panel */}
                <div className="relative hidden overflow-hidden lg:flex lg:flex-col">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950" />
                    <div
                        className="absolute inset-0 opacity-[0.08]"
                        style={{
                            backgroundImage:
                                'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                            backgroundSize: '28px 28px',
                        }}
                    />
                    <div className="absolute -top-24 -right-24 size-72 rounded-full bg-blue-500/20 blur-3xl" />
                    <div className="absolute bottom-0 left-0 size-96 rounded-full bg-indigo-500/10 blur-3xl" />

                    <div className="relative z-10 flex h-full flex-col p-10 xl:p-14">
                        <Link
                            href={route('home')}
                            className="inline-flex w-fit items-center gap-3 rounded-lg text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                        >
                            <div className="flex size-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur-sm">
                                <AppLogoIcon className="size-8 rounded-md" />
                            </div>
                            <span className="text-lg font-semibold tracking-tight">{name}</span>
                        </Link>

                        <div className="my-auto max-w-lg space-y-8 py-12">
                            <div className="space-y-4">
                                <p className="text-sm font-medium tracking-wide text-blue-200/80 uppercase">
                                    Welcome back
                                </p>
                                <h2 className="text-3xl leading-tight font-semibold tracking-tight text-white xl:text-4xl">
                                    Manage attendance with confidence
                                </h2>
                                <p className="text-base leading-relaxed text-blue-100/80">
                                    Sign in to access your dashboard, track attendance, and stay on top of daily operations.
                                </p>
                            </div>

                            <ul className="space-y-4">
                                {highlights.map(({ icon: Icon, title: itemTitle, description: itemDescription }) => (
                                    <li
                                        key={itemTitle}
                                        className="flex gap-4 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-colors hover:bg-white/10"
                                    >
                                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-blue-100">
                                            <Icon className="size-5" aria-hidden="true" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-white">{itemTitle}</p>
                                            <p className="mt-0.5 text-sm text-blue-100/70">{itemDescription}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {quote && (
                            <blockquote className="relative z-10 border-t border-white/10 pt-8">
                                <p className="text-base leading-relaxed text-blue-50/90">&ldquo;{quote.message}&rdquo;</p>
                                <footer className="mt-3 text-sm text-blue-200/70">{quote.author}</footer>
                            </blockquote>
                        )}
                    </div>
                </div>

                {/* Form panel */}
                <div className="flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-16 xl:px-20">
                    <div className="mx-auto w-full max-w-[420px]">
                        <Link
                            href={route('home')}
                            className="mb-8 inline-flex items-center gap-3 lg:hidden"
                        >
                            <div className="flex size-10 items-center justify-center rounded-xl bg-muted ring-1 ring-border">
                                <AppLogoIcon className="size-7 rounded-md" />
                            </div>
                            <span className="text-base font-semibold tracking-tight">{name}</span>
                        </Link>

                        <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm sm:p-8 dark:shadow-none dark:ring-1 dark:ring-border/40">
                            <header className="mb-8 space-y-2">
                                <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
                                <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
                            </header>

                            {children}
                        </div>

                        <p className="mt-8 text-center text-xs text-muted-foreground">
                            &copy; {new Date().getFullYear()} {name}. All rights reserved.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
