import { type KpiCardData } from '@/components/dashboard/kpi-card';

export interface RoleOption {
    id: number;
    name: string;
}

export interface UserListItem {
    id: number;
    name: string;
    email: string;
    staff_id: string;
    roles: string[];
    role_labels: string;
    status: 'active' | 'inactive' | 'suspended';
    status_label: string;
    is_locked: boolean;
    password_status: string;
    must_change_password: boolean;
    last_login_at: string | null;
    last_login_display: string | null;
    created_at: string;
    initials: string;
}

export interface UserFilters {
    search?: string;
    role?: string;
    status?: string;
    password_status?: string;
    login_status?: string;
    created_from?: string;
    created_to?: string;
    last_login_from?: string;
    last_login_to?: string;
    sort_by?: string;
    sort_dir?: string;
    per_page?: string;
}

export interface PaginatedUsers {
    data: UserListItem[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

export interface UserQuickViewData {
    profile: {
        id: number;
        name: string;
        email: string;
        staff_id: string;
        status: string;
        created_at?: string;
        last_login_at?: string | null;
        initials: string;
    };
    security: {
        account_status: string;
        locked: boolean;
        password_status: string;
        must_change_password: boolean;
        password_changed_at?: string | null;
        password_reset_history: Array<{ created_at: string; method: string }>;
        active_sessions: number;
    };
    permissions: {
        roles: string[];
        permissions: string[];
    };
    activity: Array<{
        event_type: string;
        description: string;
        category: string;
        created_at: string;
    }>;
}

export interface UsersIndexPageProps {
    summaryCards: KpiCardData[];
    users: PaginatedUsers;
    roles: RoleOption[];
    filters: UserFilters;
    statusOptions: string[];
}

export type UserColumnKey =
    | 'profile'
    | 'staff_id'
    | 'email'
    | 'roles'
    | 'status'
    | 'password'
    | 'last_login'
    | 'created'
    | 'actions';

export const defaultVisibleColumns: UserColumnKey[] = [
    'profile',
    'staff_id',
    'email',
    'roles',
    'status',
    'password',
    'last_login',
    'created',
    'actions',
];

export const columnLabels: Record<UserColumnKey, string> = {
    profile: 'User',
    staff_id: 'Staff ID',
    email: 'Email',
    roles: 'Roles',
    status: 'Status',
    password: 'Password',
    last_login: 'Last Login',
    created: 'Created',
    actions: 'Actions',
};
