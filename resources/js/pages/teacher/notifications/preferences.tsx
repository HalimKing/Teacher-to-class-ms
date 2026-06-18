import { type NotificationPreferences } from '@/components/notifications/types';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { Settings } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/teacher/dashboard' },
    { title: 'Notifications', href: '/teacher/notifications' },
    { title: 'Preferences', href: '/teacher/notifications/preferences' },
];

interface PreferencesPageProps {
    preferences: NotificationPreferences;
}

export default function TeacherNotificationPreferencesPage({ preferences }: PreferencesPageProps) {
    const { data, setData, put, processing } = useForm<NotificationPreferences>({
        attendance_enabled: preferences.attendance_enabled,
        timetable_enabled: preferences.timetable_enabled,
        administrative_enabled: preferences.administrative_enabled,
        system_enabled: preferences.system_enabled,
        email_enabled: preferences.email_enabled,
    });

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        put(route('teacher.notifications.preferences.update'));
    };

    const toggles = [
        {
            key: 'attendance_enabled' as const,
            title: 'Attendance Notifications',
            description: 'Check-in/out results, verification failures, and attendance reminders.',
        },
        {
            key: 'timetable_enabled' as const,
            title: 'Timetable Notifications',
            description: 'Reschedule approvals, timetable updates, and schedule changes.',
        },
        {
            key: 'administrative_enabled' as const,
            title: 'Administrative Notifications',
            description: 'Announcements, policy updates, and important notices.',
        },
        {
            key: 'system_enabled' as const,
            title: 'System Notifications',
            description: 'Account updates, security alerts, and profile changes.',
        },
        {
            key: 'email_enabled' as const,
            title: 'Email Notifications',
            description: 'Also send eligible notifications to your registered email address.',
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Notification Preferences" />

            <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
                <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                        <Settings className="size-3.5" />
                        Preferences
                    </div>
                    <h1 className="mt-3 text-3xl font-semibold tracking-tight text-sidebar-foreground">Notification Preferences</h1>
                    <p className="mt-2 text-sm text-sidebar-foreground/70">
                        Choose which notification categories you want to receive in the portal and by email.
                    </p>
                </div>

                <form onSubmit={submit} className="space-y-4">
                    {toggles.map((toggle) => (
                        <label
                            key={toggle.key}
                            className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-sidebar-border/70 bg-white p-5 shadow-sm dark:bg-sidebar-accent"
                        >
                            <div>
                                <p className="font-medium text-sidebar-foreground">{toggle.title}</p>
                                <p className="mt-1 text-sm text-sidebar-foreground/60">{toggle.description}</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={Boolean(data[toggle.key])}
                                onChange={(event) => setData(toggle.key, event.target.checked)}
                                className="mt-1 size-4"
                            />
                        </label>
                    ))}

                    <div className="flex justify-end">
                        <Button type="submit" disabled={processing}>
                            {processing ? 'Saving...' : 'Save Preferences'}
                        </Button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
