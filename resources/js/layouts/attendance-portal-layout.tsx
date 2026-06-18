import AppLogoIcon from '@/components/app-logo-icon';
import { Link, router, usePage } from '@inertiajs/react';
import { Clock, LogOut } from 'lucide-react';
import { type PropsWithChildren, useEffect, useState } from 'react';

interface AttendancePortalShared {
    active?: boolean;
    name?: string;
    employee_id?: string;
    remaining_minutes?: number;
    timeout_minutes?: number;
}

export default function AttendancePortalLayout({ children }: PropsWithChildren) {
    const { attendancePortal, flash } = usePage().props as {
        attendancePortal?: AttendancePortalShared | null;
        flash?: { success?: string; error?: string };
    };

    const [remaining, setRemaining] = useState(attendancePortal?.remaining_minutes ?? 0);

    useEffect(() => {
        setRemaining(attendancePortal?.remaining_minutes ?? 0);
    }, [attendancePortal?.remaining_minutes]);

    useEffect(() => {
        if (!attendancePortal?.active) {
            return;
        }

        const interval = window.setInterval(() => {
            setRemaining((value) => Math.max(0, value - 1));
        }, 60000);

        return () => window.clearInterval(interval);
    }, [attendancePortal?.active]);

    const logout = () => {
        router.post(route('attendance.logout'));
    };

    return (
        <div className="min-h-dvh bg-slate-100 dark:bg-slate-950">
            <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
                <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 md:px-6">
                    <Link href={route('attendance.portal')} className="flex items-center gap-2">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
                            <AppLogoIcon className="size-6 rounded" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">Attendance Portal</p>
                            {attendancePortal?.name && (
                                <p className="text-xs text-slate-500">{attendancePortal.name}</p>
                            )}
                        </div>
                    </Link>

                    <div className="flex items-center gap-2">
                        {attendancePortal?.active && (
                            <span className="hidden items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 sm:inline-flex dark:bg-slate-800 dark:text-slate-300">
                                <Clock className="size-3.5" />
                                {remaining}m left
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={logout}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            <LogOut className="size-4" />
                            <span className="hidden sm:inline">Sign out</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-3xl px-4 py-5 md:px-6 md:py-8">
                {flash?.success && (
                    <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        {flash.success}
                    </div>
                )}
                {flash?.error && (
                    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                        {flash.error}
                    </div>
                )}
                {children}
            </main>
        </div>
    );
}
