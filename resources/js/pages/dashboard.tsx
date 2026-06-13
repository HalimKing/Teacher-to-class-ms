import ActivityFeed, { type ActivityItem } from '@/components/dashboard/activity-feed';
import InsightsPanel from '@/components/dashboard/insights-panel';
import { KpiGrid, type KpiCardData } from '@/components/dashboard/kpi-card';
import QuickActions from '@/components/dashboard/quick-actions';
import TeachersOverview, { type TeacherOverview } from '@/components/dashboard/teachers-overview';
import WelcomeHeader from '@/components/dashboard/welcome-header';
import { chartOptions, ReportChartCard, type ReportAnalytics, type VerificationAnalytics } from '@/components/reports/shared';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import {
    ArcElement,
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Title,
    Tooltip,
} from 'chart.js';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Bar, Doughnut, Line, Pie } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Dashboard', href: '/admin/dashboard' }];

const timeFilters = [
    { id: 'today', label: 'Today' },
    { id: '7days', label: '7 Days' },
    { id: '30days', label: '30 Days' },
];

const trendTabs = [
    { id: 'dailyTrend', label: 'Daily' },
    { id: 'weeklyTrend', label: 'Weekly' },
    { id: 'monthlyTrend', label: 'Monthly' },
] as const;

type TrendTab = (typeof trendTabs)[number]['id'];

interface DashboardProps {
    welcome: {
        adminName: string;
        date: string;
        time: string;
        systemName: string;
    };
    kpiCards: KpiCardData[];
    analytics: Pick<ReportAnalytics, 'dailyTrend' | 'weeklyTrend' | 'monthlyTrend'>;
    attendanceBreakdown: { present: number; late: number; absent: number };
    verificationAnalytics: VerificationAnalytics;
    recentActivities: ActivityItem[];
    insights: {
        most_punctual_teacher: ReportAnalytics['performanceAnalytics']['highest_attendance'];
        most_punctual_administrator: ReportAnalytics['performanceAnalytics']['highest_attendance'];
        highest_attendance_rate: number;
        absent_today_count: number;
        compliance_rate: number;
        absent_today: Array<{ name: string; role: string; department: string }>;
    };
    facultyDistribution: { labels: string[]; data: number[] };
    teachers: TeacherOverview[];
    initialAttendanceTrend: {
        labels: string[];
        present: number[];
        absent: number[];
        late: number[];
    };
}

export default function Dashboard({
    welcome,
    kpiCards,
    analytics,
    attendanceBreakdown,
    verificationAnalytics,
    recentActivities,
    insights,
    facultyDistribution,
    teachers,
    initialAttendanceTrend,
}: DashboardProps) {
    const [timeFilter, setTimeFilter] = useState('30days');
    const [trendTab, setTrendTab] = useState<TrendTab>('dailyTrend');
    const [attendanceChartData, setAttendanceChartData] = useState(initialAttendanceTrend);
    const [loadingChart, setLoadingChart] = useState(false);

    useEffect(() => {
        if (timeFilter === '30days') {
            setAttendanceChartData(initialAttendanceTrend);
            return;
        }

        const fetchData = async () => {
            setLoadingChart(true);
            try {
                const response = await axios.get(route('admin.dashboard.attendance-data'), {
                    params: { range: timeFilter },
                });
                setAttendanceChartData(response.data);
            } catch (error) {
                console.error('Failed to fetch chart data', error);
            } finally {
                setLoadingChart(false);
            }
        };

        fetchData();
    }, [timeFilter, initialAttendanceTrend]);

    const attendanceTrendData = useMemo(
        () => ({
            labels: attendanceChartData.labels ?? [],
            datasets: [
                {
                    label: 'Present',
                    data: attendanceChartData.present ?? [],
                    borderColor: 'rgb(16, 185, 129)',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    tension: 0.35,
                    fill: true,
                },
                {
                    label: 'Absent',
                    data: attendanceChartData.absent ?? [],
                    borderColor: 'rgb(239, 68, 68)',
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    tension: 0.35,
                    fill: true,
                },
                {
                    label: 'Late',
                    data: attendanceChartData.late ?? [],
                    borderColor: 'rgb(245, 158, 11)',
                    backgroundColor: 'rgba(245, 158, 11, 0.08)',
                    tension: 0.35,
                    fill: true,
                },
            ],
        }),
        [attendanceChartData],
    );

    const selectedTrend = analytics[trendTab] ?? [];

    const periodTrendData = useMemo(
        () => ({
            labels: selectedTrend.map((point) => point.label),
            datasets: [
                {
                    label: 'Present',
                    data: selectedTrend.map((point) => point.present),
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                },
                {
                    label: 'Late',
                    data: selectedTrend.map((point) => point.late),
                    backgroundColor: 'rgba(245, 158, 11, 0.8)',
                },
            ],
        }),
        [selectedTrend],
    );

    const breakdownData = useMemo(
        () => ({
            labels: ['Present', 'Late', 'Absent'],
            datasets: [
                {
                    data: [attendanceBreakdown.present, attendanceBreakdown.late, attendanceBreakdown.absent],
                    backgroundColor: ['rgba(16, 185, 129, 0.85)', 'rgba(245, 158, 11, 0.85)', 'rgba(239, 68, 68, 0.85)'],
                    borderWidth: 0,
                },
            ],
        }),
        [attendanceBreakdown],
    );

    const verificationData = useMemo(
        () => ({
            labels: ['Face Success', 'Face Failure', 'Geo Success', 'Geo Failure'],
            datasets: [
                {
                    data: [
                        verificationAnalytics.face_success_rate,
                        verificationAnalytics.face_failure_rate,
                        verificationAnalytics.geolocation_success_rate,
                        verificationAnalytics.geolocation_failure_rate,
                    ],
                    backgroundColor: [
                        'rgba(16, 185, 129, 0.85)',
                        'rgba(239, 68, 68, 0.85)',
                        'rgba(59, 130, 246, 0.85)',
                        'rgba(245, 158, 11, 0.85)',
                    ],
                    borderWidth: 0,
                },
            ],
        }),
        [verificationAnalytics],
    );

    const facultyPieData = useMemo(
        () => ({
            labels: facultyDistribution.labels,
            datasets: [
                {
                    label: 'Teachers',
                    data: facultyDistribution.data,
                    backgroundColor: [
                        'rgba(59, 130, 246, 0.85)',
                        'rgba(16, 185, 129, 0.85)',
                        'rgba(245, 158, 11, 0.85)',
                        'rgba(147, 51, 234, 0.85)',
                        'rgba(236, 72, 153, 0.85)',
                        'rgba(107, 114, 128, 0.85)',
                    ],
                    borderWidth: 0,
                },
            ],
        }),
        [facultyDistribution],
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />

            <div className="flex flex-1 flex-col gap-8 p-4 md:p-6">
                <WelcomeHeader {...welcome} />

                <KpiGrid cards={kpiCards} />

                <QuickActions />

                <section className="space-y-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-sidebar-foreground">Attendance Analytics</h2>
                            <p className="text-sm text-sidebar-foreground/60">Trends, breakdowns, and verification performance</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {timeFilters.map((filter) => (
                                <button
                                    key={filter.id}
                                    type="button"
                                    onClick={() => setTimeFilter(filter.id)}
                                    className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                                        timeFilter === filter.id
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted text-sidebar-foreground hover:bg-muted/80'
                                    }`}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-3">
                        <ReportChartCard title="Daily Attendance Trend">
                            <div className="relative h-72">
                                {loadingChart ? (
                                    <div className="flex h-full items-center justify-center text-sidebar-foreground/60">
                                        <Loader2 className="size-6 animate-spin" aria-hidden="true" />
                                        <span className="ml-2 text-sm">Loading chart...</span>
                                    </div>
                                ) : (
                                    <Line data={attendanceTrendData} options={chartOptions} />
                                )}
                            </div>
                        </ReportChartCard>

                        <ReportChartCard title="Today's Attendance Breakdown">
                            <div className="h-72">
                                <Doughnut data={breakdownData} options={{ ...chartOptions, cutout: '62%' }} />
                            </div>
                        </ReportChartCard>

                        <ReportChartCard title="Verification Analytics">
                            <div className="h-72">
                                <Doughnut data={verificationData} options={{ ...chartOptions, cutout: '58%' }} />
                            </div>
                        </ReportChartCard>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-3">
                        <div className="xl:col-span-2">
                            <ReportChartCard title="Period Attendance Comparison">
                                <div className="mb-4 flex flex-wrap gap-2">
                                    {trendTabs.map((tab) => (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setTrendTab(tab.id)}
                                            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                                                trendTab === tab.id
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'bg-muted text-sidebar-foreground hover:bg-muted/80'
                                            }`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="h-64">
                                    <Bar data={periodTrendData} options={chartOptions} />
                                </div>
                            </ReportChartCard>
                        </div>

                        <ReportChartCard title="Faculty Distribution">
                            <div className="h-72">
                                <Pie data={facultyPieData} options={chartOptions} />
                            </div>
                        </ReportChartCard>
                    </div>
                </section>

                <div className="grid gap-6 xl:grid-cols-2">
                    <InsightsPanel insights={insights} />
                    <ActivityFeed activities={recentActivities} />
                </div>

                <TeachersOverview teachers={teachers} />
            </div>
        </AppLayout>
    );
}
