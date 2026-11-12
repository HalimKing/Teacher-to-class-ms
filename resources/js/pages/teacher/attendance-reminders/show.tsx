import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import { Bounce, toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface HistoryRow {
    id: number;
    session_date?: string | null;
    scheduled_for?: string | null;
    notified_at?: string | null;
    channel?: string | null;
    status: string;
    failure_reason?: string | null;
}

export default function ReminderShow({
    reminder,
    upcoming,
    history,
    can,
}: {
    reminder: {
        id: number;
        title: string;
        type_label: string;
        days: string[];
        schedules?: Array<{ label: string }>;
        trigger_label: string;
        offset_minutes: number;
        send_via_label: string;
        is_active: boolean;
        message?: string | null;
        created_at?: string | null;
    };
    upcoming: Array<{ session: string; scheduled_for_display: string; session_start: string; session_end: string }>;
    history: { data: HistoryRow[]; links: Array<{ url: string | null; label: string; active: boolean }> };
    can: { edit: boolean; delete: boolean };
}) {
    const { flash } = usePage<{ flash?: { success?: string | null; error?: string | null } }>().props;
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/teacher/dashboard' },
        { title: 'My Reminders', href: '/teacher/attendance-reminders' },
        { title: reminder.title, href: `/teacher/attendance-reminders/${reminder.id}` },
    ];

    useEffect(() => {
        if (flash?.success) toast.success(flash.success, { theme: 'colored', transition: Bounce });
        if (flash?.error) toast.error(flash.error, { theme: 'colored', transition: Bounce });
    }, [flash?.success, flash?.error]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={reminder.title} />
            <ToastContainer />
            <div className="flex flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{reminder.title}</h1>
                        <p className="mt-1 text-sm text-slate-500">
                            {reminder.type_label} · {reminder.trigger_label} · {reminder.offset_minutes} minutes · {reminder.send_via_label} · {reminder.is_active ? 'Active' : 'Inactive'}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {can.edit && (
                            <>
                                <Button variant="outline" asChild>
                                    <Link href={`/teacher/attendance-reminders/${reminder.id}/edit`}>Edit</Link>
                                </Button>
                                <Button variant="outline" onClick={() => router.patch(`/teacher/attendance-reminders/${reminder.id}/toggle`)}>
                                    {reminder.is_active ? 'Deactivate' : 'Activate'}
                                </Button>
                            </>
                        )}
                        {can.delete && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    if (confirm('Delete this reminder? Future notifications will stop.')) {
                                        router.delete(`/teacher/attendance-reminders/${reminder.id}`);
                                    }
                                }}
                            >
                                Delete
                            </Button>
                        )}
                    </div>
                </div>

                <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm md:grid-cols-2 dark:border-sidebar-border dark:bg-card">
                    <p className="md:col-span-2"><span className="text-slate-500">Schedules:</span> {reminder.schedules?.map((schedule) => schedule.label).join('; ') || reminder.days.join(', ') || 'None selected'}</p>
                    <p><span className="text-slate-500">Created:</span> {reminder.created_at}</p>
                    <p className="md:col-span-2"><span className="text-slate-500">Message:</span> {reminder.message || 'Standard attendance reminder message'}</p>
                    <p className="md:col-span-2 text-slate-500">This reminder is only for you. It continues every selected weekday until you deactivate or delete it.</p>
                </div>

                <section className="space-y-3">
                    <h2 className="text-lg font-semibold">Upcoming occurrences</h2>
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-sidebar-border dark:bg-card">
                        <table className="min-w-[640px] w-full text-left text-sm">
                            <thead className="border-b text-xs tracking-wide text-slate-500 uppercase">
                                <tr>
                                    <th className="px-4 py-3">Session</th>
                                    <th className="px-4 py-3">Session time</th>
                                    <th className="px-4 py-3">Trigger</th>
                                </tr>
                            </thead>
                            <tbody>
                                {upcoming.length === 0 && (
                                    <tr><td colSpan={3} className="px-4 py-6 text-slate-500">No upcoming sessions match this reminder.</td></tr>
                                )}
                                {upcoming.map((item, index) => (
                                    <tr key={`${item.session}-${index}`} className="border-b last:border-0">
                                        <td className="px-4 py-3">{item.session}</td>
                                        <td className="px-4 py-3">{item.session_start} – {item.session_end}</td>
                                        <td className="px-4 py-3">{item.scheduled_for_display}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="space-y-3">
                    <h2 className="text-lg font-semibold">Delivery history</h2>
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-sidebar-border dark:bg-card">
                        <table className="min-w-[760px] w-full text-left text-sm">
                            <thead className="border-b text-xs tracking-wide text-slate-500 uppercase">
                                <tr>
                                    <th className="px-4 py-3">Scheduled</th>
                                    <th className="px-4 py-3">Sent</th>
                                    <th className="px-4 py-3">Channel</th>
                                    <th className="px-4 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.data.length === 0 && (
                                    <tr><td colSpan={4} className="px-4 py-6 text-slate-500">No notifications have been sent yet.</td></tr>
                                )}
                                {history.data.map((row) => (
                                    <tr key={row.id} className="border-b last:border-0">
                                        <td className="px-4 py-3">{row.scheduled_for}</td>
                                        <td className="px-4 py-3">{row.notified_at ?? '—'}</td>
                                        <td className="px-4 py-3">{row.channel ?? '—'}</td>
                                        <td className="px-4 py-3">
                                            {row.status}
                                            {row.failure_reason && <span className="block text-xs text-red-600">{row.failure_reason}</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </AppLayout>
    );
}
