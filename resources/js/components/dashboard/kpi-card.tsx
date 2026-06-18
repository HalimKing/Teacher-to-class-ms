import { ChangeIndicator, reportIconMap } from '@/components/reports/shared';
import { cn } from '@/lib/utils';

export interface KpiCardData {
    title: string;
    value: string;
    change: string;
    changeType: 'positive' | 'negative' | 'neutral';
    icon: string;
    group?: string;
}

const groupLabels: Record<string, string> = {
    overview: 'Teacher Overview',
    attendance: 'Attendance Metrics',
    verification: 'Verification Metrics',
    timetable: 'Timetable Metrics',
    users: 'Teacher Overview',
    staff_type: 'Staff Types',
    system: 'Timetable Metrics',
};

const accentStyles: Record<string, { icon: string; ring: string }> = {
    overview: { icon: 'text-blue-600 dark:text-blue-400', ring: 'ring-blue-500/10' },
    users: { icon: 'text-blue-600 dark:text-blue-400', ring: 'ring-blue-500/10' },
    staff_type: { icon: 'text-indigo-600 dark:text-indigo-400', ring: 'ring-indigo-500/10' },
    attendance: { icon: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-500/10' },
    verification: { icon: 'text-violet-600 dark:text-violet-400', ring: 'ring-violet-500/10' },
    timetable: { icon: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-500/10' },
    system: { icon: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-500/10' },
};

export function KpiCard({ card }: { card: KpiCardData }) {
    const Icon = reportIconMap[card.icon] ?? reportIconMap.Users;
    const accent = accentStyles[card.group ?? 'system'] ?? accentStyles.system;

    return (
        <div className="group relative overflow-hidden rounded-xl border border-sidebar-border/70 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-sidebar-border dark:bg-sidebar-accent">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium tracking-wide text-sidebar-foreground/60 uppercase">{card.title}</p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-sidebar-foreground">{card.value}</p>
                    {card.change && <ChangeIndicator change={card.change} changeType={card.changeType} />}
                </div>
                <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted/60 ring-1', accent.ring)}>
                    <Icon className={cn('size-5', accent.icon)} aria-hidden="true" />
                </div>
            </div>
        </div>
    );
}

export function KpiSection({ title, cards }: { title: string; cards: KpiCardData[] }) {
    if (cards.length === 0) return null;

    return (
        <section>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-sidebar-foreground/70 uppercase">{title}</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {cards.map((card) => (
                    <KpiCard key={card.title} card={card} />
                ))}
            </div>
        </section>
    );
}

export function KpiGrid({ cards }: { cards: KpiCardData[] }) {
    const grouped = cards.reduce<Record<string, KpiCardData[]>>((acc, card) => {
        const key = card.group ?? 'system';
        acc[key] = acc[key] ?? [];
        acc[key].push(card);
        return acc;
    }, {});

    return (
        <div className="space-y-8">
            {Object.entries(grouped).map(([group, groupCards]) => (
                <KpiSection key={group} title={groupLabels[group] ?? group} cards={groupCards} />
            ))}
        </div>
    );
}
