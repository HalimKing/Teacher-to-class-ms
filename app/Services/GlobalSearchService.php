<?php

namespace App\Services;

use App\Models\ClassRoom;
use App\Models\Course;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\HelpDeskTicket;
use App\Models\Program;
use App\Models\SystemSetting;
use App\Models\Teacher;
use App\Models\TeacherAttendance;
use App\Models\TimeTable;
use App\Models\User;
use App\Support\SqlDialect;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class GlobalSearchService
{
    public const LIMIT_PER_GROUP = 5;

    /**
     * Navigable pages are cheap to render, so they get a larger cap than record groups.
     */
    public const PAGE_LIMIT = 8;

    /**
     * @return array{groups: list<array<string, mixed>>, categories: list<array{value: string, label: string}>}
     */
    public function search(string $query, ?string $category = null): array
    {
        $query = trim($query);
        $isAdmin = Auth::guard('web')->check();
        $isTeacher = Auth::guard('teacher')->check();

        if ($query === '' || (! $isAdmin && ! $isTeacher)) {
            return [
                'groups' => [],
                'categories' => $this->availableCategories($isAdmin, $isTeacher),
            ];
        }

        $like = '%'.Str::lower($query).'%';
        $providers = $isAdmin
            ? $this->adminProviders()
            : $this->teacherProviders();

        if ($category && $category !== 'all') {
            $providers = array_filter(
                $providers,
                fn (array $provider) => $provider['key'] === $category
            );
        }

        $groups = [];

        foreach ($providers as $provider) {
            if ($isAdmin && ! empty($provider['permission'])) {
                /** @var User $user */
                $user = Auth::guard('web')->user();
                if (! $user->can($provider['permission'])) {
                    continue;
                }
            }

            $items = ($provider['search'])($query, $like);
            if ($items->isEmpty()) {
                continue;
            }

            $groups[] = [
                'key' => $provider['key'],
                'label' => $provider['label'],
                'icon' => $provider['icon'],
                'items' => $items->values()->all(),
            ];
        }

        return [
            'groups' => $groups,
            'categories' => $this->availableCategories($isAdmin, $isTeacher),
        ];
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    private function availableCategories(bool $isAdmin, bool $isTeacher): array
    {
        $categories = [['value' => 'all', 'label' => 'All']];

        $providers = $isAdmin ? $this->adminProviders() : ($isTeacher ? $this->teacherProviders() : []);

        foreach ($providers as $provider) {
            if ($isAdmin && ! empty($provider['permission'])) {
                /** @var User|null $user */
                $user = Auth::guard('web')->user();
                if (! $user || ! $user->can($provider['permission'])) {
                    continue;
                }
            }

            $categories[] = [
                'value' => $provider['key'],
                'label' => $provider['label'],
            ];
        }

        return $categories;
    }

    /**
     * @return list<array{key: string, label: string, icon: string, permission?: string, search: callable}>
     */
    private function adminProviders(): array
    {
        return [
            [
                'key' => 'staff',
                'label' => 'Staff',
                'icon' => 'users',
                'permission' => 'admin.teachers.view',
                'search' => fn (string $q, string $like) => $this->searchStaff($like, null),
            ],
            [
                'key' => 'courses',
                'label' => 'Courses',
                'icon' => 'book-open',
                'permission' => 'admin.school-management.courses.view',
                'search' => fn (string $q, string $like) => $this->searchCourses($like, null),
            ],
            [
                'key' => 'venues',
                'label' => 'Venues',
                'icon' => 'map-pin',
                'permission' => 'admin.school-management.class-rooms.view',
                'search' => fn (string $q, string $like) => $this->searchVenues($like),
            ],
            [
                'key' => 'schedules',
                'label' => 'Schedules',
                'icon' => 'calendar',
                'permission' => 'admin.academics.time-tables.view',
                'search' => fn (string $q, string $like) => $this->searchSchedules($like, null),
            ],
            [
                'key' => 'departments',
                'label' => 'Departments',
                'icon' => 'building',
                'permission' => 'admin.school-management.departments.view',
                'search' => fn (string $q, string $like) => $this->searchDepartments($like),
            ],
            [
                'key' => 'faculties',
                'label' => 'Faculties',
                'icon' => 'landmark',
                'permission' => 'admin.school-management.faculties.view',
                'search' => fn (string $q, string $like) => $this->searchFaculties($like),
            ],
            [
                'key' => 'programs',
                'label' => 'Programs',
                'icon' => 'graduation-cap',
                'permission' => 'admin.school-management.programs.view',
                'search' => fn (string $q, string $like) => $this->searchPrograms($like),
            ],
            [
                'key' => 'help_desk',
                'label' => 'Help Desk',
                'icon' => 'life-buoy',
                'permission' => 'admin.help-desk.view',
                'search' => fn (string $q, string $like) => $this->searchHelpDesk($like, null),
            ],
            [
                'key' => 'attendance',
                'label' => 'Attendance',
                'icon' => 'clipboard-check',
                'permission' => 'admin.attendance.view',
                'search' => fn (string $q, string $like) => $this->searchAttendance($like, null),
            ],
            [
                'key' => 'users',
                'label' => 'Users',
                'icon' => 'user-cog',
                'permission' => 'admin.user-management.users.view',
                'search' => fn (string $q, string $like) => $this->searchUsers($like),
            ],
            [
                'key' => 'pages',
                'label' => 'Pages & Reports',
                'icon' => 'layout',
                'permission' => null,
                'search' => fn (string $q, string $like) => $this->searchAdminPages($q),
            ],
        ];
    }

    /**
     * @return list<array{key: string, label: string, icon: string, search: callable}>
     */
    private function teacherProviders(): array
    {
        /** @var Teacher $teacher */
        $teacher = Auth::guard('teacher')->user();
        $staffType = $teacher->staff_type ?? Teacher::STAFF_TYPE_LECTURER;

        $providers = [
            [
                'key' => 'help_desk',
                'label' => 'Help Desk',
                'icon' => 'life-buoy',
                'search' => fn (string $q, string $like) => $this->searchHelpDesk($like, $teacher->id),
            ],
            [
                'key' => 'pages',
                'label' => 'Pages',
                'icon' => 'layout',
                'search' => fn (string $q, string $like) => $this->searchTeacherPages($q, $teacher),
            ],
        ];

        if ($staffType === Teacher::STAFF_TYPE_LECTURER) {
            array_unshift(
                $providers,
                [
                    'key' => 'courses',
                    'label' => 'My Courses',
                    'icon' => 'book-open',
                    'search' => fn (string $q, string $like) => $this->searchCourses($like, $teacher->id),
                ],
                [
                    'key' => 'schedules',
                    'label' => 'My Schedules',
                    'icon' => 'calendar',
                    'search' => fn (string $q, string $like) => $this->searchSchedules($like, $teacher->id),
                ],
                [
                    'key' => 'attendance',
                    'label' => 'Attendance',
                    'icon' => 'clipboard-check',
                    'search' => fn (string $q, string $like) => $this->searchAttendance($like, $teacher->id),
                ],
            );
        }

        return $providers;
    }

    private function searchStaff(string $like, ?int $onlyId): Collection
    {
        $fullNameExpr = $this->lowerConcatExpr(['first_name', 'last_name']);

        return Teacher::query()
            ->with(['department:id,name', 'faculty:id,name'])
            ->when($onlyId, fn ($q) => $q->where('id', $onlyId))
            ->where(function ($q) use ($like, $fullNameExpr) {
                $q->whereRaw('LOWER(first_name) LIKE ?', [$like])
                    ->orWhereRaw('LOWER(last_name) LIKE ?', [$like])
                    ->orWhereRaw('LOWER(email) LIKE ?', [$like])
                    ->orWhereRaw('LOWER(employee_id) LIKE ?', [$like])
                    ->orWhereRaw('LOWER(phone) LIKE ?', [$like])
                    ->orWhereRaw("{$fullNameExpr} LIKE ?", [$like]);
            })
            ->orderBy('last_name')
            ->limit(self::LIMIT_PER_GROUP)
            ->get()
            ->map(fn (Teacher $teacher) => [
                'id' => 'staff-'.$teacher->id,
                'title' => trim("{$teacher->title} {$teacher->first_name} {$teacher->last_name}"),
                'subtitle' => collect([
                    $teacher->employee_id,
                    ucfirst((string) $teacher->staff_type),
                    $teacher->department?->name,
                ])->filter()->implode(' · '),
                'url' => route('admin.teachers.edit', $teacher),
                'meta' => $teacher->email,
            ]);
    }

    private function searchCourses(string $like, ?int $teacherId): Collection
    {
        return Course::query()
            ->with(['program:id,name', 'teacher:id,first_name,last_name'])
            ->when($teacherId, fn ($q) => $q->where('teacher_id', $teacherId))
            ->where(function ($q) use ($like) {
                $q->whereRaw('LOWER(name) LIKE ?', [$like])
                    ->orWhereRaw('LOWER(course_code) LIKE ?', [$like])
                    ->orWhereHas('program', fn ($p) => $p->whereRaw('LOWER(name) LIKE ?', [$like]));
            })
            ->orderBy('name')
            ->limit(self::LIMIT_PER_GROUP)
            ->get()
            ->map(function (Course $course) use ($teacherId) {
                return [
                    'id' => 'course-'.$course->id,
                    'title' => $course->name,
                    'subtitle' => collect([
                        $course->course_code,
                        $course->program?->name,
                    ])->filter()->implode(' · '),
                    'url' => $teacherId
                        ? route('teacher.my-courses')
                        : route('admin.school-management.courses.edit', $course),
                    'meta' => $course->teacher
                        ? trim("{$course->teacher->first_name} {$course->teacher->last_name}")
                        : null,
                ];
            });
    }

    private function searchVenues(string $like): Collection
    {
        return ClassRoom::query()
            ->whereRaw('LOWER(name) LIKE ?', [$like])
            ->orderBy('name')
            ->limit(self::LIMIT_PER_GROUP)
            ->get()
            ->map(fn (ClassRoom $room) => [
                'id' => 'venue-'.$room->id,
                'title' => $room->name,
                'subtitle' => $room->capacity ? "Capacity: {$room->capacity}" : 'Venue',
                'url' => route('admin.school-management.class-rooms.edit', $room),
                'meta' => null,
            ]);
    }

    private function searchSchedules(string $like, ?int $teacherId): Collection
    {
        return TimeTable::query()
            ->with(['course:id,name,course_code', 'teacher:id,first_name,last_name', 'classRoom:id,name'])
            ->when($teacherId, fn ($q) => $q->where('teacher_id', $teacherId))
            ->where(function ($q) use ($like) {
                $q->whereRaw('LOWER(day) LIKE ?', [$like])
                    ->orWhereRaw('LOWER(day_of_week) LIKE ?', [$like])
                    ->orWhereHas('course', function ($c) use ($like) {
                        $c->whereRaw('LOWER(name) LIKE ?', [$like])
                            ->orWhereRaw('LOWER(course_code) LIKE ?', [$like]);
                    })
                    ->orWhereHas('teacher', function ($t) use ($like) {
                        $t->whereRaw('LOWER(first_name) LIKE ?', [$like])
                            ->orWhereRaw('LOWER(last_name) LIKE ?', [$like])
                            ->orWhereRaw('LOWER(employee_id) LIKE ?', [$like]);
                    })
                    ->orWhereHas('classRoom', fn ($r) => $r->whereRaw('LOWER(name) LIKE ?', [$like]));
            })
            ->latest('id')
            ->limit(self::LIMIT_PER_GROUP)
            ->get()
            ->map(function (TimeTable $timetable) use ($teacherId) {
                $day = $timetable->day_of_week ?: $timetable->day;
                $title = $timetable->course?->name ?: 'Office Schedule';

                return [
                    'id' => 'schedule-'.$timetable->id,
                    'title' => $title,
                    'subtitle' => collect([
                        $day,
                        trim(($timetable->start_time ?? '').'–'.($timetable->end_time ?? ''), '–'),
                        $timetable->classRoom?->name,
                    ])->filter()->implode(' · '),
                    'url' => $teacherId
                        ? route('teacher.timetable')
                        : route('admin.academics.time-tables.edit', $timetable),
                    'meta' => $timetable->teacher
                        ? trim("{$timetable->teacher->first_name} {$timetable->teacher->last_name}")
                        : null,
                ];
            });
    }

    private function searchDepartments(string $like): Collection
    {
        return Department::query()
            ->with('faculty:id,name')
            ->where(function ($q) use ($like) {
                $q->whereRaw('LOWER(name) LIKE ?', [$like])
                    ->orWhereHas('faculty', fn ($f) => $f->whereRaw('LOWER(name) LIKE ?', [$like]));
            })
            ->orderBy('name')
            ->limit(self::LIMIT_PER_GROUP)
            ->get()
            ->map(fn (Department $department) => [
                'id' => 'department-'.$department->id,
                'title' => $department->name,
                'subtitle' => $department->faculty?->name ?: 'Department',
                'url' => route('admin.school-management.departments.edit', $department),
                'meta' => null,
            ]);
    }

    private function searchFaculties(string $like): Collection
    {
        return Faculty::query()
            ->where(function ($q) use ($like) {
                $q->whereRaw('LOWER(name) LIKE ?', [$like])
                    ->orWhereRaw('LOWER(COALESCE(description, \'\')) LIKE ?', [$like]);
            })
            ->orderBy('name')
            ->limit(self::LIMIT_PER_GROUP)
            ->get()
            ->map(fn (Faculty $faculty) => [
                'id' => 'faculty-'.$faculty->id,
                'title' => $faculty->name,
                'subtitle' => 'Faculty',
                'url' => route('admin.school-management.faculties.edit', $faculty),
                'meta' => null,
            ]);
    }

    private function searchPrograms(string $like): Collection
    {
        return Program::query()
            ->with(['department:id,name', 'faculty:id,name'])
            ->where(function ($q) use ($like) {
                $q->whereRaw('LOWER(name) LIKE ?', [$like]);
            })
            ->orderBy('name')
            ->limit(self::LIMIT_PER_GROUP)
            ->get()
            ->map(fn (Program $program) => [
                'id' => 'program-'.$program->id,
                'title' => $program->name,
                'subtitle' => collect([
                    $program->department?->name,
                    $program->faculty?->name,
                ])->filter()->implode(' · '),
                'url' => route('admin.school-management.programs.edit', $program),
                'meta' => null,
            ]);
    }

    private function searchHelpDesk(string $like, ?int $creatorId): Collection
    {
        return HelpDeskTicket::query()
            ->with('creator:id,first_name,last_name,employee_id')
            ->when($creatorId, fn ($q) => $q->where('created_by', $creatorId))
            ->where(function ($q) use ($like) {
                $q->whereRaw('LOWER(ticket_number) LIKE ?', [$like])
                    ->orWhereRaw('LOWER(subject) LIKE ?', [$like])
                    ->orWhereRaw('LOWER(description) LIKE ?', [$like])
                    ->orWhereHas('creator', function ($c) use ($like) {
                        $c->whereRaw('LOWER(first_name) LIKE ?', [$like])
                            ->orWhereRaw('LOWER(last_name) LIKE ?', [$like])
                            ->orWhereRaw('LOWER(employee_id) LIKE ?', [$like]);
                    });
            })
            ->latest('id')
            ->limit(self::LIMIT_PER_GROUP)
            ->get()
            ->map(function (HelpDeskTicket $ticket) use ($creatorId) {
                return [
                    'id' => 'ticket-'.$ticket->id,
                    'title' => $ticket->subject,
                    'subtitle' => collect([
                        $ticket->ticket_number,
                        $ticket->statusLabel(),
                        $ticket->priorityLabel(),
                    ])->implode(' · '),
                    'url' => $creatorId
                        ? route('teacher.help-desk.show', $ticket)
                        : route('admin.help-desk.show', $ticket),
                    'meta' => $ticket->creator
                        ? trim("{$ticket->creator->first_name} {$ticket->creator->last_name}")
                        : null,
                ];
            });
    }

    private function searchAttendance(string $like, ?int $teacherId): Collection
    {
        return TeacherAttendance::query()
            ->with(['teacher:id,first_name,last_name,employee_id', 'course:id,name,course_code'])
            ->when($teacherId, fn ($q) => $q->where('teacher_id', $teacherId))
            ->where(function ($q) use ($like) {
                $q->whereRaw('LOWER(COALESCE(status, \'\')) LIKE ?', [$like])
                    ->orWhereRaw('CAST(date AS CHAR) LIKE ?', [$like])
                    ->orWhereHas('teacher', function ($t) use ($like) {
                        $t->whereRaw('LOWER(first_name) LIKE ?', [$like])
                            ->orWhereRaw('LOWER(last_name) LIKE ?', [$like])
                            ->orWhereRaw('LOWER(employee_id) LIKE ?', [$like]);
                    })
                    ->orWhereHas('course', function ($c) use ($like) {
                        $c->whereRaw('LOWER(name) LIKE ?', [$like])
                            ->orWhereRaw('LOWER(course_code) LIKE ?', [$like]);
                    });
            })
            ->latest('date')
            ->limit(self::LIMIT_PER_GROUP)
            ->get()
            ->map(function (TeacherAttendance $record) use ($teacherId) {
                $teacherName = $record->teacher
                    ? trim("{$record->teacher->first_name} {$record->teacher->last_name}")
                    : 'Staff';

                return [
                    'id' => 'attendance-'.$record->id,
                    'title' => $teacherId
                        ? ($record->course?->name ?: 'Attendance session')
                        : $teacherName,
                    'subtitle' => collect([
                        optional($record->date)?->format('Y-m-d'),
                        $record->status,
                        $record->course?->course_code,
                    ])->filter()->implode(' · '),
                    'url' => $teacherId
                        ? route('teacher.records')
                        : url('/admin/attendance'),
                    'meta' => $record->teacher?->employee_id,
                ];
            });
    }

    private function searchUsers(string $like): Collection
    {
        return User::query()
            ->where(function ($q) use ($like) {
                $q->whereRaw('LOWER(name) LIKE ?', [$like])
                    ->orWhereRaw('LOWER(email) LIKE ?', [$like])
                    ->orWhereRaw('LOWER(COALESCE(staff_id, \'\')) LIKE ?', [$like]);
            })
            ->orderBy('name')
            ->limit(self::LIMIT_PER_GROUP)
            ->get()
            ->map(fn (User $user) => [
                'id' => 'user-'.$user->id,
                'title' => $user->name,
                'subtitle' => collect([$user->staff_id, $user->email])->filter()->implode(' · '),
                'url' => route('admin.user-management.users.edit', $user),
                'meta' => null,
            ]);
    }

    private function searchAdminPages(string $query): Collection
    {
        $pages = [
            ['title' => 'Dashboard', 'subtitle' => 'Overview', 'url' => '/admin/dashboard', 'permission' => 'admin.dashboard.view', 'keywords' => 'home overview'],

            ['title' => 'All Staff', 'subtitle' => 'People', 'url' => '/admin/teachers', 'permission' => 'admin.teachers.view', 'keywords' => 'staff lecturers administrators teachers'],
            ['title' => 'Add Staff', 'subtitle' => 'People', 'url' => '/admin/teachers/create', 'permission' => 'admin.teachers.create', 'keywords' => 'new staff lecturer administrator'],
            ['title' => 'Password Management', 'subtitle' => 'People', 'url' => '/admin/teachers/password-management', 'permission' => 'admin.teachers.password-management', 'keywords' => 'reset staff passwords'],
            ['title' => 'Users', 'subtitle' => 'People', 'url' => '/admin/user-management/users', 'permission' => 'admin.user-management.users.view', 'keywords' => 'accounts user management'],
            ['title' => 'Add User', 'subtitle' => 'People', 'url' => '/admin/user-management/users/create', 'permission' => 'admin.user-management.users.create', 'keywords' => 'new user account'],
            ['title' => 'User Roles', 'subtitle' => 'People', 'url' => '/admin/user-management/roles', 'permission' => 'admin.user-management.roles.view', 'keywords' => 'roles permissions access control'],

            ['title' => 'Teaching Staff Attendance Reports', 'subtitle' => 'Attendance', 'url' => '/admin/attendance', 'permission' => 'admin.attendance.view', 'keywords' => 'attendance report teaching lecturer'],
            ['title' => 'Non-Teaching Staff Attendance Reports', 'subtitle' => 'Attendance', 'url' => '/admin/settings-reports/staff-attendance-reports', 'permission' => 'admin.staff-attendance.view', 'keywords' => 'staff attendance report administrator'],
            ['title' => 'Attendance Explanations', 'subtitle' => 'Attendance', 'url' => '/admin/attendance-explanations', 'permission' => 'admin.attendance-explanations.view', 'keywords' => 'explanation absence excused self reported'],

            ['title' => 'Assigned Schedules', 'subtitle' => 'Schedules', 'url' => '/admin/academics/time-tables', 'permission' => 'admin.academics.time-tables.view', 'keywords' => 'timetable schedule'],
            ['title' => 'Create Schedule', 'subtitle' => 'Schedules', 'url' => '/admin/academics/time-tables/create', 'permission' => 'admin.academics.time-tables.create', 'keywords' => 'new schedule timetable venue slot'],
            ['title' => 'Bulk Create Schedules', 'subtitle' => 'Schedules', 'url' => '/admin/academics/time-tables/bulk-create', 'permission' => 'admin.academics.time-tables.create', 'keywords' => 'bulk import schedules csv'],
            ['title' => 'Generate Time Table', 'subtitle' => 'Schedules', 'url' => '/admin/academics/time-tables/generate', 'permission' => 'admin.academics.time-tables.generate', 'keywords' => 'generate automatic timetable'],
            ['title' => 'Rescheduled Sessions', 'subtitle' => 'Schedules', 'url' => '/admin/school-management/schedules', 'permission' => 'admin.schedules.view', 'keywords' => 'reschedule moved session'],
            ['title' => 'Venue Change Authorizations', 'subtitle' => 'Schedules', 'url' => '/admin/venue-change-authorizations', 'permission' => 'admin.venue-change-authorizations.view', 'keywords' => 'venue change authorization room move'],
            ['title' => 'Venue Change Requests', 'subtitle' => 'Schedules', 'url' => '/admin/venue-change-requests', 'permission' => 'admin.venue-change-requests.view', 'keywords' => 'venue change request approval dean head of department'],

            ['title' => 'Inbox', 'subtitle' => 'Communication', 'url' => '/admin/communication/inbox', 'permission' => 'admin.communication.view', 'keywords' => 'mail messages inbox conversations threads'],
            ['title' => 'Sent', 'subtitle' => 'Communication', 'url' => '/admin/communication/sent', 'permission' => ['admin.communication.view-sent', 'admin.communication.view'], 'keywords' => 'mail messages sent'],
            ['title' => 'Drafts', 'subtitle' => 'Communication', 'url' => '/admin/communication/drafts', 'permission' => ['admin.communication.view', 'admin.communication.manage-drafts'], 'keywords' => 'mail messages drafts unsent'],
            ['title' => 'All Mail', 'subtitle' => 'Communication', 'url' => '/admin/communication/all', 'permission' => 'admin.communication.view', 'keywords' => 'mail messages archive everything'],
            ['title' => 'Communication Dashboard', 'subtitle' => 'Communication', 'url' => '/admin/communication', 'permission' => 'admin.communication.view', 'keywords' => 'communication overview messaging'],
            ['title' => 'Compose Message', 'subtitle' => 'Communication', 'url' => '/admin/communication/compose', 'permission' => 'admin.communication.compose', 'keywords' => 'new message announcement broadcast write'],

            ['title' => 'Faculties', 'subtitle' => 'School', 'url' => '/admin/school-management/faculties', 'permission' => 'admin.school-management.faculties.view', 'keywords' => 'faculty school'],
            ['title' => 'Departments', 'subtitle' => 'School', 'url' => '/admin/school-management/departments', 'permission' => 'admin.school-management.departments.view', 'keywords' => 'department unit'],
            ['title' => 'Venues', 'subtitle' => 'School', 'url' => '/admin/school-management/class-rooms', 'permission' => 'admin.school-management.class-rooms.view', 'keywords' => 'venue classroom room hall'],

            ['title' => 'Academic Years', 'subtitle' => 'Catalog', 'url' => '/admin/school-management/academic-years', 'permission' => 'admin.school-management.academic-years.view', 'keywords' => 'academic year session'],
            ['title' => 'Academic Periods', 'subtitle' => 'Catalog', 'url' => '/admin/school-management/academic-periods', 'permission' => 'admin.school-management.academic-periods.view', 'keywords' => 'academic period semester trimester'],
            ['title' => 'Programs', 'subtitle' => 'Catalog', 'url' => '/admin/school-management/programs', 'permission' => 'admin.school-management.programs.view', 'keywords' => 'program course of study'],
            ['title' => 'Courses', 'subtitle' => 'Catalog', 'url' => '/admin/school-management/courses', 'permission' => 'admin.school-management.courses.view', 'keywords' => 'course subject module'],

            ['title' => 'System Settings', 'subtitle' => 'System', 'url' => '/admin/settings-reports/settings', 'permission' => 'admin.settings.view', 'keywords' => 'settings configuration face verification geolocation'],
            ['title' => 'Holidays & Breaks', 'subtitle' => 'System', 'url' => '/admin/holidays-breaks', 'permission' => 'admin.holidays-breaks.view', 'keywords' => 'holiday break vacation non working day'],
            ['title' => 'System Logs', 'subtitle' => 'System', 'url' => '/admin/system-logs', 'permission' => 'admin.system-logs.view', 'keywords' => 'logs audit activity trail'],

            ['title' => 'Help Desk', 'subtitle' => 'Support', 'url' => '/admin/help-desk', 'permission' => 'admin.help-desk.view', 'keywords' => 'help desk tickets support'],
        ];

        return $this->filterStaticPages($pages, $query, true);
    }

    private function searchTeacherPages(string $query, Teacher $teacher): Collection
    {
        $anyStaff = [Teacher::STAFF_TYPE_LECTURER, Teacher::STAFF_TYPE_ADMINISTRATOR];
        $lecturer = [Teacher::STAFF_TYPE_LECTURER];
        $administrator = [Teacher::STAFF_TYPE_ADMINISTRATOR];

        $pages = [
            ['title' => 'Dashboard', 'subtitle' => 'Overview', 'url' => '/teacher/dashboard', 'keywords' => 'home overview', 'staffTypes' => $anyStaff],

            ['title' => 'Take Attendance', 'subtitle' => 'Attendance', 'url' => '/teacher/attendance', 'keywords' => 'check in check out attendance face', 'staffTypes' => $lecturer],
            ['title' => 'Take Attendance', 'subtitle' => 'Attendance', 'url' => '/teacher/staff-attendance', 'keywords' => 'check in check out staff attendance shift face', 'staffTypes' => $administrator],
            ['title' => 'Explanations', 'subtitle' => 'Attendance', 'url' => '/teacher/attendance-explanations', 'keywords' => 'explanation absence excuse self reported absent', 'staffTypes' => $anyStaff],
            ['title' => 'Venue Change Requests', 'subtitle' => 'Attendance', 'url' => '/teacher/venue-change-requests', 'keywords' => 'venue change request room move approval', 'staffTypes' => $administrator, 'requiresVenueChangeRequests' => true],
            ['title' => 'Attendance Report', 'subtitle' => 'Attendance', 'url' => '/teacher/staff-reports', 'keywords' => 'staff attendance report summary', 'staffTypes' => $administrator],

            ['title' => 'My Schedules', 'subtitle' => 'Academic', 'url' => '/teacher/timetable', 'keywords' => 'timetable schedule lectures', 'staffTypes' => $lecturer],
            ['title' => 'My Courses', 'subtitle' => 'Academic', 'url' => '/teacher/my-courses', 'keywords' => 'courses teaching subjects', 'staffTypes' => $lecturer],

            ['title' => 'Records', 'subtitle' => 'My Work', 'url' => '/teacher/records', 'keywords' => 'attendance records history', 'staffTypes' => $lecturer],
            ['title' => 'Reminders', 'subtitle' => 'My Work', 'url' => '/teacher/reminders', 'keywords' => 'reminders alerts notes', 'staffTypes' => $lecturer],
            ['title' => 'Reports', 'subtitle' => 'My Work', 'url' => '/teacher/reports', 'keywords' => 'reports analytics attendance', 'staffTypes' => $lecturer],

            ['title' => 'Inbox', 'subtitle' => 'Communication', 'url' => '/teacher/communication/inbox', 'keywords' => 'mail messages inbox conversations threads', 'staffTypes' => $anyStaff],
            ['title' => 'Sent', 'subtitle' => 'Communication', 'url' => '/teacher/communication/sent', 'keywords' => 'mail messages sent', 'staffTypes' => $anyStaff],
            ['title' => 'Drafts', 'subtitle' => 'Communication', 'url' => '/teacher/communication/drafts', 'keywords' => 'mail messages drafts unsent', 'staffTypes' => $anyStaff],
            ['title' => 'All Mail', 'subtitle' => 'Communication', 'url' => '/teacher/communication/all', 'keywords' => 'mail messages archive everything', 'staffTypes' => $anyStaff],
            ['title' => 'Communication Dashboard', 'subtitle' => 'Communication', 'url' => '/teacher/communication', 'keywords' => 'communication overview messaging', 'staffTypes' => $anyStaff, 'requiresLeadership' => true],
            ['title' => 'Compose Message', 'subtitle' => 'Communication', 'url' => '/teacher/communication/compose', 'keywords' => 'new message announcement write', 'staffTypes' => $anyStaff, 'requiresLeadership' => true],

            ['title' => 'Unit Staff', 'subtitle' => 'My Unit', 'url' => '/teacher/unit/staff', 'keywords' => 'unit staff faculty department members', 'staffTypes' => $anyStaff, 'requiresLeadership' => true],
            ['title' => 'Unit Attendance', 'subtitle' => 'My Unit', 'url' => '/teacher/unit/attendance', 'keywords' => 'unit attendance monitoring', 'staffTypes' => $anyStaff, 'requiresLeadership' => true],
            ['title' => 'Self-reported Absences', 'subtitle' => 'My Unit', 'url' => '/teacher/unit/self-reported-absences', 'keywords' => 'self reported absence absent mark reason', 'staffTypes' => $anyStaff, 'requiresLeadership' => true],
            ['title' => 'Venue Change Requests', 'subtitle' => 'My Unit', 'url' => '/teacher/unit/venue-change-requests', 'keywords' => 'unit venue change request approve reject', 'staffTypes' => $anyStaff, 'requiresLeadership' => true],
            ['title' => 'Venue Change Authorizations', 'subtitle' => 'My Unit', 'url' => '/teacher/unit/venue-change-authorizations', 'keywords' => 'unit venue change authorization room move', 'staffTypes' => $anyStaff, 'requiresLeadership' => true],
            ['title' => 'New Venue Change Authorization', 'subtitle' => 'My Unit', 'url' => '/teacher/unit/venue-change-authorizations/create', 'keywords' => 'authorize venue change create room move', 'staffTypes' => $anyStaff, 'requiresLeadership' => true],

            ['title' => 'Help Desk', 'subtitle' => 'Support', 'url' => '/teacher/help-desk', 'keywords' => 'help desk tickets support', 'staffTypes' => $anyStaff],
        ];

        $staffType = $teacher->staff_type ?? Teacher::STAFF_TYPE_LECTURER;
        $hasLeadership = $teacher->hasLeadershipAssignment();
        $venueChangeRequestsEnabled = SystemSetting::administratorVenueChangeRequestsEnabled();

        $pages = array_values(array_filter($pages, function (array $page) use ($staffType, $hasLeadership, $venueChangeRequestsEnabled) {
            if (! in_array($staffType, $page['staffTypes'], true)) {
                return false;
            }

            if (! empty($page['requiresLeadership']) && ! $hasLeadership) {
                return false;
            }

            return empty($page['requiresVenueChangeRequests']) || $venueChangeRequestsEnabled;
        }));

        return $this->filterStaticPages($pages, $query, false);
    }

    /**
     * @param  list<array<string, mixed>>  $pages
     */
    private function filterStaticPages(array $pages, string $query, bool $checkPermission): Collection
    {
        $needle = Str::lower($query);
        /** @var User|null $user */
        $user = Auth::guard('web')->user();

        return collect($pages)
            ->filter(function (array $page) use ($checkPermission, $user) {
                if (! $checkPermission || empty($page['permission'])) {
                    return true;
                }

                return $user !== null
                    && collect((array) $page['permission'])->contains(fn (string $permission) => $user->can($permission));
            })
            ->map(fn (array $page) => $page + ['rank' => $this->pageMatchRank($page, $needle)])
            ->filter(fn (array $page) => $page['rank'] !== null)
            ->sortBy('rank')
            ->take(self::PAGE_LIMIT)
            ->values()
            ->map(fn (array $page) => [
                'id' => 'page-'.Str::slug($page['url']),
                'title' => $page['title'],
                'subtitle' => $page['subtitle'],
                'url' => $page['url'],
                'meta' => null,
            ]);
    }

    /**
     * Rank a page against the query so the closest titles survive the result cap.
     *
     * @param  array<string, mixed>  $page
     */
    private function pageMatchRank(array $page, string $needle): ?int
    {
        $title = Str::lower((string) ($page['title'] ?? ''));

        if (str_starts_with($title, $needle)) {
            return 0;
        }

        if (str_contains($title, $needle)) {
            return 1;
        }

        if (str_contains(Str::lower((string) ($page['subtitle'] ?? '')), $needle)) {
            return 2;
        }

        if (str_contains(Str::lower((string) ($page['keywords'] ?? '')), $needle)) {
            return 3;
        }

        return null;
    }

    /**
     * Build a portable LOWER(col1 || ' ' || col2) expression.
     *
     * @param  list<string>  $columns
     */
    private function lowerConcatExpr(array $columns): string
    {
        return SqlDialect::lowerConcat($columns);
    }
}
