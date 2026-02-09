import AppLayout from '@/layouts/app-layout';
import { SharedData, type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { 
  Calendar, 
  Users, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  BookOpen,
  Filter,
  ChevronDown,
} from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
  },
  {
    title: 'Reports',
    href: '/reports',
  },
];

// Mock data for the reports
const summaryMetrics = [
  {
    title: 'Monthly Avg Attendance',
    value: '94.8%',
    change: '+2.4% vs last mo',
    changeType: 'positive',
    subtitle: ''
  },
  {
    title: 'Highest Attendance Class',
    value: 'Grade 10A',
    subtitle: '98.5%',
    change: '',
    changeType: 'neutral',
    badge: '98.5%',
    badgeColor: 'text-blue-600 bg-blue-50'
  },
  {
    title: 'Critical Attendance Alert',
    value: '02',
    subtitle: 'Students',
    change: '↓ 75%',
    changeType: 'negative',
    changeColor: 'text-red-600'
  },
  {
    title: 'Total Sessions Conducted',
    value: '112',
    change: '',
    changeType: 'neutral',
    subtitle: ''
  }
];

const attendanceRatePerClass = [
  { class: 'Grade 10A - Math', rate: 98.5, color: 'bg-blue-500' },
  { class: 'Grade 12B - Physics', rate: 92.1, color: 'bg-blue-500' },
  { class: 'Grade 9C - Earth Science', rate: 88.4, color: 'bg-blue-500' },
  { class: 'Grade 11A - Chemistry', rate: 95.6, color: 'bg-blue-500' },
];

const classPerformanceSummary = [
  {
    class: 'Grade 10 Section A',
    present: 942,
    absent: 12,
    late: 3,
    reliability: 'Excellent',
    reliabilityColor: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    trend: 'up'
  },
  {
    class: 'Grade 12 Section B',
    present: 810,
    absent: 45,
    late: 22,
    reliability: 'Average',
    reliabilityColor: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    trend: 'neutral'
  },
];

// Heatmap data - 5 weeks x 7 days
const generateHeatmapData = () => {
  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const weeks = 5;
  
  return Array.from({ length: weeks }, (_, weekIndex) => {
    return days.map((day, dayIndex) => {
      // Generate random intensity (0-4)
      const intensity = Math.floor(Math.random() * 5);
      return {
        day,
        week: weekIndex,
        intensity,
        isHoliday: intensity === 0 && Math.random() > 0.8
      };
    });
  });
};

const heatmapData = generateHeatmapData();

const getHeatmapColor = (intensity: number, isHoliday: boolean) => {
  if (isHoliday) return 'bg-red-200 dark:bg-red-900/30';
  
  const colors = [
    'bg-blue-100 dark:bg-blue-900/20',
    'bg-blue-200 dark:bg-blue-800/40',
    'bg-blue-400 dark:bg-blue-700/60',
    'bg-blue-500 dark:bg-blue-600/80',
    'bg-blue-600 dark:bg-blue-500',
  ];
  return colors[intensity] || colors[0];
};

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState('Oct 01, 2023 - Oct 31, 2023');
  const [selectedClass, setSelectedClass] = useState('All Assigned Classes');
  const page = usePage<SharedData>();
  const { auth } = page.props;

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Attendance Reports" />
      
      <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4 md:p-6 overflow-x-auto">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-sidebar-foreground dark:text-sidebar-foreground">
            Attendance Reports
          </h1>
          <p className="text-sm text-sidebar-foreground/60 dark:text-sidebar-foreground/60 mt-1">
            Comprehensive attendance analytics and insights
          </p>
        </div>

        {/* Filters Section */}
        <div className="bg-white dark:bg-sidebar-accent rounded-xl border border-sidebar-border/70 dark:border-sidebar-border p-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Date Range Filter */}
            <div>
              <label className="block text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider mb-2">
                Date Range
              </label>
              <div className="relative">
                <div className="flex items-center gap-2 px-3 py-2 border border-sidebar-border/50 rounded-lg bg-white dark:bg-sidebar-accent cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                  <Calendar className="h-4 w-4 text-sidebar-foreground/60" />
                  <input
                    type="text"
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-sidebar-foreground dark:text-sidebar-foreground outline-none"
                    placeholder="Select date range"
                  />
                </div>
              </div>
            </div>

            {/* Class Section Filter */}
            <div>
              <label className="block text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider mb-2">
                Class Section
              </label>
              <div className="relative">
                <div className="flex items-center gap-2 px-3 py-2 border border-sidebar-border/50 rounded-lg bg-white dark:bg-sidebar-accent cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                  <Users className="h-4 w-4 text-sidebar-foreground/60" />
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-sidebar-foreground dark:text-sidebar-foreground outline-none cursor-pointer"
                  >
                    <option>All Assigned Classes</option>
                    <option>Grade 10A</option>
                    <option>Grade 12B</option>
                    <option>Grade 9C</option>
                    <option>Grade 11A</option>
                  </select>
                  <ChevronDown className="h-4 w-4 text-sidebar-foreground/60" />
                </div>
              </div>
            </div>

            {/* Apply Filters Button */}
            <div className="flex items-end">
              <button className="w-full px-4 py-2 bg-gray-900 dark:bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-700 transition-colors">
                Apply Filters
              </button>
            </div>
          </div>
        </div>

        {/* Summary Metrics */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {summaryMetrics.map((metric, index) => (
            <div
              key={index}
              className="bg-white dark:bg-sidebar-accent rounded-xl border border-sidebar-border/70 dark:border-sidebar-border p-5 shadow-sm"
            >
              <p className="text-xs font-medium text-sidebar-foreground/60 dark:text-sidebar-foreground/60 mb-3">
                {metric.title}
              </p>
              
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-sidebar-foreground dark:text-sidebar-foreground">
                  {metric.value}
                </p>
                {metric.subtitle && (
                  <p className="text-lg font-semibold text-sidebar-foreground/60 dark:text-sidebar-foreground/60">
                    {metric.subtitle}
                  </p>
                )}
              </div>

              {metric.badge && (
                <div className="mt-2">
                  <span className={`inline-block px-2 py-0.5 text-sm font-semibold rounded ${metric.badgeColor}`}>
                    {metric.badge}
                  </span>
                </div>
              )}

              {metric.change && (
                <div className="mt-2">
                  <span className={`text-sm font-medium ${
                    metric.changeType === 'positive' ? 'text-green-600' : 
                    metric.changeType === 'negative' ? 'text-red-600' : 
                    'text-sidebar-foreground/60'
                  }`}>
                    {metric.change}
                  </span>
                </div>
              )}

              {metric.changeColor && (
                <div className="mt-2">
                  <span className={`text-sm font-medium ${metric.changeColor}`}>
                    {metric.change}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Attendance Rate per Class */}
          <div className="bg-white dark:bg-sidebar-accent rounded-xl border border-sidebar-border/70 dark:border-sidebar-border p-6 shadow-sm">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-sidebar-foreground dark:text-sidebar-foreground">
                Attendance Rate per Class
              </h3>
              <p className="text-sm text-sidebar-foreground/60 dark:text-sidebar-foreground/60 mt-1">
                Performance distribution across sections
              </p>
            </div>

            <div className="space-y-4">
              {attendanceRatePerClass.map((item, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-sidebar-foreground dark:text-sidebar-foreground">
                      {item.class}
                    </span>
                    <span className="text-sm font-bold text-sidebar-foreground dark:text-sidebar-foreground">
                      {item.rate}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div 
                      className={`${item.color} h-2.5 rounded-full transition-all duration-500`}
                      style={{ width: `${item.rate}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly Consistency Heatmap */}
          <div className="bg-white dark:bg-sidebar-accent rounded-xl border border-sidebar-border/70 dark:border-sidebar-border p-6 shadow-sm">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-sidebar-foreground dark:text-sidebar-foreground">
                Monthly Consistency Heatmap
              </h3>
              <p className="text-sm text-sidebar-foreground/60 dark:text-sidebar-foreground/60 mt-1">
                Daily presence trends for October
              </p>
            </div>

            {/* Day labels */}
            <div className="flex gap-1 mb-2 pl-0">
              {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day) => (
                <div key={day} className="flex-1 text-center">
                  <span className="text-xs font-medium text-sidebar-foreground/50">
                    {day}
                  </span>
                </div>
              ))}
            </div>

            {/* Heatmap grid */}
            <div className="space-y-1">
              {heatmapData.map((week, weekIndex) => (
                <div key={weekIndex} className="flex gap-1">
                  {week.map((cell, dayIndex) => (
                    <div
                      key={`${weekIndex}-${dayIndex}`}
                      className={`flex-1 aspect-square rounded ${getHeatmapColor(cell.intensity, cell.isHoliday)} transition-colors hover:ring-2 hover:ring-blue-400 cursor-pointer`}
                      title={`${cell.day}, Week ${weekIndex + 1}: ${cell.isHoliday ? 'Holiday/No Class' : `${cell.intensity * 25}% attendance`}`}
                    ></div>
                  ))}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-sidebar-border/30">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-sidebar-foreground/60">LESS</span>
                <div className="flex gap-1">
                  <div className="w-4 h-4 rounded bg-blue-100 dark:bg-blue-900/20"></div>
                  <div className="w-4 h-4 rounded bg-blue-300 dark:bg-blue-800/40"></div>
                  <div className="w-4 h-4 rounded bg-blue-500 dark:bg-blue-600/80"></div>
                  <div className="w-4 h-4 rounded bg-blue-600 dark:bg-blue-500"></div>
                </div>
                <span className="text-xs font-medium text-sidebar-foreground/60">MORE</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-red-200 dark:bg-red-900/30"></div>
                <span className="text-xs font-medium text-sidebar-foreground/60">HOLIDAY / NO CLASS</span>
              </div>
            </div>
          </div>
        </div>

        {/* Class Performance Summary Table */}
        <div className="bg-white dark:bg-sidebar-accent rounded-xl border border-sidebar-border/70 dark:border-sidebar-border p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-sidebar-foreground dark:text-sidebar-foreground">
              Class Performance Summary
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-sidebar-border/30">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
                    Class
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
                    Present
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
                    Absent
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
                    Late
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
                    Reliability
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
                    Trend
                  </th>
                </tr>
              </thead>
              <tbody>
                {classPerformanceSummary.map((classData, index) => (
                  <tr key={index} className="border-b border-sidebar-border/20 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-4 px-4">
                      <span className="font-medium text-sidebar-foreground dark:text-sidebar-foreground">
                        {classData.class}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sidebar-foreground/80 dark:text-sidebar-foreground/80">
                        {classData.present}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sidebar-foreground/80 dark:text-sidebar-foreground/80">
                        {classData.absent}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sidebar-foreground/80 dark:text-sidebar-foreground/80">
                        {classData.late}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${classData.reliabilityColor}`}>
                        {classData.reliability}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      {classData.trend === 'up' && (
                        <TrendingUp className="h-5 w-5 text-green-500" />
                      )}
                      {classData.trend === 'neutral' && (
                        <div className="flex items-center">
                          <div className="w-5 h-0.5 bg-orange-500"></div>
                          <div className="w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-b-4 border-b-orange-500 ml-1"></div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}