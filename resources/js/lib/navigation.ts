import { useCan } from '@/lib/can';
import { type NavGroup, type NavItem, type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import {
    BarChart,
    Bell,
    Book,
    BookOpen,
    Building2,
    CalendarDays,
    ClipboardList,
    FileText,
    Folder,
    GraduationCap,
    Inbox,
    Landmark,
    Layers,
    LayoutGrid,
    LifeBuoy,
    Mail,
    MapPin,
    ScrollText,
    Settings,
    ShieldCheck,
    Sparkles,
    UserCheck,
    Users,
} from 'lucide-react';
import { useMemo } from 'react';

const teacherNavGroups: NavGroup[] = [
    {
        title: 'Overview',
        items: [
            {
                title: 'Dashboard',
                href: '/teacher/dashboard',
                icon: LayoutGrid,
                exact: true,
            },
        ],
    },
    {
        title: 'Attendance',
        items: [
            {
                title: 'Take Attendance',
                href: '/teacher/attendance',
                icon: UserCheck,
                staffTypes: ['lecturer'],
            },
            {
                title: 'Take Attendance',
                href: '/teacher/staff-attendance',
                icon: UserCheck,
                staffTypes: ['administrator'],
            },
            {
                title: 'Explanations',
                href: '/teacher/attendance-explanations',
                icon: ClipboardList,
            },
            {
                title: 'Venue Change Requests',
                href: '/teacher/venue-change-requests',
                icon: MapPin,
                staffTypes: ['administrator'],
            },
            {
                title: 'Attendance Report',
                href: '/teacher/staff-reports',
                icon: BarChart,
                staffTypes: ['administrator'],
            },
        ],
    },
    {
        title: 'Academic',
        items: [
            {
                title: 'My Schedules',
                href: '/teacher/timetable',
                icon: CalendarDays,
                staffTypes: ['lecturer'],
            },
            {
                title: 'My Courses',
                href: '/teacher/my-courses',
                icon: BookOpen,
                staffTypes: ['lecturer'],
            },
        ],
    },
    {
        title: 'My Work',
        items: [
            {
                title: 'Records',
                href: '/teacher/records',
                icon: Folder,
                staffTypes: ['lecturer'],
            },
            {
                title: 'Reminders',
                href: '/teacher/reminders',
                icon: Bell,
                staffTypes: ['lecturer'],
            },
            {
                title: 'Reports',
                href: '/teacher/reports',
                icon: BarChart,
                staffTypes: ['lecturer'],
            },
        ],
    },
    {
        title: 'Communication',
        items: [
            {
                title: 'Inbox',
                href: '/teacher/communication/inbox',
                icon: Inbox,
                badge: 'unread',
            },
            {
                title: 'Sent',
                href: '/teacher/communication/sent',
                icon: ClipboardList,
            },
            {
                title: 'Drafts',
                href: '/teacher/communication/drafts',
                icon: FileText,
            },
            {
                title: 'All Mail',
                href: '/teacher/communication/all',
                icon: Mail,
            },
            {
                title: 'Dashboard',
                href: '/teacher/communication',
                icon: LayoutGrid,
                exact: true,
                requiresLeadership: true,
            },
            {
                title: 'Compose',
                href: '/teacher/communication/compose',
                icon: ScrollText,
                requiresLeadership: true,
            },
        ],
    },
    {
        title: 'My Unit',
        items: [
            {
                title: 'Unit Staff',
                href: '/teacher/unit/staff',
                icon: Users,
                requiresLeadership: true,
            },
            {
                title: 'Unit Attendance',
                href: '/teacher/unit/attendance',
                icon: ClipboardList,
                requiresLeadership: true,
            },
            {
                title: 'Self-reported Absences',
                href: '/teacher/unit/self-reported-absences',
                icon: ClipboardList,
                requiresLeadership: true,
            },
            {
                title: 'Venue Change Requests',
                href: '/teacher/unit/venue-change-requests',
                icon: MapPin,
                requiresLeadership: true,
            },
            {
                title: 'Venue Change Authorizations',
                href: '/teacher/unit/venue-change-authorizations',
                icon: ShieldCheck,
                requiresLeadership: true,
            },
        ],
    },
    {
        title: 'Support',
        items: [
            {
                title: 'Help Desk',
                href: '/teacher/help-desk',
                icon: LifeBuoy,
            },
        ],
    },
];

const adminNavGroups: NavGroup[] = [
    {
        title: 'Overview',
        items: [
            {
                title: 'Dashboard',
                href: '/admin/dashboard',
                icon: LayoutGrid,
                exact: true,
                permission: 'admin.dashboard.view',
            },
        ],
    },
    {
        title: 'People',
        items: [
            {
                title: 'Staff',
                href: '/admin/teachers',
                icon: UserCheck,
                permission: 'admin.teachers.view',
                subItems: [
                    {
                        title: 'All Staff',
                        href: '/admin/teachers',
                        permission: 'admin.teachers.view',
                    },
                    {
                        title: 'Add Staff',
                        href: '/admin/teachers/create',
                        permission: 'admin.teachers.create',
                    },
                    {
                        title: 'Password Management',
                        href: '/admin/teachers/password-management',
                        permission: 'admin.teachers.password-management',
                    },
                ],
            },
            {
                title: 'Users',
                href: '/admin/user-management/users',
                icon: Users,
                permission: 'admin.user-management.users.view',
                subItems: [
                    {
                        title: 'All Users',
                        href: '/admin/user-management/users',
                        permission: 'admin.user-management.users.view',
                    },
                    {
                        title: 'Add User',
                        href: '/admin/user-management/users/create',
                        permission: 'admin.user-management.users.create',
                    },
                    {
                        title: 'User Roles',
                        href: '/admin/user-management/roles',
                        permission: 'admin.user-management.roles.view',
                    },
                ],
            },
        ],
    },
    {
        title: 'Attendance',
        items: [
            {
                title: 'Teaching Staff',
                href: '/admin/attendance',
                icon: BarChart,
                permission: 'admin.attendance.view',
            },
            {
                title: 'Non-Teaching Staff',
                href: '/admin/settings-reports/staff-attendance-reports',
                icon: ClipboardList,
                permission: 'admin.staff-attendance.view',
            },
            {
                title: 'Attendance Explanations',
                href: '/admin/attendance-explanations',
                icon: ScrollText,
                permission: 'admin.attendance-explanations.view',
            },
        ],
    },
    {
        title: 'Schedules',
        items: [
            {
                title: 'Assigned Schedules',
                href: '/admin/academics/time-tables',
                icon: CalendarDays,
                permission: 'admin.academics.time-tables.view',
            },
            {
                title: 'Create Schedule',
                href: '/admin/academics/time-tables/create',
                icon: Book,
                permission: 'admin.academics.time-tables.create',
            },
            {
                title: 'Bulk Create Schedules',
                href: '/admin/academics/time-tables/bulk-create',
                icon: Layers,
                permission: 'admin.academics.time-tables.create',
            },
            {
                title: 'Generate Time Table',
                href: '/admin/academics/time-tables/generate',
                icon: Sparkles,
                permission: 'admin.academics.time-tables.generate',
            },
            {
                title: 'Rescheduled Sessions',
                href: '/admin/school-management/schedules',
                icon: CalendarDays,
                permission: 'admin.schedules.view',
            },
            {
                title: 'Venue Change Authorizations',
                href: '/admin/venue-change-authorizations',
                icon: ShieldCheck,
                permission: 'admin.venue-change-authorizations.view',
            },
            {
                title: 'Venue Change Requests',
                href: '/admin/venue-change-requests',
                icon: MapPin,
                permission: 'admin.venue-change-requests.view',
            },
        ],
    },
    {
        title: 'Communication',
        items: [
            {
                title: 'Inbox',
                href: '/admin/communication/inbox',
                icon: Inbox,
                permission: 'admin.communication.view',
                badge: 'unread',
            },
            {
                title: 'Sent',
                href: '/admin/communication/sent',
                icon: ClipboardList,
                permission: 'admin.communication.view-sent',
            },
            {
                title: 'Drafts',
                href: '/admin/communication/drafts',
                icon: FileText,
                permission: 'admin.communication.view',
            },
            {
                title: 'All Mail',
                href: '/admin/communication/all',
                icon: Mail,
                permission: 'admin.communication.view',
            },
            {
                title: 'Dashboard',
                href: '/admin/communication',
                icon: LayoutGrid,
                exact: true,
                permission: 'admin.communication.view',
            },
            {
                title: 'Compose',
                href: '/admin/communication/compose',
                permission: 'admin.communication.compose',
                icon: ScrollText,
            },
        ],
    },
    {
        title: 'School',
        items: [
            {
                title: 'Faculties',
                href: '/admin/school-management/faculties',
                icon: Landmark,
                permission: 'admin.school-management.faculties.view',
                subItems: [
                    {
                        title: 'Faculty List',
                        href: '/admin/school-management/faculties',
                        permission: 'admin.school-management.faculties.view',
                    },
                    {
                        title: 'Add Faculty',
                        href: '/admin/school-management/faculties/create',
                        permission: 'admin.school-management.faculties.create',
                    },
                ],
            },
            {
                title: 'Departments',
                href: '/admin/school-management/departments',
                icon: Building2,
                permission: 'admin.school-management.departments.view',
                subItems: [
                    {
                        title: 'Department List',
                        href: '/admin/school-management/departments',
                        permission: 'admin.school-management.departments.view',
                    },
                    {
                        title: 'Add Department',
                        href: '/admin/school-management/departments/create',
                        permission: 'admin.school-management.departments.create',
                    },
                ],
            },
            {
                title: 'Venues',
                href: '/admin/school-management/class-rooms',
                icon: MapPin,
                permission: 'admin.school-management.class-rooms.view',
                subItems: [
                    {
                        title: 'Venue List',
                        href: '/admin/school-management/class-rooms',
                        permission: 'admin.school-management.class-rooms.view',
                    },
                    {
                        title: 'Add Venue',
                        href: '/admin/school-management/class-rooms/create',
                        permission: 'admin.school-management.class-rooms.create',
                    },
                ],
            },
        ],
    },
    {
        title: 'Catalog',
        items: [
            {
                title: 'Academic Years',
                href: '/admin/school-management/academic-years',
                icon: CalendarDays,
                permission: 'admin.school-management.academic-years.view',
                subItems: [
                    {
                        title: 'Academic Year List',
                        href: '/admin/school-management/academic-years',
                        permission: 'admin.school-management.academic-years.view',
                    },
                    {
                        title: 'Add Academic Year',
                        href: '/admin/school-management/academic-years/create',
                        permission: 'admin.school-management.academic-years.create',
                    },
                ],
            },
            {
                title: 'Academic Periods',
                href: '/admin/school-management/academic-periods',
                icon: CalendarDays,
                permission: 'admin.school-management.academic-periods.view',
                subItems: [
                    {
                        title: 'Academic Period List',
                        href: '/admin/school-management/academic-periods',
                        permission: 'admin.school-management.academic-periods.view',
                    },
                    {
                        title: 'Add Academic Period',
                        href: '/admin/school-management/academic-periods/create',
                        permission: 'admin.school-management.academic-periods.create',
                    },
                ],
            },
            {
                title: 'Programs',
                href: '/admin/school-management/programs',
                icon: GraduationCap,
                permission: 'admin.school-management.programs.view',
                subItems: [
                    {
                        title: 'Program List',
                        href: '/admin/school-management/programs',
                        permission: 'admin.school-management.programs.view',
                    },
                    {
                        title: 'Add Program',
                        href: '/admin/school-management/programs/create',
                        permission: 'admin.school-management.programs.create',
                    },
                ],
            },
            {
                title: 'Courses',
                href: '/admin/school-management/courses',
                icon: BookOpen,
                permission: 'admin.school-management.courses.view',
                subItems: [
                    {
                        title: 'Course List',
                        href: '/admin/school-management/courses',
                        permission: 'admin.school-management.courses.view',
                    },
                    {
                        title: 'Add Course',
                        href: '/admin/school-management/courses/create',
                        permission: 'admin.school-management.courses.create',
                    },
                ],
            },
        ],
    },
    {
        title: 'System',
        items: [
            {
                title: 'System Settings',
                href: '/admin/settings-reports/settings',
                icon: Settings,
                permission: 'admin.settings.view',
            },
            {
                title: 'Holidays & Breaks',
                href: '/admin/holidays-breaks',
                icon: CalendarDays,
                permission: 'admin.holidays-breaks.view',
            },
            {
                title: 'System Logs',
                href: '/admin/system-logs',
                icon: ScrollText,
                permission: 'admin.system-logs.view',
            },
        ],
    },
    {
        title: 'Support',
        items: [
            {
                title: 'Help Desk',
                href: '/admin/help-desk',
                icon: LifeBuoy,
                permission: 'admin.help-desk.view',
            },
        ],
    },
];

type CanFn = (permission?: string | null) => boolean;

interface NavFilterContext {
    isTeacher: boolean;
    staffType: string | null;
    hasLeadership: boolean;
    venueChangeRequestsEnabled: boolean;
    can: CanFn;
}

function normalizePath(href: string) {
    let path = href.split('?')[0];

    try {
        if (path.startsWith('http://') || path.startsWith('https://')) {
            path = new URL(path).pathname;
        }
    } catch {
        // Keep the original path when URL parsing fails.
    }

    if (path.length > 1) {
        path = path.replace(/\/+$/, '');
    }

    return path || '/';
}

function pathMatches(currentUrl: string, href: string, exact?: boolean): boolean {
    const current = normalizePath(currentUrl);
    const path = normalizePath(href);

    if (current === path) {
        return true;
    }

    if (exact || path === '/') {
        return false;
    }

    return current.startsWith(`${path}/`);
}

export function isNavItemActive(item: NavItem, currentUrl: string): boolean {
    if (item.subItems?.length) {
        return item.subItems.some((subItem) => isNavItemActive(subItem, currentUrl));
    }

    return pathMatches(currentUrl, item.href, item.exact ?? /\/dashboard$/.test(normalizePath(item.href)));
}

function isNavItemVisible(item: NavItem, ctx: NavFilterContext): boolean {
    if (ctx.isTeacher) {
        if (item.requiresLeadership && !ctx.hasLeadership) {
            return false;
        }

        if (item.staffTypes && !item.staffTypes.includes(ctx.staffType || 'lecturer')) {
            return false;
        }

        if (item.href === '/teacher/venue-change-requests' && !ctx.venueChangeRequestsEnabled) {
            return false;
        }

        return true;
    }

    if (item.subItems?.length) {
        return ctx.can(item.permission) || item.subItems.some((subItem) => isNavItemVisible(subItem, ctx));
    }

    return ctx.can(item.permission);
}

function filterNavItem(item: NavItem, ctx: NavFilterContext): NavItem | null {
    if (!isNavItemVisible(item, ctx)) {
        return null;
    }

    if (!item.subItems?.length) {
        return item;
    }

    const subItems = item.subItems.map((subItem) => filterNavItem(subItem, ctx)).filter((subItem): subItem is NavItem => Boolean(subItem));

    if (subItems.length === 0) {
        return null;
    }

    return { ...item, subItems };
}

function filterNavGroups(groups: NavGroup[], ctx: NavFilterContext): NavGroup[] {
    return groups
        .map((group) => ({
            ...group,
            items: group.items.map((item) => filterNavItem(item, ctx)).filter((item): item is NavItem => Boolean(item)),
        }))
        .filter((group) => group.items.length > 0);
}

export function useAppNavigation() {
    const page = usePage<SharedData>();
    const { auth } = page.props;
    const can = useCan();
    const systemSettings = (
        page.props as SharedData & {
            system_settings?: Record<string, Record<string, { value?: boolean | string | number }>>;
        }
    ).system_settings;

    const isTeacher = Boolean(auth.user && auth.guard === 'teacher');
    const staffType = isTeacher ? String(auth.user.staff_type || 'lecturer') : null;
    const hasLeadership = Boolean(auth.leadership?.role);
    const venueChangeRequestsEnabled = systemSettings?.attendance?.administrator_venue_change_requests_enabled?.value !== false;
    const unreadConversationsCount = Number(page.props.unreadConversationsCount ?? 0);
    const homeHref = auth.home || (isTeacher ? '/teacher/dashboard' : '/admin/dashboard');

    const groups = useMemo(
        () =>
            filterNavGroups(isTeacher ? teacherNavGroups : adminNavGroups, {
                isTeacher,
                staffType,
                hasLeadership,
                venueChangeRequestsEnabled,
                can,
            }),
        [can, hasLeadership, isTeacher, staffType, venueChangeRequestsEnabled],
    );

    return {
        groups,
        isTeacher,
        homeHref,
        unreadConversationsCount,
        currentUrl: page.url,
        leadership: auth.leadership,
        staffType,
    };
}
