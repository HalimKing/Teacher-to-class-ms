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

export type CommunicationActor = {
    type: string;
    id: number;
    name: string;
    initials: string;
};

export type CommunicationTarget = {
    type: string;
    id: number | null;
    label: string | null;
};

export type CommunicationRecipient = {
    id: number;
    teacher_id?: number | null;
    user_id?: number | null;
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
    conversation_id?: number | null;
    parent_id?: number | null;
    kind?: string;
    subject: string;
    body: string;
    excerpt?: string;
    status: string;
    status_label: string;
    recipient_count: number;
    delivered_count: number;
    read_count: number;
    audience_summary: string[];
    sent_at?: string | null;
    created_at?: string | null;
    sender?: CommunicationActor | null;
    in_reply_to?: {
        id: number;
        sender?: CommunicationActor | null;
        excerpt?: string;
    } | null;
    to?: Array<{ name: string; type: string }>;
    targets: CommunicationTarget[];
    recipients: CommunicationRecipient[];
    viewer_status?: string | null;
    viewer_read_at?: string | null;
};

export type CommunicationConversation = {
    id: number;
    subject: string;
    preview?: string | null;
    last_message_at?: string | null;
    message_count: number;
    unread: boolean;
    is_important: boolean;
    has_draft?: boolean;
    participants: CommunicationActor[];
    from?: CommunicationActor | null;
    participant_label: string;
};

export type CommunicationThread = {
    id: number;
    subject: string;
    message_count: number;
    last_message_at?: string | null;
    participants: CommunicationActor[];
    can_reply: boolean;
    can_reply_all: boolean;
    can_send_draft: boolean;
    draft_id?: number | null;
    viewer?: CommunicationActor | null;
    messages: CommunicationMessage[];
};

export type CommunicationFolder = 'inbox' | 'sent' | 'drafts' | 'all';

export type CommunicationFolderCounts = {
    inbox: number;
    drafts: number;
    sent: number;
    all: number;
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

export type PaginatedConversations = {
    data: CommunicationConversation[];
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

export type MailboxPrefix = 'teacher' | 'admin';
