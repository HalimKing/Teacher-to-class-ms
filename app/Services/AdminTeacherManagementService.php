<?php

namespace App\Services;

use App\Models\Department;
use App\Models\Faculty;
use App\Models\StaffAttendance;
use App\Models\Teacher;
use App\Models\TeacherAttendance;
use App\Models\TimeTable;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class AdminTeacherManagementService
{
    public function getIndexPayload(Request $request): array
    {
        $today = Carbon::today()->toDateString();
        $context = $this->attendanceContext($today);

        return [
            'summaryCards' => $this->getSummaryCards($today, $context),
            'teachers' => $this->paginateTeachers($request, $context),
            'faculties' => Faculty::select('id', 'name')->orderBy('name')->get(),
            'departments' => Department::select('id', 'name', 'faculty_id')->orderBy('name')->get(),
            'filters' => $this->currentFilters($request),
        ];
    }

    public function getQuickView(Teacher $teacher): array
    {
        $teacher->load(['faculty', 'department', 'courses', 'timeTables.classroom', 'timeTables.course']);

        $today = Carbon::today()->toDateString();
        $monthStart = Carbon::now()->startOfMonth()->toDateString();

        if ($teacher->isAdministrator()) {
            $monthRecords = StaffAttendance::query()
                ->where('staff_id', $teacher->id)
                ->whereBetween('date', [$monthStart, $today])
                ->get();
            $todayRecord = $monthRecords->first(fn ($record) => Carbon::parse($record->date)->toDateString() === $today);
        } else {
            $monthRecords = TeacherAttendance::query()
                ->where('teacher_id', $teacher->id)
                ->whereBetween('date', [$monthStart, $today])
                ->get();
            $todayRecord = $monthRecords->first(fn ($record) => Carbon::parse($record->date)->toDateString() === $today);
        }

        $presentStatuses = ['checked_in', 'completed', 'late', 'present'];
        $presentDays = $monthRecords->filter(function ($record) use ($presentStatuses, $teacher) {
            $status = $teacher->isAdministrator() ? $record->attendance_status : $record->status;

            return in_array($status, $presentStatuses, true);
        })->count();

        $lateDays = $monthRecords->filter(function ($record) use ($teacher) {
            $status = $teacher->isAdministrator() ? $record->attendance_status : $record->status;

            return $status === 'late';
        })->count();

        $totalDays = max($monthRecords->count(), 1);
        $assignedSchedules = $teacher->isAdministrator()
            ? $teacher->workTimeTables
            : $teacher->teachingTimeTables;

        return [
            'profile' => [
                'id' => $teacher->id,
                'full_name' => trim("{$teacher->title} {$teacher->first_name} {$teacher->last_name}"),
                'first_name' => $teacher->first_name,
                'last_name' => $teacher->last_name,
                'title' => $teacher->title,
                'employee_id' => $teacher->employee_id,
                'email' => $teacher->email,
                'phone' => $teacher->phone,
                'department' => $teacher->department?->name,
                'faculty' => $teacher->faculty?->name,
                'staff_type' => $teacher->staff_type,
                'created_at' => $teacher->created_at?->format('M d, Y'),
            ],
            'attendance' => [
                'attendance_rate' => round(($presentDays / $totalDays) * 100, 1),
                'present_days' => $presentDays,
                'absent_days' => max($monthRecords->count() - $presentDays, 0),
                'late_arrivals' => $lateDays,
                'today_status' => $this->resolveTodayAttendanceLabel($teacher, $todayRecord),
            ],
            'face' => [
                'status' => $teacher->faceEnrollmentStatus(),
                'registered_at' => $teacher->face_registered_at?->format('M d, Y g:i A'),
            ],
            'timetable' => [
                'assigned_count' => $assignedSchedules->count(),
                'courses' => $teacher->courses->pluck('name')->unique()->values()->all(),
                'classes' => $assignedSchedules->map(fn (TimeTable $schedule) => [
                    'day' => $schedule->day_of_week,
                    'start_time' => $schedule->start_time,
                    'end_time' => $schedule->end_time,
                    'venue' => $schedule->classroom?->name,
                    'course' => $schedule->course?->name,
                ])->values()->all(),
            ],
        ];
    }

    public function filteredQuery(Request $request): Builder
    {
        $query = Teacher::query()
            ->with(['faculty:id,name', 'department:id,name'])
            ->withCount(['timeTables', 'courses']);

        $this->applyFilters($query, $request);
        $this->applySorting($query, $request);

        return $query;
    }

    public function currentFilters(Request $request): array
    {
        return $request->only([
            'search',
            'faculty',
            'department',
            'staffType',
            'faceEnrollment',
            'faceVerification',
            'timetable',
            'attendanceToday',
            'accountStatus',
            'created_from',
            'created_to',
            'last_attendance_from',
            'last_attendance_to',
            'sort_by',
            'sort_dir',
            'per_page',
        ]);
    }

    private function paginateTeachers(Request $request, array $context)
    {
        $perPage = min(max((int) $request->get('per_page', 15), 5), 100);
        $paginator = $this->filteredQuery($request)->paginate($perPage)->withQueryString();

        return $paginator->through(fn (Teacher $teacher) => $this->transformTeacher($teacher, $context));
    }

    private function applyFilters(Builder $query, Request $request): void
    {
        if ($request->filled('search')) {
            $search = trim((string) $request->search);
            $query->where(function (Builder $inner) use ($search) {
                $inner->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('employee_id', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        if ($request->filled('faculty') && $request->faculty !== 'all') {
            $query->where('faculty_id', (int) $request->faculty);
        }

        if ($request->filled('department') && $request->department !== 'all') {
            $query->where('department_id', (int) $request->department);
        }

        if ($request->filled('staffType') && in_array($request->staffType, Teacher::STAFF_TYPES, true)) {
            $query->where('staff_type', $request->staffType);
        }

        if ($request->filled('faceEnrollment') && $request->faceEnrollment !== 'all') {
            if ($request->faceEnrollment === 'enrolled') {
                $query->whereNotNull('face_registered_at')->whereNotNull('face_descriptor');
            } elseif ($request->faceEnrollment === 'not_enrolled') {
                $query->where(function (Builder $faceQuery) {
                    $faceQuery->whereNull('face_registered_at')->orWhereNull('face_descriptor');
                });
            }
        }

        if ($request->filled('faceVerification') && $request->faceVerification !== 'all') {
            $today = Carbon::today()->toDateString();

            if ($request->faceVerification === 'verification_failed') {
                $query->where(function (Builder $verificationQuery) use ($today) {
                    $verificationQuery->whereIn('id', function ($sub) use ($today) {
                        $sub->select('teacher_id')
                            ->from('teacher_attendances')
                            ->whereDate('date', $today)
                            ->where('face_verified', false)
                            ->whereNotNull('check_in_time');
                    })->orWhereIn('id', function ($sub) use ($today) {
                        $sub->select('staff_id')
                            ->from('staff_attendances')
                            ->whereDate('date', $today)
                            ->where('face_verified', false)
                            ->whereNotNull('check_in_time');
                    });
                });
            }
        }

        if ($request->filled('last_attendance_from') || $request->filled('last_attendance_to')) {
            $from = $request->filled('last_attendance_from')
                ? Carbon::parse($request->last_attendance_from)->toDateString()
                : null;
            $to = $request->filled('last_attendance_to')
                ? Carbon::parse($request->last_attendance_to)->toDateString()
                : null;

            $query->where(function (Builder $attendanceQuery) use ($from, $to) {
                $attendanceQuery->whereIn('id', function ($sub) use ($from, $to) {
                    $sub->select('teacher_id')
                        ->from('teacher_attendances')
                        ->when($from, fn ($inner) => $inner->whereDate('date', '>=', $from))
                        ->when($to, fn ($inner) => $inner->whereDate('date', '<=', $to));
                })->orWhereIn('id', function ($sub) use ($from, $to) {
                    $sub->select('staff_id')
                        ->from('staff_attendances')
                        ->when($from, fn ($inner) => $inner->whereDate('date', '>=', $from))
                        ->when($to, fn ($inner) => $inner->whereDate('date', '<=', $to));
                });
            });
        }

        if ($request->filled('timetable') && $request->timetable !== 'all') {
            if ($request->timetable === 'assigned') {
                $query->whereHas('timeTables');
            } elseif ($request->timetable === 'unassigned') {
                $query->whereDoesntHave('timeTables');
            }
        }

        if ($request->filled('attendanceToday') && $request->attendanceToday !== 'all') {
            $today = Carbon::today()->toDateString();
            if ($request->attendanceToday === 'present') {
                $query->where(function (Builder $attendanceQuery) use ($today) {
                    $attendanceQuery->whereHas('timeTables', function (Builder $timetableQuery) use ($today) {
                        $timetableQuery->where('staff_type', Teacher::STAFF_TYPE_LECTURER);
                    })->whereIn('id', function ($sub) use ($today) {
                        $sub->select('teacher_id')
                            ->from('teacher_attendances')
                            ->whereDate('date', $today)
                            ->whereIn('status', ['checked_in', 'completed', 'late', 'present']);
                    })->orWhere(function (Builder $adminQuery) use ($today) {
                        $adminQuery->where('staff_type', Teacher::STAFF_TYPE_ADMINISTRATOR)
                            ->whereIn('id', function ($sub) use ($today) {
                                $sub->select('staff_id')
                                    ->from('staff_attendances')
                                    ->whereDate('date', $today)
                                    ->whereIn('attendance_status', ['checked_in', 'completed', 'late']);
                            });
                    });
                });
            } elseif ($request->attendanceToday === 'absent') {
                $query->where(function (Builder $attendanceQuery) use ($today) {
                    $attendanceQuery->where(function (Builder $lecturerQuery) use ($today) {
                        $lecturerQuery->where('staff_type', Teacher::STAFF_TYPE_LECTURER)
                            ->whereHas('timeTables', fn (Builder $t) => $t->where('day_of_week', now()->format('l')))
                            ->whereNotIn('id', function ($sub) use ($today) {
                                $sub->select('teacher_id')
                                    ->from('teacher_attendances')
                                    ->whereDate('date', $today);
                            });
                    })->orWhere(function (Builder $adminQuery) use ($today) {
                        $adminQuery->where('staff_type', Teacher::STAFF_TYPE_ADMINISTRATOR)
                            ->whereHas('timeTables', fn (Builder $t) => $t->where('day_of_week', now()->format('l')))
                            ->whereNotIn('id', function ($sub) use ($today) {
                                $sub->select('staff_id')
                                    ->from('staff_attendances')
                                    ->whereDate('date', $today);
                            });
                    });
                });
            }
        }

        if ($request->filled('accountStatus') && $request->accountStatus !== 'all') {
            if ($request->accountStatus === 'active') {
                $query->whereHas('timeTables');
            } elseif ($request->accountStatus === 'inactive') {
                $query->whereDoesntHave('timeTables');
            }
        }

        if ($request->filled('created_from')) {
            $query->whereDate('created_at', '>=', Carbon::parse($request->created_from)->toDateString());
        }

        if ($request->filled('created_to')) {
            $query->whereDate('created_at', '<=', Carbon::parse($request->created_to)->toDateString());
        }

        if ($request->filled('ids')) {
            $ids = collect(explode(',', (string) $request->ids))
                ->filter(fn ($id) => is_numeric($id))
                ->map(fn ($id) => (int) $id)
                ->all();

            if (!empty($ids)) {
                $query->whereIn('id', $ids);
            }
        }
    }

    private function applySorting(Builder $query, Request $request): void
    {
        $sortBy = $request->get('sort_by', 'created_at');
        $sortDir = strtolower((string) $request->get('sort_dir', 'desc')) === 'asc' ? 'asc' : 'desc';

        $allowed = [
            'name' => 'first_name',
            'department' => 'department_id',
            'created_at' => 'created_at',
            'staff_type' => 'staff_type',
        ];

        $column = $allowed[$sortBy] ?? 'created_at';
        $query->orderBy($column, $sortDir)->orderBy('last_name', $sortDir);
    }

    private function getSummaryCards(string $today, array $context): array
    {
        $totalTeachers = Teacher::count();
        $newThisMonth = Teacher::whereMonth('created_at', now()->month)
            ->whereYear('created_at', now()->year)
            ->count();
        $withTimetables = Teacher::whereHas('timeTables')->count();
        $withoutTimetables = max($totalTeachers - $withTimetables, 0);
        $faceEnrolled = Teacher::whereNotNull('face_registered_at')->whereNotNull('face_descriptor')->count();
        $pendingFace = max($totalTeachers - $faceEnrolled, 0);

        $presentToday = $context['present_teacher_ids']->count() + $context['present_staff_ids']->count();
        $scheduledToday = TimeTable::query()
            ->where('day_of_week', now()->format('l'))
            ->distinct('teacher_id')
            ->count('teacher_id');
        $absentToday = max($scheduledToday - $presentToday, 0);
        $attendanceRate = $scheduledToday > 0 ? round(($presentToday / $scheduledToday) * 100, 1) : 0;

        $verifiedToday = TeacherAttendance::whereDate('date', $today)->where('face_verified', true)->count()
            + StaffAttendance::whereDate('date', $today)->where('face_verified', true)->count();
        $totalTodayRecords = TeacherAttendance::whereDate('date', $today)->count()
            + StaffAttendance::whereDate('date', $today)->count();
        $faceSuccessRate = $totalTodayRecords > 0 ? round(($verifiedToday / $totalTodayRecords) * 100, 1) : 0;

        $lecturerCount = Teacher::where('staff_type', Teacher::STAFF_TYPE_LECTURER)->count();
        $administratorCount = Teacher::where('staff_type', Teacher::STAFF_TYPE_ADMINISTRATOR)->count();
        $lecturersPresentToday = $context['present_teacher_ids']->count();
        $administratorsPresentToday = $context['present_staff_ids']->count();

        return [
            ['title' => 'Total Teachers', 'value' => (string) $totalTeachers, 'change' => "{$lecturerCount} lecturers · {$administratorCount} administrators", 'changeType' => 'neutral', 'icon' => 'Users', 'group' => 'overview'],
            ['title' => 'Active Teachers', 'value' => (string) $withTimetables, 'change' => 'With assigned timetables', 'changeType' => 'positive', 'icon' => 'CheckCircle', 'group' => 'overview'],
            ['title' => 'Inactive Teachers', 'value' => (string) $withoutTimetables, 'change' => 'No timetable assigned', 'changeType' => $withoutTimetables > 0 ? 'negative' : 'neutral', 'icon' => 'XCircle', 'group' => 'overview'],
            ['title' => 'New This Month', 'value' => (string) $newThisMonth, 'change' => now()->format('F Y'), 'changeType' => 'positive', 'icon' => 'TrendingUp', 'group' => 'overview'],
            ['title' => 'Present Today', 'value' => (string) $presentToday, 'change' => "{$lecturersPresentToday} lecturers · {$administratorsPresentToday} administrators", 'changeType' => 'positive', 'icon' => 'LogIn', 'group' => 'attendance'],
            ['title' => 'Absent Today', 'value' => (string) $absentToday, 'change' => "{$scheduledToday} scheduled today", 'changeType' => $absentToday > 0 ? 'negative' : 'neutral', 'icon' => 'LogOut', 'group' => 'attendance'],
            ['title' => 'Attendance Rate', 'value' => "{$attendanceRate}%", 'change' => 'Today scheduled staff', 'changeType' => $attendanceRate >= 80 ? 'positive' : 'neutral', 'icon' => 'Activity', 'group' => 'attendance'],
            ['title' => 'Face Enrolled', 'value' => (string) $faceEnrolled, 'change' => $totalTeachers > 0 ? round(($faceEnrolled / $totalTeachers) * 100, 1) . '% enrolled' : '0% enrolled', 'changeType' => 'positive', 'icon' => 'ShieldCheck', 'group' => 'verification'],
            ['title' => 'Pending Enrollment', 'value' => (string) $pendingFace, 'change' => 'Awaiting face capture', 'changeType' => $pendingFace > 0 ? 'negative' : 'neutral', 'icon' => 'ShieldX', 'group' => 'verification'],
            ['title' => 'Face Success Rate', 'value' => "{$faceSuccessRate}%", 'change' => "Today's verified check-ins", 'changeType' => 'positive', 'icon' => 'ShieldCheck', 'group' => 'verification'],
            ['title' => 'With Timetables', 'value' => (string) $withTimetables, 'change' => 'Assigned schedules', 'changeType' => 'positive', 'icon' => 'Calendar', 'group' => 'timetable'],
            ['title' => 'Without Timetables', 'value' => (string) $withoutTimetables, 'change' => 'Needs schedule assignment', 'changeType' => $withoutTimetables > 0 ? 'negative' : 'neutral', 'icon' => 'Clock', 'group' => 'timetable'],
        ];
    }

    private function transformTeacher(Teacher $teacher, array $context): array
    {
        $todayRecord = $teacher->isAdministrator()
            ? $context['staff_attendance_today']->get($teacher->id)
            : $context['teacher_attendance_today']->get($teacher->id);

        return [
            'id' => $teacher->id,
            'first_name' => $teacher->first_name,
            'last_name' => $teacher->last_name,
            'full_name' => trim("{$teacher->title} {$teacher->first_name} {$teacher->last_name}"),
            'title' => $teacher->title,
            'email' => $teacher->email,
            'phone' => $teacher->phone,
            'employee_id' => $teacher->employee_id,
            'staff_type' => $teacher->staff_type,
            'faculty' => $teacher->faculty?->name ?? 'N/A',
            'department' => $teacher->department?->name ?? 'N/A',
            'assigned_classes_count' => $teacher->courses_count ?? 0,
            'timetable_count' => $teacher->time_tables_count ?? 0,
            'timetable_status' => ($teacher->time_tables_count ?? 0) > 0 ? 'assigned' : 'unassigned',
            'face_enrollment_status' => $teacher->faceEnrollmentStatus(),
            'face_registered_at' => $teacher->face_registered_at?->format('M d, Y'),
            'attendance_status' => $this->resolveTodayAttendanceLabel($teacher, $todayRecord),
            'attendance_badge' => $this->resolveTodayAttendanceBadge($teacher, $todayRecord),
            'account_status' => ($teacher->time_tables_count ?? 0) > 0 ? 'active' : 'inactive',
            'created_at' => $teacher->created_at?->format('M d, Y'),
            'initials' => strtoupper(substr($teacher->first_name, 0, 1) . substr($teacher->last_name, 0, 1)),
        ];
    }

    private function attendanceContext(string $today): array
    {
        $teacherAttendanceToday = TeacherAttendance::query()
            ->whereDate('date', $today)
            ->get()
            ->keyBy('teacher_id');

        $staffAttendanceToday = StaffAttendance::query()
            ->whereDate('date', $today)
            ->get()
            ->keyBy('staff_id');

        $presentTeacherIds = $teacherAttendanceToday
            ->filter(fn (TeacherAttendance $record) => in_array($record->status, ['checked_in', 'completed', 'late', 'present'], true))
            ->keys();

        $presentStaffIds = $staffAttendanceToday
            ->filter(fn (StaffAttendance $record) => in_array($record->attendance_status, ['checked_in', 'completed', 'late'], true))
            ->keys();

        return [
            'teacher_attendance_today' => $teacherAttendanceToday,
            'staff_attendance_today' => $staffAttendanceToday,
            'present_teacher_ids' => $presentTeacherIds,
            'present_staff_ids' => $presentStaffIds,
        ];
    }

    private function resolveTodayAttendanceLabel(Teacher $teacher, TeacherAttendance|StaffAttendance|null $record): string
    {
        if (!$record) {
            return 'Not checked in';
        }

        if ($teacher->isAdministrator()) {
            /** @var StaffAttendance $record */
            if ($record->attendance_status === 'late') {
                return 'Late arrival';
            }
            if ($record->check_out_time) {
                return 'Checked out';
            }
            if ($record->check_in_time) {
                return $record->face_verified ? 'Checked in' : 'Checked in (unverified)';
            }

            return ucfirst(str_replace('_', ' ', $record->attendance_status));
        }

        /** @var TeacherAttendance $record */
        if ($record->status === 'late') {
            return 'Late arrival';
        }
        if ($record->check_out_time) {
            return 'Checked out';
        }
        if ($record->check_in_time) {
            return $record->face_verified ? 'Checked in' : 'Checked in (unverified)';
        }

        return ucfirst(str_replace('_', ' ', (string) $record->status));
    }

    private function resolveTodayAttendanceBadge(Teacher $teacher, TeacherAttendance|StaffAttendance|null $record): string
    {
        if (!$record) {
            return 'absent';
        }

        if ($teacher->isAdministrator()) {
            /** @var StaffAttendance $record */
            if ($record->attendance_status === 'late') {
                return 'late';
            }
            if (!$record->face_verified && $record->check_in_time) {
                return 'unverified';
            }
            if ($record->check_out_time) {
                return 'checked_out';
            }

            return 'present';
        }

        /** @var TeacherAttendance $record */
        if ($record->status === 'late') {
            return 'late';
        }
        if (!$record->face_verified && $record->check_in_time) {
            return 'unverified';
        }
        if ($record->check_out_time) {
            return 'checked_out';
        }

        return 'present';
    }
}
