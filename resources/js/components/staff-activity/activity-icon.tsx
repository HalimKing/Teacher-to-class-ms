import { cn } from '@/lib/utils';
import {
    Activity,
    CalendarDays,
    CheckCircle2,
    ClipboardList,
    FileText,
    KeyRound,
    LifeBuoy,
    LogIn,
    LogOut,
    Mail,
    MapPin,
    ShieldCheck,
    TriangleAlert,
    UserMinus,
    Users,
    XCircle,
} from 'lucide-react';
import type { StaffActivityIcon } from './types';

const iconMap: Record<StaffActivityIcon, typeof Activity> = {
    login: LogIn,
    logout: LogOut,
    'check-in': CheckCircle2,
    'check-out': LogOut,
    warning: TriangleAlert,
    shield: ShieldCheck,
    location: MapPin,
    absence: UserMinus,
    explanation: ClipboardList,
    approve: CheckCircle2,
    reject: XCircle,
    help: LifeBuoy,
    document: FileText,
    message: Mail,
    password: KeyRound,
    reminder: CalendarDays,
    calendar: CalendarDays,
    users: Users,
    activity: Activity,
};

const toneMap: Record<StaffActivityIcon, string> = {
    login: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200',
    logout: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    'check-in': 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200',
    'check-out': 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-200',
    warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200',
    shield: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-200',
    location: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-200',
    absence: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200',
    explanation: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200',
    approve: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200',
    reject: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200',
    help: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200',
    document: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    message: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200',
    password: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    reminder: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200',
    calendar: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200',
    users: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-200',
    activity: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
};

export function StaffActivityIconBadge({
    icon,
    className,
    iconClassName,
}: {
    icon: StaffActivityIcon | string;
    className?: string;
    iconClassName?: string;
}) {
    const key = (icon in iconMap ? icon : 'activity') as StaffActivityIcon;
    const Icon = iconMap[key];

    return (
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-2xl', toneMap[key], className)}>
            <Icon className={cn('size-5', iconClassName)} />
        </span>
    );
}
