<?php

namespace App\Services;

use App\Models\AcademicYear;
use App\Models\ClassRoom;
use App\Models\Course;
use App\Models\Teacher;
use App\Models\TimeTable;
use Carbon\Carbon;
use Illuminate\Support\Str;

class TimeTableScheduleService
{
    public const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    /**
     * Validate and resolve a schedule row into persistable data.
     *
     * @param  array<string, mixed>  $input
     * @param  array<int, array<string, mixed>>  $pendingSchedules  Already-accepted rows in the same batch
     * @return array{data: ?array<string, mixed>, errors: array<int, string>, exists: bool}
     */
    public function validateAndResolve(array $input, array $pendingSchedules = []): array
    {
        $errors = [];
        $normalized = $this->normalizeInput($input);

        $academicYear = $this->resolveAcademicYear($normalized, $errors);
        $staffType = $this->resolveStaffType($normalized, $errors);
        $teacher = $this->resolveTeacher($normalized, $staffType, $errors);
        $course = $this->resolveCourse($normalized, $staffType, $academicYear, $errors);
        $classRoom = $this->resolveClassRoom($normalized, $errors);
        $day = $this->resolveDay($normalized, $errors);
        $startTime = $this->normalizeTime($normalized['start_time'] ?? null);
        $endTime = $this->normalizeTime($normalized['end_time'] ?? null);

        if ($startTime === null) {
            $errors[] = 'Start time is required (HH:MM).';
        }
        if ($endTime === null) {
            $errors[] = 'End time is required (HH:MM).';
        }
        if ($startTime !== null && $endTime !== null && $endTime <= $startTime) {
            $errors[] = 'End time must be after start time.';
        }

        if (! empty($errors) || ! $academicYear || ! $staffType || ! $teacher || ! $classRoom || ! $day || ! $startTime || ! $endTime) {
            return ['data' => null, 'errors' => $errors, 'exists' => false];
        }

        if ($staffType === Teacher::STAFF_TYPE_LECTURER && ! $course) {
            return ['data' => null, 'errors' => $errors ?: ['Course is required for lecturer schedules.'], 'exists' => false];
        }

        $data = [
            'academic_year_id' => $academicYear->id,
            'teacher_id' => $teacher->id,
            'staff_type' => $staffType,
            'course_id' => $staffType === Teacher::STAFF_TYPE_LECTURER ? $course?->id : null,
            'class_room_id' => $classRoom->id,
            'day' => $day,
            'day_of_week' => $day,
            'start_time' => $startTime,
            'end_time' => $endTime,
        ];

        $exists = $this->hasDuplicateEntry($data);

        if ($staffType === Teacher::STAFF_TYPE_LECTURER) {
            if ($this->hasClassroomConflict($data)) {
                $errors[] = "Venue conflict on {$day} between {$startTime} and {$endTime}.";
            }
            if ($this->hasStaffOverlap($data)) {
                $errors[] = "Staff member already has a schedule on {$day} between {$startTime} and {$endTime}.";
            }
            if ($exists) {
                $errors[] = 'Duplicate schedule already exists for this staff member, venue, day, and time.';
            }
        } elseif ($exists) {
            $errors[] = 'Duplicate schedule already exists for this staff member, venue, day, and time.';
        }

        foreach ($pendingSchedules as $index => $pending) {
            if ($this->rowsConflict($data, $pending)) {
                $errors[] = 'Conflicts with another schedule in this batch (row ' . ($index + 1) . ').';
            }
            if ($this->rowsExactMatch($data, $pending)) {
                $errors[] = 'Duplicate of another schedule in this batch (row ' . ($index + 1) . ').';
            }
        }

        return [
            'data' => empty($errors) ? $data : null,
            'errors' => array_values(array_unique($errors)),
            'exists' => $exists,
        ];
    }

    public function create(array $data): TimeTable
    {
        return TimeTable::create([
            'academic_year_id' => $data['academic_year_id'],
            'teacher_id' => $data['teacher_id'],
            'staff_type' => $data['staff_type'],
            'course_id' => $data['course_id'],
            'class_room_id' => $data['class_room_id'],
            'day' => $data['day'],
            'day_of_week' => $data['day_of_week'] ?? $data['day'],
            'start_time' => $data['start_time'],
            'end_time' => $data['end_time'],
        ]);
    }

    public function hasClassroomConflict(array $data, ?int $excludeId = null): bool
    {
        $query = TimeTable::where('academic_year_id', $data['academic_year_id'])
            ->where('class_room_id', $data['class_room_id'])
            ->where('day_of_week', $data['day'])
            ->where(function ($query) use ($data) {
                $query->where('start_time', '<', $data['end_time'])
                    ->where('end_time', '>', $data['start_time']);
            });

        if ($excludeId) {
            $query->where('id', '!=', $excludeId);
        }

        return $query->exists();
    }

    public function hasStaffOverlap(array $data, ?int $excludeId = null): bool
    {
        $query = TimeTable::where('academic_year_id', $data['academic_year_id'])
            ->where('teacher_id', $data['teacher_id'])
            ->where('day_of_week', $data['day'])
            ->where(function ($query) use ($data) {
                $query->where('start_time', '<', $data['end_time'])
                    ->where('end_time', '>', $data['start_time']);
            });

        if ($excludeId) {
            $query->where('id', '!=', $excludeId);
        }

        return $query->exists();
    }

    public function hasDuplicateEntry(array $data, ?int $excludeId = null): bool
    {
        $query = TimeTable::where('academic_year_id', $data['academic_year_id'])
            ->where('teacher_id', $data['teacher_id'])
            ->where('staff_type', $data['staff_type'])
            ->where('course_id', $data['course_id'])
            ->where('class_room_id', $data['class_room_id'])
            ->where('day_of_week', $data['day'])
            ->where('start_time', $data['start_time'])
            ->where('end_time', $data['end_time']);

        if ($excludeId) {
            $query->where('id', '!=', $excludeId);
        }

        return $query->exists();
    }

    public function normalizeTime(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_numeric($value) && ! is_string($value)) {
            $seconds = (int) round(((float) $value) * 24 * 60 * 60);
            $hours = intdiv($seconds, 3600) % 24;
            $minutes = intdiv($seconds % 3600, 60);

            return sprintf('%02d:%02d', $hours, $minutes);
        }

        $raw = trim((string) $value);

        if (preg_match('/^(\d{1,2}):(\d{2})(?::\d{2})?$/', $raw, $matches)) {
            $hours = (int) $matches[1];
            $minutes = (int) $matches[2];
            if ($hours > 23 || $minutes > 59) {
                return null;
            }

            return sprintf('%02d:%02d', $hours, $minutes);
        }

        try {
            return Carbon::parse($raw)->format('H:i');
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    private function normalizeInput(array $input): array
    {
        $aliases = [
            'academic_year' => 'academic_year_name',
            'academic_year_name' => 'academic_year_name',
            'employee_id' => 'employee_id',
            'staff_id' => 'employee_id',
            'course_code' => 'course_code',
            'venue' => 'venue',
            'classroom' => 'venue',
            'class_room' => 'venue',
            'venue_name' => 'venue',
            'day_of_week' => 'day',
        ];

        $normalized = [];
        foreach ($input as $key => $value) {
            $key = strtolower(trim(str_replace([' ', '-'], '_', (string) $key)));
            $mapped = $aliases[$key] ?? $key;
            $normalized[$mapped] = is_string($value) ? trim($value) : $value;
        }

        return $normalized;
    }

    /**
     * @param  array<string, mixed>  $normalized
     * @param  array<int, string>  $errors
     */
    private function resolveAcademicYear(array $normalized, array &$errors): ?AcademicYear
    {
        if (! empty($normalized['academic_year_id'])) {
            $year = AcademicYear::find($normalized['academic_year_id']);
            if (! $year) {
                $errors[] = 'Academic year not found.';
            }

            return $year;
        }

        $name = trim((string) ($normalized['academic_year_name'] ?? ''));
        if ($name === '') {
            $year = AcademicYear::active()->first();
            if (! $year) {
                $errors[] = 'Academic year is required.';
            }

            return $year;
        }

        $year = AcademicYear::where('name', $name)->first();
        if (! $year) {
            $errors[] = 'Academic year "' . $name . '" not found.';
        }

        return $year;
    }

    /**
     * @param  array<string, mixed>  $normalized
     * @param  array<int, string>  $errors
     */
    private function resolveStaffType(array $normalized, array &$errors): ?string
    {
        $staffType = strtolower(trim((string) ($normalized['staff_type'] ?? Teacher::STAFF_TYPE_LECTURER)));
        if (! in_array($staffType, Teacher::STAFF_TYPES, true)) {
            $errors[] = 'Staff type must be lecturer or administrator.';

            return null;
        }

        return $staffType;
    }

    /**
     * @param  array<string, mixed>  $normalized
     * @param  array<int, string>  $errors
     */
    private function resolveTeacher(array $normalized, ?string $staffType, array &$errors): ?Teacher
    {
        $teacher = null;

        if (! empty($normalized['teacher_id'])) {
            $teacher = Teacher::find($normalized['teacher_id']);
            if (! $teacher) {
                $errors[] = 'Staff member not found.';
            }
        } elseif (! empty($normalized['employee_id'])) {
            $teacher = Teacher::where('employee_id', trim((string) $normalized['employee_id']))->first();
            if (! $teacher) {
                $errors[] = 'Staff member with employee ID "' . $normalized['employee_id'] . '" not found.';
            }
        } else {
            $errors[] = 'Staff member (teacher_id or employee_id) is required.';
        }

        if ($teacher && $staffType && $teacher->staff_type !== $staffType) {
            $errors[] = 'Selected staff member does not match the selected staff type.';
        }

        return $teacher;
    }

    /**
     * @param  array<string, mixed>  $normalized
     * @param  array<int, string>  $errors
     */
    private function resolveCourse(array $normalized, ?string $staffType, ?AcademicYear $academicYear, array &$errors): ?Course
    {
        if ($staffType === Teacher::STAFF_TYPE_ADMINISTRATOR) {
            return null;
        }

        $course = null;
        if (! empty($normalized['course_id'])) {
            $course = Course::find($normalized['course_id']);
            if (! $course) {
                $errors[] = 'Course not found.';
            }
        } elseif (! empty($normalized['course_code'])) {
            $query = Course::where('course_code', trim((string) $normalized['course_code']));
            if ($academicYear) {
                $query->where('academic_year_id', $academicYear->id);
            }
            $course = $query->first();
            if (! $course) {
                $errors[] = 'Course code "' . $normalized['course_code'] . '" not found'
                    . ($academicYear ? ' for academic year ' . $academicYear->name : '') . '.';
            }
        } else {
            $errors[] = 'Course is required for lecturer schedules.';
        }

        if ($course && (empty($course->course_code) || empty($course->name))) {
            $errors[] = 'Lecturer schedules require a course with both code and title.';
        }

        return $course;
    }

    /**
     * @param  array<string, mixed>  $normalized
     * @param  array<int, string>  $errors
     */
    private function resolveClassRoom(array $normalized, array &$errors): ?ClassRoom
    {
        if (! empty($normalized['class_room_id'])) {
            $room = ClassRoom::find($normalized['class_room_id']);
            if (! $room) {
                $errors[] = 'Venue not found.';
            }

            return $room;
        }

        $name = trim((string) ($normalized['venue'] ?? ''));
        if ($name === '') {
            $errors[] = 'Venue is required.';

            return null;
        }

        $room = ClassRoom::where('name', $name)->first();
        if (! $room) {
            $errors[] = 'Venue "' . $name . '" not found.';
        }

        return $room;
    }

    /**
     * @param  array<string, mixed>  $normalized
     * @param  array<int, string>  $errors
     */
    private function resolveDay(array $normalized, array &$errors): ?string
    {
        $day = trim((string) ($normalized['day'] ?? ''));
        if ($day === '') {
            $errors[] = 'Day is required.';

            return null;
        }

        $matched = collect(self::DAYS)->first(fn ($candidate) => Str::lower($candidate) === Str::lower($day));
        if (! $matched) {
            $errors[] = 'Day must be Monday through Sunday.';

            return null;
        }

        return $matched;
    }

    /**
     * @param  array<string, mixed>  $a
     * @param  array<string, mixed>  $b
     */
    private function rowsConflict(array $a, array $b): bool
    {
        if ((int) $a['academic_year_id'] !== (int) $b['academic_year_id'] || $a['day'] !== $b['day']) {
            return false;
        }

        $overlaps = $a['start_time'] < $b['end_time'] && $a['end_time'] > $b['start_time'];
        if (! $overlaps) {
            return false;
        }

        if ((int) $a['class_room_id'] === (int) $b['class_room_id']) {
            return true;
        }

        return (int) $a['teacher_id'] === (int) $b['teacher_id'];
    }

    /**
     * @param  array<string, mixed>  $a
     * @param  array<string, mixed>  $b
     */
    private function rowsExactMatch(array $a, array $b): bool
    {
        return (int) $a['academic_year_id'] === (int) $b['academic_year_id']
            && (int) $a['teacher_id'] === (int) $b['teacher_id']
            && $a['staff_type'] === $b['staff_type']
            && (int) ($a['course_id'] ?? 0) === (int) ($b['course_id'] ?? 0)
            && (int) $a['class_room_id'] === (int) $b['class_room_id']
            && $a['day'] === $b['day']
            && $a['start_time'] === $b['start_time']
            && $a['end_time'] === $b['end_time'];
    }
}
