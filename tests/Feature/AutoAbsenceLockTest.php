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
use App\Support\AttendanceLock;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;

beforeEach(function () {
    Cache::forget('system_settings');

    SystemSetting::query()->updateOrCreate(
        ['key' => 'facial_recognition_enabled'],
        ['value' => '0', 'group' => 'attendance', 'type' => 'boolean', 'description' => 'test'],
    );
    SystemSetting::query()->updateOrCreate(
        ['key' => 'gps_enforcement_enabled'],
        ['value' => '0', 'group' => 'attendance', 'type' => 'boolean', 'description' => 'test'],
    );
    SystemSetting::query()->updateOrCreate(
        ['key' => 'auto_mark_absent_after_end'],
        ['value' => '1', 'group' => 'attendance', 'type' => 'boolean', 'description' => 'test'],
    );
    SystemSetting::query()->updateOrCreate(
        ['key' => 'checkout_grace_period_minutes'],
        ['value' => '0', 'group' => 'attendance', 'type' => 'integer', 'description' => 'test'],
    );

    $this->faculty = Faculty::create(['name' => 'Lock Faculty']);
    $this->department = Department::create([
        'name' => 'Lock Dept',
        'faculty_id' => $this->faculty->id,
    ]);
    $this->academicYear = AcademicYear::create(['name' => '2026/2027 Lock', 'status' => 'active']);
    $this->classroom = ClassRoom::factory()->create();
    $this->program = Program::create([
        'name' => 'Lock Program',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
    ]);

    $this->lecturer = Teacher::create([
        'first_name' => 'Locked',
        'last_name' => 'Lecturer',
        'email' => 'locked-lecturer-'.uniqid().'@example.com',
        'phone' => '1111111111',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'LOCKLEC'.uniqid(),
        'title' => 'Dr.',
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
    ]);

    $this->administrator = Teacher::create([
        'first_name' => 'Locked',
        'last_name' => 'Admin',
        'email' => 'locked-admin-'.uniqid().'@example.com',
        'phone' => '2222222222',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'LOCKADM'.uniqid(),
        'title' => 'Mr.',
        'staff_type' => Teacher::STAFF_TYPE_ADMINISTRATOR,
    ]);

    $this->course = Course::create([
        'course_code' => 'LOCK-101',
        'name' => 'Lock Course',
        'program_id' => $this->program->id,
        'teacher_id' => $this->lecturer->id,
        'student_size' => 20,
    ]);
});

afterEach(function () {
    Carbon::setTestNow();
});

function lecturerCheckInPayload(Course $course, TimeTable $timetable, ClassRoom $classroom): array
{
    return [
        'coordinates' => ['latitude' => 1.2345, 'longitude' => 2.3456, 'accuracy' => 5],
        'course_id' => $course->id,
        'course_name' => $course->name,
        'class_room' => $classroom->name,
        'timetable_id' => $timetable->id,
        'check_in_time' => now()->toDateTimeString(),
        'distance' => 10,
        'within_range' => true,
    ];
}

function staffCheckInPayload(TimeTable $timetable): array
{
    return [
        'timetable_id' => $timetable->id,
        'check_in_time' => now()->toDateTimeString(),
        'coordinates' => ['latitude' => 1.2345, 'longitude' => 2.3456, 'accuracy' => 5],
        'distance' => 10,
        'within_range' => true,
    ];
}

it('blocks lecturer check-in after automatic absence and keeps the session absent', function () {
    $now = Carbon::parse('2026-06-12 10:30:00');
    Carbon::setTestNow($now);

    $timetable = TimeTable::create([
        'academic_year_id' => $this->academicYear->id,
        'course_id' => $this->course->id,
        'class_room_id' => $this->classroom->id,
        'teacher_id' => $this->lecturer->id,
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'day' => $now->format('l'),
        'day_of_week' => $now->format('l'),
        'start_time' => '08:00:00',
        'end_time' => '10:00:00',
    ]);

    $attendance = TeacherAttendance::create([
        'teacher_id' => $this->lecturer->id,
        'timetable_id' => $timetable->id,
        'course_id' => $this->course->id,
        'classroom_id' => $this->classroom->id,
        'academic_year_id' => $this->academicYear->id,
        'date' => $now->toDateString(),
        'status' => 'absent',
        'attendance_source' => 'system',
        'auto_generated' => true,
        'auto_generated_at' => $now,
        'auto_absence_reason' => 'session_expired',
    ]);

    $list = $this->actingAs($this->lecturer, 'teacher')
        ->getJson('/teacher/attendance/todays-classes')
        ->assertOk();

    $session = collect($list->json('data'))->firstWhere('timetable_id', $timetable->id);

    expect($session)->not->toBeNull()
        ->and($session['is_missed'])->toBeTrue()
        ->and($session['can_take_attendance'])->toBeFalse()
        ->and($session['attendance_state'])->toBe('missed')
        ->and($session['attendance_blocked_message'])->toBe(AttendanceLock::MESSAGE)
        ->and($session['attendance_status']['status'])->toBe('absent');

    $this->actingAs($this->lecturer, 'teacher')
        ->postJson('/teacher/attendance/check-in', lecturerCheckInPayload($this->course, $timetable, $this->classroom))
        ->assertStatus(422)
        ->assertJson(AttendanceLock::blockedPayload());

    $this->actingAs($this->lecturer, 'teacher')
        ->postJson('/teacher/attendance/check-out', [
            'attendance_id' => $attendance->id,
            'check_out_time' => $now->toDateTimeString(),
            'coordinates' => ['latitude' => 1.2345, 'longitude' => 2.3456, 'accuracy' => 5],
            'distance' => 5,
            'within_range' => true,
        ])
        ->assertStatus(422)
        ->assertJson(AttendanceLock::blockedPayload());

    expect($attendance->fresh()->status)->toBe('absent')
        ->and($attendance->fresh()->check_in_time)->toBeNull()
        ->and($attendance->fresh()->check_out_time)->toBeNull();

    expect(
        TeacherAttendance::query()
            ->where('teacher_id', $this->lecturer->id)
            ->where('timetable_id', $timetable->id)
            ->whereDate('date', $now)
            ->count()
    )->toBe(1);
});

it('blocks administrator check-in and check-out after automatic absence', function () {
    $now = Carbon::parse('2026-06-12 10:30:00');
    Carbon::setTestNow($now);

    $timetable = TimeTable::create([
        'academic_year_id' => $this->academicYear->id,
        'class_room_id' => $this->classroom->id,
        'teacher_id' => $this->administrator->id,
        'staff_type' => Teacher::STAFF_TYPE_ADMINISTRATOR,
        'day' => $now->format('l'),
        'day_of_week' => $now->format('l'),
        'start_time' => '08:00:00',
        'end_time' => '10:00:00',
    ]);

    $attendance = StaffAttendance::create([
        'staff_id' => $this->administrator->id,
        'timetable_id' => $timetable->id,
        'classroom_id' => $this->classroom->id,
        'academic_year_id' => $this->academicYear->id,
        'date' => $now->toDateString(),
        'attendance_status' => 'absent',
        'attendance_source' => 'system',
        'auto_generated' => true,
        'auto_generated_at' => $now,
        'auto_absence_reason' => 'session_expired',
    ]);

    $list = $this->actingAs($this->administrator, 'teacher')
        ->getJson('/teacher/staff-attendance/todays-schedules')
        ->assertOk();

    $session = collect($list->json('data'))->firstWhere('id', $timetable->id);

    expect($session)->not->toBeNull()
        ->and($session['is_missed'])->toBeTrue()
        ->and($session['can_take_attendance'])->toBeFalse()
        ->and($session['attendance_state'])->toBe('missed')
        ->and($session['attendance_blocked_message'])->toBe(AttendanceLock::MESSAGE)
        ->and($session['attendance_status']['status'])->toBe('absent');

    $this->actingAs($this->administrator, 'teacher')
        ->postJson('/teacher/staff-attendance/check-in', staffCheckInPayload($timetable))
        ->assertStatus(422)
        ->assertJson(AttendanceLock::blockedPayload());

    $this->actingAs($this->administrator, 'teacher')
        ->postJson('/teacher/staff-attendance/check-out', [
            'attendance_id' => $attendance->id,
            'check_out_time' => $now->toDateTimeString(),
            'coordinates' => ['latitude' => 1.2345, 'longitude' => 2.3456, 'accuracy' => 5],
            'distance' => 5,
            'within_range' => true,
        ])
        ->assertStatus(422)
        ->assertJson(AttendanceLock::blockedPayload());

    expect($attendance->fresh()->attendance_status)->toBe('absent')
        ->and($attendance->fresh()->check_in_time)->toBeNull()
        ->and($attendance->fresh()->check_out_time)->toBeNull();
});

it('lets an administrator check in to a later shift after an earlier one was auto-marked absent', function () {
    $now = Carbon::parse('2026-06-12 17:40:00');
    Carbon::setTestNow($now);

    $missed = TimeTable::create([
        'academic_year_id' => $this->academicYear->id,
        'class_room_id' => $this->classroom->id,
        'teacher_id' => $this->administrator->id,
        'staff_type' => Teacher::STAFF_TYPE_ADMINISTRATOR,
        'day' => 'Friday',
        'day_of_week' => 'Friday',
        'start_time' => '08:00:00',
        'end_time' => '10:00:00',
    ]);

    $fresh = TimeTable::create([
        'academic_year_id' => $this->academicYear->id,
        'class_room_id' => $this->classroom->id,
        'teacher_id' => $this->administrator->id,
        'staff_type' => Teacher::STAFF_TYPE_ADMINISTRATOR,
        'day' => 'Friday',
        'day_of_week' => 'Friday',
        'start_time' => '17:30:00',
        'end_time' => '18:30:00',
    ]);

    StaffAttendance::create([
        'staff_id' => $this->administrator->id,
        'timetable_id' => $missed->id,
        'classroom_id' => $this->classroom->id,
        'academic_year_id' => $this->academicYear->id,
        'date' => $now->toDateString(),
        'attendance_status' => 'absent',
        'auto_generated' => true,
        'auto_generated_at' => $now->copy()->setTime(10, 5),
    ]);

    $this->actingAs($this->administrator, 'teacher')
        ->postJson('/teacher/staff-attendance/check-in', staffCheckInPayload($fresh))
        ->assertOk()
        ->assertJson(['success' => true]);

    $freshAttendance = StaffAttendance::query()
        ->where('staff_id', $this->administrator->id)
        ->where('timetable_id', $fresh->id)
        ->whereDate('date', $now->toDateString())
        ->first();

    expect($freshAttendance)->not->toBeNull()
        ->and($freshAttendance->attendance_status)->not->toBe('absent')
        ->and($freshAttendance->check_in_time)->not->toBeNull();

    expect(
        StaffAttendance::query()
            ->where('staff_id', $this->administrator->id)
            ->where('timetable_id', $missed->id)
            ->first()
            ->attendance_status
    )->toBe('absent');
});

it('does not rewrite an auto-absent record when the attendance processor runs again', function () {
    $now = Carbon::parse('2026-06-12 11:00:00');
    Carbon::setTestNow($now);

    $timetable = TimeTable::create([
        'academic_year_id' => $this->academicYear->id,
        'course_id' => $this->course->id,
        'class_room_id' => $this->classroom->id,
        'teacher_id' => $this->lecturer->id,
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'day' => $now->format('l'),
        'day_of_week' => $now->format('l'),
        'start_time' => '08:00:00',
        'end_time' => '10:00:00',
    ]);

    $attendance = TeacherAttendance::create([
        'teacher_id' => $this->lecturer->id,
        'timetable_id' => $timetable->id,
        'course_id' => $this->course->id,
        'classroom_id' => $this->classroom->id,
        'academic_year_id' => $this->academicYear->id,
        'date' => $now->toDateString(),
        'status' => 'absent',
        'attendance_source' => 'system',
        'auto_generated' => true,
        'auto_generated_at' => $now->copy()->subMinutes(30),
        'auto_absence_reason' => 'session_expired',
    ]);

    app(AttendanceProcessorService::class)->process($now);

    expect($attendance->fresh()->status)->toBe('absent')
        ->and($attendance->fresh()->check_in_time)->toBeNull()
        ->and($attendance->fresh()->check_out_time)->toBeNull()
        ->and($attendance->fresh()->auto_generated)->toBeTrue();
});
