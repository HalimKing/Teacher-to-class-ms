import AppLayout from '@/layouts/app-layout';
import { SharedData, type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { 
  Search,
  Calendar,
  Clock,
  Users,
  Download,
  Filter,
  ChevronDown,
  Check,
  X,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  FileText,
  Eye,
  Edit,
  Printer,
} from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
  },
  {
    title: 'Attendance History',
    href: '/attendance/history',
  },
];

// Summary statistics
const summaryStats = [
  {
    title: 'Total Sessions',
    value: '156',
    icon: Calendar,
    iconColor: 'text-blue-500',
    iconBg: 'bg-blue-100 dark:bg-blue-900/20',
    change: '+12',
    changeType: 'positive',
  },
  {
    title: 'Average Attendance',
    value: '92.3%',
    icon: Users,
    iconColor: 'text-green-500',
    iconBg: 'bg-green-100 dark:bg-green-900/20',
    change: '+2.4%',
    changeType: 'positive',
  },
  {
    title: 'Total Students',
    value: '847',
    icon: Users,
    iconColor: 'text-purple-500',
    iconBg: 'bg-purple-100 dark:bg-purple-900/20',
    change: '+15',
    changeType: 'positive',
  },
  {
    title: 'Absent Rate',
    value: '7.7%',
    icon: AlertCircle,
    iconColor: 'text-orange-500',
    iconBg: 'bg-orange-100 dark:bg-orange-900/20',
    change: '-1.2%',
    changeType: 'positive',
  },
];

// Mock attendance records data
const attendanceRecords = [
  {
    id: 1,
    date: '2025-02-07',
    dateFormatted: 'Feb 07, 2025',
    dayOfWeek: 'Friday',
    course: 'Grade 10 - Mathematics',
    courseCode: 'MATH10A',
    time: '09:00 AM - 10:30 AM',
    totalStudents: 45,
    present: 43,
    absent: 2,
    late: 0,
    attendanceRate: 95.6,
    status: 'completed',
    takenBy: 'Dr. Sarah Johnson',
  },
  {
    id: 2,
    date: '2025-02-06',
    dateFormatted: 'Feb 06, 2025',
    dayOfWeek: 'Thursday',
    course: 'Grade 12 - Physics',
    courseCode: 'PHYS12B',
    time: '11:30 AM - 01:00 PM',
    totalStudents: 38,
    present: 35,
    absent: 2,
    late: 1,
    attendanceRate: 92.1,
    status: 'completed',
    takenBy: 'Dr. Sarah Johnson',
  },
  {
    id: 3,
    date: '2025-02-06',
    dateFormatted: 'Feb 06, 2025',
    dayOfWeek: 'Thursday',
    course: 'Grade 9 - Earth Science',
    courseCode: 'EARTH9C',
    time: '01:00 PM - 02:30 PM',
    totalStudents: 42,
    present: 38,
    absent: 3,
    late: 1,
    attendanceRate: 90.5,
    status: 'completed',
    takenBy: 'Dr. Sarah Johnson',
  },
  {
    id: 4,
    date: '2025-02-05',
    dateFormatted: 'Feb 05, 2025',
    dayOfWeek: 'Wednesday',
    course: 'Grade 10 - Mathematics',
    courseCode: 'MATH10A',
    time: '09:00 AM - 10:30 AM',
    totalStudents: 45,
    present: 44,
    absent: 1,
    late: 0,
    attendanceRate: 97.8,
    status: 'completed',
    takenBy: 'Dr. Sarah Johnson',
  },
  {
    id: 5,
    date: '2025-02-05',
    dateFormatted: 'Feb 05, 2025',
    dayOfWeek: 'Wednesday',
    course: 'Grade 11 - Chemistry',
    courseCode: 'CHEM11A',
    time: '10:00 AM - 11:30 AM',
    totalStudents: 40,
    present: 39,
    absent: 0,
    late: 1,
    attendanceRate: 97.5,
    status: 'completed',
    takenBy: 'Dr. Sarah Johnson',
  },
  {
    id: 6,
    date: '2025-02-04',
    dateFormatted: 'Feb 04, 2025',
    dayOfWeek: 'Tuesday',
    course: 'Grade 12 - Physics',
    courseCode: 'PHYS12B',
    time: '11:30 AM - 01:00 PM',
    totalStudents: 38,
    present: 33,
    absent: 4,
    late: 1,
    attendanceRate: 86.8,
    status: 'completed',
    takenBy: 'Dr. Sarah Johnson',
  },
  {
    id: 7,
    date: '2025-02-03',
    dateFormatted: 'Feb 03, 2025',
    dayOfWeek: 'Monday',
    course: 'Grade 10 - Mathematics',
    courseCode: 'MATH10A',
    time: '09:00 AM - 10:30 AM',
    totalStudents: 45,
    present: 42,
    absent: 3,
    late: 0,
    attendanceRate: 93.3,
    status: 'completed',
    takenBy: 'Dr. Sarah Johnson',
  },
  {
    id: 8,
    date: '2025-02-03',
    dateFormatted: 'Feb 03, 2025',
    dayOfWeek: 'Monday',
    course: 'Grade 9 - Earth Science',
    courseCode: 'EARTH9C',
    time: '01:00 PM - 02:30 PM',
    totalStudents: 42,
    present: 40,
    absent: 1,
    late: 1,
    attendanceRate: 95.2,
    status: 'completed',
    takenBy: 'Dr. Sarah Johnson',
  },
];

export default function AttendanceHistoryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedDateRange, setSelectedDateRange] = useState('last-30-days');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const page = usePage<SharedData>();
  const { auth } = page.props;

  const filteredRecords = attendanceRecords.filter(record => {
    const matchesSearch = 
      record.course.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.courseCode.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCourse = selectedCourse === 'all' || record.courseCode === selectedCourse;
    const matchesStatus = selectedStatus === 'all' || record.status === selectedStatus;
    
    return matchesSearch && matchesCourse && matchesStatus;
  });

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Attendance History" />
      
      <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4 md:p-6 overflow-x-auto">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-sidebar-foreground dark:text-sidebar-foreground">
              Attendance History
            </h1>
            <p className="text-sm text-sidebar-foreground/60 dark:text-sidebar-foreground/60 mt-1">
              View and manage all attendance records
            </p>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 text-sm font-medium text-sidebar-foreground dark:text-sidebar-foreground border border-sidebar-border/50 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2">
              <Printer className="h-4 w-4" />
              Print
            </button>
            <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export Data
            </button>
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {summaryStats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="bg-white dark:bg-sidebar-accent rounded-xl border border-sidebar-border/70 dark:border-sidebar-border p-5 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-sidebar-foreground/60 dark:text-sidebar-foreground/60">
                      {stat.title}
                    </p>
                    <p className="text-2xl font-bold text-sidebar-foreground dark:text-sidebar-foreground mt-1">
                      {stat.value}
                    </p>
                    <div className={`flex items-center gap-1 mt-2 text-sm ${
                      stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {stat.changeType === 'positive' ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                      <span className="font-medium">{stat.change}</span>
                      <span className="text-sidebar-foreground/50 text-xs">vs last month</span>
                    </div>
                  </div>
                  <div className={`p-3 rounded-xl ${stat.iconBg}`}>
                    <Icon className={`h-6 w-6 ${stat.iconColor}`} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Filters Section */}
        <div className="bg-white dark:bg-sidebar-accent rounded-xl border border-sidebar-border/70 dark:border-sidebar-border p-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="lg:col-span-1">
              <label className="block text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider mb-2">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sidebar-foreground/40" />
                <input
                  type="text"
                  placeholder="Course or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-sidebar-border/50 rounded-lg bg-white dark:bg-sidebar-accent text-sidebar-foreground dark:text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            {/* Course Filter */}
            <div>
              <label className="block text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider mb-2">
                Course
              </label>
              <div className="relative">
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className="w-full px-3 py-2 border border-sidebar-border/50 rounded-lg bg-white dark:bg-sidebar-accent text-sidebar-foreground dark:text-sidebar-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm appearance-none cursor-pointer"
                >
                  <option value="all">All Courses</option>
                  <option value="MATH10A">Grade 10 - Mathematics</option>
                  <option value="PHYS12B">Grade 12 - Physics</option>
                  <option value="EARTH9C">Grade 9 - Earth Science</option>
                  <option value="CHEM11A">Grade 11 - Chemistry</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sidebar-foreground/60 pointer-events-none" />
              </div>
            </div>

            {/* Date Range Filter */}
            <div>
              <label className="block text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider mb-2">
                Date Range
              </label>
              <div className="relative">
                <select
                  value={selectedDateRange}
                  onChange={(e) => setSelectedDateRange(e.target.value)}
                  className="w-full px-3 py-2 border border-sidebar-border/50 rounded-lg bg-white dark:bg-sidebar-accent text-sidebar-foreground dark:text-sidebar-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm appearance-none cursor-pointer"
                >
                  <option value="today">Today</option>
                  <option value="last-7-days">Last 7 Days</option>
                  <option value="last-30-days">Last 30 Days</option>
                  <option value="this-month">This Month</option>
                  <option value="last-month">Last Month</option>
                  <option value="custom">Custom Range</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sidebar-foreground/60 pointer-events-none" />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider mb-2">
                Status
              </label>
              <div className="relative">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-sidebar-border/50 rounded-lg bg-white dark:bg-sidebar-accent text-sidebar-foreground dark:text-sidebar-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm appearance-none cursor-pointer"
                >
                  <option value="all">All Status</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sidebar-foreground/60 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Attendance Records Table */}
        <div className="bg-white dark:bg-sidebar-accent rounded-xl border border-sidebar-border/70 dark:border-sidebar-border shadow-sm overflow-hidden">
          <div className="p-6 border-b border-sidebar-border/30">
            <h3 className="text-lg font-semibold text-sidebar-foreground dark:text-sidebar-foreground">
              Attendance Records
            </h3>
            <p className="text-sm text-sidebar-foreground/60 dark:text-sidebar-foreground/60 mt-1">
              {filteredRecords.length} records found
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
                    Course
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
                    Present
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
                    Absent
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
                    Late
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
                    Rate
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr 
                    key={record.id}
                    className="border-b border-sidebar-border/20 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    {/* Date & Time */}
                    <td className="py-4 px-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-sidebar-foreground dark:text-sidebar-foreground text-sm">
                          {record.dateFormatted}
                        </span>
                        <span className="text-xs text-sidebar-foreground/60 dark:text-sidebar-foreground/60">
                          {record.dayOfWeek} • {record.time}
                        </span>
                      </div>
                    </td>

                    {/* Course */}
                    <td className="py-4 px-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-sidebar-foreground dark:text-sidebar-foreground text-sm">
                          {record.course}
                        </span>
                        <span className="text-xs text-sidebar-foreground/60 dark:text-sidebar-foreground/60">
                          {record.courseCode}
                        </span>
                      </div>
                    </td>

                    {/* Total Students */}
                    <td className="py-4 px-4 text-center">
                      <span className="font-semibold text-sidebar-foreground dark:text-sidebar-foreground">
                        {record.totalStudents}
                      </span>
                    </td>

                    {/* Present */}
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Check className="h-4 w-4 text-green-500" />
                        <span className="font-semibold text-green-700 dark:text-green-400">
                          {record.present}
                        </span>
                      </div>
                    </td>

                    {/* Absent */}
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <X className="h-4 w-4 text-red-500" />
                        <span className="font-semibold text-red-700 dark:text-red-400">
                          {record.absent}
                        </span>
                      </div>
                    </td>

                    {/* Late */}
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Clock className="h-4 w-4 text-orange-500" />
                        <span className="font-semibold text-orange-700 dark:text-orange-400">
                          {record.late}
                        </span>
                      </div>
                    </td>

                    {/* Attendance Rate */}
                    <td className="py-4 px-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`font-bold text-sm ${
                          record.attendanceRate >= 95 ? 'text-green-600 dark:text-green-400' :
                          record.attendanceRate >= 85 ? 'text-blue-600 dark:text-blue-400' :
                          'text-orange-600 dark:text-orange-400'
                        }`}>
                          {record.attendanceRate}%
                        </span>
                        <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
                          <div 
                            className={`h-1.5 rounded-full ${
                              record.attendanceRate >= 95 ? 'bg-green-500' :
                              record.attendanceRate >= 85 ? 'bg-blue-500' :
                              'bg-orange-500'
                            }`}
                            style={{ width: `${record.attendanceRate}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                        {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4 text-sidebar-foreground/60" />
                        </button>
                        <button 
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                          title="Edit Record"
                        >
                          <Edit className="h-4 w-4 text-sidebar-foreground/60" />
                        </button>
                        <button 
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                          title="Download Report"
                        >
                          <Download className="h-4 w-4 text-sidebar-foreground/60" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Empty State */}
          {filteredRecords.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                <FileText className="h-10 w-10 text-sidebar-foreground/40" />
              </div>
              <h3 className="text-lg font-semibold text-sidebar-foreground dark:text-sidebar-foreground mb-2">
                No records found
              </h3>
              <p className="text-sm text-sidebar-foreground/60 dark:text-sidebar-foreground/60 text-center max-w-md">
                Try adjusting your filters or search query
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {filteredRecords.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-sidebar-foreground/60 dark:text-sidebar-foreground/60">
              Showing <span className="font-medium">1</span> to <span className="font-medium">{filteredRecords.length}</span> of{' '}
              <span className="font-medium">{filteredRecords.length}</span> results
            </p>
            <div className="flex items-center gap-2">
              <button className="px-3 py-2 text-sm font-medium text-sidebar-foreground dark:text-sidebar-foreground border border-sidebar-border/50 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                Previous
              </button>
              <button className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg">
                1
              </button>
              <button className="px-3 py-2 text-sm font-medium text-sidebar-foreground dark:text-sidebar-foreground border border-sidebar-border/50 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                2
              </button>
              <button className="px-3 py-2 text-sm font-medium text-sidebar-foreground dark:text-sidebar-foreground border border-sidebar-border/50 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                3
              </button>
              <button className="px-3 py-2 text-sm font-medium text-sidebar-foreground dark:text-sidebar-foreground border border-sidebar-border/50 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}