import {
    Calendar,
    CheckCircle,
    Clock,
    MapPin,
    ShieldCheck,
    ShieldX,
    TrendingUp,
    Users,
    XCircle,
} from 'lucide-react';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';

export interface SummaryCard {
    title: string;
    value: string;
    change: string;
    changeType: 'positive' | 'negative' | 'neutral';
    icon: string;
}

export interface PaginatedRecords<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

export interface TrendPoint {
    label: string;
    total: number;
    present: number;
    late: number;
    attendance_rate: number;
}

export interface VerificationAnalytics {
    face_success_rate: number;
    face_failure_rate: number;
    geolocation_success_rate: number;
    geolocation_failure_rate: number;
}

export interface PerformancePerson {
    name: string;
    department: string;
    attendance_rate: number;
    late: number;
    present?: number;
    total?: number;
}

export interface ReportAnalytics {
    dailyTrend: TrendPoint[];
    weeklyTrend: TrendPoint[];
    monthlyTrend: TrendPoint[];
    verificationAnalytics: VerificationAnalytics;
    performanceAnalytics: {
        most_punctual: PerformancePerson[];
        frequently_late: PerformancePerson[];
        attendance_ranking: PerformancePerson[];
        highest_attendance?: PerformancePerson | null;
        lowest_attendance?: PerformancePerson | null;
    };
    verificationTrend?: TrendPoint[];
}

export interface TableColumn<T> {
    key: string;
    label: string;
    sortable?: boolean;
    render?: (record: T) => React.ReactNode;
}

export const reportIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    Users,
    Calendar,
    CheckCircle,
    XCircle,
    Clock,
    TrendingUp,
    ShieldCheck,
    ShieldX,
    MapPin,
};

export const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'top' as const } },
};

export const statusColors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-700',
    checked_in: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    late: 'bg-amber-100 text-amber-700',
    early_leave: 'bg-orange-100 text-orange-700',
    present: 'bg-green-100 text-green-700',
    absent: 'bg-red-100 text-red-700',
    incomplete: 'bg-gray-100 text-gray-700',
};

export function StatusBadge({ status }: { status: string }) {
    return (
        <span className={`rounded-full px-2 py-1 text-xs capitalize ${statusColors[status] ?? 'bg-gray-100 text-gray-700'}`}>
            {status.replace(/_/g, ' ')}
        </span>
    );
}

export function ChangeIndicator({ change, changeType }: { change: string; changeType: SummaryCard['changeType'] }) {
    if (!change) return null;

    return (
        <p
            className={`mt-1 inline-flex items-center gap-1 text-xs ${
                changeType === 'positive' ? 'text-green-600' : changeType === 'negative' ? 'text-red-600' : 'text-sidebar-foreground/60'
            }`}
        >
            {changeType === 'positive' ? <ArrowUp className="h-3 w-3" /> : changeType === 'negative' ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {change}
        </p>
    );
}

export const filterInputClass = 'filter-input w-full rounded-lg border border-sidebar-border/50 bg-white px-3 py-2 text-sm text-sidebar-foreground dark:bg-sidebar-accent';

export function ReportFilterField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="mb-2 block text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">{label}</label>
            {children}
        </div>
    );
}

export function ReportChartCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-sidebar-border/70 bg-white p-4 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
            <h2 className="mb-4 text-lg font-semibold text-sidebar-foreground">{title}</h2>
            {children}
        </div>
    );
}

export const reportStyles = `
    .filter-input {
        width: 100%;
        border-radius: 0.5rem;
        border: 1px solid rgba(148, 163, 184, 0.5);
        background: white;
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
        color: inherit;
    }
    .dark .filter-input {
        background: var(--sidebar-accent);
    }
`;
