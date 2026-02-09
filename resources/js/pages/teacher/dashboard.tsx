import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import AppLayout from '@/layouts/app-layout';
import { SharedData, type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { 
  Users, Star, BookOpen, 
  MapPin, Calendar, Clock, TrendingUp, 
  TrendingDown, Bell, 
  Users as StudentsIcon, 
  Clock as ClockIcon, 
  Phone, Award as Trophy, BookOpen as BookIcon,
  BookmarkCheck, MessageSquare, CheckCircle, 
  AlertCircle, FileText, UserCheck,
} from 'lucide-react';
import { useState, useMemo } from 'react';

// Import Chart.js components
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const breadcrumbs: BreadcrumbItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
  },
];

// Teacher profile data
const teacherProfile = {
  name: 'Dr. Sarah Johnson',
  email: 'sarah.johnson@university.edu',
  phone: '+1 (555) 123-4567',
  subject: 'Computer Science',
  faculty: 'Faculty of Computing',
  department: 'Software Engineering',
  office: 'Building A, Room 315',
  experience: '8 years',
  rating: 4.8,
  totalStudents: 156,
  avatar: 'bg-gradient-to-r from-purple-500 to-indigo-600',
  status: 'teaching',
  nextClass: 'Data Structures - 10:00 AM',
  upcomingOfficeHours: 'Today, 2:00 PM - 4:00 PM'
};

const metricsGrid = [
  {
    title: 'Total Classes Assigned',
    value: '08',
    subtitle: '',
    icon: Calendar,
    iconColor: 'text-blue-500',
    iconBg: 'bg-blue-50 dark:bg-blue-900/20',
    badge: '+1 today',
    badgeColor: 'text-green-600 bg-green-50 dark:bg-green-900/20'
  },
  {
    title: 'Attendance Taken Today',
    value: '5',
    subtitle: '/8',
    icon: CheckCircle,
    iconColor: 'text-green-500',
    iconBg: 'bg-green-50 dark:bg-green-900/20',
    badge: 'Target 8/8',
    badgeColor: 'text-gray-600 bg-gray-100 dark:bg-gray-800'
  },
  {
    title: 'Pending Attendance',
    value: '03',
    subtitle: '',
    icon: AlertCircle,
    iconColor: 'text-orange-500',
    iconBg: 'bg-orange-50 dark:bg-orange-900/20',
    badge: 'Attention',
    badgeColor: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20'
  },
  {
    title: 'Total Records',
    value: '1,240',
    subtitle: '',
    icon: BookIcon,
    iconColor: 'text-purple-500',
    iconBg: 'bg-purple-50 dark:bg-purple-900/20',
    badge: 'Lifetime',
    badgeColor: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20'
  }
];

const recentActivities = [
  {
    id: 1,
    type: 'submission',
    title: 'New Assignment Submission',
    description: '15 students submitted "Data Structures Lab 4"',
    time: '10 minutes ago',
    icon: FileText,
    iconColor: 'text-blue-500',
    iconBg: 'bg-blue-100 dark:bg-blue-900/20'
  },
  {
    id: 2,
    type: 'message',
    title: 'Student Question',
    description: 'John Doe asked about sorting algorithms',
    time: '25 minutes ago',
    icon: MessageSquare,
    iconColor: 'text-green-500',
    iconBg: 'bg-green-100 dark:bg-green-900/20'
  },
  {
    id: 3,
    type: 'grade',
    title: 'Grading Complete',
    description: 'You completed grading CS201 Midterm Exam',
    time: '1 hour ago',
    icon: CheckCircle,
    iconColor: 'text-purple-500',
    iconBg: 'bg-purple-100 dark:bg-purple-900/20'
  },
  {
    id: 4,
    type: 'attendance',
    title: 'Attendance Alert',
    description: '3 students marked absent in Algorithms class',
    time: '2 hours ago',
    icon: AlertCircle,
    iconColor: 'text-orange-500',
    iconBg: 'bg-orange-100 dark:bg-orange-900/20'
  },
  {
    id: 5,
    type: 'enrollment',
    title: 'New Student Enrollment',
    description: '2 students enrolled in Database Systems',
    time: '3 hours ago',
    icon: UserCheck,
    iconColor: 'text-indigo-500',
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/20'
  }
];



const timeFilters = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'semester', label: 'This Semester' },
];

// Mock attendance data
const generateAttendanceData = (timeRange: string) => {
  switch(timeRange) {
    case 'today':
      return {
        labels: ['9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM'],
        attendance: [92, 94, 96, 95, 93, 94, 95]
      };
    case 'week':
      return {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        attendance: [91, 93, 94, 95, 93]
      };
    case 'month':
    default:
      return {
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        attendance: [90, 92, 94, 95]
      };
  }
};

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
    },
  },
};

export default function TeacherDashboard({upcomingClasses, todayLectures}: {upcomingClasses: any[], todayLectures: any[]}) {
  const [timeFilter, setTimeFilter] = useState('week');
  const [activeTab, setActiveTab] = useState('overview');
  const page = usePage<SharedData>()

  const { auth } = page.props
  
  // Generate chart data based on time filter
  const attendanceData = useMemo(() => {
    const data = generateAttendanceData(timeFilter);
    
    return {
      labels: data.labels,
      datasets: [
        {
          label: 'Attendance Rate (%)',
          data: data.attendance,
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4,
        }
      ],
    };
  }, [timeFilter]);



  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Teacher Dashboard" />
      <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4 md:p-6 overflow-x-auto">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex flex-col lg:flex-row items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 lg:w-20 lg:h-20 rounded-2xl ${teacherProfile.avatar} flex items-center justify-center text-white text-2xl font-bold shadow-md`}>
                {auth.user.first_name[0]}{auth.user.last_name[0]}
              </div>
              <div>
                <h1 className="text-xl lg:text-2xl font-bold">
                  Welcome back, {auth.user.title} {auth.user.first_name} {auth.user.last_name}
                </h1>
                <p className="text-purple-100 mt-1">{teacherProfile.subject} • {teacherProfile.department}</p>
                <div className="flex flex-wrap items-center gap-3 lg:gap-4 mt-3">
                  <div className="flex items-center gap-2">
                    <ClockIcon className="h-4 w-4" />
                    <span className="text-sm">Next: {teacherProfile.nextClass}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span className="text-sm">{teacherProfile.totalStudents} Students</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 lg:gap-3 w-full lg:w-auto">
              <button className="flex-1 lg:flex-none px-3 lg:px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors">
                <Bell className="h-4 w-4 inline mr-2" />
                Notifications
              </button>
              <button className="flex-1 lg:flex-none px-3 lg:px-4 py-2 bg-white text-purple-700 hover:bg-white/90 rounded-lg text-sm font-medium transition-colors font-semibold">
                Start Today's Class
              </button>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {metricsGrid.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="relative overflow-hidden rounded-xl border border-sidebar-border/70 dark:border-sidebar-border bg-white dark:bg-sidebar-accent p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Badge in top-right corner */}
                <div className="absolute top-3 right-3">
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${stat.badgeColor}`}>
                    {stat.badge}
                  </span>
                </div>

                {/* Icon */}
                <div className={`w-10 h-10 rounded-lg ${stat.iconBg} flex items-center justify-center mb-4`}>
                  <Icon className={`h-5 w-5 ${stat.iconColor}`} />
                </div>

                {/* Title */}
                <p className="text-sm font-medium text-sidebar-foreground/60 dark:text-sidebar-foreground/60 mb-2">
                  {stat.title}
                </p>

                {/* Value with optional subtitle */}
                <div className="flex items-baseline gap-1">
                  <p className="text-3xl font-bold text-sidebar-foreground dark:text-sidebar-foreground">
                    {stat.value}
                  </p>
                  {stat.subtitle && (
                    <p className="text-xl font-semibold text-sidebar-foreground/40 dark:text-sidebar-foreground/40">
                      {stat.subtitle}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Upcoming Classes & Performance Analytics */}
          <div className="lg:col-span-2 space-y-6">
          

            {/* Performance Analytics Section */}
            <div className="bg-white dark:bg-sidebar-accent rounded-xl border border-sidebar-border/70 dark:border-sidebar-border p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-sidebar-foreground dark:text-sidebar-foreground">
                    Performance Analytics
                  </h2>
                  <p className="text-sm text-sidebar-foreground/60 dark:text-sidebar-foreground/60 mt-1">
                    Track your class performance and student engagement
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {timeFilters.map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setTimeFilter(filter.id)}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        timeFilter === filter.id
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-gray-100 dark:bg-gray-800 text-sidebar-foreground dark:text-sidebar-foreground hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Attendance Chart */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-sidebar-foreground dark:text-sidebar-foreground">
                    Attendance Rate
                  </h4>
                  <Users className="h-5 w-5 text-sidebar-foreground/60" />
                </div>
                <div className="h-64">
                  <Line data={attendanceData} options={chartOptions} />
                </div>
              </div>

              {/* Today's Classes Table */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-sidebar-foreground dark:text-sidebar-foreground">
                    Today's Classes
                  </h4>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-sidebar-foreground/60">October 24, 2025</span>
                    <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                      <Calendar className="h-4 w-4" />
                      Export Schedule
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-sidebar-border/30">
                        <th className="text-left py-3 px-3 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">Class Name</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">Subject</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">Time</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">Status</th>
                        <th className="text-right py-3 px-3 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayLectures.map((lecture, index) => (
                        <tr key={lecture.id || index} className="border-b border-sidebar-border/20 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="py-4 px-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                  {lecture.code || '10A'}
                                </span>
                              </div>
                              <div>
                                <div className="font-semibold text-sidebar-foreground dark:text-sidebar-foreground">
                                  {lecture.class_name || 'Grade 10 Section A'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-3">
                            <span className="text-sidebar-foreground/80 dark:text-sidebar-foreground/80">
                              {lecture.subject || 'Advanced Mathematics'}
                            </span>
                          </td>
                          <td className="py-4 px-3">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-sidebar-foreground/50" />
                              <span className="text-sm text-sidebar-foreground/80">
                                {lecture.start_time || '09:00 AM'} - {lecture.end_time || '10:00 AM'}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-3">
                            {lecture.status === 'completed' && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                ✓ COMPLETED
                              </span>
                            )}
                            {lecture.status === 'pending' && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                                ⏱ PENDING
                              </span>
                            )}
                            {lecture.status === 'upcoming' && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                                UPCOMING
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-3 text-right">
                            {lecture.status === 'completed' && (
                              <button className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium">
                                Edit Records
                              </button>
                            )}
                            {lecture.status === 'pending' && (
                              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                                Take Attendance
                              </button>
                            )}
                            {lecture.status === 'upcoming' && (
                              <button className="text-sm text-gray-400 dark:text-gray-500 cursor-not-allowed font-medium">
                                Upcoming
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Recent Activities & Student Engagement */}
          <div className="space-y-6">
            {/* Recent Activities Panel */}
            <div className="bg-white dark:bg-sidebar-accent rounded-xl border border-sidebar-border/70 dark:border-sidebar-border p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-sidebar-foreground dark:text-sidebar-foreground flex items-center gap-2">
                    <Bell className="h-5 w-5 text-indigo-500" />
                    Recent Activities
                  </h2>
                  <p className="text-sm text-sidebar-foreground/60 dark:text-sidebar-foreground/60 mt-1">
                    Latest updates and notifications
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {recentActivities.map((activity) => {
                  const Icon = activity.icon;
                  return (
                    <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <div className={`p-2 rounded-lg ${activity.iconBg} flex-shrink-0`}>
                        <Icon className={`h-4 w-4 ${activity.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm text-sidebar-foreground dark:text-sidebar-foreground">
                          {activity.title}
                        </h4>
                        <p className="text-xs text-sidebar-foreground/60 dark:text-sidebar-foreground/60 mt-1 line-clamp-2">
                          {activity.description}
                        </p>
                        <span className="text-xs text-sidebar-foreground/50 mt-1 inline-block">
                          {activity.time}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button className="w-full mt-4 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                View All Activities
              </button>
            </div>

           
          </div>
        </div>




           <div className="">
          {/* Left Column - Upcoming Classes & Performance Analytics */}
          <div className="lg:col-span-2 space-y-6">
          

            {/* Performance Analytics Section */}
            <div className="bg-white dark:bg-sidebar-accent rounded-xl border border-sidebar-border/70 dark:border-sidebar-border p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-sidebar-foreground dark:text-sidebar-foreground">
                    Today's Classes

                  </h2>
                  <p className="text-sm text-sidebar-foreground/60 dark:text-sidebar-foreground/60 mt-1">
                    View and manage your classes for today
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-sidebar-foreground/60">October 24, 2025</span>
                    <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                      <Calendar className="h-4 w-4" />
                      Export Schedule
                    </button>
                </div>
              </div>

          

              {/* Today's Classes Table */}
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-sidebar-border/30">
                        <th className="text-left py-3 px-3 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">Class Name</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">Subject</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">Time</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">Status</th>
                        <th className="text-right py-3 px-3 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayLectures.map((lecture, index) => (
                        <tr key={lecture.id || index} className="border-b border-sidebar-border/20 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="py-4 px-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                  {lecture.code || '10A'}
                                </span>
                              </div>
                              <div>
                                <div className="font-semibold text-sidebar-foreground dark:text-sidebar-foreground">
                                  {lecture.class_name || 'Grade 10 Section A'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-3">
                            <span className="text-sidebar-foreground/80 dark:text-sidebar-foreground/80">
                              {lecture.subject || 'Advanced Mathematics'}
                            </span>
                          </td>
                          <td className="py-4 px-3">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-sidebar-foreground/50" />
                              <span className="text-sm text-sidebar-foreground/80">
                                {lecture.start_time || '09:00 AM'} - {lecture.end_time || '10:00 AM'}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-3">
                            {lecture.status === 'completed' && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                ✓ COMPLETED
                              </span>
                            )}
                            {lecture.status === 'pending' && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                                ⏱ PENDING
                              </span>
                            )}
                            {lecture.status === 'upcoming' && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                                UPCOMING
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-3 text-right">
                            {lecture.status === 'completed' && (
                              <button className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium">
                                Edit Records
                              </button>
                            )}
                            {lecture.status === 'pending' && (
                              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                                Take Attendance
                              </button>
                            )}
                            {lecture.status === 'upcoming' && (
                              <button className="text-sm text-gray-400 dark:text-gray-500 cursor-not-allowed font-medium">
                                Upcoming
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}