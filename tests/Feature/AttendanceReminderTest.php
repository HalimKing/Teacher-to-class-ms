<?php

use App\Models\AcademicYear;
use App\Models\AttendanceReminder;
use App\Models\AttendanceReminderDispatch;
use App\Models\ClassRoom;
use App\Models\Course;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\HolidayBreak;
use App\Models\Program;
use App\Models\SystemSetting;
use App\Models\Teacher;
use App\Models\StaffAttendance;
use App\Models\TimeTable;
use App\Models\User;
use App\Notifications\LecturerAlertNotification;
use App\Services\AttendanceReminderService;
use Carbon\Carbon;
use Illuminate\Support\Facades\Notification;

beforeEach(function () {
    Carbon::setTestNow(Carbon::parse('2026-11-16 08:30:00', config('app.timezone')));
    config(['services.sms.driver' => 'log']);

    SystemSetting::query()->updateOrCreate(
        ['key' => 'max_reminders_per_administrator'],
        ['value' => '5', 'group' => 'attendance', 'type' => 'integer', 'description' => 'Reminder limit'],
    );
    SystemSetting::query()->updateOrCreate(
        ['key' => 'checkout_grace_period_minutes'],
        ['value' => '180', 'group' => 'attendance', 'type' => 'integer', 'description' => 'Grace'],
    );
    SystemSetting::clearCache();

    $this->faculty = Faculty::create(['name' => 'Reminder Faculty']);
    $this->department = Department::create(['name' => 'Reminder Dept', 'faculty_id' => $this->faculty->id]);
    $this->admin = User::factory()->create();

    $this->teacher = Teacher::create([
        'first_name' => 'Ama',
        'last_name' => 'Mensah',
        'email' => 'ama@example.com',
        'phone' => '0200000000',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'EMP-REM-1',
        'title' => 'Dr.',
        'staff_type' => Teacher::STAFF_TYPE_ADMINISTRATOR,
    ]);

    $this->academicYear = AcademicYear::create(['name' => '2026/2027', 'status' => 'active']);
    $this->classroom = ClassRoom::factory()->create();
    $this->program = Program::create([
        'name' => 'Reminder Program',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
    ]);
    $this->course = Course::create([
        'course_code' => 'REM-101',
        'name' => 'Reminder Course',
        'program_id' => $this->program->id,
        'teacher_id' => $this->teacher->id,
        'student_size' => 20,
    ]);
});

afterEach(function () {
    Carbon::setTestNow();
});

function reminderTimetable(string $start, string $end, ?int $teacherId = null): TimeTable
{
    return TimeTable::create([
        'academic_year_id' => test()->academicYear->id,
        'course_id' => test()->course->id,
        'class_room_id' => test()->classroom->id,
        'teacher_id' => $teacherId ?? test()->teacher->id,
        'staff_type' => Teacher::STAFF_TYPE_ADMINISTRATOR,
        'day' => 'Monday',
        'day_of_week' => 'Monday',
        'start_time' => $start,
        'end_time' => $end,
    ]);
}

function makeReminder(array $overrides = []): AttendanceReminder
{
    $timetableIds = $overrides['timetable_ids'] ?? TimeTable::query()
        ->where('teacher_id', test()->teacher->id)
        ->pluck('id')
        ->all();
    unset($overrides['timetable_ids']);

    $reminder = AttendanceReminder::query()->create(array_merge([
        'teacher_id' => test()->teacher->id,
        'title' => 'Monday Check-in Reminder',
        'type' => AttendanceReminder::TYPE_CHECK_IN,
        'days' => [],
        'trigger' => AttendanceReminder::TRIGGER_AFTER_START,
        'offset_minutes' => 30,
        'send_via' => AttendanceReminder::VIA_BOTH,
        'recipient_scope' => AttendanceReminder::SCOPE_SELF,
        'is_active' => true,
    ], $overrides));

    app(AttendanceReminderService::class)->syncSchedules($reminder, $timetableIds);

    return $reminder->fresh();
}

it('repeats a monday check-in reminder from the timetable without an expiry date', function () {
    Notification::fake();
    reminderTimetable('08:00:00', '10:00:00');
    $reminder = makeReminder();

    expect(app(AttendanceReminderService::class)->processDue(now()))->toBe(1);

    Notification::assertSentTo($this->teacher, LecturerAlertNotification::class);
    expect(AttendanceReminderDispatch::query()->count())->toBe(1)
        ->and($reminder->fresh()->is_active)->toBeTrue();
});

it('does not remind an administrator who has already checked in', function () {
    Notification::fake();
    $timetable = reminderTimetable('08:00:00', '10:00:00');
    StaffAttendance::create([
        'staff_id' => $this->teacher->id,
        'timetable_id' => $timetable->id,
        'classroom_id' => $this->classroom->id,
        'academic_year_id' => $this->academicYear->id,
        'date' => '2026-11-16',
        'check_in_time' => '08:05:00',
        'attendance_status' => 'checked_in',
    ]);
    makeReminder();

    expect(app(AttendanceReminderService::class)->processDue(now()))->toBe(0);
    Notification::assertNothingSent();
});

it('sends a check-out reminder 15 minutes before the session ends and 30 minutes after it ends', function () {
    Notification::fake();
    reminderTimetable('08:00:00', '08:45:00');
    makeReminder([
        'title' => 'Before end',
        'type' => AttendanceReminder::TYPE_CHECK_OUT,
        'trigger' => AttendanceReminder::TRIGGER_BEFORE_END,
        'offset_minutes' => 15,
    ]);

    expect(app(AttendanceReminderService::class)->processDue(now()))->toBe(1);

    Notification::fake();
    Carbon::setTestNow(Carbon::parse('2026-11-16 09:15:00', config('app.timezone')));
    makeReminder([
        'title' => 'After end',
        'type' => AttendanceReminder::TYPE_CHECK_OUT,
        'trigger' => AttendanceReminder::TRIGGER_AFTER_END,
        'offset_minutes' => 30,
    ]);

    expect(app(AttendanceReminderService::class)->processDue(now()))->toBe(1);
});

it('evaluates every session on the same day and does not notify staff without a session', function () {
    Notification::fake();
    reminderTimetable('08:00:00', '10:00:00');
    reminderTimetable('08:00:00', '11:00:00');
    $other = Teacher::create([
        'first_name' => 'Kojo',
        'last_name' => 'Boateng',
        'email' => 'kojo@example.com',
        'phone' => '0200000001',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'EMP-REM-2',
        'title' => 'Mr.',
        'staff_type' => Teacher::STAFF_TYPE_ADMINISTRATOR,
    ]);
    makeReminder();
    reminderTimetable('08:00:00', '12:00:00');

    expect(app(AttendanceReminderService::class)->processDue(now()))->toBe(2);
    Notification::assertSentTo($this->teacher, LecturerAlertNotification::class);
    Notification::assertNotSentTo($other, LecturerAlertNotification::class);
});

it('does not send reminders on a holiday or after the reminder is disabled or deleted', function () {
    Notification::fake();
    reminderTimetable('08:00:00', '10:00:00');
    HolidayBreak::create([
        'name' => 'Founders Day',
        'type' => 'public_holiday',
        'start_date' => '2026-11-16',
        'end_date' => '2026-11-16',
        'status' => 'active',
        'coverage_type' => 'all_staff',
        'created_by' => $this->admin->id,
    ]);
    $reminder = makeReminder();

    expect(app(AttendanceReminderService::class)->processDue(now()))->toBe(0);

    HolidayBreak::query()->delete();
    $reminder->update(['is_active' => false]);
    expect(app(AttendanceReminderService::class)->processDue(now()))->toBe(0);

    $reminder->update(['is_active' => true]);
    $reminder->delete();
    expect(app(AttendanceReminderService::class)->processDue(now()))->toBe(0);
});

it('does not send a duplicate notification for the same session', function () {
    Notification::fake();
    reminderTimetable('08:00:00', '10:00:00');
    makeReminder();
    $service = app(AttendanceReminderService::class);

    expect($service->processDue(now()))->toBe(1)
        ->and($service->processDue(now()))->toBe(0)
        ->and(AttendanceReminderDispatch::query()->count())->toBe(1);
});

it('limits reminders per administrator without deleting existing ones when the limit drops', function () {
    SystemSetting::setValue('max_reminders_per_administrator', 1);
    $payload = [
        'title' => 'First',
        'type' => 'check_in',
        'days' => ['Monday'],
        'trigger' => 'after_start',
        'offset_minutes' => 30,
        'send_via' => 'both',
        'timetable_ids' => [reminderTimetable('08:00:00', '10:00:00')->id],
        'message' => null,
        'is_active' => true,
    ];

    $this->actingAs($this->teacher, 'teacher')
        ->post(route('teacher.attendance-reminders.store'), $payload)
        ->assertRedirect(route('teacher.attendance-reminders.index'));

    $this->actingAs($this->teacher, 'teacher')
        ->post(route('teacher.attendance-reminders.store'), [...$payload, 'title' => 'Second'])
        ->assertForbidden();

    $other = Teacher::create([
        'first_name' => 'Kojo',
        'last_name' => 'Boateng',
        'email' => 'kojo-limit@example.com',
        'phone' => '0200000002',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'EMP-REM-3',
        'title' => 'Mr.',
        'staff_type' => Teacher::STAFF_TYPE_ADMINISTRATOR,
    ]);

    $this->actingAs($other, 'teacher')
        ->post(route('teacher.attendance-reminders.store'), [...$payload, 'title' => 'Not mine'])
        ->assertSessionHasErrors('timetable_ids');

    $ownSchedule = reminderTimetable('08:00:00', '10:00:00', $other->id);
    $this->actingAs($other, 'teacher')
        ->post(route('teacher.attendance-reminders.store'), [...$payload, 'title' => 'Other staff', 'timetable_ids' => [$ownSchedule->id]])
        ->assertRedirect(route('teacher.attendance-reminders.index'));

    expect(AttendanceReminder::query()->count())->toBe(2)
        ->and(AttendanceReminder::query()->where('title', 'Other staff')->value('teacher_id'))->toBe($other->id);

    $this->actingAs($this->teacher, 'teacher')
        ->put(route('teacher.attendance-reminders.update', AttendanceReminder::query()->where('title', 'First')->first()), [
            ...$payload,
            'title' => 'First updated',
        ])
        ->assertRedirect(route('teacher.attendance-reminders.index'));
});

it('stops another administrator from editing a reminder they do not own', function () {
    $reminder = makeReminder();
    $other = Teacher::create([
        'first_name' => 'Abena',
        'last_name' => 'Owusu',
        'email' => 'abena@example.com',
        'phone' => '0200000003',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'EMP-REM-4',
        'title' => 'Mrs.',
        'staff_type' => Teacher::STAFF_TYPE_ADMINISTRATOR,
    ]);

    $this->actingAs($other, 'teacher')
        ->put(route('teacher.attendance-reminders.update', $reminder), [
            'title' => 'Taken over',
            'type' => 'check_in',
            'days' => ['Monday'],
            'trigger' => 'after_start',
            'offset_minutes' => 30,
            'send_via' => 'mail',
            'timetable_ids' => [$reminder->targets()->value('target_id')],
            'is_active' => true,
        ])
        ->assertForbidden();
});

it('does not let a lecturer or a portal admin create a reminder for someone else', function () {
    $lecturer = Teacher::create([
        'first_name' => 'Yaw',
        'last_name' => 'Mensah',
        'email' => 'yaw@example.com',
        'phone' => '0200000004',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'EMP-REM-5',
        'title' => 'Mr.',
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
    ]);

    $this->actingAs($lecturer, 'teacher')
        ->get(route('teacher.attendance-reminders.index'))
        ->assertForbidden();

    $this->actingAs($this->admin)
        ->get('/admin/reminders')
        ->assertNotFound();
});

it('sends the reminder by email, sms, or both', function () {
    Notification::fake();
    reminderTimetable('08:00:00', '10:00:00');

    makeReminder(['title' => 'Email only', 'send_via' => AttendanceReminder::VIA_MAIL]);
    expect(app(AttendanceReminderService::class)->processDue(now()))->toBe(1);
    expect(AttendanceReminderDispatch::query()->where('channel', 'database,mail')->count())->toBe(1);

    Notification::fake();
    Carbon::setTestNow(Carbon::parse('2026-11-16 08:32:00', config('app.timezone')));
    makeReminder(['title' => 'Text only', 'send_via' => AttendanceReminder::VIA_SMS, 'offset_minutes' => 32]);
    expect(app(AttendanceReminderService::class)->processDue(now()))->toBe(1);
    expect(AttendanceReminderDispatch::query()->where('channel', 'database,sms')->count())->toBe(1);
});

it('records a failed delivery when notification sending throws', function () {
    reminderTimetable('08:00:00', '10:00:00');
    makeReminder(['send_via' => AttendanceReminder::VIA_MAIL]);

    Notification::shouldReceive('send')->andThrow(new RuntimeException('smtp down'));

    expect(fn () => app(AttendanceReminderService::class)->processDue(now()))
        ->toThrow(RuntimeException::class, 'smtp down');

    $dispatch = AttendanceReminderDispatch::query()->first();
    expect($dispatch->status)->toBe(AttendanceReminderDispatch::STATUS_FAILED)
        ->and($dispatch->failure_reason)->toContain('smtp down');
});
