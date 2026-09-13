import { type TeacherListItem, type TeacherQuickViewData, type TeachersIndexPageProps } from '@/components/teachers/types';
import TeacherQuickViewPanel from '@/components/teachers/TeacherQuickViewPanel';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type PagePropsWithFlash } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { ToastContainer, toast, Bounce } from 'react-toastify';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/teacher/dashboard' },
    { title: 'Unit Staff', href: '/teacher/unit/staff' },
];

export default function UnitStaffPage({
    teachers,
    leadershipScope,
}: TeachersIndexPageProps & {
    leadershipScope?: { role_label?: string | null; faculty_name?: string | null; department_name?: string | null } | null;
}) {
    const { flash } = usePage().props as PagePropsWithFlash;
    const [quickViewTeacher, setQuickViewTeacher] = useState<TeacherListItem | null>(null);
    const [quickViewData, setQuickViewData] = useState<TeacherQuickViewData | null>(null);
    const [quickViewLoading, setQuickViewLoading] = useState(false);

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success, { theme: 'dark', transition: Bounce });
        }
        if (flash?.error) {
            toast.error(flash.error, { theme: 'dark', transition: Bounce });
        }
    }, [flash?.success, flash?.error]);

    const handleQuickView = async (teacher: TeacherListItem) => {
        setQuickViewTeacher(teacher);
        setQuickViewData(null);
        setQuickViewLoading(true);

        try {
            const response = await fetch(route('teacher.unit.staff.quick-view', teacher.id), {
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });
            const payload = await response.json();
            if (!response.ok || !payload.success) {
                throw new Error(payload.message || 'Unable to load staff member details.');
            }
            setQuickViewData(payload.data);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Unable to load staff member details.', { theme: 'dark' });
            setQuickViewTeacher(null);
        } finally {
            setQuickViewLoading(false);
        }
    };

    const unitLabel = leadershipScope?.department_name || leadershipScope?.faculty_name || 'your unit';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Unit Staff" />
            <div className="flex min-w-0 flex-col gap-6 p-3 sm:p-4 md:p-6">
                <div>
                    <h1 className="text-xl font-semibold text-sidebar-foreground sm:text-2xl">Unit Staff</h1>
                    <p className="mt-1 text-sm text-sidebar-foreground/70">
                        {leadershipScope?.role_label || 'Leadership'} · {unitLabel}. You still keep your original
                        lecturer or administrator features.
                    </p>
                </div>

                <div className="space-y-3 md:hidden">
                    {teachers.data.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-sidebar-border px-4 py-8 text-center text-sm text-sidebar-foreground/60">
                            No staff members in this unit.
                        </div>
                    ) : (
                        teachers.data.map((teacher) => (
                            <div key={teacher.id} className="rounded-2xl border border-sidebar-border/60 bg-card p-4">
                                <p className="truncate font-medium text-sidebar-foreground">{teacher.full_name}</p>
                                <p className="truncate text-xs text-sidebar-foreground/60">{teacher.email}</p>
                                <p className="mt-2 text-sm text-sidebar-foreground/75">
                                    {teacher.employee_id} · <span className="capitalize">{teacher.staff_type}</span>
                                </p>
                                <p className="mt-1 text-xs text-sidebar-foreground/55">
                                    {[teacher.department, teacher.faculty].filter(Boolean).join(' · ') || '—'}
                                </p>
                                <div className="mt-3 flex gap-3">
                                    <button
                                        type="button"
                                        className="inline-flex min-h-10 items-center text-sm font-medium text-primary hover:underline"
                                        onClick={() => handleQuickView(teacher)}
                                    >
                                        View
                                    </button>
                                    <Link href={route('teacher.unit.staff.edit', teacher.id)} className="inline-flex min-h-10 items-center text-sm font-medium text-primary hover:underline">
                                        Edit
                                    </Link>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="hidden overflow-hidden rounded-2xl border border-sidebar-border/60 bg-card md:block">
                    <table className="min-w-full divide-y divide-sidebar-border/60">
                        <thead className="bg-muted/40 text-left text-xs font-semibold tracking-wide text-sidebar-foreground/60 uppercase">
                            <tr>
                                <th className="px-4 py-3">Staff member</th>
                                <th className="px-4 py-3">Staff ID</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">Department</th>
                                <th className="px-4 py-3">Leadership</th>
                                <th className="px-4 py-3">Attendance</th>
                                <th className="px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-sidebar-border/50">
                            {teachers.data.map((teacher) => (
                                <tr key={teacher.id}>
                                    <td className="px-4 py-3">
                                        <div className="font-medium">{teacher.full_name}</div>
                                        <div className="text-xs text-sidebar-foreground/60">{teacher.email}</div>
                                    </td>
                                    <td className="px-4 py-3 text-sm">{teacher.employee_id}</td>
                                    <td className="px-4 py-3 text-sm capitalize">{teacher.staff_type}</td>
                                    <td className="px-4 py-3 text-sm">
                                        <div>{teacher.department}</div>
                                        <div className="text-xs text-sidebar-foreground/50">{teacher.faculty}</div>
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                        {teacher.leadership_role_label ? (
                                            <div>
                                                <div>{teacher.leadership_role_label}</div>
                                                <div className="text-xs text-sidebar-foreground/50">{teacher.leadership_unit}</div>
                                            </div>
                                        ) : (
                                            '—'
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm">{teacher.attendance_status}</td>
                                    <td className="px-4 py-3 text-sm">
                                        <div className="flex gap-3">
                                            <button
                                                type="button"
                                                className="text-primary hover:underline"
                                                onClick={() => handleQuickView(teacher)}
                                            >
                                                View
                                            </button>
                                            <Link href={route('teacher.unit.staff.edit', teacher.id)} className="text-primary hover:underline">
                                                Edit
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {teachers.data.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-sidebar-foreground/60">
                                        No staff members in this unit.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {teachers.last_page > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        {teachers.current_page > 1 && (
                            <button
                                type="button"
                                className="min-h-11 rounded-lg border border-sidebar-border px-4 py-2"
                                onClick={() => router.get(route('teacher.unit.staff.index'), { page: teachers.current_page - 1 })}
                            >
                                Previous
                            </button>
                        )}
                        <span className="px-2 py-1 text-sidebar-foreground/70">
                            Page {teachers.current_page} of {teachers.last_page}
                        </span>
                        {teachers.current_page < teachers.last_page && (
                            <button
                                type="button"
                                className="min-h-11 rounded-lg border border-sidebar-border px-4 py-2"
                                onClick={() => router.get(route('teacher.unit.staff.index'), { page: teachers.current_page + 1 })}
                            >
                                Next
                            </button>
                        )}
                    </div>
                )}
            </div>

            <TeacherQuickViewPanel
                open={Boolean(quickViewTeacher)}
                loading={quickViewLoading}
                teacher={quickViewTeacher}
                data={quickViewData}
                onClose={() => setQuickViewTeacher(null)}
            />
            <ToastContainer />
        </AppLayout>
    );
}
