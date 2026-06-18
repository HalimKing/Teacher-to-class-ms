import { ReportAnalytics, ReportChartCard, chartOptions, trendChartOptions } from '@/components/reports/shared';
import { useState } from 'react';
import { Bar, Doughnut, Line, Pie } from 'react-chartjs-2';

interface ReportAnalyticsSectionProps {
    analytics: ReportAnalytics;
    variant?: 'admin' | 'lecturer';
}

export function ReportAnalyticsSection({ analytics, variant = 'admin' }: ReportAnalyticsSectionProps) {
    const [trendView, setTrendView] = useState<'dailyTrend' | 'weeklyTrend' | 'monthlyTrend'>('dailyTrend');
    const trendData = analytics[trendView] ?? [];

    const attendanceTrendChart = {
        labels: trendData.map((item) => item.label),
        datasets: [
            { label: 'Present', data: trendData.map((item) => item.present), borderColor: 'rgb(34, 197, 94)', backgroundColor: 'rgba(34, 197, 94, 0.2)', tension: 0.3 },
            { label: 'Late', data: trendData.map((item) => item.late), borderColor: 'rgb(245, 158, 11)', backgroundColor: 'rgba(245, 158, 11, 0.2)', tension: 0.3 },
            { label: 'Absent', data: trendData.map((item) => item.absent ?? 0), borderColor: 'rgb(239, 68, 68)', backgroundColor: 'rgba(239, 68, 68, 0.2)', tension: 0.3 },
        ],
    };

    const verificationChart = {
        labels: ['Face Verified', 'Face Unverified', 'Geo Verified', 'Geo Failed'],
        datasets: [{
            data: [
                analytics.verificationAnalytics.face_success_rate,
                analytics.verificationAnalytics.face_failure_rate,
                analytics.verificationAnalytics.geolocation_success_rate,
                analytics.verificationAnalytics.geolocation_failure_rate,
            ],
            backgroundColor: ['#22c55e', '#ef4444', '#3b82f6', '#f97316'],
        }],
    };

    const breakdownChart = {
        labels: analytics.attendanceBreakdown?.map((item) => item.label) ?? [],
        datasets: [{
            data: analytics.attendanceBreakdown?.map((item) => item.value) ?? [],
            backgroundColor: ['#22c55e', '#ef4444', '#f59e0b', '#8b5cf6'],
        }],
    };

    const punctualityChart = {
        labels: analytics.punctualityAnalytics?.map((item) => item.label) ?? [],
        datasets: [{
            label: 'Arrivals',
            data: analytics.punctualityAnalytics?.map((item) => item.value) ?? [],
            backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b'],
        }],
    };

    const rankingChart = {
        labels: analytics.performanceAnalytics.attendance_ranking.slice(0, 8).map((item) => item.name),
        datasets: [{
            label: variant === 'lecturer' ? 'Course Attendance Rate (%)' : 'Attendance Rate (%)',
            data: analytics.performanceAnalytics.attendance_ranking.slice(0, 8).map((item) => item.attendance_rate),
            backgroundColor: 'rgba(59, 130, 246, 0.7)',
        }],
    };

    return (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ReportChartCard title="Attendance Trends">
                <div className="mb-3 flex flex-wrap gap-2">
                    {(['dailyTrend', 'weeklyTrend', 'monthlyTrend'] as const).map((view) => (
                        <button
                            key={view}
                            onClick={() => setTrendView(view)}
                            className={`rounded-md px-3 py-1 text-xs ${trendView === view ? 'bg-gray-900 text-white' : 'bg-sidebar-accent text-sidebar-foreground'}`}
                        >
                            {view === 'dailyTrend' ? 'Daily' : view === 'weeklyTrend' ? 'Weekly' : 'Monthly'}
                        </button>
                    ))}
                </div>
                <div className="h-72"><Line data={attendanceTrendChart} options={trendChartOptions} /></div>
            </ReportChartCard>

            <ReportChartCard title="Verification Analytics">
                <div className="h-72"><Pie data={verificationChart} options={chartOptions} /></div>
            </ReportChartCard>

            {variant === 'lecturer' && analytics.attendanceBreakdown && (
                <ReportChartCard title="Attendance Breakdown">
                    <div className="h-72"><Doughnut data={breakdownChart} options={chartOptions} /></div>
                </ReportChartCard>
            )}

            {variant === 'lecturer' && analytics.punctualityAnalytics && (
                <ReportChartCard title="Punctuality Analytics">
                    <div className="h-72"><Bar data={punctualityChart} options={chartOptions} /></div>
                </ReportChartCard>
            )}

            <ReportChartCard title={variant === 'lecturer' ? 'Course Attendance Ranking' : 'Attendance Ranking'}>
                <div className="h-72"><Bar data={rankingChart} options={chartOptions} /></div>
            </ReportChartCard>

            {variant === 'admin' && (
                <ReportChartCard title="Performance Highlights">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                            <h3 className="mb-2 text-sm font-semibold text-sidebar-foreground">Most Punctual</h3>
                            <div className="space-y-2">
                                {analytics.performanceAnalytics.most_punctual.map((item, index) => (
                                    <div key={index} className="rounded-lg border border-sidebar-border/50 p-2 text-sm">
                                        <div className="font-medium">{item.name}</div>
                                        <div className="text-sidebar-foreground/60">{item.department} · {item.attendance_rate}%</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h3 className="mb-2 text-sm font-semibold text-sidebar-foreground">Frequently Late</h3>
                            <div className="space-y-2">
                                {analytics.performanceAnalytics.frequently_late.map((item, index) => (
                                    <div key={index} className="rounded-lg border border-sidebar-border/50 p-2 text-sm">
                                        <div className="font-medium">{item.name}</div>
                                        <div className="text-sidebar-foreground/60">{item.department} · {item.late} late check-ins</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    {(analytics.performanceAnalytics.highest_attendance || analytics.performanceAnalytics.lowest_attendance) && (
                        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                            {analytics.performanceAnalytics.highest_attendance && (
                                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm dark:border-green-900 dark:bg-green-950/20">
                                    <div className="font-semibold text-green-700 dark:text-green-400">Highest Attendance</div>
                                    <div>{analytics.performanceAnalytics.highest_attendance.name} · {analytics.performanceAnalytics.highest_attendance.attendance_rate}%</div>
                                </div>
                            )}
                            {analytics.performanceAnalytics.lowest_attendance && (
                                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950/20">
                                    <div className="font-semibold text-red-700 dark:text-red-400">Lowest Attendance</div>
                                    <div>{analytics.performanceAnalytics.lowest_attendance.name} · {analytics.performanceAnalytics.lowest_attendance.attendance_rate}%</div>
                                </div>
                            )}
                        </div>
                    )}
                </ReportChartCard>
            )}
        </div>
    );
}
