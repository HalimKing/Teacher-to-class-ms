import AppLayout from '@/layouts/app-layout';
import { SharedData, type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { 
  Search,
  Calendar,
  Clock,
  Users,
  Plus,
  BookOpen,
  FlaskConical,
  Leaf,
  TestTube,
} from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
  },
  {
    title: 'My Courses',
    href: '/courses',
  },
];

// Course icons mapping
const courseIcons: { [key: string]: any } = {
  mathematics: '∑',
  physics: '⚗',
  'earth-science': '🌍',
  chemistry: '🧪',
};

// Mock courses data
// const coursesData = [
//   {
//     id: 1,
//     title: 'Grade 10 - Mathematics',
//     subtitle: 'Advanced Calculus & Algebra',
//     schedule: 'Mon, Wed, Fri | 09:00 AM',
//     sessionsTotal: 42,
//     sessionsConducted: 42,
//     currentAttendance: 94.8,
//     status: 'Active',
//     icon: 'Σ',
//     iconBg: 'bg-blue-100 dark:bg-blue-900/30',
//     iconColor: 'text-blue-600 dark:text-blue-400',
//   },
//   {
//     id: 2,
//     title: 'Grade 12 - Physics',
//     subtitle: 'Mechanics & Thermodynamics',
//     schedule: 'Tue, Thu | 11:30 AM',
//     sessionsTotal: 28,
//     sessionsConducted: 28,
//     currentAttendance: 88.2,
//     status: 'Active',
//     icon: '⚗',
//     iconBg: 'bg-purple-100 dark:bg-purple-900/30',
//     iconColor: 'text-purple-600 dark:text-purple-400',
//   },
//   {
//     id: 3,
//     title: 'Grade 9 - Earth Science',
//     subtitle: 'Geology & Atmosphere',
//     schedule: 'Mon, Wed | 01:00 PM',
//     sessionsTotal: 35,
//     sessionsConducted: 35,
//     currentAttendance: 91.5,
//     status: 'Active',
//     icon: '🌍',
//     iconBg: 'bg-green-100 dark:bg-green-900/30',
//     iconColor: 'text-green-600 dark:text-green-400',
//   },
//   {
//     id: 4,
//     title: 'Grade 11 - Chemistry',
//     subtitle: 'Organic Compounds & Lab',
//     schedule: 'Tue, Fri | 10:00 AM',
//     sessionsTotal: 31,
//     sessionsConducted: 31,
//     currentAttendance: 96.2,
//     status: 'Active',
//     icon: '🧪',
//     iconBg: 'bg-orange-100 dark:bg-orange-900/30',
//     iconColor: 'text-orange-600 dark:text-orange-400',
//   },
// ];

interface Course {
  id: number;
  title: string;
subtitle: string;
code: string;
student_size: number;
total_hours: number;
icone: string;
}

export default function MyCoursesPage({ coursesData }: { coursesData: Course[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const page = usePage<SharedData>();
  const { auth } = page.props;

  const filteredCourses = coursesData.filter(course => 
    course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="My Courses" />
      
      <div className="flex h-full flex-1 flex-col gap-6 rounded-xl p-4 md:p-6 overflow-x-auto">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-sidebar-foreground dark:text-sidebar-foreground">
            My Courses
          </h1>
          <p className="text-sm text-sidebar-foreground/60 dark:text-sidebar-foreground/60 mt-1">
            Manage and track all your assigned classes
          </p>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Search Bar */}
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sidebar-foreground/40" />
            <input
              type="text"
              placeholder="Search courses or class codes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-sidebar-border/50 rounded-lg bg-white dark:bg-sidebar-accent text-sidebar-foreground dark:text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Tab Filters */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'active'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-800 text-sidebar-foreground dark:text-sidebar-foreground hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              Active Classes
            </button>
            <button
              onClick={() => setActiveTab('archived')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'archived'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-800 text-sidebar-foreground dark:text-sidebar-foreground hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              Archived Classes
            </button>
          </div>
        </div>

        {/* Courses Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Course Cards */}
        {filteredCourses.map((course) => (
  <div
    key={course.id}
    className="bg-white dark:bg-sidebar-accent rounded-xl border border-sidebar-border/70 dark:border-sidebar-border p-6 shadow-sm hover:shadow-md transition-all hover:border-blue-300 dark:hover:border-blue-700"
  >
    {/* Header with Icon and Status */}
    <div className="flex items-start justify-between mb-4">
      <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-2xl">
        {course.icone || "📚"}
      </div>
      <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold rounded-full">
        Active
      </span>
    </div>

    {/* Course Title and Subtitle */}
    <div className="mb-4">
      <h3 className="text-lg font-bold text-sidebar-foreground dark:text-sidebar-foreground mb-1">
        {course.title}
      </h3>
      <p className="text-sm text-sidebar-foreground/60 dark:text-sidebar-foreground/60 mb-1">
        {course.code}
      </p>
      <div className="flex items-center gap-4 text-xs text-sidebar-foreground/50 mt-2">
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          {course.student_size} students
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {course.total_hours} hours
        </span>
      </div>
    </div>

    {/* Schedule and Sessions Info */}
    <div className="space-y-2 mb-4">
      <div className="flex items-center gap-2 text-sm text-sidebar-foreground/70">
        <Calendar className="h-4 w-4 flex-shrink-0" />
        <span>Monday & Wednesday, 10:00 AM</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-sidebar-foreground/70">
        <Users className="h-4 w-4 flex-shrink-0" />
        <span>Sessions: 8 of 16 Conducted</span>
      </div>
    </div>

    {/* Attendance Progress */}
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-sidebar-foreground/60">
          Current Attendance
        </span>
        <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
          85%
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div 
          className="bg-blue-500 dark:bg-blue-600 h-2 rounded-full transition-all duration-500"
          style={{ width: `85%` }}
        ></div>
      </div>
    </div>

    {/* Action Buttons */}
    <div className="flex items-center gap-2">
      <button className="flex-1 px-3 py-2 text-sm font-medium text-sidebar-foreground dark:text-sidebar-foreground border border-sidebar-border/50 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
        View Details
      </button>
      <button className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
        Manage Attendance
      </button>
    </div>
  </div>
))}

          {/* Request New Class Card */}
          <div className="bg-white dark:bg-sidebar-accent rounded-xl border-2 border-dashed border-sidebar-border/50 dark:border-sidebar-border p-6 flex flex-col items-center justify-center min-h-[400px] hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer group">
            <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
              <Plus className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-sidebar-foreground dark:text-sidebar-foreground mb-2 text-center">
              REQUEST NEW CLASS
            </h3>
            <p className="text-sm text-sidebar-foreground/60 dark:text-sidebar-foreground/60 text-center max-w-[200px]">
              Add a new course to your teaching schedule
            </p>
          </div>
        </div>

        {/* Empty State (when no courses found) */}
        {filteredCourses.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <Search className="h-10 w-10 text-sidebar-foreground/40" />
            </div>
            <h3 className="text-lg font-semibold text-sidebar-foreground dark:text-sidebar-foreground mb-2">
              No courses found
            </h3>
            <p className="text-sm text-sidebar-foreground/60 dark:text-sidebar-foreground/60 text-center max-w-md">
              Try adjusting your search query or check the archived classes tab
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}