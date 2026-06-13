import { CalendarDays, Clock3 } from 'lucide-react';

interface WelcomeHeaderProps {
    adminName: string;
    date: string;
    time: string;
    systemName: string;
}

export default function WelcomeHeader({ adminName, date, time, systemName }: WelcomeHeaderProps) {
    const firstName = adminName.split(' ')[0] || adminName;

    return (
        <section className="relative overflow-hidden rounded-2xl border border-sidebar-border/70 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 p-6 text-white shadow-sm sm:p-8">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
            <div className="absolute -top-16 -right-16 size-48 rounded-full bg-blue-500/20 blur-3xl" />

            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-3">
                    <p className="text-sm font-medium text-blue-200/80">{systemName}</p>
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Welcome back, {firstName}</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
                            Here&apos;s what&apos;s happening in your attendance system today.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                        <CalendarDays className="size-5 text-blue-200" aria-hidden="true" />
                        <div>
                            <p className="text-xs text-slate-300">Today</p>
                            <p className="text-sm font-medium">{date}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                        <Clock3 className="size-5 text-blue-200" aria-hidden="true" />
                        <div>
                            <p className="text-xs text-slate-300">Current time</p>
                            <p className="text-sm font-medium">{time}</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
