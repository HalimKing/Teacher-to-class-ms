import { Award, TrendingUp, UserX, Users } from 'lucide-react';

interface PerformancePerson {
    name: string;
    department: string;
    attendance_rate: number;
    late?: number;
    present?: number;
    total?: number;
}

interface InsightsData {
    most_punctual_teacher: PerformancePerson | null;
    most_punctual_administrator: PerformancePerson | null;
    highest_attendance_rate: number;
    absent_today_count: number;
    compliance_rate: number;
    absent_today: Array<{ name: string; role: string; department: string }>;
}

function InsightCard({
    icon: Icon,
    title,
    value,
    subtitle,
}: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    value: string;
    subtitle?: string;
}) {
    return (
        <div className="rounded-xl border border-sidebar-border/70 bg-white p-4 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
            <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/70">
                    <Icon className="size-5 text-sidebar-foreground/70" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                    <p className="text-xs font-medium tracking-wide text-sidebar-foreground/60 uppercase">{title}</p>
                    <p className="mt-1 text-lg font-semibold text-sidebar-foreground">{value}</p>
                    {subtitle && <p className="mt-1 text-sm text-sidebar-foreground/60">{subtitle}</p>}
                </div>
            </div>
        </div>
    );
}

export default function InsightsPanel({ insights }: { insights: InsightsData }) {
    return (
        <section className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-sidebar-foreground">Attendance Insights</h2>
                <p className="text-sm text-sidebar-foreground/60">Key performance indicators for the last 30 days</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <InsightCard
                    icon={Award}
                    title="Most Punctual Teacher"
                    value={insights.most_punctual_teacher?.name ?? 'No data yet'}
                    subtitle={
                        insights.most_punctual_teacher
                            ? `${insights.most_punctual_teacher.attendance_rate}% rate · ${insights.most_punctual_teacher.department}`
                            : undefined
                    }
                />
                <InsightCard
                    icon={Award}
                    title="Most Punctual Administrator"
                    value={insights.most_punctual_administrator?.name ?? 'No data yet'}
                    subtitle={
                        insights.most_punctual_administrator
                            ? `${insights.most_punctual_administrator.attendance_rate}% rate · ${insights.most_punctual_administrator.department}`
                            : undefined
                    }
                />
                <InsightCard
                    icon={TrendingUp}
                    title="Highest Attendance Rate"
                    value={`${insights.highest_attendance_rate}%`}
                    subtitle="Best performer in the last 30 days"
                />
                <InsightCard
                    icon={Users}
                    title="Compliance Rate Today"
                    value={`${insights.compliance_rate}%`}
                    subtitle="Present vs scheduled staff today"
                />
            </div>

            <div className="rounded-xl border border-sidebar-border/70 bg-white p-4 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                <div className="mb-3 flex items-center gap-2">
                    <UserX className="size-5 text-red-500" aria-hidden="true" />
                    <h3 className="font-semibold text-sidebar-foreground">Absent Today ({insights.absent_today_count})</h3>
                </div>
                {insights.absent_today.length === 0 ? (
                    <p className="text-sm text-sidebar-foreground/60">No scheduled absences detected for today.</p>
                ) : (
                    <ul className="space-y-2">
                        {insights.absent_today.map((person, index) => (
                            <li key={`${person.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                                <div>
                                    <p className="font-medium text-sidebar-foreground">{person.name}</p>
                                    <p className="text-xs text-sidebar-foreground/60">{person.department}</p>
                                </div>
                                <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/30 dark:text-red-400">
                                    {person.role}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
}
