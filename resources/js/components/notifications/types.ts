export type NotificationCategory = 'attendance' | 'timetable' | 'system' | 'administrative' | 'all';
export type NotificationPriority = 'critical' | 'high' | 'medium' | 'low' | 'all';
export type NotificationStatus = 'all' | 'read' | 'unread';

export interface NotificationData {
    type?: string;
    category?: NotificationCategory;
    priority?: NotificationPriority;
    title?: string;
    message?: string;
    url?: string;
    session?: string | null;
    status?: string | null;
    meta?: Record<string, unknown>;
}

export interface TeacherNotificationItem {
    id: string;
    type: string;
    data: NotificationData;
    read_at?: string | null;
    created_at: string;
}

export interface NotificationPreferences {
    attendance_enabled: boolean;
    timetable_enabled: boolean;
    administrative_enabled: boolean;
    system_enabled: boolean;
    email_enabled: boolean;
}

export interface PaginatedNotifications {
    data: TeacherNotificationItem[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    links: Array<{ url: string | null; label: string; active: boolean }>;
}
