import AttendancePortalLayout from '@/layouts/attendance-portal-layout';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowRight, CheckCircle, Clock, LogIn, RefreshCw, User } from 'lucide-react';

interface PortalProfile {
    name: string;
    employee_id: string;
    staff_type: string;
    role_label: string;
    department?: string | null;
    faculty?: string | null;
}

interface AttendanceSummary {
    sessions_today: number;
    checked_in: boolean;
    completed: number;
    status_label: string;
    check_in_time?: string | null;
    check_out_time?: string | null;
}

interface PortalPageProps {
    profile: PortalProfile;
    attendanceSummary: AttendanceSummary;
}

export default function AttendancePortalDashboardPage({ profile, attendanceSummary }: PortalPageProps) {
    const refreshSession = () => {
        router.post(route('attendance.refresh'));
    };

    return (
        <AttendancePortalLayout>
            <Head title="Attendance Portal" />

            <div className="space-y-5">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-emerald-100 p-3 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            <User className="size-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{profile.name}</h1>
                            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                                <div>
                                    <dt className="text-slate-500">Staff ID</dt>
                                    <dd className="font-medium text-slate-900 dark:text-white">{profile.employee_id}</dd>
                                </div>
                                <div>
                                    <dt className="text-slate-500">Role</dt>
                                    <dd className="font-medium text-slate-900 dark:text-white">{profile.role_label}</dd>
                                </div>
                                {profile.department && (
                                    <div className="sm:col-span-2">
                                        <dt className="text-slate-500">Department</dt>
                                        <dd className="font-medium text-slate-900 dark:text-white">{profile.department}</dd>
                                    </div>
                                )}
                            </dl>
                        </div>
                    </div>
                </section>

                <section
                    className={`rounded-2xl border p-5 shadow-sm ${
                        attendanceSummary.checked_in
                            ? 'border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/20'
                            : attendanceSummary.completed > 0
                              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20'
                              : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                    }`}
                >
                    <div className="flex items-start gap-3">
                        {attendanceSummary.checked_in ? (
                            <LogIn className="mt-0.5 size-6 text-blue-600" />
                        ) : attendanceSummary.completed > 0 ? (
                            <CheckCircle className="mt-0.5 size-6 text-emerald-600" />
                        ) : (
                            <Clock className="mt-0.5 size-6 text-slate-500" />
                        )}
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Today&apos;s attendance</h2>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{attendanceSummary.status_label}</p>
                            {attendanceSummary.check_in_time && (
                                <p className="mt-2 text-sm text-slate-500">
                                    Check-in: {attendanceSummary.check_in_time}
                                    {attendanceSummary.check_out_time ? ` · Check-out: ${attendanceSummary.check_out_time}` : ''}
                                </p>
                            )}
                        </div>
                    </div>
                </section>

                <section className="space-y-3">
                    <Link
                        href={route('attendance.mark')}
                        className="flex w-full items-center justify-between rounded-2xl bg-emerald-600 px-5 py-5 text-white shadow-lg shadow-emerald-600/20 transition-colors hover:bg-emerald-700"
                    >
                        <div>
                            <p className="text-lg font-semibold">Mark attendance</p>
                            <p className="text-sm text-emerald-100">Check in or check out for today</p>
                        </div>
                        <ArrowRight className="size-6 shrink-0" />
                    </Link>

                    <button
                        type="button"
                        onClick={refreshSession}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                        <RefreshCw className="size-4" />
                        Refresh session
                    </button>
                </section>
            </div>
        </AttendancePortalLayout>
    );
}
