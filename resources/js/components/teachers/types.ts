import { type KpiCardData } from '@/components/dashboard/kpi-card';

export interface FacultyOption {
    id: number;
    name: string;
}

export interface DepartmentOption {
    id: number;
    name: string;
    faculty_id: number;
}

export interface TeacherListItem {
    id: number;
    first_name: string;
    last_name: string;
    full_name: string;
    title: string;
    email: string;
    phone: string;
    employee_id: string;
    staff_type: string;
    faculty: string;
    department: string;
    assigned_classes_count: number;
    timetable_count: number;
    timetable_status: 'assigned' | 'unassigned';
    face_enrollment_status: 'enrolled' | 'not_enrolled';
    face_registered_at: string | null;
    attendance_status: string;
    attendance_badge: 'present' | 'absent' | 'late' | 'checked_out' | 'unverified';
    account_status: 'active' | 'inactive';
    created_at: string;
    initials: string;
}

export interface TeacherFilters {
    search?: string;
    faculty?: string;
    department?: string;
    staffType?: string;
    faceEnrollment?: string;
    faceVerification?: string;
    timetable?: string;
    attendanceToday?: string;
    accountStatus?: string;
    created_from?: string;
    created_to?: string;
    last_attendance_from?: string;
    last_attendance_to?: string;
    sort_by?: string;
    sort_dir?: string;
    per_page?: string;
}

export interface PaginatedTeachers {
    data: TeacherListItem[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

export interface TeacherQuickViewData {
    profile: {
        id: number;
        full_name: string;
        employee_id: string;
        email: string;
        phone: string;
        department?: string;
        faculty?: string;
        staff_type: string;
        created_at?: string;
    };
    attendance: {
        attendance_rate: number;
        present_days: number;
        absent_days: number;
        late_arrivals: number;
        today_status: string;
    };
    face: {
        status: string;
        registered_at?: string | null;
    };
    timetable: {
        assigned_count: number;
        courses: string[];
        classes: Array<{
            day: string;
            start_time: string;
            end_time: string;
            venue?: string;
            course?: string;
        }>;
    };
}

export interface TeachersIndexPageProps {
    summaryCards: KpiCardData[];
    teachers: PaginatedTeachers;
    faculties: FacultyOption[];
    departments: DepartmentOption[];
    filters: TeacherFilters;
}

export type TeacherColumnKey =
    | 'profile'
    | 'staff_id'
    | 'email'
    | 'phone'
    | 'department'
    | 'classes'
    | 'timetable'
    | 'face'
    | 'attendance'
    | 'account'
    | 'created'
    | 'actions';

export const defaultVisibleColumns: TeacherColumnKey[] = [
    'profile',
    'staff_id',
    'email',
    'phone',
    'department',
    'classes',
    'timetable',
    'face',
    'attendance',
    'account',
    'created',
    'actions',
];

export const columnLabels: Record<TeacherColumnKey, string> = {
    profile: 'Teacher',
    staff_id: 'Staff ID',
    email: 'Email',
    phone: 'Phone',
    department: 'Department',
    classes: 'Classes',
    timetable: 'Timetable',
    face: 'Face Enrollment',
    attendance: 'Attendance',
    account: 'Account',
    created: 'Created',
    actions: 'Actions',
};
