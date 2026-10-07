export type StaffActivityIcon =
    | 'login'
    | 'logout'
    | 'check-in'
    | 'check-out'
    | 'warning'
    | 'shield'
    | 'location'
    | 'absence'
    | 'explanation'
    | 'approve'
    | 'reject'
    | 'help'
    | 'document'
    | 'message'
    | 'password'
    | 'reminder'
    | 'calendar'
    | 'users'
    | 'activity';

export interface StaffActivityResource {
    type: string;
    id: number | string | null;
    label: string;
}

export interface StaffActivityItem {
    id: number;
    action: string;
    title: string;
    description: string;
    module: string;
    module_label: string;
    icon: StaffActivityIcon | string;
    status: string;
    resource: StaffActivityResource | null;
    created_at: string | null;
    created_at_display: string | null;
    relative_time: string | null;
    ip_address?: string | null;
    browser?: string | null;
    device?: string | null;
}

export interface StaffActivityFilters {
    search: string;
    category: string;
    status: string;
    start_date: string;
    end_date: string;
}

export interface StaffActivityOption {
    value: string;
    label: string;
}

export interface PaginatedStaffActivities {
    data: StaffActivityItem[];
    links?: Array<{ url: string | null; label: string; active: boolean }>;
    current_page?: number;
    last_page?: number;
    from?: number | null;
    to?: number | null;
    total?: number;
}
