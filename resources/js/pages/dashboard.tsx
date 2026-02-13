import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import {
  GraduationCap, Users, Star, BookOpen, Activity, Search,
  MapPin, UserPlus, FileText, Bell, Play, Upload,
  GraduationCap as GradIcon, Calendar, Building, Filter,
  TrendingUp, Clock, BarChart3, PieChart, Download
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import axios from 'axios';

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
import { Line, Bar, Pie } from 'react-chartjs-2';

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

const timeFilters = [
  { id: 'today', label: 'Today' },
  { id: '7days', label: 'Last 7 Days' },
  { id: '30days', label: 'Last 30 Days' },
];



const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
    },
  },
};

interface Teacher {
  id: number;
  name: string;
  initials: string;
  subject: string;
  faculty: string;
  department: string;
  status: string;
  statusTime: string;
  topic: string;
  room: string;
  rating: number | string;
  classes: number;
  avatar: string;
}

interface Stat {
  title: string;
  value: number | string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
}

interface RecentActivity {
  id: number;
  teacher: string;
  action: string;
  time: string;
}

interface DashboardProps {
  stats: Stat[];
  recentActivities: RecentActivity[];
  facultyDistribution: {
    labels: string[];
    data: number[];
  };
  teachers: Teacher[];
  initialAttendanceTrend: any;
}

export default function Dashboard({ stats, recentActivities, facultyDistribution, teachers, initialAttendanceTrend }: DashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('All Subjects');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [facultyFilter, setFacultyFilter] = useState('All Faculties');
  const [departmentFilter, setDepartmentFilter] = useState('All Departments');
  const [timeFilter, setTimeFilter] = useState('30days');

  const [attendanceChartData, setAttendanceChartData] = useState(initialAttendanceTrend);
  const [loadingChart, setLoadingChart] = useState(false);

  // Fetch chart data when filter changes
  useEffect(() => {
    // skip initial load as we have data from props
    if (timeFilter === '30days' && attendanceChartData === initialAttendanceTrend) return;

    const fetchData = async () => {
      setLoadingChart(true);
      try {
        const response = await axios.get(route('admin.dashboard.attendance-data'), {
          params: { range: timeFilter }
        });
        setAttendanceChartData(response.data);
      } catch (error) {
        console.error("Failed to fetch chart data", error);
      } finally {
        setLoadingChart(false);
      }
    };

    fetchData();
  }, [timeFilter]);


  // Helper to map icon to stat title
  const getIconForStat = (title: string) => {
    switch (title) {
      case 'Total Teachers': return GraduationCap;
      case 'Active Today': return Users;
      case 'Total Classes': return BookOpen;
      case 'Ongoing': return Activity;
      default: return GraduationCap;
    }
  };

  const getColorForStat = (title: string) => {
    switch (title) {
      case 'Total Teachers': return { color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/20' };
      case 'Active Today': return { color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/20' };
      case 'Total Classes': return { color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/20' };
      case 'Ongoing': return { color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/20' };
      default: return { color: 'text-gray-500', bg: 'bg-gray-100' };
    }
  };


  // Get unique subjects for filter dropdown
  const subjects = useMemo(() => {
    const uniqueSubjects = [...new Set(teachers.map(teacher => teacher.subject))];
    return ['All Subjects', ...uniqueSubjects];
  }, [teachers]);

  // Get unique faculties
  // We can use the props teachers list to derive unique faculties dynamically
  // Or use the facultyDistribution labels if complete. Using teachers list is safer for the dropdown.
  const allFaculties = useMemo(() => {
    const uniqueFaculties = [...new Set(teachers.map(teacher => teacher.faculty))];
    return ['All Faculties', ...uniqueFaculties];
  }, [teachers]);


  // Get departments based on selected faculty
  const departments = useMemo(() => {
    if (facultyFilter === 'All Faculties') {
      const allDepartments = [...new Set(teachers.map(teacher => teacher.department))];
      return ['All Departments', ...allDepartments];
    }

    // Filter teachers by the selected faculty then get their unique departments
    const uniqueDepartments = [...new Set(
      teachers
        .filter(t => t.faculty === facultyFilter)
        .map(t => t.department)
    )];
    return ['All Departments', ...uniqueDepartments];
  }, [facultyFilter, teachers]);

  // Get unique statuses for filter dropdown
  const statuses = useMemo(() => {
    const uniqueStatuses = [...new Set(teachers.map(teacher => teacher.status))];
    return ['All Status', ...uniqueStatuses.map(status =>
      status.charAt(0).toUpperCase() + status.slice(1)
    )];
  }, [teachers]);

  // Filter teachers based on search and filters
  const filteredTeachers = useMemo(() => {
    return teachers.filter(teacher => {
      const matchesSearch = teacher.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        teacher.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        teacher.topic.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesSubject = subjectFilter === 'All Subjects' || teacher.subject === subjectFilter;

      const matchesStatus = statusFilter === 'All Status' ||
        teacher.status === statusFilter.toLowerCase();

      const matchesFaculty = facultyFilter === 'All Faculties' || teacher.faculty === facultyFilter;

      const matchesDepartment = departmentFilter === 'All Departments' || teacher.department === departmentFilter;

      return matchesSearch && matchesSubject && matchesStatus && matchesFaculty && matchesDepartment;
    });
  }, [searchQuery, subjectFilter, statusFilter, facultyFilter, departmentFilter, teachers]);

  // Generate chart data objects
  const attendanceData = useMemo(() => {
    // attendanceChartData is the raw data object { labels, present, absent, late }
    return {
      labels: attendanceChartData.labels || [],
      datasets: [
        {
          label: 'Present',
          data: attendanceChartData.present || [],
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.5)',
          tension: 0.4,
        },
        {
          label: 'Absent',
          data: attendanceChartData.absent || [],
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.5)',
          tension: 0.4,
        },
        {
          label: 'Late',
          data: attendanceChartData.late || [],
          borderColor: 'rgb(245, 158, 11)',
          backgroundColor: 'rgba(245, 158, 11, 0.5)',
          tension: 0.4,
        },
      ],
    };
  }, [attendanceChartData]);

  const pieChartData = useMemo(() => {
    return {
      labels: facultyDistribution.labels,
      datasets: [
        {
          label: 'Number of Teachers',
          data: facultyDistribution.data,
          backgroundColor: [
            'rgba(147, 51, 234, 0.8)',  // Purple
            'rgba(59, 130, 246, 0.8)',   // Blue
            'rgba(16, 185, 129, 0.8)',   // Green
            'rgba(245, 158, 11, 0.8)',   // Orange
            'rgba(236, 72, 153, 0.8)',   // Pink
            'rgba(107, 114, 128, 0.8)',  // Gray
          ],
          borderColor: [
            'white'
          ],
          borderWidth: 1,
        },
      ],
    };
  }, [facultyDistribution]);


  // Placeholder for bar chart - could also be dynamic if we had that data
  const barChartData = {
    labels: facultyDistribution.labels,
    datasets: [
      {
        label: 'Attendance Rate (%)', // This would need real calculation
        data: facultyDistribution.labels.map(() => Math.floor(Math.random() * (100 - 80 + 1) + 80)), // Mock random 80-100%
        backgroundColor: 'rgba(147, 51, 234, 0.8)',
        borderColor: 'rgb(147, 51, 234)',
        borderWidth: 1,
      },
    ],
  };

  const handleFacultyChange = (faculty: string) => {
    setFacultyFilter(faculty);
    setDepartmentFilter('All Departments');
  };

  const handleExportData = () => {
    console.log('Exporting data...');
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Dashboard" />
      <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4 overflow-x-auto">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
          {stats.map((stat, index) => {
            const Icon = getIconForStat(stat.title);
            const { color, bg } = getColorForStat(stat.title);
            return (
              <div
                key={index}
                className="relative overflow-hidden rounded-xl border border-sidebar-border/70 dark:border-sidebar-border bg-white dark:bg-sidebar-accent p-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-sidebar-foreground/70 dark:text-sidebar-foreground/70">
                      {stat.title}
                    </p>
                    <p className="text-3xl font-bold text-sidebar-foreground dark:text-sidebar-foreground mt-2">
                      {stat.value}
                    </p>
                    {stat.change !== 'N/A' && (
                      <div className={`flex items-center gap-1 mt-2 text-sm ${stat.changeType === 'positive' ? 'text-green-600' :
                        stat.changeType === 'negative' ? 'text-red-600' : 'text-gray-500'
                        }`}>
                        <TrendingUp className="h-4 w-4" />
                        <span>{stat.change}</span>
                        <span className="text-sidebar-foreground/50">from last month</span>
                      </div>
                    )}
                  </div>
                  <div className={`p-3 rounded-lg ${bg}`}>
                    <Icon className={`h-6 w-6 ${color}`} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Time Filter Section */}
        <div className="bg-white dark:bg-sidebar-accent rounded-xl border border-sidebar-border/70 dark:border-sidebar-border p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-sidebar-foreground dark:text-sidebar-foreground flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Attendance Overview
              </h3>
              <p className="text-sm text-sidebar-foreground/60 dark:text-sidebar-foreground/60 mt-1">
                Track attendance patterns over time
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-sidebar-foreground/60" />
                <span className="text-sm text-sidebar-foreground/60">Time Range:</span>
              </div>
              <div className="flex gap-2">
                {timeFilters.map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setTimeFilter(filter.id)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${timeFilter === filter.id
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-sidebar-foreground dark:text-sidebar-foreground hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              <button
                onClick={handleExportData}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-sidebar-foreground dark:text-sidebar-foreground rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Line Chart - Attendance Trend */}
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 h-80">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-sidebar-foreground dark:text-sidebar-foreground">
                    Attendance Trend
                  </h4>
                  <BarChart3 className="h-5 w-5 text-sidebar-foreground/60" />
                </div>
                {loadingChart ? (
                  <div className="flex items-center justify-center h-full">Loading...</div>
                ) : (
                  <Line data={attendanceData} options={chartOptions} />
                )}
              </div>
            </div>

            {/* Pie Chart - Faculty Distribution */}
            <div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 h-80">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-sidebar-foreground dark:text-sidebar-foreground">
                    Faculty Distribution
                  </h4>
                  <PieChart className="h-5 w-5 text-sidebar-foreground/60" />
                </div>
                <Pie data={pieChartData} options={chartOptions} />
              </div>
            </div>
          </div>

          {/* Bar Chart - Faculty Comparison */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-sidebar-foreground dark:text-sidebar-foreground">
                Faculty Performance Comparison
              </h4>
              <BarChart3 className="h-5 w-5 text-sidebar-foreground/60" />
            </div>
            <div className="h-64">
              <Bar data={barChartData} options={chartOptions} />
            </div>
          </div>
        </div>

        {/* Teachers Overview and Side Panels */}
        <div className="flex gap-6">
          {/* Main Teachers Table */}
          <div className="flex-1 bg-white dark:bg-sidebar-accent rounded-xl border border-sidebar-border/70 dark:border-sidebar-border p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-sidebar-foreground dark:text-sidebar-foreground">
                Teachers Overview
              </h2>
              <div className="flex items-center gap-2">
                <Building className="h-5 w-5 text-sidebar-foreground/60" />
                <span className="text-sm text-sidebar-foreground/60">Filter by:</span>
              </div>
            </div>

            {/* Advanced Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-sidebar-foreground/50" />
                <input
                  type="text"
                  placeholder="Search teachers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-sidebar-border rounded-lg bg-white dark:bg-sidebar-accent text-sidebar-foreground dark:text-sidebar-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={facultyFilter}
                onChange={(e) => handleFacultyChange(e.target.value)}
                className="px-4 py-2 border border-sidebar-border rounded-lg bg-white dark:bg-sidebar-accent text-sidebar-foreground dark:text-sidebar-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {allFaculties.map(faculty => (
                  <option key={faculty} value={faculty}>{faculty}</option>
                ))}
              </select>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="px-4 py-2 border border-sidebar-border rounded-lg bg-white dark:bg-sidebar-accent text-sidebar-foreground dark:text-sidebar-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-sidebar-border rounded-lg bg-white dark:bg-sidebar-accent text-sidebar-foreground dark:text-sidebar-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {statuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-sidebar-border/30">
                    <th className="text-left py-3 px-2 text-sm font-medium text-sidebar-foreground/70 dark:text-sidebar-foreground/70">
                      TEACHER
                    </th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-sidebar-foreground/70 dark:text-sidebar-foreground/70">
                      STATUS
                    </th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-sidebar-foreground/70 dark:text-sidebar-foreground/70">
                      FACULTY & DEPARTMENT
                    </th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-sidebar-foreground/70 dark:text-sidebar-foreground/70">
                      ROOM
                    </th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-sidebar-foreground/70 dark:text-sidebar-foreground/70">
                      RATING
                    </th>
                    <th className="text-left py-3 px-2 text-sm font-medium text-sidebar-foreground/70 dark:text-sidebar-foreground/70">
                      CLASSES
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeachers.length > 0 ? (
                    filteredTeachers.map((teacher) => (
                      <tr key={teacher.id} className="border-b border-sidebar-border/20 last:border-b-0">
                        <td className="py-4 px-2">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg ${teacher.avatar} flex items-center justify-center text-white font-medium text-sm relative`}>
                              {teacher.initials}
                              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${teacher.status === 'teaching' ? 'bg-blue-500' :
                                teacher.status === 'available' ? 'bg-green-500' :
                                  'bg-gray-400'
                                }`}></div>
                            </div>
                            <div>
                              <p className="font-medium text-sidebar-foreground dark:text-sidebar-foreground">
                                {teacher.name}
                              </p>
                              <p className="text-sm text-sidebar-foreground/60 dark:text-sidebar-foreground/60">
                                {teacher.subject}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-2">
                          <div>
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${teacher.status === 'teaching'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                              : teacher.status === 'available'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                              }`}>
                              {teacher.status}
                            </span>
                            <p className="text-xs text-sidebar-foreground/50 dark:text-sidebar-foreground/50 mt-1">
                              {teacher.statusTime}
                            </p>
                          </div>
                        </td>
                        <td className="py-4 px-2">
                          <div>
                            <p className="text-sidebar-foreground dark:text-sidebar-foreground font-medium text-sm">
                              {teacher.faculty}
                            </p>
                            <p className="text-xs text-sidebar-foreground/60 dark:text-sidebar-foreground/60">
                              {teacher.department}
                            </p>
                          </div>
                        </td>
                        <td className="py-4 px-2">
                          <div className="flex items-center gap-1 text-sidebar-foreground/70 dark:text-sidebar-foreground/70">
                            <MapPin className="h-4 w-4" />
                            <span>{teacher.room}</span>
                          </div>
                        </td>
                        <td className="py-4 px-2">
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-orange-400 fill-current" />
                            <span className="text-sidebar-foreground dark:text-sidebar-foreground">
                              {teacher.rating}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-2">
                          <span className="text-sidebar-foreground dark:text-sidebar-foreground">
                            {teacher.classes}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-sidebar-foreground/50">
                        No teachers found matching your criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Side Panel */}
          <div className="w-80 flex flex-col gap-6">
            {/* Recent Activity */}
            <div className="bg-white dark:bg-sidebar-accent rounded-xl border border-sidebar-border/70 dark:border-sidebar-border p-6">
              <h3 className="text-lg font-semibold text-sidebar-foreground dark:text-sidebar-foreground mb-4">
                Recent Activity
              </h3>
              <div className="space-y-4">
                {recentActivities.length > 0 ? (
                  recentActivities.map((activity) => (
                    // We don't have icon/color in backend data yet, so using default or random
                    <div key={activity.id} className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg bg-gray-100 dark:bg-gray-800 flex-shrink-0`}>
                        <Activity className={`h-4 w-4 text-gray-500`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sidebar-foreground dark:text-sidebar-foreground text-sm">
                          {activity.teacher}
                        </p>
                        <p className="text-sidebar-foreground/70 dark:text-sidebar-foreground/70 text-sm">
                          {activity.action}
                        </p>
                        <p className="text-sidebar-foreground/50 dark:text-sidebar-foreground/50 text-xs mt-1">
                          {activity.time}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No recent activity.</p>
                )}
              </div>
            </div>


            {/* Filter Summary */}
            <div className="bg-white dark:bg-sidebar-accent rounded-xl border border-sidebar-border/70 dark:border-sidebar-border p-6">
              <h3 className="text-lg font-semibold text-sidebar-foreground dark:text-sidebar-foreground mb-4">
                Current Filters
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-sidebar-foreground/70 dark:text-sidebar-foreground/70">Time Range</p>
                  <p className="font-medium text-sidebar-foreground dark:text-sidebar-foreground">
                    {timeFilters.find(f => f.id === timeFilter)?.label}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-sidebar-foreground/70 dark:text-sidebar-foreground/70">Faculty</p>
                  <p className="font-medium text-sidebar-foreground dark:text-sidebar-foreground">
                    {facultyFilter}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-sidebar-foreground/70 dark:text-sidebar-foreground/70">Department</p>
                  <p className="font-medium text-sidebar-foreground dark:text-sidebar-foreground">
                    {departmentFilter}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-sidebar-foreground/70 dark:text-sidebar-foreground/70">Showing Teachers</p>
                  <p className="font-medium text-sidebar-foreground dark:text-sidebar-foreground">
                    {filteredTeachers.length} of {teachers.length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}