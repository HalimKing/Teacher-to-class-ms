<?php

namespace App\Services;

use App\Models\HolidayBreak;
use App\Models\HolidayBreakCoverageAssignment;
use App\Models\HolidayBreakDutyAssignment;
use App\Models\Teacher;
use App\Support\AttendanceExceptionCategory;
use App\Support\HolidayBreakCoverage;
use App\Support\HolidayBreakType;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class HolidayBreakService
{
    public const MODE_OPEN = 'open';
    public const MODE_PUBLIC_HOLIDAY = 'public_holiday';
    public const MODE_UNIVERSITY_BREAK = 'university_break';
    public const MODE_BREAK_DUTY = 'break_duty';
    public const MODE_BREAK_DUTY_OFF = 'break_duty_off';

    public const DAY_NORMAL = 'normal';
    public const DAY_PUBLIC_HOLIDAY = 'public_holiday';
    public const DAY_UNIVERSITY_BREAK = 'university_break';
    public const DAY_BREAK_DUTY_REQUIRED = 'break_duty_required';

    public function activeBreakCovering(Carbon|string $date): ?HolidayBreak
    {
        $day = Carbon::parse($date)->toDateString();

        return HolidayBreak::query()
            ->active()
            ->coveringDate($day)
            ->orderBy('start_date')
            ->first();
    }

    /**
     * First active break on the date that covers this teacher.
     */
    public function activeBreakCoveringTeacher(Teacher $teacher, Carbon|string $date): ?HolidayBreak
    {
        $day = Carbon::parse($date)->toDateString();

        /** @var Collection<int, HolidayBreak> $breaks */
        $breaks = HolidayBreak::query()
            ->active()
            ->coveringDate($day)
            ->with('coverageAssignments')
            ->orderBy('start_date')
            ->get();

        return $breaks->first(fn (HolidayBreak $break) => $this->isTeacherCovered($teacher, $break));
    }

    /**
     * @return Collection<int, HolidayBreak>
     */
    public function activeBreaksCovering(Carbon|string $date): Collection
    {
        $day = Carbon::parse($date)->toDateString();

        return HolidayBreak::query()
            ->active()
            ->coveringDate($day)
            ->orderBy('start_date')
            ->get();
    }

    public function isTeacherCovered(Teacher $teacher, HolidayBreak $break): bool
    {
        $coverage = $break->coverage_type ?: HolidayBreakCoverage::ALL_STAFF;

        return match ($coverage) {
            HolidayBreakCoverage::ALL_STAFF => true,
            HolidayBreakCoverage::ALL_ADMINISTRATORS => $teacher->isAdministrator(),
            HolidayBreakCoverage::ALL_LECTURERS => $teacher->isLecturer(),
            HolidayBreakCoverage::SELECTED_STAFF,
            HolidayBreakCoverage::SELECTED_ADMINISTRATORS,
            HolidayBreakCoverage::SELECTED_LECTURERS => $this->teacherInCoverageList($teacher->id, $break),
            default => true,
        };
    }

    public function isBreakDutyRequired(Teacher $teacher, Carbon|string $date): bool
    {
        $day = Carbon::parse($date)->toDateString();
        $break = $this->activeBreakCoveringTeacher($teacher, $day);

        if (! $break) {
            return false;
        }

        return $this->teacherHasDutyOnBreak($teacher->id, $break, $day);
    }

    public function isAttendanceSuspended(Teacher $teacher, Carbon|string $date): bool
    {
        $day = Carbon::parse($date)->toDateString();
        $break = $this->activeBreakCoveringTeacher($teacher, $day);

        if (! $break) {
            return false;
        }

        return ! $this->teacherHasDutyOnBreak($teacher->id, $break, $day);
    }

    public function breakDutyMeta(Teacher $teacher, Carbon|string $date): ?array
    {
        $day = Carbon::parse($date)->toDateString();
        $break = $this->activeBreakCoveringTeacher($teacher, $day);

        if (! $break || ! $this->teacherHasDutyOnBreak($teacher->id, $break, $day)) {
            return null;
        }

        return [
            'holiday_break_id' => $break->id,
            'exception_category' => AttendanceExceptionCategory::BREAK_DUTY,
        ];
    }

    /**
     * @return array{
     *     mode: string,
     *     title: string,
     *     message: string,
     *     attendance_required: bool,
     *     break: array<string, mixed>|null
     * }
     */
    public function portalContext(Teacher $teacher, Carbon|string $date): array
    {
        $day = Carbon::parse($date)->toDateString();
        $break = $this->activeBreakCoveringTeacher($teacher, $day);

        if (! $break) {
            return [
                'mode' => self::MODE_OPEN,
                'title' => 'Attendance is open',
                'message' => 'Attendance is open.',
                'attendance_required' => true,
                'break' => null,
            ];
        }

        $breakPayload = $this->breakPayload($break);
        $assignedToBreak = $this->teacherAssignedToDuty($teacher->id, $break);
        $dutyToday = $assignedToBreak && $this->teacherHasDutyOnBreak($teacher->id, $break, $day);

        if ($dutyToday) {
            return [
                'mode' => self::MODE_BREAK_DUTY,
                'title' => 'Break duty required',
                'message' => 'University break is active, but you are assigned to duty. Please complete your attendance.',
                'attendance_required' => true,
                'break' => $breakPayload,
            ];
        }

        if ($assignedToBreak) {
            return [
                'mode' => self::MODE_BREAK_DUTY_OFF,
                'title' => 'Break duty — not required today',
                'message' => 'You are on break duty for this period, but attendance is not required today.',
                'attendance_required' => false,
                'break' => $breakPayload,
            ];
        }

        if ($break->isPublicHoliday()) {
            return [
                'mode' => self::MODE_PUBLIC_HOLIDAY,
                'title' => 'Public holiday',
                'message' => 'Today is a public holiday. Attendance is not required.',
                'attendance_required' => false,
                'break' => $breakPayload,
            ];
        }

        return [
            'mode' => self::MODE_UNIVERSITY_BREAK,
            'title' => 'University break',
            'message' => 'The university is currently on break. Attendance is not required.',
            'attendance_required' => false,
            'break' => $breakPayload,
        ];
    }

    public function dayClassification(Carbon|string $date, ?Teacher $teacher = null): string
    {
        $day = Carbon::parse($date)->toDateString();

        if ($teacher) {
            $break = $this->activeBreakCoveringTeacher($teacher, $day);
            if (! $break) {
                return self::DAY_NORMAL;
            }

            if ($this->teacherHasDutyOnBreak($teacher->id, $break, $day)) {
                return self::DAY_BREAK_DUTY_REQUIRED;
            }

            return $break->isPublicHoliday()
                ? self::DAY_PUBLIC_HOLIDAY
                : self::DAY_UNIVERSITY_BREAK;
        }

        $break = $this->activeBreakCovering($day);
        if (! $break) {
            return self::DAY_NORMAL;
        }

        return $break->isPublicHoliday()
            ? self::DAY_PUBLIC_HOLIDAY
            : self::DAY_UNIVERSITY_BREAK;
    }

    public function dayClassificationLabel(string $classification): string
    {
        return match ($classification) {
            self::DAY_PUBLIC_HOLIDAY => 'Holiday',
            self::DAY_UNIVERSITY_BREAK => 'University Break',
            self::DAY_BREAK_DUTY_REQUIRED => 'Break Duty',
            default => 'Normal',
        };
    }

    public function reportStatusLabel(?string $attendanceStatus, ?string $exceptionCategory, string $dayClassification): string
    {
        $isBreakDuty = $exceptionCategory === AttendanceExceptionCategory::BREAK_DUTY;
        $normalized = strtolower((string) $attendanceStatus);

        if ($isBreakDuty) {
            if ($normalized === 'absent') {
                return 'Break Duty Absent';
            }

            return 'Break Duty Present';
        }

        if ($attendanceStatus === null || $attendanceStatus === '') {
            return match ($dayClassification) {
                self::DAY_PUBLIC_HOLIDAY => 'Holiday',
                self::DAY_UNIVERSITY_BREAK => 'University Break',
                default => 'No Record',
            };
        }

        if ($normalized === 'absent') {
            return 'Absent';
        }

        return 'Present';
    }

    /**
     * Eligible teachers for break-duty assignment under this break's coverage.
     *
     * @return Collection<int, Teacher>
     */
    public function eligibleDutyTeachers(HolidayBreak $break): Collection
    {
        $query = Teacher::query()->orderBy('first_name')->orderBy('last_name');
        $coverage = $break->coverage_type ?: HolidayBreakCoverage::ALL_STAFF;
        $staffType = HolidayBreakCoverage::staffTypeFilter($coverage);

        if ($staffType) {
            $query->where('staff_type', $staffType);
        }

        if (HolidayBreakCoverage::requiresStaffSelection($coverage)) {
            $ids = $break->coverageAssignments()->pluck('teacher_id');
            if ($ids->isEmpty()) {
                return collect();
            }
            $query->whereIn('id', $ids);
        }

        return $query->get();
    }

    public function coveredStaffCount(HolidayBreak $break): int
    {
        $coverage = $break->coverage_type ?: HolidayBreakCoverage::ALL_STAFF;

        if (HolidayBreakCoverage::requiresStaffSelection($coverage)) {
            return $break->coverageAssignments()->count();
        }

        $query = Teacher::query();
        $staffType = HolidayBreakCoverage::staffTypeFilter($coverage);
        if ($staffType) {
            $query->where('staff_type', $staffType);
        }

        return $query->count();
    }

    /**
     * @return array<string, mixed>
     */
    private function breakPayload(HolidayBreak $break): array
    {
        return [
            'id' => $break->id,
            'name' => $break->name,
            'type' => $break->type,
            'type_label' => HolidayBreakType::label($break->type),
            'coverage_type' => $break->coverage_type,
            'coverage_label' => HolidayBreakCoverage::label($break->coverage_type),
            'start_date' => $break->start_date?->toDateString(),
            'end_date' => $break->end_date?->toDateString(),
            'description' => $break->description,
        ];
    }

    private function teacherInCoverageList(int $teacherId, HolidayBreak $break): bool
    {
        if ($break->relationLoaded('coverageAssignments')) {
            return $break->coverageAssignments->contains('teacher_id', $teacherId);
        }

        return HolidayBreakCoverageAssignment::query()
            ->where('holiday_break_id', $break->id)
            ->where('teacher_id', $teacherId)
            ->exists();
    }

    private function teacherAssignedToDuty(int $teacherId, HolidayBreak $break): bool
    {
        return HolidayBreakDutyAssignment::query()
            ->where('holiday_break_id', $break->id)
            ->where('teacher_id', $teacherId)
            ->exists();
    }

    private function teacherHasDutyOnBreak(int $teacherId, HolidayBreak $break, string $date): bool
    {
        /** @var HolidayBreakDutyAssignment|null $assignment */
        $assignment = HolidayBreakDutyAssignment::query()
            ->where('holiday_break_id', $break->id)
            ->where('teacher_id', $teacherId)
            ->first();

        if (! $assignment) {
            return false;
        }

        return $assignment->isDutyRequiredOn($date);
    }
}
