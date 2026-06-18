import { ChangeIndicator, reportIconMap, SummaryCard } from '@/components/reports/shared';
import { Users } from 'lucide-react';

const groupLabels: Record<string, string> = {
    attendance: 'Attendance Metrics',
    punctuality: 'Punctuality Metrics',
    verification: 'Verification Metrics',
    productivity: 'Productivity Metrics',
};

export function ReportKpiSection({ cards }: { cards: SummaryCard[] }) {
    const grouped = cards.reduce<Record<string, SummaryCard[]>>((acc, card) => {
        const key = card.group ?? 'general';
        acc[key] = acc[key] ?? [];
        acc[key].push(card);
        return acc;
    }, {});

    const groups = Object.keys(grouped);

    if (groups.length <= 1 && !cards.some((card) => card.group)) {
        return <ReportSummaryCards cards={cards} />;
    }

    return (
        <div className="space-y-6">
            {groups.map((group) => (
                <div key={group}>
                    <h2 className="mb-3 text-sm font-semibold tracking-wide text-sidebar-foreground/70 uppercase">
                        {groupLabels[group] ?? group}
                    </h2>
                    <ReportSummaryCards cards={grouped[group]} />
                </div>
            ))}
        </div>
    );
}

export function ReportSummaryCards({ cards }: { cards: SummaryCard[] }) {
    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card, index) => {
                const Icon = reportIconMap[card.icon] ?? Users;
                return (
                    <div
                        key={`${card.title}-${index}`}
                        className="rounded-xl border border-sidebar-border/70 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-sidebar-border dark:bg-sidebar-accent"
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">{card.title}</p>
                                <p className="mt-2 text-2xl font-bold tabular-nums text-sidebar-foreground">{card.value}</p>
                                <ChangeIndicator change={card.change} changeType={card.changeType} />
                            </div>
                            <div className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/40">
                                <Icon className="h-5 w-5" />
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
