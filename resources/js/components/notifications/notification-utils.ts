import { type NotificationCategory, type NotificationPriority } from '@/components/notifications/types';
import { AlertTriangle, Bell, Calendar, CheckCircle, Clock, ShieldAlert, UserCog } from 'lucide-react';

export const categoryLabels: Record<string, string> = {
    attendance: 'Attendance',
    timetable: 'Timetable',
    system: 'System',
    administrative: 'Administrative',
};

export const priorityLabels: Record<string, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
};

export const priorityStyles: Record<string, string> = {
    critical: 'bg-red-100 text-red-700 ring-red-600/20 dark:bg-red-950/40 dark:text-red-300',
    high: 'bg-orange-100 text-orange-700 ring-orange-600/20 dark:bg-orange-950/40 dark:text-orange-300',
    medium: 'bg-blue-100 text-blue-700 ring-blue-600/20 dark:bg-blue-950/40 dark:text-blue-300',
    low: 'bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300',
};

export function getCategoryIcon(category?: string) {
    switch (category) {
        case 'attendance':
            return CheckCircle;
        case 'timetable':
            return Calendar;
        case 'administrative':
            return Bell;
        case 'system':
            return UserCog;
        default:
            return Clock;
    }
}

export function getPriorityIcon(priority?: NotificationPriority | string) {
    if (priority === 'critical' || priority === 'high') {
        return ShieldAlert;
    }

    if (priority === 'medium') {
        return AlertTriangle;
    }

    return Bell;
}

export function formatNotificationTime(value: string) {
    return new Date(value).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}
