import FaceEnrollmentSection from '@/components/face/FaceEnrollmentSection';
import { type TeacherListItem, type TeacherQuickViewData } from '@/components/teachers/types';
import { Button } from '@/components/ui/button';
import { can } from '@/lib/can';
import { Link } from '@inertiajs/react';
import { Calendar, Loader2, Phone, ShieldCheck, User, X } from 'lucide-react';

interface TeacherQuickViewPanelProps {
    open: boolean;
    loading: boolean;
    teacher: TeacherListItem | null;
    data: TeacherQuickViewData | null;
    onClose: () => void;
}

export default function TeacherQuickViewPanel({ open, loading, teacher, data, onClose }: TeacherQuickViewPanelProps) {
    if (!open || !teacher) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-label="Close quick view" />
            <aside className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl dark:bg-sidebar-accent">
                <div className="flex items-start justify-between border-b border-sidebar-border/60 p-6">
                    <div>
                        <p className="text-xs font-medium tracking-wide text-primary uppercase">Teacher Profile</p>
                        <h2 className="mt-1 text-2xl font-semibold text-sidebar-foreground">{teacher.full_name}</h2>
                        <p className="text-sm text-sidebar-foreground/60">{teacher.employee_id}</p>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={onClose}>
                        <X className="size-4" />
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {loading || !data ? (
                        <div className="flex h-40 items-center justify-center text-sidebar-foreground/60">
                            <Loader2 className="size-5 animate-spin" />
                            <span className="ml-2 text-sm">Loading teacher details...</span>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <section className="rounded-xl border border-sidebar-border/60 p-4">
                                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-sidebar-foreground">
                                    <User className="size-4" />
                                    Profile Information
                                </h3>
                                <dl className="grid gap-3 text-sm">
                                    <div><dt className="text-sidebar-foreground/50">Email</dt><dd className="font-medium">{data.profile.email}</dd></div>
                                    <div><dt className="text-sidebar-foreground/50">Phone</dt><dd className="font-medium">{data.profile.phone || '—'}</dd></div>
                                    <div><dt className="text-sidebar-foreground/50">Department</dt><dd className="font-medium">{data.profile.department || '—'}</dd></div>
                                    <div><dt className="text-sidebar-foreground/50">Faculty</dt><dd className="font-medium">{data.profile.faculty || '—'}</dd></div>
                                    <div><dt className="text-sidebar-foreground/50">Created</dt><dd className="font-medium">{data.profile.created_at || '—'}</dd></div>
                                </dl>
                            </section>

                            <section className="rounded-xl border border-sidebar-border/60 p-4">
                                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-sidebar-foreground">
                                    <Calendar className="size-4" />
                                    Attendance Summary
                                </h3>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="rounded-lg bg-muted/40 p-3"><p className="text-sidebar-foreground/50">Rate</p><p className="text-xl font-semibold">{data.attendance.attendance_rate}%</p></div>
                                    <div className="rounded-lg bg-muted/40 p-3"><p className="text-sidebar-foreground/50">Today</p><p className="font-semibold">{data.attendance.today_status}</p></div>
                                    <div className="rounded-lg bg-muted/40 p-3"><p className="text-sidebar-foreground/50">Present Days</p><p className="font-semibold">{data.attendance.present_days}</p></div>
                                    <div className="rounded-lg bg-muted/40 p-3"><p className="text-sidebar-foreground/50">Late Arrivals</p><p className="font-semibold">{data.attendance.late_arrivals}</p></div>
                                </div>
                            </section>

                            <section className="rounded-xl border border-sidebar-border/60 p-4">
                                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-sidebar-foreground">
                                    <ShieldCheck className="size-4" />
                                    Facial Recognition
                                </h3>
                                {can('admin.teachers.edit') ? (
                                    <FaceEnrollmentSection
                                        teacherId={teacher.id}
                                        status={data.face.status}
                                        faceRegisteredAt={data.face.registered_at}
                                    />
                                ) : (
                                    <p className="text-sm text-sidebar-foreground/70">
                                        Status: {data.face.status === 'enrolled' ? 'Enrolled' : 'Not Enrolled'}
                                    </p>
                                )}
                            </section>

                            <section className="rounded-xl border border-sidebar-border/60 p-4">
                                <h3 className="mb-3 text-sm font-semibold text-sidebar-foreground">Timetable Summary</h3>
                                <p className="mb-3 text-sm text-sidebar-foreground/70">{data.timetable.assigned_count} assigned schedule(s)</p>
                                {data.timetable.courses.length > 0 && (
                                    <div className="mb-3">
                                        <p className="text-xs font-medium tracking-wide text-sidebar-foreground/50 uppercase">Courses</p>
                                        <p className="text-sm">{data.timetable.courses.join(', ')}</p>
                                    </div>
                                )}
                                <div className="space-y-2">
                                    {data.timetable.classes.slice(0, 4).map((item, index) => (
                                        <div key={index} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                                            <p className="font-medium">{item.day} · {item.start_time} - {item.end_time}</p>
                                            <p className="text-sidebar-foreground/60">{[item.course, item.venue].filter(Boolean).join(' · ')}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap gap-2 border-t border-sidebar-border/60 p-4">
                    {can('admin.teachers.edit') && (
                        <Button asChild variant="outline" size="sm">
                            <Link href={route('admin.teachers.edit', teacher.id)}>
                                Edit Teacher
                            </Link>
                        </Button>
                    )}
                    <Button asChild variant="outline" size="sm">
                        <Link href={route('admin.teachers.password-management', { employee_id: teacher.employee_id })}>
                            <Phone className="size-4" />
                            Password Management
                        </Link>
                    </Button>
                </div>
            </aside>
        </div>
    );
}
