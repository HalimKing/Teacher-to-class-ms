import AppLayout from '@/layouts/app-layout';
import { Head, useForm, usePage, Link, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Bounce, ToastContainer, toast } from 'react-toastify';

export default function AdminSchedulesIndex() {
    const { props } = usePage();
    const { schedules, filters, flash } = props as any;
    const [search, setSearch] = useState(filters?.search || '');
    const [status, setStatus] = useState(filters?.status || '');
    const [dateFrom, setDateFrom] = useState(filters?.date_from || '');
    const [dateTo, setDateTo] = useState(filters?.date_to || '');

    useEffect(() => {
        // no-op
    }, []);

    const handleFilter = () => {
        router.get(route('admin.school-management.schedules.index'), {
            search: search || undefined,
            status: status || undefined,
            date_from: dateFrom || undefined,
            date_to: dateTo || undefined,
        }, { preserveState: true, replace: true });
    };

    const handleClear = () => {
        setSearch('');
        setStatus('');
        setDateFrom('');
        setDateTo('');
        router.get(route('admin.school-management.schedules.index'), {}, { preserveState: false, replace: true });
    };

    const handlePageChange = (page:number) => {
        const params: any = {};
        if (search) params.search = search;
        if (status) params.status = status;
        if (dateFrom) params.date_from = dateFrom;
        if (dateTo) params.date_to = dateTo;
        params.page = page;

        router.get(route('admin.school-management.schedules.index'), params, { preserveState: true, replace: true });
    };

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success, {
                position: 'top-right',
                autoClose: 5000,
                hideProgressBar: false,
                closeOnClick: false,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: 'dark',
                transition: Bounce,
            });
        }
        if (flash?.error) {
            toast.error(flash.error, {
                position: 'top-right',
                autoClose: 5000,
                hideProgressBar: false,
                closeOnClick: false,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: 'dark',
                transition: Bounce,
            });
        }
    }, [flash?.success, flash?.error]);

    return (
        <AppLayout breadcrumbs={[{ title: 'Academics', href: '/admin/school-management' }, { title: 'Schedules', href: '/admin/school-management/schedules' }]}>
            <Head title="Schedules" />

            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-4 md:p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Schedules</h1>
                        <p className="mt-1 text-sm text-sidebar-foreground/60">Manage lecture reschedule requests</p>
                    </div>
                </div>

                <div className="rounded-xl border border-sidebar-border/70 bg-white p-4 shadow-sm">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                        <div>
                            <label className="block text-xs font-semibold text-sidebar-foreground/60">Search</label>
                            <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-lg border px-3 py-2" placeholder="Lecturer, course, class..." />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-sidebar-foreground/60">Status</label>
                            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-lg border px-3 py-2">
                                <option value="">All</option>
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                                <option value="active">Active</option>
                            </select>
                        </div>
                            <div>
                                <label className="block text-xs font-semibold text-sidebar-foreground/60">Date From</label>
                                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-sidebar-foreground/60">Date To</label>
                                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
                            </div>
                        <div className="flex items-end justify-end col-span-1 md:col-span-4">
                            <button type="button" onClick={handleFilter} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">Filter</button>
                            <button type="button" onClick={handleClear} className="ml-2 rounded-lg border px-4 py-2 text-sm">Clear</button>
                        </div>
                    </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-sidebar-border/70 bg-white shadow-sm">
                    <div className="p-4 border-b">
                        <h3 className="text-lg font-semibold">Reschedule Requests</h3>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold">Lecturer</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold">Course / Program</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold">Original</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold">Requested</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold">Venue</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold">Status</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {schedules.data.map((s:any) => (
                                    <tr key={s.id} className="border-b hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            <div className="text-sm font-medium">{s.timetable.course && s.timetable.course.teacher ? `${s.timetable.course.teacher.first_name} ${s.timetable.course.teacher.last_name}` : '—'}</div>
                                            <div className="text-xs text-sidebar-foreground/60">{s.timetable.course && s.timetable.course.teacher ? s.timetable.course.teacher.email : ''}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-sm">{s.timetable.course?.name}</div>
                                            <div className="text-xs text-sidebar-foreground/60">{s.timetable.course?.program?.name}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-sm">{s.original_date} • {s.original_start_time} - {s.original_end_time}</div>
                                            <div className="text-xs text-sidebar-foreground/60">{s.timetable.day}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-sm">{s.new_date} • {s.new_start_time} - {s.new_end_time}</div>
                                        </td>
                                        <td className="px-4 py-3">{s.classroom ? s.classroom.name : '—'}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${s.status==='approved'? 'bg-green-100 text-green-700' : s.status==='rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{s.status}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <a href={route('admin.school-management.schedules.show', s.id)} className="rounded-lg border px-3 py-2 text-sm">View</a>
                                                {s.status === 'pending' && (
                                                    <Link href={route('admin.school-management.schedules.approve', s.id)} method="post" as="button" className="rounded-lg bg-green-600 px-3 py-2 text-sm text-white">Approve</Link>
                                                )}
                                                {s.status === 'pending' && (
                                                    <Link href={route('admin.school-management.schedules.reject', s.id)} method="post" as="button" className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white">Reject</Link>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-4">
                        {/* simple pagination links */}
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-sidebar-foreground/60">Showing {schedules.from} to {schedules.to} of {schedules.total}</div>
                                <div className="flex items-center gap-2">
                                {Array.from({ length: schedules.last_page }, (_, i) => i+1).map((p:number) => (
                                    <button key={p} onClick={() => handlePageChange(p)} className={`rounded-lg px-3 py-2 ${schedules.current_page===p? 'bg-blue-600 text-white':'border'}`}>{p}</button>
                                ))}
                                </div>
                        </div>
                        <ToastContainer />
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
