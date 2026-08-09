<?php

use App\Models\AcademicYear;
use App\Models\ClassRoom;
use App\Models\Course;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\HolidayBreak;
use App\Models\HolidayBreakCoverageAssignment;
use App\Models\HolidayBreakDutyAssignment;
use App\Models\Program;
use App\Models\SystemSetting;
use App\Models\Teacher;
use App\Models\TimeTable;
use App\Models\User;
use App\Services\AttendancePortalService;
use App\Services\AttendanceProcessorService;
use App\Services\HolidayBreakService;
use App\Support\AttendanceExceptionCategory;
use App\Support\HolidayBreakCoverage;
use App\Support\HolidayBreakType;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Cache::forget('system_settings');

    SystemSetting::query()->updateOrCreate(
        ['key' => 'facial_recognition_enabled'],
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

    foreach ([
        'admin.holidays-breaks.view',
        'admin.holidays-breaks.create',
        'admin.holidays-breaks.edit',
        'admin.holidays-breaks.delete',
    ] as $permission) {
        Permission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
    }

    $role = Role::firstOrCreate(['name' => 'Super Admin', 'guard_name' => 'web']);
    $role->givePermissionTo([
        'admin.holidays-breaks.view',
        'admin.holidays-breaks.create',
        'admin.holidays-breaks.edit',
        'admin.holidays-breaks.delete',
    ]);

    $this->admin = User::factory()->create([
        'must_change_password' => false,
        'password_changed_at' => now(),
        'email_verified_at' => now(),
        'status' => User::STATUS_ACTIVE,
    ]);
    $this->admin->assignRole($role);

    $this->faculty = Faculty::create(['name' => 'Holiday Faculty']);
    $this->department = Department::create([
        'name' => 'Holiday Dept',
        'faculty_id' => $this->faculty->id,
    ]);
    $this->academicYear = AcademicYear::create(['name' => '2026/2027 Holiday', 'status' => 'active']);
    $this->classroom = ClassRoom::factory()->create();
    $this->program = Program::create([
        'name' => 'Holiday Program',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
    ]);

    $this->teacher = Teacher::create([
        'first_name' => 'Holiday',
        'last_name' => 'Lecturer',
        'email' => 'holiday.lecturer.' . uniqid() . '@example.com',
        'phone' => '0244111000',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'HOL' . uniqid(),
        'title' => 'Mr.',
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'password' => 'Password123!',
    ]);

    $this->dutyTeacher = Teacher::create([
        'first_name' => 'Duty',
        'last_name' => 'Staff',
        'email' => 'duty.staff.' . uniqid() . '@example.com',
        'phone' => '0244111001',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'DUTY' . uniqid(),
        'title' => 'Ms.',
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'password' => 'Password123!',
    ]);

    $this->administrator = Teacher::create([
        'first_name' => 'Office',
        'last_name' => 'Admin',
        'email' => 'office.admin.' . uniqid() . '@example.com',
        'phone' => '0244111002',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'ADM' . uniqid(),
        'title' => 'Ms.',
        'staff_type' => Teacher::STAFF_TYPE_ADMINISTRATOR,
        'password' => 'Password123!',
    ]);

    $this->course = Course::create([
        'course_code' => 'HOL-101',
        'name' => 'Holiday Course',
        'program_id' => $this->program->id,
        'teacher_id' => $this->teacher->id,
        'student_size' => 20,
    ]);

    $this->dutyCourse = Course::create([
        'course_code' => 'DUTY-101',
        'name' => 'Duty Course',
        'program_id' => $this->program->id,
        'teacher_id' => $this->dutyTeacher->id,
        'student_size' => 20,
    ]);
});

function createActiveBreak(array $overrides = []): HolidayBreak
{
    return HolidayBreak::create(array_merge([
        'name' => 'Christmas Break',
        'type' => HolidayBreakType::CHRISTMAS_BREAK,
        'start_date' => now()->toDateString(),
        'end_date' => now()->addDays(5)->toDateString(),
        'description' => 'University closed',
        'status' => HolidayBreak::STATUS_ACTIVE,
        'coverage_type' => HolidayBreakCoverage::ALL_STAFF,
    ], $overrides));
}

function createLectureTimetable(Teacher $teacher, Course $course, ClassRoom $classroom, AcademicYear $year, array $overrides = []): TimeTable
{
    return TimeTable::create(array_merge([
        'academic_year_id' => $year->id,
        'teacher_id' => $teacher->id,
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'course_id' => $course->id,
        'class_room_id' => $classroom->id,
        'day_of_week' => now()->format('l'),
        'day' => now()->format('l'),
        'start_time' => '08:00:00',
        'end_time' => '09:00:00',
    ], $overrides));
}

it('allows admins to create a holiday break period', function () {
    $response = $this->actingAs($this->admin)->post(route('admin.holidays-breaks.store'), [
        'name' => 'Independence Day',
        'type' => HolidayBreakType::PUBLIC_HOLIDAY,
        'start_date' => '2026-03-06',
        'end_date' => '2026-03-06',
        'description' => 'National holiday',
        'status' => 'active',
        'coverage_type' => HolidayBreakCoverage::ALL_STAFF,
    ]);

    $response->assertRedirect();
    $this->assertDatabaseHas('holiday_breaks', [
        'name' => 'Independence Day',
        'type' => HolidayBreakType::PUBLIC_HOLIDAY,
        'status' => 'active',
        'coverage_type' => HolidayBreakCoverage::ALL_STAFF,
    ]);
});

it('stores selected staff coverage assignments', function () {
    $response = $this->actingAs($this->admin)->post(route('admin.holidays-breaks.store'), [
        'name' => 'Selected Coverage Break',
        'type' => HolidayBreakType::SEMESTER_BREAK,
        'start_date' => now()->toDateString(),
        'end_date' => now()->addDays(2)->toDateString(),
        'status' => 'active',
        'coverage_type' => HolidayBreakCoverage::SELECTED_LECTURERS,
        'coverage_teacher_ids' => [$this->teacher->id],
    ]);

    $response->assertRedirect();
    $break = HolidayBreak::query()->where('name', 'Selected Coverage Break')->first();

    expect($break)->not->toBeNull()
        ->and($break->coverage_type)->toBe(HolidayBreakCoverage::SELECTED_LECTURERS);

    $this->assertDatabaseHas('holiday_break_coverage_assignments', [
        'holiday_break_id' => $break->id,
        'teacher_id' => $this->teacher->id,
    ]);
});

it('does not suspend administrators when coverage is all lecturers', function () {
    createActiveBreak(['coverage_type' => HolidayBreakCoverage::ALL_LECTURERS]);
    $service = app(HolidayBreakService::class);

    expect($service->isAttendanceSuspended($this->teacher, now()))->toBeTrue()
        ->and($service->isAttendanceSuspended($this->administrator, now()))->toBeFalse()
        ->and($service->portalContext($this->administrator, now())['mode'])->toBe(HolidayBreakService::MODE_OPEN);
});

it('only suspends selected covered staff', function () {
    $break = createActiveBreak(['coverage_type' => HolidayBreakCoverage::SELECTED_STAFF]);
    HolidayBreakCoverageAssignment::create([
        'holiday_break_id' => $break->id,
        'teacher_id' => $this->teacher->id,
    ]);

    $service = app(HolidayBreakService::class);

    expect($service->isAttendanceSuspended($this->teacher, now()))->toBeTrue()
        ->and($service->isAttendanceSuspended($this->dutyTeacher, now()))->toBeFalse();
});

it('rejects break duty assignment for staff outside coverage', function () {
    $break = createActiveBreak(['coverage_type' => HolidayBreakCoverage::ALL_LECTURERS]);

    $response = $this->actingAs($this->admin)->post(route('admin.holidays-breaks.duty.store', $break), [
        'teacher_ids' => [$this->administrator->id],
    ]);

    $response->assertSessionHasErrors('teacher_ids');
    $this->assertDatabaseMissing('holiday_break_duty_assignments', [
        'holiday_break_id' => $break->id,
        'teacher_id' => $this->administrator->id,
    ]);
});

it('assigns all eligible covered staff to break duty', function () {
    $break = createActiveBreak(['coverage_type' => HolidayBreakCoverage::ALL_LECTURERS]);

    $response = $this->actingAs($this->admin)->post(route('admin.holidays-breaks.duty.assign-all', $break));

    $response->assertRedirect();
    $this->assertDatabaseHas('holiday_break_duty_assignments', [
        'holiday_break_id' => $break->id,
        'teacher_id' => $this->teacher->id,
    ]);
    $this->assertDatabaseHas('holiday_break_duty_assignments', [
        'holiday_break_id' => $break->id,
        'teacher_id' => $this->dutyTeacher->id,
    ]);
    $this->assertDatabaseMissing('holiday_break_duty_assignments', [
        'holiday_break_id' => $break->id,
        'teacher_id' => $this->administrator->id,
    ]);
});

it('suspends attendance for staff not assigned to break duty', function () {
    createActiveBreak();
    $service = app(HolidayBreakService::class);

    expect($service->isAttendanceSuspended($this->teacher, now()))->toBeTrue()
        ->and($service->isBreakDutyRequired($this->teacher, now()))->toBeFalse()
        ->and($service->portalContext($this->teacher, now())['mode'])->toBe(HolidayBreakService::MODE_UNIVERSITY_BREAK);
});

it('requires attendance for break-duty staff on covered dates', function () {
    $break = createActiveBreak();
    HolidayBreakDutyAssignment::create([
        'holiday_break_id' => $break->id,
        'teacher_id' => $this->dutyTeacher->id,
        'duty_dates' => null,
    ]);

    $service = app(HolidayBreakService::class);

    expect($service->isAttendanceSuspended($this->dutyTeacher, now()))->toBeFalse()
        ->and($service->isBreakDutyRequired($this->dutyTeacher, now()))->toBeTrue()
        ->and($service->portalContext($this->dutyTeacher, now())['mode'])->toBe(HolidayBreakService::MODE_BREAK_DUTY);
});

it('respects optional duty dates when determining break duty', function () {
    $break = createActiveBreak([
        'start_date' => now()->toDateString(),
        'end_date' => now()->addDays(3)->toDateString(),
    ]);

    HolidayBreakDutyAssignment::create([
        'holiday_break_id' => $break->id,
        'teacher_id' => $this->dutyTeacher->id,
        'duty_dates' => [now()->addDay()->toDateString()],
    ]);

    $service = app(HolidayBreakService::class);

    expect($service->isBreakDutyRequired($this->dutyTeacher, now()))->toBeFalse()
        ->and($service->portalContext($this->dutyTeacher, now())['mode'])->toBe(HolidayBreakService::MODE_BREAK_DUTY_OFF)
        ->and($service->isBreakDutyRequired($this->dutyTeacher, now()->addDay()))->toBeTrue();
});

it('skips auto-absence for suspended teachers during an active break', function () {
    createActiveBreak();

    createLectureTimetable($this->teacher, $this->course, $this->classroom, $this->academicYear);

    $reference = now()->setTime(23, 0);
    app(AttendanceProcessorService::class)->process($reference);

    $this->assertDatabaseMissing('teacher_attendances', [
        'teacher_id' => $this->teacher->id,
        'date' => now()->toDateString(),
        'status' => 'absent',
    ]);
});

it('auto-marks absent break-duty staff with break_duty exception category', function () {
    $break = createActiveBreak();
    HolidayBreakDutyAssignment::create([
        'holiday_break_id' => $break->id,
        'teacher_id' => $this->dutyTeacher->id,
        'duty_dates' => null,
    ]);

    createLectureTimetable($this->dutyTeacher, $this->dutyCourse, $this->classroom, $this->academicYear);

    $reference = now()->setTime(23, 0);
    app(AttendanceProcessorService::class)->process($reference);

    $attendance = \App\Models\TeacherAttendance::query()
        ->where('teacher_id', $this->dutyTeacher->id)
        ->whereDate('date', now()->toDateString())
        ->first();

    expect($attendance)->not->toBeNull()
        ->and($attendance->status)->toBe('absent')
        ->and($attendance->exception_category)->toBe(AttendanceExceptionCategory::BREAK_DUTY)
        ->and($attendance->holiday_break_id)->toBe($break->id);
});

it('blocks check-in when attendance is suspended by a holiday break', function () {
    createActiveBreak(['type' => HolidayBreakType::PUBLIC_HOLIDAY]);

    $timetable = createLectureTimetable($this->teacher, $this->course, $this->classroom, $this->academicYear, [
        'start_time' => Carbon::now()->subHour()->format('H:i:s'),
        'end_time' => Carbon::now()->addHour()->format('H:i:s'),
    ]);

    $response = $this->actingAs($this->teacher, 'teacher')->postJson('/teacher/attendance/check-in', [
        'timetable_id' => $timetable->id,
        'course_id' => $this->course->id,
        'course_name' => $this->course->name,
        'class_room' => $this->classroom->name,
        'check_in_time' => now()->toDateTimeString(),
        'distance' => 5,
        'within_range' => true,
        'coordinates' => [
            'latitude' => 5.6,
            'longitude' => -0.1,
            'accuracy' => 10,
        ],
    ]);

    $response->assertStatus(422)
        ->assertJsonFragment(['success' => false]);
});

it('exposes holiday context on the attendance portal mark page', function () {
    createActiveBreak(['type' => HolidayBreakType::PUBLIC_HOLIDAY, 'name' => 'Public Day']);

    $this->actingAs($this->teacher, 'teacher');
    $this->withSession([
        AttendancePortalService::SESSION_KEY => [
            'teacher_id' => $this->teacher->id,
            'employee_id' => $this->teacher->employee_id,
            'staff_type' => $this->teacher->staff_type,
            'started_at' => now()->timestamp,
            'last_activity_at' => now()->timestamp,
        ],
    ]);

    $response = $this->get(route('attendance.mark'));

    $response->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('attendance/mark')
            ->where('holidayContext.mode', HolidayBreakService::MODE_PUBLIC_HOLIDAY)
            ->where('holidayContext.attendance_required', false));
});

it('classifies report labels for holiday and break duty outcomes', function () {
    $service = app(HolidayBreakService::class);

    expect($service->reportStatusLabel(null, null, HolidayBreakService::DAY_PUBLIC_HOLIDAY))->toBe('Holiday')
        ->and($service->reportStatusLabel(null, null, HolidayBreakService::DAY_UNIVERSITY_BREAK))->toBe('University Break')
        ->and($service->reportStatusLabel('absent', AttendanceExceptionCategory::BREAK_DUTY, HolidayBreakService::DAY_BREAK_DUTY_REQUIRED))->toBe('Break Duty Absent')
        ->and($service->reportStatusLabel('completed', AttendanceExceptionCategory::BREAK_DUTY, HolidayBreakService::DAY_BREAK_DUTY_REQUIRED))->toBe('Break Duty Present')
        ->and($service->reportStatusLabel('absent', AttendanceExceptionCategory::UNEXCUSED_ABSENCE, HolidayBreakService::DAY_NORMAL))->toBe('Absent');
});
