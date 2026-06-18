export interface ReportInsight {
    title: string;
    value: string;
    detail: string;
    tone: 'positive' | 'negative' | 'neutral';
}

const toneClasses: Record<ReportInsight['tone'], string> = {
    positive: 'border-green-200 bg-green-50/80 dark:border-green-900 dark:bg-green-950/20',
    negative: 'border-red-200 bg-red-50/80 dark:border-red-900 dark:bg-red-950/20',
    neutral: 'border-sidebar-border/60 bg-white dark:bg-sidebar-accent',
};

export function ReportInsightsPanel({ insights }: { insights: ReportInsight[] }) {
    if (!insights.length) {
        return null;
    }

    return (
        <div className="rounded-xl border border-sidebar-border/70 bg-white p-5 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
            <div className="mb-4">
                <h2 className="text-lg font-semibold text-sidebar-foreground">Attendance Intelligence</h2>
                <p className="text-sm text-sidebar-foreground/60">Meaningful summaries from your attendance history</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {insights.map((insight) => (
                    <div key={insight.title} className={`rounded-xl border p-4 ${toneClasses[insight.tone]}`}>
                        <p className="text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">{insight.title}</p>
                        <p className="mt-2 text-xl font-bold text-sidebar-foreground">{insight.value}</p>
                        <p className="mt-1 text-sm text-sidebar-foreground/70">{insight.detail}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
