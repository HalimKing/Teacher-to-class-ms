<?php

use App\Models\AcademicYear;
use App\Models\ClassRoom;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\StaffAttendance;
use App\Models\SystemSetting;
use App\Models\Teacher;
use App\Models\TimeTable;
use App\Support\AttendanceExceptionCategory;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;

beforeEach(function () {
    Carbon::setTestNow(Carbon::parse('2026-10-07 10:00:00'));
    Cache::forget('system_settings');

    SystemSetting::query()->updateOrCreate(
        ['key' => 'facial_recognition_enabled'],
        ['value' => '0', 'group' => 'attendance', 'type' => 'boolean', 'description' => 'test'],
    );
    SystemSetting::query()->updateOrCreate(
        ['key' => 'gps_enforcement_enabled'],
        ['value' => '0', 'group' => 'attendance', 'type' => 'boolean', 'description' => 'test'],
    );

    $this->faculty = Faculty::create(['name' => 'Staff Checkout Faculty']);
    $this->department = Department::create([
        'name' => 'Staff Checkout Dept',
        'faculty_id' => $this->faculty->id,
    ]);
    $this->administrator = Teacher::create([
        'first_name' => 'Office',
        'last_name' => 'Admin',
        'email' => 'staff-checkout-'.uniqid().'@example.com',
        'phone' => '0244000111',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'SCO'.uniqid(),
        'title' => 'Ms.',
        'staff_type' => Teacher::STAFF_TYPE_ADMINISTRATOR,
    ]);
    $this->academicYear = AcademicYear::create(['name' => '2026/2027 Staff Checkout', 'status' => 'active']);
    $this->classroom = ClassRoom::factory()->create();
});

afterEach(function () {
    Carbon::setTestNow();
});

it('allows an administrator to check out before the shift end time', function () {
    $start = Carbon::now()->subMinutes(30)->format('H:i:s');
    $end = Carbon::now()->addMinutes(60)->format('H:i:s');

    $timetable = TimeTable::create([
        'academic_year_id' => $this->academicYear->id,
        'class_room_id' => $this->classroom->id,
        'teacher_id' => $this->administrator->id,
        'staff_type' => Teacher::STAFF_TYPE_ADMINISTRATOR,
        'day' => Carbon::now()->format('l'),
        'day_of_week' => Carbon::now()->format('l'),
        'start_time' => $start,
        'end_time' => $end,
    ]);

    $attendance = StaffAttendance::create([
        'staff_id' => $this->administrator->id,
        'timetable_id' => $timetable->id,
        'classroom_id' => $this->classroom->id,
        'academic_year_id' => $this->academicYear->id,
        'date' => Carbon::now()->format('Y-m-d'),
        'check_in_time' => Carbon::now()->subMinutes(10)->format('H:i:s'),
        'latitude' => 1.2345,
        'longitude' => 2.3456,
        'check_in_distance' => 10,
        'check_in_within_range' => true,
        'attendance_status' => 'checked_in',
        'arrival_category' => 'on_time',
    ]);

    $this->actingAs($this->administrator, 'teacher')
        ->postJson('/teacher/staff-attendance/check-out', [
            'attendance_id' => $attendance->id,
            'check_out_time' => Carbon::now()->toDateTimeString(),
            'coordinates' => ['latitude' => 1.2345, 'longitude' => 2.3456, 'accuracy' => 5],
            'distance' => 5,
            'within_range' => true,
        ])
        ->assertOk()
        ->assertJson([
            'success' => true,
            'message' => 'Staff check-out recorded as early leave.',
        ]);

    $attendance->refresh();

    expect($attendance->departure_category)->toBe('early_leave')
        ->and($attendance->attendance_status)->toBe('early_leave')
        ->and($attendance->exception_category)->toBe(AttendanceExceptionCategory::UNAUTHORIZED_EARLY_DEPARTURE)
        ->and($attendance->check_out_time)->not->toBeNull();
});
