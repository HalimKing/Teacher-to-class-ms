<?php

use App\Models\AcademicYear;
use App\Models\ClassRoom;
use App\Models\Course;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\Program;
use App\Models\StaffAttendance;
use App\Models\SystemSetting;
use App\Models\Teacher;
use App\Models\TeacherAttendance;
use App\Models\TimeTable;
use App\Services\AttendanceProcessorService;
use App\Support\AttendanceRecordSource;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;

function seedAttendanceProcessorSettings(): void
{
    Cache::forget('system_settings');

    foreach ([
        [
            'key' => 'auto_mark_absent_after_end',
            'value' => '1',
            'group' => 'attendance',
            'type' => 'boolean',
            'description' => 'Auto-mark absent after class end time',
        ],
        [
            'key' => 'checkout_grace_period_minutes',
            'value' => '30',
            'group' => 'attendance',
            'type' => 'integer',
            'description' => 'Checkout grace period',
        ],
    ] as $setting) {
        SystemSetting::query()->updateOrCreate(
            ['key' => $setting['key']],
            $setting,
        );
    }
}

function createAttendanceProcessorFixtures(): array
{
    $faculty = Faculty::create(['name' => 'Science Faculty']);
    $department = Department::create(['name' => 'Computer Science', 'faculty_id' => $faculty->id]);
    $academicYear = AcademicYear::create(['name' => '2025/2026', 'status' => 'active']);
    $classroom = ClassRoom::factory()->create();

    $lecturer = Teacher::create([
        'first_name' => 'Jane',
        'last_name' => 'Lecturer',
        'email' => 'lecturer@example.com',
        'phone' => '1111111111',
        'faculty_id' => $faculty->id,
        'department_id' => $department->id,
        'employee_id' => 'LEC001',
        'title' => 'Dr.',
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
    ]);

    $administrator = Teacher::create([
        'first_name' => 'Alan',
        'last_name' => 'Admin',
        'email' => 'administrator@example.com',
        'phone' => '2222222222',
        'faculty_id' => $faculty->id,
        'department_id' => $department->id,
        'employee_id' => 'ADM001',
        'title' => 'Mr.',
        'staff_type' => Teacher::STAFF_TYPE_ADMINISTRATOR,
    ]);

    $program = Program::create([
        'name' => 'Computer Science',
        'faculty_id' => $faculty->id,
        'department_id' => $department->id,
    ]);

    $course = Course::create([
        'course_code' => 'ECO101',
        'name' => 'Economics',
        'program_id' => $program->id,
        'teacher_id' => $lecturer->id,
        'student_size' => 30,
    ]);

    return compact(
        'faculty',
        'department',
        'academicYear',
        'classroom',
        'lecturer',
        'administrator',
        'program',
        'course',
    );
}

function createExpiredSchedule(
    array $fixtures,
    Teacher $staff,
    string $staffType,
    ?Course $course,
    Carbon $reference,
): TimeTable {
    return TimeTable::create([
        'academic_year_id' => $fixtures['academicYear']->id,
        'teacher_id' => $staff->id,
        'staff_type' => $staffType,
        'course_id' => $course?->id,
        'class_room_id' => $fixtures['classroom']->id,
        'day' => $reference->format('l'),
        'day_of_week' => $reference->format('l'),
        'start_time' => $reference->copy()->subHours(2)->format('H:i:s'),
        'end_time' => $reference->copy()->subMinutes(45)->format('H:i:s'),
    ]);
}

beforeEach(function () {
    seedAttendanceProcessorSettings();
    $this->fixtures = createAttendanceProcessorFixtures();
    $this->processor = app(AttendanceProcessorService::class);
});

it('marks lecturers absent after the attendance window expires without check-in', function () {
    $reference = Carbon::parse('2026-06-12 10:31:00');
    Carbon::setTestNow($reference);

    $schedule = createExpiredSchedule(
        $this->fixtures,
        $this->fixtures['lecturer'],
        Teacher::STAFF_TYPE_LECTURER,
        $this->fixtures['course'],
        $reference,
    );

    $stats = $this->processor->process($reference);

    expect($stats['teachers']['absent'])->toBe(1);

    $this->assertDatabaseHas('teacher_attendances', [
        'teacher_id' => $this->fixtures['lecturer']->id,
        'timetable_id' => $schedule->id,
        'status' => 'absent',
        'attendance_source' => AttendanceRecordSource::SYSTEM,
        'auto_absence_reason' => AttendanceRecordSource::REASON_SESSION_EXPIRED,
    ]);

    expect((bool) TeacherAttendance::query()->where('timetable_id', $schedule->id)->value('auto_generated'))->toBeTrue();
});

it('marks administrators absent after the attendance window expires without check-in', function () {
    $reference = Carbon::parse('2026-06-12 17:31:00');
    Carbon::setTestNow($reference);

    $schedule = createExpiredSchedule(
        $this->fixtures,
        $this->fixtures['administrator'],
        Teacher::STAFF_TYPE_ADMINISTRATOR,
        null,
        $reference,
    );

    $stats = $this->processor->process($reference);

    expect($stats['administrators']['processed'])->toBeGreaterThan(0)
        ->and($stats['administrators']['absent'])->toBe(1);

    $this->assertDatabaseHas('staff_attendances', [
        'staff_id' => $this->fixtures['administrator']->id,
        'timetable_id' => $schedule->id,
        'attendance_status' => 'absent',
        'attendance_source' => AttendanceRecordSource::SYSTEM,
        'auto_absence_reason' => AttendanceRecordSource::REASON_SESSION_EXPIRED,
    ]);

    expect((bool) StaffAttendance::query()->where('timetable_id', $schedule->id)->value('auto_generated'))->toBeTrue();
});

it('does not mark absent when a check-in already exists', function () {
    $reference = Carbon::parse('2026-06-12 10:31:00');
    Carbon::setTestNow($reference);

    $schedule = createExpiredSchedule(
        $this->fixtures,
        $this->fixtures['lecturer'],
        Teacher::STAFF_TYPE_LECTURER,
        $this->fixtures['course'],
        $reference,
    );

    TeacherAttendance::create([
        'teacher_id' => $this->fixtures['lecturer']->id,
        'timetable_id' => $schedule->id,
        'classroom_id' => $this->fixtures['classroom']->id,
        'academic_year_id' => $this->fixtures['academicYear']->id,
        'course_id' => $this->fixtures['course']->id,
        'date' => $reference->toDateString(),
        'check_in_time' => $reference->copy()->subMinutes(90)->format('H:i:s'),
        'status' => 'pending',
        'attendance_source' => AttendanceRecordSource::MANUAL,
    ]);

    $stats = $this->processor->process($reference);

    expect($stats['teachers']['absent'])->toBe(0)
        ->and($stats['teachers']['incomplete'])->toBe(1);

    $this->assertDatabaseCount('teacher_attendances', 1);
    $this->assertDatabaseMissing('teacher_attendances', [
        'teacher_id' => $this->fixtures['lecturer']->id,
        'timetable_id' => $schedule->id,
        'status' => 'absent',
    ]);
});

it('does not create duplicate auto-absence records when run repeatedly', function () {
    $reference = Carbon::parse('2026-06-12 10:31:00');
    Carbon::setTestNow($reference);

    createExpiredSchedule(
        $this->fixtures,
        $this->fixtures['lecturer'],
        Teacher::STAFF_TYPE_LECTURER,
        $this->fixtures['course'],
        $reference,
    );

    $firstRun = $this->processor->process($reference);
    $secondRun = $this->processor->process($reference);

    expect($firstRun['teachers']['absent'])->toBe(1)
        ->and($secondRun['teachers']['absent'])->toBe(0)
        ->and($secondRun['teachers']['skipped'])->toBeGreaterThan(0);

    $this->assertDatabaseCount('teacher_attendances', 1);
});

it('skips auto-absence when the setting is disabled', function () {
    SystemSetting::query()->where('key', 'auto_mark_absent_after_end')->update(['value' => '0']);
    Cache::forget('system_settings');

    $reference = Carbon::parse('2026-06-12 10:31:00');
    Carbon::setTestNow($reference);

    createExpiredSchedule(
        $this->fixtures,
        $this->fixtures['lecturer'],
        Teacher::STAFF_TYPE_LECTURER,
        $this->fixtures['course'],
        $reference,
    );

    $stats = $this->processor->process($reference);

    expect($stats['teachers']['absent'])->toBe(0)
        ->and($stats['teachers']['skipped'])->toBe(1);

    $this->assertDatabaseCount('teacher_attendances', 0);
});

afterEach(function () {
    Carbon::setTestNow();
});
