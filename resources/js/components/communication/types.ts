export type CommunicationCapabilities = {
    can_compose: boolean;
    can_send: boolean;
    can_manage_drafts: boolean;
    can_send_selected_faculties: boolean;
    can_send_all_faculties: boolean;
    can_send_selected_departments: boolean;
    can_send_all_departments: boolean;
    can_send_selected_staff: boolean;
    can_send_all_staff: boolean;
    scope_label: string;
    all_staff_label: string;
};

export type CommunicationTarget = {
    type: string;
    id: number | null;
    label: string | null;
};

export type CommunicationRecipient = {
    id: number;
    teacher_id: number;
    name: string;
    employee_id?: string | null;
    faculty?: string | null;
    department?: string | null;
    status: string;
    status_label: string;
    delivered_at?: string | null;
    read_at?: string | null;
};

export type CommunicationMessage = {
    id: number;
    subject: string;
    body: string;
    status: string;
    status_label: string;
    recipient_count: number;
    delivered_count: number;
    read_count: number;
    audience_summary: string[];
    sent_at?: string | null;
    created_at?: string | null;
    sender?: { type: string; name: string } | null;
    targets: CommunicationTarget[];
    recipients: CommunicationRecipient[];
    viewer_status?: string | null;
    viewer_read_at?: string | null;
};

export type CommunicationStats = {
    sent: number;
    recipients: number;
    drafts: number;
    delivered: number;
    read: number;
};

export type PaginatedMessages = {
    data: CommunicationMessage[];
    links?: Array<{ url: string | null; label: string; active: boolean }>;
    current_page?: number;
    last_page?: number;
    total?: number;
};

export type StaffOption = {
    id: number;
    name: string;
    employee_id?: string | null;
    faculty?: string | null;
    department?: string | null;
};

export type FacultyOption = {
    id: number;
    name: string;
};

export type DepartmentOption = {
    id: number;
    name: string;
    faculty_id: number;
    faculty_name?: string | null;
};
