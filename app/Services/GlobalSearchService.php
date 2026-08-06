<?php

namespace App\Services;

use App\Models\ClassRoom;
use App\Models\Course;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\HelpDeskTicket;
use App\Models\Program;
use App\Models\Teacher;
use App\Models\TeacherAttendance;
use App\Models\TimeTable;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class GlobalSearchService
{
    public const LIMIT_PER_GROUP = 5;

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

        $like = '%' . Str::lower($query) . '%';
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
                'search' => fn (string $q, string $like) => $this->searchTeacherPages($q, $staffType),
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
                'id' => 'staff-' . $teacher->id,
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
                    'id' => 'course-' . $course->id,
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
                'id' => 'venue-' . $room->id,
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
                    'id' => 'schedule-' . $timetable->id,
                    'title' => $title,
                    'subtitle' => collect([
                        $day,
                        trim(($timetable->start_time ?? '') . '–' . ($timetable->end_time ?? ''), '–'),
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
                'id' => 'department-' . $department->id,
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
                'id' => 'faculty-' . $faculty->id,
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
                'id' => 'program-' . $program->id,
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
                    'id' => 'ticket-' . $ticket->id,
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
                    'id' => 'attendance-' . $record->id,
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
                'id' => 'user-' . $user->id,
                'title' => $user->name,
                'subtitle' => collect([$user->staff_id, $user->email])->filter()->implode(' · '),
                'url' => route('admin.user-management.users.edit', $user),
                'meta' => null,
            ]);
    }

    private function searchAdminPages(string $query): Collection
    {
        $pages = [
            ['title' => 'Teaching Staff Attendance Reports', 'subtitle' => 'Reports', 'url' => '/admin/attendance', 'permission' => 'admin.attendance.view', 'keywords' => 'attendance report teaching'],
            ['title' => 'Non-Teaching Staff Attendance Reports', 'subtitle' => 'Reports', 'url' => '/admin/settings-reports/staff-attendance-reports', 'permission' => 'admin.staff-attendance.view', 'keywords' => 'staff attendance report'],
            ['title' => 'Attendance Explanations', 'subtitle' => 'Reports', 'url' => '/admin/attendance-explanations', 'permission' => 'admin.attendance-explanations.view', 'keywords' => 'explanation absence'],
            ['title' => 'Help Desk', 'subtitle' => 'Support', 'url' => '/admin/help-desk', 'permission' => 'admin.help-desk.view', 'keywords' => 'help desk tickets support'],
            ['title' => 'Assigned Schedules', 'subtitle' => 'Schedules', 'url' => '/admin/academics/time-tables', 'permission' => 'admin.academics.time-tables.view', 'keywords' => 'timetable schedule'],
            ['title' => 'All Staff', 'subtitle' => 'Staff', 'url' => '/admin/teachers', 'permission' => 'admin.teachers.view', 'keywords' => 'staff lecturers administrators'],
            ['title' => 'Venues', 'subtitle' => 'Settings', 'url' => '/admin/school-management/class-rooms', 'permission' => 'admin.school-management.class-rooms.view', 'keywords' => 'venue classroom'],
            ['title' => 'System Settings', 'subtitle' => 'Settings', 'url' => '/admin/settings-reports/settings', 'permission' => 'admin.settings.view', 'keywords' => 'settings configuration'],
        ];

        return $this->filterStaticPages($pages, $query, true);
    }

    private function searchTeacherPages(string $query, string $staffType): Collection
    {
        $pages = [
            ['title' => 'Help Desk', 'subtitle' => 'Support', 'url' => '/teacher/help-desk', 'keywords' => 'help desk tickets support', 'staffTypes' => ['lecturer', 'administrator']],
            ['title' => 'Explanations', 'subtitle' => 'Attendance', 'url' => '/teacher/attendance-explanations', 'keywords' => 'explanation absence', 'staffTypes' => ['lecturer', 'administrator']],
            ['title' => 'My Schedules', 'subtitle' => 'Academic', 'url' => '/teacher/timetable', 'keywords' => 'timetable schedule', 'staffTypes' => ['lecturer']],
            ['title' => 'My Courses', 'subtitle' => 'Academic', 'url' => '/teacher/my-courses', 'keywords' => 'courses teaching', 'staffTypes' => ['lecturer']],
            ['title' => 'Attendance Records', 'subtitle' => 'Attendance', 'url' => '/teacher/records', 'keywords' => 'records attendance', 'staffTypes' => ['lecturer']],
            ['title' => 'Attendance Analytics', 'subtitle' => 'Reports', 'url' => '/teacher/reports', 'keywords' => 'reports analytics', 'staffTypes' => ['lecturer']],
            ['title' => 'Take Attendance', 'subtitle' => 'Attendance', 'url' => '/teacher/attendance', 'keywords' => 'check in attendance', 'staffTypes' => ['lecturer']],
            ['title' => 'Staff Attendance', 'subtitle' => 'Attendance', 'url' => '/teacher/staff-attendance', 'keywords' => 'staff attendance check in', 'staffTypes' => ['administrator']],
            ['title' => 'Staff Attendance Report', 'subtitle' => 'Reports', 'url' => '/teacher/staff-reports', 'keywords' => 'staff report', 'staffTypes' => ['administrator']],
        ];

        $pages = array_values(array_filter(
            $pages,
            fn (array $page) => in_array($staffType, $page['staffTypes'], true)
        ));

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
            ->filter(function (array $page) use ($needle, $checkPermission, $user) {
                if ($checkPermission && ! empty($page['permission'])) {
                    if (! $user || ! $user->can($page['permission'])) {
                        return false;
                    }
                }

                $haystack = Str::lower(($page['title'] ?? '') . ' ' . ($page['subtitle'] ?? '') . ' ' . ($page['keywords'] ?? ''));

                return str_contains($haystack, $needle);
            })
            ->take(self::LIMIT_PER_GROUP)
            ->values()
            ->map(fn (array $page, int $index) => [
                'id' => 'page-' . $index . '-' . Str::slug($page['title']),
                'title' => $page['title'],
                'subtitle' => $page['subtitle'],
                'url' => $page['url'],
                'meta' => null,
            ]);
    }

    /**
     * Build a portable LOWER(col1 || ' ' || col2) / CONCAT expression.
     *
     * @param  list<string>  $columns
     */
    private function lowerConcatExpr(array $columns): string
    {
        $driver = DB::connection()->getDriverName();

        if ($driver === 'sqlite') {
            $parts = array_map(
                fn (string $column) => "COALESCE({$column}, '')",
                $columns
            );

            return 'LOWER(' . implode(" || ' ' || ", $parts) . ')';
        }

        $parts = array_map(
            fn (string $column) => "COALESCE({$column}, '')",
            $columns
        );

        return 'LOWER(CONCAT(' . implode(", ' ', ", $parts) . '))';
    }
}
