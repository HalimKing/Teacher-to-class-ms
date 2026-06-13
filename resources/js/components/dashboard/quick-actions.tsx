import { can } from '@/lib/can';
import { Link } from '@inertiajs/react';
import {
    ArrowRight,
    BarChart3,
    Calendar,
    ClipboardList,
    Settings,
    UserCog,
    Users,
} from 'lucide-react';

interface QuickAction {
    title: string;
    description: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    permission?: string;
    accent: string;
}

const actions: QuickAction[] = [
    {
        title: 'Teacher Attendance',
        description: 'View lecturer attendance records and analytics.',
        href: '/admin/attendance',
        icon: ClipboardList,
        permission: 'admin.attendance.view',
        accent: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
    },
    {
        title: 'Manage Teachers',
        description: 'Add, edit, and manage lecturer profiles.',
        href: '/admin/teachers',
        icon: Users,
        permission: 'admin.teachers.view',
        accent: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
    },
    {
        title: 'Manage Administrators',
        description: 'Manage administrative staff accounts.',
        href: '/admin/teachers?staff_type=administrator',
        icon: UserCog,
        permission: 'admin.teachers.view',
        accent: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400',
    },
    {
        title: 'Manage Timetables',
        description: 'Configure class and work schedules.',
        href: '/admin/academics/time-tables',
        icon: Calendar,
        permission: 'admin.academics.view',
        accent: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
    },
    {
        title: 'Staff Attendance Reports',
        description: 'Track administrator attendance and verification.',
        href: '/admin/settings-reports/staff-attendance-reports',
        icon: BarChart3,
        permission: 'admin.staff-attendance.view',
        accent: 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400',
    },
    {
        title: 'System Settings',
        description: 'Configure attendance rules and system options.',
        href: '/admin/settings-reports/settings',
        icon: Settings,
        permission: 'admin.settings.view',
        accent: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    },
];

export default function QuickActions() {
    const visibleActions = actions.filter((action) => !action.permission || can(action.permission));

    if (visibleActions.length === 0) return null;

    return (
        <section>
            <div className="mb-4">
                <h2 className="text-lg font-semibold text-sidebar-foreground">Quick Actions</h2>
                <p className="text-sm text-sidebar-foreground/60">Jump to common administrative tasks</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visibleActions.map((action) => {
                    const Icon = action.icon;

                    return (
                        <Link
                            key={action.title}
                            href={action.href}
                            className="group rounded-xl border border-sidebar-border/70 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md dark:border-sidebar-border dark:bg-sidebar-accent"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className={`mb-3 inline-flex rounded-lg p-2.5 ${action.accent}`}>
                                        <Icon className="size-5" aria-hidden="true" />
                                    </div>
                                    <h3 className="font-semibold text-sidebar-foreground">{action.title}</h3>
                                    <p className="mt-1 text-sm text-sidebar-foreground/60">{action.description}</p>
                                </div>
                                <ArrowRight className="size-5 shrink-0 text-sidebar-foreground/30 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                            </div>
                        </Link>
                    );
                })}
            </div>
        </section>
    );
}
