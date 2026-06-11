import AppLayout from '@/layouts/app-layout';
import { Head, useForm, usePage } from '@inertiajs/react';
import { useState, useEffect } from 'react';

export default function AdminSchedulesShow() {
    const { props } = usePage();
    const { schedule } = props as any;
    const form = useForm({ admin_remarks: '' });
    const [actionError, setActionError] = useState(null as string | null);
    const csrf = typeof document !== 'undefined' ? (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '' : '';
    const flash = (props as any).flash;
    useEffect(() => {
        if (flash?.error) setActionError(flash.error as string);
        else if (flash?.success) setActionError(null);
    }, [flash?.error, flash?.success]);

    return (
        <AppLayout breadcrumbs={[{ title: 'Academics', href: '/admin/school-management' }, { title: 'Schedules', href: '/admin/school-management/schedules' }, { title: 'Review', href: '#' }]}>
            <Head title="Schedule Review" />

            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-4 md:p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Review Reschedule Request</h1>
                        <p className="mt-1 text-sm text-sidebar-foreground/60">Review and approve or reject this request</p>
                    </div>
                </div>

                <div className="rounded-xl border border-sidebar-border/70 bg-white p-4 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <h3 className="font-semibold">Lecturer</h3>
                            <div>{schedule.timetable.course.teacher.first_name} {schedule.timetable.course.teacher.last_name}</div>
                            <div className="text-xs text-sidebar-foreground/60">{schedule.timetable.course.teacher.email}</div>

                            <h3 className="mt-4 font-semibold">Course / Program</h3>
                            <div>{schedule.timetable.course.name}</div>
                            <div className="text-xs text-sidebar-foreground/60">{schedule.timetable.course.program?.name}</div>

                            <h3 className="mt-4 font-semibold">Original</h3>
                            <div>{schedule.original_date} • {schedule.original_start_time} - {schedule.original_end_time}</div>

                            <h3 className="mt-4 font-semibold">Requested</h3>
                            <div>{schedule.new_date} • {schedule.new_start_time} - {schedule.new_end_time}</div>

                            <h3 className="mt-4 font-semibold">Venue</h3>
                            <div>{schedule.classroom ? schedule.classroom.name : '—'}</div>
                        </div>

                        <div>
                            <h3 className="font-semibold">Admin Remarks</h3>
                            <textarea className="w-full rounded-lg border p-2" value={form.data.admin_remarks} onChange={(e) => form.setData('admin_remarks', e.target.value)} />

                            <div className="mt-4 flex items-center gap-2 justify-end">
                                <button
                                    type="button"
                                    onClick={() => {
                                        form.post(route('admin.school-management.schedules.reject', schedule.id), {
                                            onError: (errors: any) => {
                                                const msg = Object.values(errors).flat().join(' ');
                                                setActionError(msg || 'Failed to reject schedule');
                                            },
                                            onSuccess: () => setActionError(null),
                                        });
                                    }}
                                    className="rounded-lg bg-red-600 px-4 py-2 text-white"
                                >
                                    Reject
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        form.post(route('admin.school-management.schedules.approve', schedule.id), {
                                            onError: (errors: any) => {
                                                const msg = Object.values(errors).flat().join(' ');
                                                setActionError(msg || 'Failed to approve schedule');
                                            },
                                            onSuccess: () => setActionError(null),
                                        });
                                    }}
                                    className="rounded-lg bg-green-600 px-4 py-2 text-white"
                                >
                                    Approve
                                </button>
                            </div>

                            {actionError && <div className="text-sm text-red-600 mt-2">{actionError}</div>}
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
