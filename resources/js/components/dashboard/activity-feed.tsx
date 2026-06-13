import { StatusBadge } from '@/components/reports/shared';
import { MapPin, ShieldCheck, ShieldX } from 'lucide-react';

export interface ActivityItem {
    id: string;
    name: string;
    role: string;
    department: string;
    check_in_time: string | null;
    check_out_time: string | null;
    status: string;
    face_verification: string;
    geolocation_status: string;
    time: string;
}

export default function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
    return (
        <section className="rounded-xl border border-sidebar-border/70 bg-white shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
            <div className="border-b border-sidebar-border/50 px-5 py-4">
                <h2 className="text-lg font-semibold text-sidebar-foreground">Recent Attendance Activity</h2>
                <p className="text-sm text-sidebar-foreground/60">Latest check-ins across teachers and administrators</p>
            </div>

            {activities.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-sidebar-foreground/50">No recent attendance activity.</div>
            ) : (
                <div className="divide-y divide-sidebar-border/40">
                    {activities.map((activity) => (
                        <div key={activity.id} className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-medium text-sidebar-foreground">{activity.name}</p>
                                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-sidebar-foreground/70">{activity.role}</span>
                                </div>
                                <p className="mt-1 text-sm text-sidebar-foreground/60">{activity.department}</p>
                                <p className="mt-1 text-xs text-sidebar-foreground/50">{activity.time}</p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-sm">
                                <div>
                                    <p className="text-xs text-sidebar-foreground/50">Check-in</p>
                                    <p className="font-medium text-sidebar-foreground">{activity.check_in_time ?? '—'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-sidebar-foreground/50">Check-out</p>
                                    <p className="font-medium text-sidebar-foreground">{activity.check_out_time ?? '—'}</p>
                                </div>
                                <StatusBadge status={activity.status} />
                                <div className="flex items-center gap-1 text-xs text-sidebar-foreground/70" title="Face verification">
                                    {activity.face_verification === 'verified' ? (
                                        <ShieldCheck className="size-4 text-emerald-600" aria-hidden="true" />
                                    ) : (
                                        <ShieldX className="size-4 text-red-500" aria-hidden="true" />
                                    )}
                                    Face
                                </div>
                                <div className="flex items-center gap-1 text-xs text-sidebar-foreground/70" title="Geolocation verification">
                                    <MapPin className={`size-4 ${activity.geolocation_status === 'verified' ? 'text-emerald-600' : 'text-red-500'}`} aria-hidden="true" />
                                    GPS
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
