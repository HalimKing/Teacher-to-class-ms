import AppLayout from '@/layouts/app-layout';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { Bell, Calendar, Clock, Edit, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Bounce, ToastContainer, toast } from 'react-toastify';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/teacher/dashboard' },
    { title: 'Reminders', href: '/teacher/reminders' },
];

interface SessionInfo {
    id: number;
    day: string;
    start_time: string;
    end_time: string;
    course: string | null;
    course_code: string | null;
    classroom: string | null;
}

interface Reminder {
    id: number;
    title: string;
    message: string | null;
    reminder_at: string;
    triggered_at: string | null;
    timetable_id: number | null;
    session: SessionInfo | null;
    send_via?: 'mail' | 'sms' | 'both';
    status?: 'pending' | 'sent' | 'failed';
    error_message?: string | null;
}

interface TimetableOption {
    id: number;
    label: string;
    day: string;
    start_time: string;
    end_time: string;
    course_name: string | null;
    classroom_name: string | null;
}

interface RemindersIndexProps {
    reminders: Reminder[];
    timetableOptions: TimetableOption[];
    filter: string;
}

function formatReminderDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
        dateStyle: 'short',
        timeStyle: 'short',
    });
}

function toDatetimeLocal(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TeacherRemindersIndex({
    reminders,
    timetableOptions,
    filter: initialFilter,
}: RemindersIndexProps) {
    const [filter, setFilter] = useState(initialFilter);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
    const [errorDialogOpen, setErrorDialogOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const page = usePage<SharedData & { flash?: { success?: string; error?: string }; errors?: Record<string, string> }>();
    const { flash, errors = {} } = page.props;

    const form = useForm({
        title: '',
        message: '',
        reminder_at: '',
        timetable_id: '' as string | number,
        send_via: 'mail' as 'mail' | 'sms' | 'both',
    });

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success, {
                position: 'top-right',
                autoClose: 4000,
                theme: 'dark',
                transition: Bounce,
            });
        }
        if (flash?.error) {
            toast.error(flash.error, {
                position: 'top-right',
                autoClose: 4000,
                theme: 'dark',
                transition: Bounce,
            });
        }
    }, [flash?.success, flash?.error]);

    const handleFilter = (newFilter: string) => {
        setFilter(newFilter);
        router.get(route('teacher.reminders.index'), { filter: newFilter }, { preserveState: true });
    };

    const openCreate = () => {
        setEditingReminder(null);
        form.reset();
        const now = new Date();
        now.setMinutes(now.getMinutes() + 30);
        form.setData({
            title: '',
            message: '',
            reminder_at: toDatetimeLocal(now.toISOString()),
            timetable_id: '',
            send_via: 'mail',
        });
        setDialogOpen(true);
    };

    const openEdit = (reminder: Reminder) => {
        setEditingReminder(reminder);
        form.setData({
            title: reminder.title,
            message: reminder.message || '',
            reminder_at: toDatetimeLocal(reminder.reminder_at),
            timetable_id: reminder.timetable_id ?? '',
            send_via: reminder.send_via ?? 'mail',
        });
        setDialogOpen(true);
    };

    const closeDialog = () => {
        setDialogOpen(false);
        setEditingReminder(null);
        form.reset();
    };

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            title: form.data.title,
            message: form.data.message || null,
            reminder_at: new Date(form.data.reminder_at).toISOString(),
            timetable_id: form.data.timetable_id === '' ? null : form.data.timetable_id,
            send_via: form.data.send_via,
        };
        if (editingReminder) {
            router.put(route('teacher.reminders.update', editingReminder.id), payload, {
                onSuccess: () => closeDialog(),
                preserveScroll: true,
            });
        } else {
            router.post(route('teacher.reminders.store'), payload, {
                onSuccess: () => closeDialog(),
                preserveScroll: true,
            });
        }
    };

    const handleDelete = (reminder: Reminder) => {
        if (!confirm('Delete this reminder?')) return;
        router.delete(route('teacher.reminders.destroy', reminder.id));
    };

    const handleRetry = (reminder: Reminder) => {
        if (!confirm('Retry sending this reminder?')) return;
        router.post(route('teacher.reminders.resend', reminder.id), {}, {
            onSuccess: () => toast.success('Retry dispatched.'),
            onError: () => toast.error('Failed to dispatch retry.'),
        });
    };

    const openError = (reminder: Reminder) => {
        setErrorMessage(reminder.error_message ?? 'No error details available.');
        setErrorDialogOpen(true);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Session Reminders" />
            <ToastContainer />
            <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4 md:p-6 overflow-x-auto">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-sidebar-foreground dark:text-sidebar-foreground">
                            Session Reminders
                        </h1>
                        <p className="mt-1 text-sm text-sidebar-foreground/60 dark:text-sidebar-foreground/60">
                            Set reminders for your classes and sessions
                        </p>
                    </div>
                    <Button onClick={openCreate} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Add Reminder
                    </Button>
                </div>

                <div className="flex gap-2">
                    {(['upcoming', 'past', 'all'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => handleFilter(f)}
                            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                                filter === f
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-sidebar-foreground hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700'
                            }`}
                        >
                            {f === 'upcoming' ? 'Upcoming' : f === 'past' ? 'Past' : 'All'}
                        </button>
                    ))}
                </div>

                <div className="rounded-xl border border-sidebar-border/70 bg-white shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent overflow-hidden">
                    {reminders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Bell className="h-12 w-12 text-sidebar-foreground/30 dark:text-sidebar-foreground/30 mb-4" />
                            <p className="text-sidebar-foreground/70 dark:text-sidebar-foreground/70">
                                No reminders yet. Add one to get notified before your sessions.
                            </p>
                            <Button onClick={openCreate} variant="outline" className="mt-4 gap-2">
                                <Plus className="h-4 w-4" />
                                Add Reminder
                            </Button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-sidebar-border/30 bg-gray-50/80 dark:bg-gray-800/50">
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
                                            Title
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
                                            Session
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
                                            Remind at
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
                                            Method
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
                                            Status
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reminders.map((reminder) => (
                                        <tr
                                            key={reminder.id}
                                            className="border-b border-sidebar-border/20 last:border-b-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/30"
                                        >
                                            <td className="px-4 py-4">
                                                <div className="font-medium text-sidebar-foreground dark:text-sidebar-foreground">
                                                    {reminder.title}
                                                </div>
                                                {reminder.message && (
                                                    <p className="mt-0.5 text-sm text-sidebar-foreground/60 line-clamp-1">
                                                        {reminder.message}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-sm text-sidebar-foreground/80">
                                                {reminder.session ? (
                                                    <span>
                                                        {reminder.session.course ?? reminder.session.course_code} –{' '}
                                                        {reminder.session.day} {reminder.session.start_time?.slice(0, 5)}
                                                        {reminder.session.classroom && ` (${reminder.session.classroom})`}
                                                    </span>
                                                ) : (
                                                    <span className="text-sidebar-foreground/50">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-2 text-sm text-sidebar-foreground/80">
                                                    <Clock className="h-4 w-4 text-sidebar-foreground/50" />
                                                    {formatReminderDate(reminder.reminder_at)}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-sm text-sidebar-foreground/80">
                                                {reminder.send_via === 'sms' ? (
                                                    <span>SMS</span>
                                                ) : reminder.send_via === 'both' ? (
                                                    <span>Both</span>
                                                ) : (
                                                    <span>Email</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-sm">
                                                {reminder.status === 'sent' ? (
                                                    <span className="text-green-600 font-medium">Sent</span>
                                                ) : reminder.status === 'failed' ? (
                                                    <span className="text-red-600 font-medium">Failed</span>
                                                ) : (
                                                    <span className="text-gray-600 font-medium">Pending</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="gap-1"
                                                        onClick={() => openEdit(reminder)}
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                        Edit
                                                    </Button>
                                                    {reminder.status === 'failed' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="gap-1 text-yellow-600 hover:text-yellow-700"
                                                            onClick={() => handleRetry(reminder)}
                                                        >
                                                            Retry
                                                        </Button>
                                                    )}
                                                    {reminder.status === 'failed' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="gap-1 text-gray-600 hover:text-gray-700"
                                                            onClick={() => openError(reminder)}
                                                        >
                                                            Error
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="gap-1 text-red-600 hover:text-red-700"
                                                        onClick={() => handleDelete(reminder)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                        Delete
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingReminder ? 'Edit Reminder' : 'Add Reminder'}</DialogTitle>
                        <DialogDescription>
                            Set a reminder for a session or a general task. You can link it to a specific class.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={onSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="title">Title *</Label>
                            <Input
                                id="title"
                                value={form.data.title}
                                onChange={(e) => form.setData('title', e.target.value)}
                                placeholder="e.g. Prepare quiz for Math 101"
                                className={errors.title ? 'border-red-500' : ''}
                            />
                            {errors.title && (
                                <p className="text-sm text-red-600 dark:text-red-400">{errors.title}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="message">Message (optional)</Label>
                            <Input
                                id="message"
                                value={form.data.message}
                                onChange={(e) => form.setData('message', e.target.value)}
                                placeholder="Optional note"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="reminder_at">Remind at *</Label>
                            <Input
                                id="reminder_at"
                                type="datetime-local"
                                value={form.data.reminder_at}
                                onChange={(e) => form.setData('reminder_at', e.target.value)}
                                className={errors.reminder_at ? 'border-red-500' : ''}
                            />
                            {errors.reminder_at && (
                                <p className="text-sm text-red-600 dark:text-red-400">{errors.reminder_at}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="timetable_id">Link to session (optional)</Label>
                            <select
                                id="timetable_id"
                                value={form.data.timetable_id === '' ? '' : String(form.data.timetable_id)}
                                onChange={(e) =>
                                    form.setData('timetable_id', e.target.value === '' ? '' : Number(e.target.value))
                                }
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <option value="">— No specific session —</option>
                                {timetableOptions.map((opt) => (
                                    <option key={opt.id} value={opt.id}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                            {errors.timetable_id && (
                                <p className="text-sm text-red-600 dark:text-red-400">{errors.timetable_id}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="send_via">Send via</Label>
                            <select
                                id="send_via"
                                value={form.data.send_via}
                                onChange={(e) => form.setData('send_via', e.target.value as any)}
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <option value="mail">Email</option>
                                <option value="sms">SMS</option>
                                <option value="both">Both</option>
                            </select>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={closeDialog}>
                                Cancel
                            </Button>
                            <Button type="submit">
                                {editingReminder ? 'Update' : 'Create'} Reminder
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
            <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Send Error</DialogTitle>
                        <DialogDescription>
                            Details about why this reminder failed to send.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="prose max-w-full p-2">
                        <pre className="whitespace-pre-wrap break-words text-sm">{errorMessage}</pre>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setErrorDialogOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
