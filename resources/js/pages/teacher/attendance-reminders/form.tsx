import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { AlertCircle, ArrowLeft, Bell, Clock3, LogIn, LogOut, Mail, MessageSquare, Repeat } from 'lucide-react';
import { type FormEvent } from 'react';

interface ScheduleOption {
    id: number;
    day: string;
    start: string;
    end: string;
    venue: string;
    label: string;
}

interface ReminderFormData {
    id?: number;
    title: string;
    type: string;
    days: string[];
    timetable_ids?: number[];
    trigger: string;
    offset_minutes: number;
    send_via?: string;
    message?: string | null;
    is_active: boolean;
}

const triggers = [
    { value: 'before_start', label: 'Before start', detail: 'Before the session begins' },
    { value: 'after_start', label: 'After start', detail: 'After the session begins' },
    { value: 'before_end', label: 'Before end', detail: 'Before the session ends' },
    { value: 'after_end', label: 'After end', detail: 'After the session ends' },
];

const channels = [
    { value: 'mail', label: 'Email', detail: 'Send to your email', icon: Mail },
    { value: 'sms', label: 'SMS', detail: 'Send to your phone', icon: MessageSquare },
    { value: 'both', label: 'Both', detail: 'Email and SMS', icon: Bell },
];

const offsets = [0, 15, 30, 45, 60];

const inputClass =
    'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:outline-none dark:border-sidebar-border dark:bg-background dark:text-sidebar-foreground';

function FieldError({ message }: { message?: string | string[] }) {
    const text = Array.isArray(message) ? message.filter(Boolean).join(' ') : message;

    if (!text) {
        return null;
    }

    return (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-rose-600">
            <AlertCircle className="size-4 shrink-0" />
            {text}
        </p>
    );
}

function standardMessage(data: { type: string; trigger: string; offset_minutes: number }): string {
    const offset = Number(data.offset_minutes) || 0;
    const when = `${offset} ${offset === 1 ? 'minute' : 'minutes'}`;

    if (offset === 0 && data.trigger === 'after_end') {
        return 'Attendance Reminder: Your scheduled session has ended. Please check out if you have not already done so.';
    }

    if (offset === 0 && data.trigger === 'after_start') {
        return 'Attendance Reminder: Your scheduled session has started. Please check in if you have not already done so.';
    }

    if (data.type === 'check_out') {
        if (data.trigger === 'before_end') {
            return `Attendance Reminder: Your scheduled session ends in ${when}. Please check out if you have not already done so.`;
        }
        if (data.trigger === 'after_end') {
            return `Attendance Reminder: Your scheduled session ended ${when} ago. Please check out if you have not already done so.`;
        }

        return 'Attendance Reminder: Your scheduled session has ended. Please check out if you have not already done so.';
    }

    if (data.trigger === 'before_start') {
        return `Attendance Reminder: Your scheduled session starts in ${when}. Please check in if you have not already done so.`;
    }

    if (data.trigger === 'after_start') {
        return `Attendance Reminder: Your scheduled session started ${when} ago. Please check in if you have not already done so.`;
    }

    return 'Attendance Reminder: Please complete your attendance check-in if you have not already done so.';
}

function summary(data: { type: string; trigger: string; offset_minutes: number; send_via: string }, selected: ScheduleOption[]): string {
    const action = data.type === 'check_out' ? 'check out' : 'check in';
    const minutes = Number(data.offset_minutes) || 0;
    const when = minutes === 0
        ? 'exactly when'
        : `${minutes} minute${minutes === 1 ? '' : 's'} ${data.trigger.startsWith('before') ? 'before' : 'after'}`;
    const event = data.trigger.endsWith('end') ? 'each selected session ends' : 'each selected session starts';
    const scheduleText = selected.length === 0 ? 'the schedules you select' : selected.map((schedule) => schedule.label).join('; ');
    const channel = data.send_via === 'sms' ? 'an SMS' : data.send_via === 'mail' ? 'an email' : 'an email and SMS';

    return `You will get ${channel} reminder to ${action} ${when} ${event}. Selected: ${scheduleText}. It repeats every week until you turn it off.`;
}

export default function ReminderForm({
    reminder,
    schedules = [],
}: {
    reminder: ReminderFormData | null;
    schedules?: ScheduleOption[];
}) {
    const editing = Boolean(reminder?.id);
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/teacher/dashboard' },
        { title: 'My Reminders', href: '/teacher/attendance-reminders' },
        { title: editing ? 'Edit reminder' : 'New reminder', href: editing ? `/teacher/attendance-reminders/${reminder?.id}/edit` : '/teacher/attendance-reminders/create' },
    ];
    const form = useForm({
        title: reminder?.title ?? '',
        type: reminder?.type ?? 'check_in',
        timetable_ids: reminder?.timetable_ids ?? [],
        trigger: reminder?.trigger ?? 'after_start',
        offset_minutes: reminder?.offset_minutes ?? 30,
        send_via: reminder?.send_via ?? 'both',
        message: reminder?.message ?? '',
        is_active: reminder?.is_active ?? true,
    });

    const toggleSchedule = (id: number) => {
        const next = form.data.timetable_ids.includes(id)
            ? form.data.timetable_ids.filter((item) => item !== id)
            : [...form.data.timetable_ids, id];
        form.setData('timetable_ids', next);
    };

    const scheduleOptions = schedules ?? [];
    const selectedSchedules = scheduleOptions.filter((schedule) => form.data.timetable_ids.includes(schedule.id));
    const messageText = form.data.message ?? '';
    const previewMessage = messageText.trim() !== '' ? messageText.trim() : standardMessage(form.data);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (editing && reminder?.id) {
            form.put(`/teacher/attendance-reminders/${reminder.id}`);
            return;
        }
        form.post('/teacher/attendance-reminders');
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={editing ? 'Edit reminder' : 'New reminder'} />
            <div className="min-h-full bg-gradient-to-b from-indigo-50/80 via-slate-50 to-slate-50 dark:from-indigo-950/20 dark:via-background dark:to-background">
                <form onSubmit={submit} className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-5 p-3 pb-10 sm:p-4 md:p-6 lg:p-8">
                    <section className="overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-sm shadow-indigo-100/70 dark:border-indigo-900/40 dark:bg-card dark:shadow-none">
                        <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-slate-800 px-5 py-6 text-white sm:px-8">
                            <Link
                                href="/teacher/attendance-reminders"
                                className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium ring-1 ring-white/20 transition hover:bg-white/25"
                            >
                                <ArrowLeft className="size-3.5" />
                                Back to My Reminders
                            </Link>
                            <div className="mt-5 flex items-start gap-4">
                                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                                    <Bell className="size-6" />
                                </span>
                                <div className="min-w-0">
                                    <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{editing ? 'Edit reminder' : 'New reminder'}</h1>
                                    <p className="mt-2 max-w-2xl text-sm text-white/85">
                                        This reminder is only for your own duty schedule. It repeats every selected weekday until you deactivate or delete it.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
                        <div className="space-y-5">
                            <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7 dark:border-sidebar-border dark:bg-card">
                                <h2 className="text-base font-semibold text-slate-900 dark:text-sidebar-foreground">Reminder details</h2>
                                <div className="mt-5 space-y-6">
                                    <div>
                                        <label htmlFor="title" className="mb-2 block text-sm font-semibold text-slate-800 dark:text-sidebar-foreground">
                                            Reminder title <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            id="title"
                                            aria-label="Reminder title"
                                            value={form.data.title}
                                            onChange={(event) => form.setData('title', event.target.value)}
                                            placeholder="Monday check-in reminder"
                                            className={cn(inputClass, form.errors.title && 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/10')}
                                        />
                                        <FieldError message={form.errors.title} />
                                    </div>

                                    <div>
                                        <span className="mb-2 block text-sm font-semibold text-slate-800 dark:text-sidebar-foreground">Reminder type</span>
                                        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Reminder type">
                                            {[
                                                { value: 'check_in', label: 'Check-in', detail: 'Remind me if I have not checked in', icon: LogIn },
                                                { value: 'check_out', label: 'Check-out', detail: 'Remind me if I have not checked out', icon: LogOut },
                                            ].map((option) => {
                                                const selected = form.data.type === option.value;
                                                const Icon = option.icon;
                                                return (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        role="radio"
                                                        aria-checked={selected}
                                                        onClick={() => form.setData('type', option.value)}
                                                        className={cn(
                                                            'flex items-start gap-3 rounded-2xl border p-4 text-left transition',
                                                            selected
                                                                ? 'border-indigo-500 bg-indigo-50 ring-4 ring-indigo-500/10 dark:bg-indigo-950/30'
                                                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-sidebar-border dark:bg-background',
                                                        )}
                                                    >
                                                        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', selected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-sidebar-accent')}>
                                                            <Icon className="size-5" />
                                                        </span>
                                                        <span>
                                                            <span className="block text-sm font-semibold text-slate-900 dark:text-sidebar-foreground">{option.label}</span>
                                                            <span className="mt-0.5 block text-xs text-slate-500">{option.detail}</span>
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <FieldError message={form.errors.type} />
                                    </div>

                                    <div>
                                        <span className="mb-2 block text-sm font-semibold text-slate-800 dark:text-sidebar-foreground">Assigned schedules</span>
                                        <p className="mb-3 text-xs text-slate-500">Only duty periods already assigned to you can be selected.</p>
                                        {scheduleOptions.length === 0 ? (
                                            <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500 dark:border-sidebar-border">
                                                You do not have any assigned schedules yet.
                                            </p>
                                        ) : (
                                            <div className="max-h-72 space-y-2 overflow-y-auto" role="group" aria-label="Assigned schedules">
                                                {scheduleOptions.map((schedule) => {
                                                    const selected = form.data.timetable_ids.includes(schedule.id);
                                                    return (
                                                        <button
                                                            key={schedule.id}
                                                            type="button"
                                                            onClick={() => toggleSchedule(schedule.id)}
                                                            aria-pressed={selected}
                                                            className={cn(
                                                                'flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition',
                                                                selected
                                                                    ? 'border-indigo-600 bg-indigo-50 text-indigo-950 dark:bg-indigo-950/30 dark:text-indigo-100'
                                                                    : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/50 dark:border-sidebar-border dark:bg-background dark:text-sidebar-foreground',
                                                            )}
                                                        >
                                                            <span>
                                                                <span className="block text-sm font-semibold">{schedule.day}</span>
                                                                <span className="mt-0.5 block text-xs opacity-80">{schedule.start} – {schedule.end}{schedule.venue ? ` · ${schedule.venue}` : ''}</span>
                                                            </span>
                                                            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', selected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-sidebar-accent')}>
                                                                {selected ? 'Selected' : 'Select'}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        <FieldError message={form.errors.timetable_ids} />
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7 dark:border-sidebar-border dark:bg-card">
                                <h2 className="text-base font-semibold text-slate-900 dark:text-sidebar-foreground">When to send it</h2>
                                <div className="mt-5 space-y-6">
                                    <div>
                                        <span className="mb-2 block text-sm font-semibold text-slate-800 dark:text-sidebar-foreground">Trigger condition</span>
                                        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Trigger condition">
                                            {triggers.map((trigger) => {
                                                const selected = form.data.trigger === trigger.value;
                                                return (
                                                    <button
                                                        key={trigger.value}
                                                        type="button"
                                                        role="radio"
                                                        aria-checked={selected}
                                                        onClick={() => form.setData('trigger', trigger.value)}
                                                        className={cn(
                                                            'rounded-2xl border px-4 py-3 text-left transition',
                                                            selected
                                                                ? 'border-indigo-500 bg-indigo-50 ring-4 ring-indigo-500/10 dark:bg-indigo-950/30'
                                                                : 'border-slate-200 bg-white hover:border-slate-300 dark:border-sidebar-border dark:bg-background',
                                                        )}
                                                    >
                                                        <span className="block text-sm font-semibold text-slate-900 dark:text-sidebar-foreground">{trigger.label}</span>
                                                        <span className="mt-0.5 block text-xs text-slate-500">{trigger.detail}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <FieldError message={form.errors.trigger} />
                                    </div>

                                    <div>
                                        <label htmlFor="offset" className="mb-2 block text-sm font-semibold text-slate-800 dark:text-sidebar-foreground">Time offset</label>
                                        <div className="flex flex-wrap gap-2">
                                            {offsets.map((minutes) => (
                                                <button
                                                    key={minutes}
                                                    type="button"
                                                    onClick={() => form.setData('offset_minutes', minutes)}
                                                    className={cn(
                                                        'min-h-10 rounded-full px-3 text-sm font-medium transition',
                                                        Number(form.data.offset_minutes) === minutes
                                                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-sidebar-accent dark:text-sidebar-foreground',
                                                    )}
                                                >
                                                    {minutes === 0 ? 'On time' : `${minutes} min`}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="mt-3 flex max-w-xs items-center gap-3">
                                            <input
                                                id="offset"
                                                aria-label="Time offset (minutes)"
                                                type="number"
                                                min={0}
                                                max={180}
                                                value={form.data.offset_minutes}
                                                onChange={(event) => form.setData('offset_minutes', Number(event.target.value))}
                                                className={cn(inputClass, 'max-w-[8rem]')}
                                            />
                                            <span className="text-sm text-slate-500">minutes, from 0 to 180</span>
                                        </div>
                                        <FieldError message={form.errors.offset_minutes} />
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7 dark:border-sidebar-border dark:bg-card">
                                <h2 className="text-base font-semibold text-slate-900 dark:text-sidebar-foreground">Delivery</h2>
                                <div className="mt-5 space-y-6">
                                    <div>
                                        <span className="mb-2 block text-sm font-semibold text-slate-800 dark:text-sidebar-foreground">Send via</span>
                                        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Send via">
                                            {channels.map((channel) => {
                                                const selected = form.data.send_via === channel.value;
                                                const Icon = channel.icon;
                                                return (
                                                    <button
                                                        key={channel.value}
                                                        type="button"
                                                        role="radio"
                                                        aria-checked={selected}
                                                        onClick={() => form.setData('send_via', channel.value)}
                                                        className={cn(
                                                            'rounded-2xl border px-4 py-3 text-left transition',
                                                            selected
                                                                ? 'border-indigo-500 bg-indigo-50 ring-4 ring-indigo-500/10 dark:bg-indigo-950/30'
                                                                : 'border-slate-200 bg-white hover:border-slate-300 dark:border-sidebar-border dark:bg-background',
                                                        )}
                                                    >
                                                        <Icon className={cn('size-4', selected ? 'text-indigo-600' : 'text-slate-400')} />
                                                        <span className="mt-2 block text-sm font-semibold text-slate-900 dark:text-sidebar-foreground">{channel.label}</span>
                                                        <span className="mt-0.5 block text-xs text-slate-500">{channel.detail}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <FieldError message={form.errors.send_via} />
                                    </div>

                                    <div>
                                        <label htmlFor="message" className="mb-2 block text-sm font-semibold text-slate-800 dark:text-sidebar-foreground">
                                            Notification message <span className="font-normal text-slate-400">(optional)</span>
                                        </label>
                                        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm leading-relaxed text-slate-700 dark:border-indigo-900/40 dark:bg-indigo-950/30 dark:text-indigo-100">
                                            <p className="text-xs font-semibold tracking-wide text-indigo-600 uppercase dark:text-indigo-300">Message that will be sent</p>
                                            <p className="mt-1">{previewMessage}</p>
                                        </div>
                                        <textarea
                                            id="message"
                                            aria-label="Notification message"
                                            value={messageText}
                                            onChange={(event) => form.setData('message', event.target.value)}
                                            rows={4}
                                            maxLength={500}
                                            placeholder="Type here only if you want to replace the message above."
                                            className={cn(inputClass, 'mt-3 resize-y leading-relaxed')}
                                        />
                                        <p className="mt-2 text-xs text-slate-400">{messageText.length} / 500</p>
                                        <FieldError message={form.errors.message} />
                                    </div>

                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={form.data.is_active}
                                        onClick={() => form.setData('is_active', !form.data.is_active)}
                                        className="flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-left dark:border-sidebar-border dark:bg-background"
                                    >
                                        <span>
                                            <span className="block text-sm font-semibold text-slate-900 dark:text-sidebar-foreground">Active</span>
                                            <span className="mt-0.5 block text-xs text-slate-500">Turn this off to keep the reminder without sending it.</span>
                                        </span>
                                        <span className={cn('relative h-6 w-11 shrink-0 rounded-full transition', form.data.is_active ? 'bg-indigo-600' : 'bg-slate-300')}>
                                            <span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition', form.data.is_active ? 'left-5' : 'left-0.5')} />
                                        </span>
                                    </button>
                                </div>
                            </section>
                        </div>

                        <aside className="lg:sticky lg:top-4 lg:self-start">
                            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-sidebar-border dark:bg-card">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-sidebar-foreground">
                                    <Repeat className="size-4 text-indigo-600" />
                                    How this reminder works
                                </div>
                                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-sidebar-foreground/80">
                                    {summary(form.data, selectedSchedules)}
                                </p>
                                <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-background">
                                    <p className="flex items-center gap-2"><Clock3 className="size-3.5" /> Uses your latest approved duty timetable.</p>
                                    <p>Already completed attendance is not reminded again.</p>
                                    <p>Holidays and cancelled sessions are skipped.</p>
                                </div>
                            </div>
                        </aside>
                    </div>

                    <div className="flex flex-col-reverse gap-3 rounded-3xl border border-slate-200/80 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-end dark:border-sidebar-border dark:bg-card">
                        <Link
                            href="/teacher/attendance-reminders"
                            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-sidebar-border dark:bg-card dark:text-sidebar-foreground"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={form.processing}
                            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {form.processing ? 'Saving...' : editing ? 'Save changes' : 'Create reminder'}
                        </button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
