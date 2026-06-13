import { ChangeIndicator, reportIconMap, SummaryCard } from '@/components/reports/shared';
import { Users } from 'lucide-react';

export function ReportSummaryCards({ cards }: { cards: SummaryCard[] }) {
    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card, index) => {
                const Icon = reportIconMap[card.icon] ?? Users;
                return (
                    <div key={index} className="rounded-xl border border-sidebar-border/70 bg-white p-4 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">{card.title}</p>
                                <p className="mt-2 text-2xl font-bold text-sidebar-foreground">{card.value}</p>
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
