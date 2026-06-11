import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { CalendarCheck, ShieldCheck, UserCheck } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/teacher/dashboard',
    },
    {
        title: 'Staff Attendance',
        href: '/teacher/staff-attendance',
    },
];

interface StaffMember {
    name: string;
    email: string;
    staff_type: string;
    faculty?: string | null;
    department?: string | null;
}

export default function StaffAttendancePage({ staffMember }: { staffMember: StaffMember }) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Staff Attendance" />

            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-4 md:p-6">
                <div className="rounded-2xl border border-sidebar-border/70 bg-white p-6 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1 text-sm font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                <ShieldCheck className="h-4 w-4" />
                                Administrative Staff
                            </div>
                            <h1 className="text-2xl font-bold text-sidebar-foreground dark:text-sidebar-foreground">Staff Attendance</h1>
                            <p className="mt-2 max-w-2xl text-sm text-sidebar-foreground/70 dark:text-sidebar-foreground/70">
                                This area is reserved for administrator staff attendance. Lecturer class attendance features are hidden for your staff type.
                            </p>
                        </div>
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                            <UserCheck className="h-7 w-7" />
                        </div>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    <div className="rounded-xl border border-sidebar-border/70 bg-white p-5 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent lg:col-span-2">
                        <h2 className="mb-4 text-lg font-semibold text-sidebar-foreground dark:text-sidebar-foreground">Staff Profile</h2>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <InfoItem label="Name" value={staffMember.name} />
                            <InfoItem label="Email" value={staffMember.email} />
                            <InfoItem label="Staff Type" value={formatStaffType(staffMember.staff_type)} />
                            <InfoItem label="Faculty" value={staffMember.faculty || 'Not assigned'} />
                            <InfoItem label="Department" value={staffMember.department || 'Not assigned'} />
                        </div>
                    </div>

                    <div className="rounded-xl border border-sidebar-border/70 bg-white p-5 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                <CalendarCheck className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-sidebar-foreground dark:text-sidebar-foreground">Attendance Status</h2>
                                <p className="text-sm text-sidebar-foreground/60 dark:text-sidebar-foreground/60">Staff attendance workflow</p>
                            </div>
                        </div>
                        <p className="text-sm text-sidebar-foreground/70 dark:text-sidebar-foreground/70">
                            Your account is configured for staff attendance visibility. Class/course attendance check-in is intentionally unavailable.
                        </p>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

function InfoItem({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/50 dark:text-sidebar-foreground/50">{label}</p>
            <p className="mt-1 font-medium text-sidebar-foreground dark:text-sidebar-foreground">{value}</p>
        </div>
    );
}

function formatStaffType(staffType: string) {
    return staffType
        .replace('_', ' ')
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}
