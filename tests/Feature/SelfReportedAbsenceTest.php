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
use App\Models\SelfReportedAbsenceReply;
use App\Notifications\SelfReportedAbsenceReplyPosted;
use App\Notifications\SelfReportedAbsenceSubmitted;
use App\Services\AttendanceExplanationService;
use App\Services\AttendanceProcessorService;
use App\Support\AttendanceExceptionCategory;
use App\Support\AttendanceLock;
use App\Support\AttendanceRecordSource;
use App\Support\LeadershipAssignment;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;

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

    $this->now = Carbon::parse('2026-06-12 08:30:00');
    Carbon::setTestNow($this->now);

    $this->faculty = Faculty::create(['name' => 'Self Report Faculty']);
    $this->otherFaculty = Faculty::create(['name' => 'Other Faculty']);
    $this->department = Department::create([
        'name' => 'Self Report Dept',
        'faculty_id' => $this->faculty->id,
    ]);
    $this->otherDepartment = Department::create([
        'name' => 'Other Dept',
        'faculty_id' => $this->otherFaculty->id,
    ]);
    $this->academicYear = AcademicYear::create(['name' => '2026/2027 Self Report', 'status' => 'active']);
    $this->classroom = ClassRoom::factory()->create();
    $this->program = Program::create([
        'name' => 'Self Report Program',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
    ]);

    $this->lecturer = Teacher::create([
        'first_name' => 'Amina',
        'last_name' => 'Lecturer',
        'email' => 'self-lecturer-'.uniqid().'@example.com',
        'phone' => '1111111111',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'SRL'.uniqid(),
        'title' => 'Dr.',
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
    ]);

    $this->administrator = Teacher::create([
        'first_name' => 'Kojo',
        'last_name' => 'Admin',
        'email' => 'self-admin-'.uniqid().'@example.com',
        'phone' => '2222222222',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'SRA'.uniqid(),
        'title' => 'Mr.',
        'staff_type' => Teacher::STAFF_TYPE_ADMINISTRATOR,
    ]);

    $this->dean = Teacher::create([
        'first_name' => 'Efua',
        'last_name' => 'Dean',
        'email' => 'self-dean-'.uniqid().'@example.com',
        'phone' => '3333333333',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'SRD'.uniqid(),
        'title' => 'Prof.',
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'leadership_role' => LeadershipAssignment::DIRECTOR_DEAN,
        'leadership_faculty_id' => $this->faculty->id,
    ]);

    $this->hod = Teacher::create([
        'first_name' => 'Yaw',
        'last_name' => 'Head',
        'email' => 'self-hod-'.uniqid().'@example.com',
        'phone' => '4444444444',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'SRH'.uniqid(),
        'title' => 'Dr.',
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'leadership_role' => LeadershipAssignment::HEAD_OF_DEPARTMENT,
        'leadership_faculty_id' => $this->faculty->id,
        'leadership_department_id' => $this->department->id,
    ]);

    $this->otherDean = Teacher::create([
        'first_name' => 'Outside',
        'last_name' => 'Dean',
        'email' => 'other-dean-'.uniqid().'@example.com',
        'phone' => '5555555555',
        'faculty_id' => $this->otherFaculty->id,
        'department_id' => $this->otherDepartment->id,
        'employee_id' => 'SRO'.uniqid(),
        'title' => 'Prof.',
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'leadership_role' => LeadershipAssignment::DIRECTOR_DEAN,
        'leadership_faculty_id' => $this->otherFaculty->id,
    ]);

    $this->course = Course::create([
        'course_code' => 'SRA-101',
        'name' => 'Self Report Course',
        'program_id' => $this->program->id,
        'teacher_id' => $this->lecturer->id,
        'student_size' => 20,
    ]);

    $this->lecturerTimetable = TimeTable::create([
        'academic_year_id' => $this->academicYear->id,
        'course_id' => $this->course->id,
        'class_room_id' => $this->classroom->id,
        'teacher_id' => $this->lecturer->id,
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'day' => $this->now->format('l'),
        'day_of_week' => $this->now->format('l'),
        'start_time' => '08:00:00',
        'end_time' => '10:00:00',
    ]);

    $this->staffTimetable = TimeTable::create([
        'academic_year_id' => $this->academicYear->id,
        'class_room_id' => $this->classroom->id,
        'teacher_id' => $this->administrator->id,
        'staff_type' => Teacher::STAFF_TYPE_ADMINISTRATOR,
        'day' => $this->now->format('l'),
        'day_of_week' => $this->now->format('l'),
        'start_time' => '08:00:00',
        'end_time' => '16:00:00',
    ]);
});

afterEach(function () {
    Carbon::setTestNow();
});

it('lets a lecturer self-report absence, lock the session, and notify assigned supervisors', function () {
    Notification::fake();

    $this->actingAs($this->lecturer, 'teacher')
        ->get(route('teacher.attendance.mark-absent.create', $this->lecturerTimetable))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('teacher/self-reported-absence/create')
            ->where('session.timetable_id', $this->lecturerTimetable->id)
            ->where('session.staff.name', 'Dr. Amina Lecturer')
        );

    $this->actingAs($this->lecturer, 'teacher')
        ->post(route('teacher.attendance.mark-absent.store'), [
            'timetable_id' => $this->lecturerTimetable->id,
            'reason' => 'I have an official faculty meeting that overlaps this lecture.',
            'notes' => 'The meeting was scheduled by the registry.',
        ])
        ->assertRedirect(route('teacher.attendance'))
        ->assertSessionHas('success');

    $attendance = TeacherAttendance::query()
        ->where('teacher_id', $this->lecturer->id)
        ->where('timetable_id', $this->lecturerTimetable->id)
        ->first();

    expect($attendance)->not->toBeNull()
        ->and($attendance->status)->toBe('absent')
        ->and($attendance->self_reported)->toBeTrue()
        ->and($attendance->self_reported_reason)->toContain('official faculty meeting')
        ->and($attendance->attendance_source)->toBe(AttendanceRecordSource::SELF_REPORTED)
        ->and($attendance->auto_generated)->toBeFalse()
        ->and($attendance->exception_category)->toBe(AttendanceExceptionCategory::SELF_REPORTED_ABSENCE);

    $list = $this->actingAs($this->lecturer, 'teacher')
        ->getJson('/teacher/attendance/todays-classes')
        ->assertOk();

    $session = collect($list->json('data'))->firstWhere('timetable_id', $this->lecturerTimetable->id);

    expect($session['can_self_report_absence'])->toBeFalse()
        ->and($session['self_reported'])->toBeTrue()
        ->and($session['is_missed'])->toBeTrue()
        ->and($session['can_take_attendance'])->toBeFalse();

    $this->actingAs($this->lecturer, 'teacher')
        ->postJson('/teacher/attendance/check-in', [
            'coordinates' => ['latitude' => 1.2345, 'longitude' => 2.3456, 'accuracy' => 5],
            'course_id' => $this->course->id,
            'course_name' => $this->course->name,
            'class_room' => $this->classroom->name,
            'timetable_id' => $this->lecturerTimetable->id,
            'check_in_time' => now()->toDateTimeString(),
            'distance' => 10,
            'within_range' => true,
        ])
        ->assertStatus(422)
        ->assertJson(AttendanceLock::blockedPayload());

    expect($attendance->fresh()->status)->toBe('absent')
        ->and($attendance->fresh()->check_in_time)->toBeNull();

    Notification::assertSentTo($this->dean, SelfReportedAbsenceSubmitted::class);
    Notification::assertSentTo($this->hod, SelfReportedAbsenceSubmitted::class);
    Notification::assertSentTimes(SelfReportedAbsenceSubmitted::class, 2);
});

it('lets an administrator self-report absence for the assigned shift', function () {
    Notification::fake();

    $this->actingAs($this->administrator, 'teacher')
        ->post(route('teacher.staff-attendance.mark-absent.store'), [
            'timetable_id' => $this->staffTimetable->id,
            'reason' => 'I will be off campus for a required administrative workshop.',
        ])
        ->assertRedirect(route('teacher.staff-attendance'));

    $attendance = StaffAttendance::query()
        ->where('staff_id', $this->administrator->id)
        ->where('timetable_id', $this->staffTimetable->id)
        ->first();

    expect($attendance)->not->toBeNull()
        ->and($attendance->attendance_status)->toBe('absent')
        ->and($attendance->self_reported)->toBeTrue()
        ->and($attendance->attendance_source)->toBe(AttendanceRecordSource::SELF_REPORTED);

    $this->actingAs($this->administrator, 'teacher')
        ->postJson('/teacher/staff-attendance/check-in', [
            'timetable_id' => $this->staffTimetable->id,
            'check_in_time' => now()->toDateTimeString(),
            'coordinates' => ['latitude' => 1.2345, 'longitude' => 2.3456, 'accuracy' => 5],
            'distance' => 10,
            'within_range' => true,
        ])
        ->assertStatus(422)
        ->assertJson(AttendanceLock::blockedPayload());

    Notification::assertSentTo([$this->dean, $this->hod], SelfReportedAbsenceSubmitted::class);
});

it('lets the director and head of department view the absence reason in their unit only', function () {
    $attendance = TeacherAttendance::create([
        'teacher_id' => $this->lecturer->id,
        'timetable_id' => $this->lecturerTimetable->id,
        'course_id' => $this->course->id,
        'classroom_id' => $this->classroom->id,
        'academic_year_id' => $this->academicYear->id,
        'date' => $this->now->toDateString(),
        'status' => 'absent',
        'self_reported' => true,
        'self_reported_reason' => 'Attending a required departmental briefing.',
        'self_reported_at' => $this->now,
        'attendance_source' => AttendanceRecordSource::SELF_REPORTED,
    ]);

    $this->actingAs($this->dean, 'teacher')
        ->get(route('teacher.unit.self-reported-absences.show', [
            'kind' => 'lecturer',
            'attendance' => $attendance->id,
        ]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('teacher/unit/self-reported-absence-show')
            ->where('record.reason', 'Attending a required departmental briefing.')
            ->where('record.staff_name', 'Dr. Amina Lecturer')
            ->where('canReply', true)
            ->has('record.replies', 0)
        );

    $this->actingAs($this->hod, 'teacher')
        ->get(route('teacher.unit.self-reported-absences.show', [
            'kind' => 'lecturer',
            'attendance' => $attendance->id,
        ]))
        ->assertOk();

    $this->actingAs($this->otherDean, 'teacher')
        ->get(route('teacher.unit.self-reported-absences.show', [
            'kind' => 'lecturer',
            'attendance' => $attendance->id,
        ]))
        ->assertForbidden();

    $this->actingAs($this->lecturer, 'teacher')
        ->get(route('teacher.unit.self-reported-absences.show', [
            'kind' => 'lecturer',
            'attendance' => $attendance->id,
        ]))
        ->assertForbidden();
});

it('still records the absence when no supervisor is assigned and does not claim a notification was sent', function () {
    Notification::fake();

    $orphanFaculty = Faculty::create(['name' => 'Unassigned Faculty']);
    $orphanDepartment = Department::create([
        'name' => 'Unassigned Dept',
        'faculty_id' => $orphanFaculty->id,
    ]);

    $this->lecturer->update([
        'faculty_id' => $orphanFaculty->id,
        'department_id' => $orphanDepartment->id,
    ]);

    $this->actingAs($this->lecturer, 'teacher')
        ->post(route('teacher.attendance.mark-absent.store'), [
            'timetable_id' => $this->lecturerTimetable->id,
            'reason' => 'Family emergency requiring me to stay off campus today.',
        ])
        ->assertRedirect(route('teacher.attendance'))
        ->assertSessionHas('success', function (string $message) {
            return str_contains($message, 'marked absent')
                && str_contains($message, 'skipped')
                && ! str_contains(strtolower($message), 'delivered');
        });

    expect(TeacherAttendance::query()->where('teacher_id', $this->lecturer->id)->where('self_reported', true)->exists())->toBeTrue();

    Notification::assertNothingSent();
});

it('rejects self-reporting after check-in, automatic absence, or a duplicate submission', function () {
    TeacherAttendance::create([
        'teacher_id' => $this->lecturer->id,
        'timetable_id' => $this->lecturerTimetable->id,
        'course_id' => $this->course->id,
        'classroom_id' => $this->classroom->id,
        'academic_year_id' => $this->academicYear->id,
        'date' => $this->now->toDateString(),
        'status' => 'present',
        'check_in_time' => '08:05:00',
    ]);

    $this->actingAs($this->lecturer, 'teacher')
        ->post(route('teacher.attendance.mark-absent.store'), [
            'timetable_id' => $this->lecturerTimetable->id,
            'reason' => 'Trying to mark absent after already checking in today.',
        ])
        ->assertSessionHasErrors('session');

    $otherCourse = Course::create([
        'course_code' => 'SRA-102',
        'name' => 'Second Course',
        'program_id' => $this->program->id,
        'teacher_id' => $this->lecturer->id,
        'student_size' => 15,
    ]);
    $autoTimetable = TimeTable::create([
        'academic_year_id' => $this->academicYear->id,
        'course_id' => $otherCourse->id,
        'class_room_id' => $this->classroom->id,
        'teacher_id' => $this->lecturer->id,
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'day' => $this->now->format('l'),
        'day_of_week' => $this->now->format('l'),
        'start_time' => '11:00:00',
        'end_time' => '13:00:00',
    ]);

    TeacherAttendance::create([
        'teacher_id' => $this->lecturer->id,
        'timetable_id' => $autoTimetable->id,
        'course_id' => $otherCourse->id,
        'classroom_id' => $this->classroom->id,
        'academic_year_id' => $this->academicYear->id,
        'date' => $this->now->toDateString(),
        'status' => 'absent',
        'attendance_source' => AttendanceRecordSource::SYSTEM,
        'auto_generated' => true,
        'auto_absence_reason' => AttendanceRecordSource::REASON_SESSION_EXPIRED,
    ]);

    $this->actingAs($this->lecturer, 'teacher')
        ->from(route('teacher.attendance'))
        ->post(route('teacher.attendance.mark-absent.store'), [
            'timetable_id' => $autoTimetable->id,
            'reason' => 'Trying to self-report after automatic absence.',
        ])
        ->assertSessionHasErrors('session');

    $openTimetable = TimeTable::create([
        'academic_year_id' => $this->academicYear->id,
        'course_id' => $otherCourse->id,
        'class_room_id' => $this->classroom->id,
        'teacher_id' => $this->lecturer->id,
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'day' => $this->now->format('l'),
        'day_of_week' => $this->now->format('l'),
        'start_time' => '14:00:00',
        'end_time' => '16:00:00',
    ]);

    $this->actingAs($this->lecturer, 'teacher')
        ->post(route('teacher.attendance.mark-absent.store'), [
            'timetable_id' => $openTimetable->id,
            'reason' => 'First valid self-reported absence for this later session.',
        ])
        ->assertRedirect(route('teacher.attendance'));

    $this->actingAs($this->lecturer, 'teacher')
        ->post(route('teacher.attendance.mark-absent.store'), [
            'timetable_id' => $openTimetable->id,
            'reason' => 'Second attempt should be rejected as a duplicate.',
        ])
        ->assertSessionHasErrors('session');
});

it('does not let a staff member mark another person absent and keeps automatic absence processing intact', function () {
    Notification::fake();

    $this->actingAs($this->administrator, 'teacher')
        ->post(route('teacher.staff-attendance.mark-absent.store'), [
            'timetable_id' => $this->lecturerTimetable->id,
            'reason' => 'Attempting to mark a colleague absent without authorization.',
        ])
        ->assertForbidden();

    $this->actingAs($this->lecturer, 'teacher')
        ->post(route('teacher.attendance.mark-absent.store'), [
            'timetable_id' => $this->lecturerTimetable->id,
            'reason' => 'Confirmed illness, staying home for this lecture period.',
        ])
        ->assertRedirect(route('teacher.attendance'));

    $attendance = TeacherAttendance::query()
        ->where('teacher_id', $this->lecturer->id)
        ->where('timetable_id', $this->lecturerTimetable->id)
        ->first();

    Carbon::setTestNow(Carbon::parse('2026-06-12 10:31:00'));
    app(AttendanceProcessorService::class)->process(now());

    expect($attendance->fresh()->status)->toBe('absent')
        ->and($attendance->fresh()->self_reported)->toBeTrue()
        ->and($attendance->fresh()->attendance_source)->toBe(AttendanceRecordSource::SELF_REPORTED)
        ->and($attendance->fresh()->auto_generated)->toBeFalse();
});

it('keeps the explanation module available for automatic absences and excludes self-reported ones', function () {
    $autoAbsence = StaffAttendance::create([
        'staff_id' => $this->administrator->id,
        'timetable_id' => $this->staffTimetable->id,
        'classroom_id' => $this->classroom->id,
        'academic_year_id' => $this->academicYear->id,
        'date' => $this->now->toDateString(),
        'attendance_status' => 'absent',
        'auto_generated' => true,
        'attendance_source' => AttendanceRecordSource::SYSTEM,
        'exception_category' => AttendanceExceptionCategory::UNEXCUSED_ABSENCE,
    ]);

    $otherStaffTimetable = TimeTable::create([
        'academic_year_id' => $this->academicYear->id,
        'class_room_id' => $this->classroom->id,
        'teacher_id' => $this->administrator->id,
        'staff_type' => Teacher::STAFF_TYPE_ADMINISTRATOR,
        'day' => $this->now->copy()->subDay()->format('l'),
        'day_of_week' => $this->now->copy()->subDay()->format('l'),
        'start_time' => '08:00:00',
        'end_time' => '16:00:00',
    ]);

    $selfReported = StaffAttendance::create([
        'staff_id' => $this->administrator->id,
        'timetable_id' => $otherStaffTimetable->id,
        'classroom_id' => $this->classroom->id,
        'academic_year_id' => $this->academicYear->id,
        'date' => $this->now->copy()->subDay()->toDateString(),
        'attendance_status' => 'absent',
        'self_reported' => true,
        'self_reported_reason' => 'Already explained through self-service absence.',
        'self_reported_at' => $this->now,
        'attendance_source' => AttendanceRecordSource::SELF_REPORTED,
        'exception_category' => AttendanceExceptionCategory::SELF_REPORTED_ABSENCE,
    ]);

    $this->actingAs($this->administrator, 'teacher')
        ->get('/teacher/attendance-explanations')
        ->assertOk()
        ->assertInertia(function ($page) use ($autoAbsence, $selfReported) {
            $page->component('teacher/attendance-explanations')->has('eligibleRecords');
            $ids = collect($page->toArray()['props']['eligibleRecords'] ?? [])->pluck('attendance_id');

            expect($ids->contains($autoAbsence->id))->toBeTrue()
                ->and($ids->contains($selfReported->id))->toBeFalse();
        });

    $service = app(AttendanceExplanationService::class);

    expect(fn () => $service->submit($this->administrator, [
        'attendance_type' => 'staff',
        'attendance_id' => $selfReported->id,
        'timetable_id' => $this->staffTimetable->id,
        'attendance_date' => $selfReported->date->toDateString(),
        'explanation_type' => 'absence',
        'reason_category' => 'sick_leave',
        'explanation' => 'This should be rejected because the absence was self-reported.',
    ]))->toThrow(InvalidArgumentException::class);
});

it('lets the director and head of department reply to an absence reason in their unit', function () {
    Notification::fake();

    $attendance = TeacherAttendance::create([
        'teacher_id' => $this->lecturer->id,
        'timetable_id' => $this->lecturerTimetable->id,
        'course_id' => $this->course->id,
        'classroom_id' => $this->classroom->id,
        'academic_year_id' => $this->academicYear->id,
        'date' => $this->now->toDateString(),
        'status' => 'absent',
        'self_reported' => true,
        'self_reported_reason' => 'Attending a required departmental briefing.',
        'self_reported_at' => $this->now,
        'attendance_source' => AttendanceRecordSource::SELF_REPORTED,
    ]);

    $this->actingAs($this->dean, 'teacher')
        ->post(route('teacher.unit.self-reported-absences.reply', [
            'kind' => 'lecturer',
            'attendance' => $attendance->id,
        ]), [
            'body' => 'Thank you for reporting this. Please share the briefing note with the department office.',
        ])
        ->assertRedirect()
        ->assertSessionHas('success');

    $this->actingAs($this->hod, 'teacher')
        ->post(route('teacher.unit.self-reported-absences.reply', [
            'kind' => 'lecturer',
            'attendance' => $attendance->id,
        ]), [
            'body' => 'Noted. We will cover the session with another lecturer.',
        ])
        ->assertRedirect();

    expect(SelfReportedAbsenceReply::query()->where('attendance_id', $attendance->id)->count())->toBe(2);

    $this->actingAs($this->dean, 'teacher')
        ->get(route('teacher.unit.self-reported-absences.show', [
            'kind' => 'lecturer',
            'attendance' => $attendance->id,
        ]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('record.replies', 2)
            ->where('record.replies.0.body', 'Thank you for reporting this. Please share the briefing note with the department office.')
            ->where('canReply', true)
        );

    $this->actingAs($this->lecturer, 'teacher')
        ->get(route('teacher.self-reported-absences.show', [
            'kind' => 'lecturer',
            'attendance' => $attendance->id,
        ]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('record.replies', 2)
            ->where('canReply', false)
        );

    Notification::assertSentTo($this->lecturer, SelfReportedAbsenceReplyPosted::class);
});

it('blocks unauthorized users from replying to a self-reported absence', function () {
    $attendance = TeacherAttendance::create([
        'teacher_id' => $this->lecturer->id,
        'timetable_id' => $this->lecturerTimetable->id,
        'course_id' => $this->course->id,
        'classroom_id' => $this->classroom->id,
        'academic_year_id' => $this->academicYear->id,
        'date' => $this->now->toDateString(),
        'status' => 'absent',
        'self_reported' => true,
        'self_reported_reason' => 'Attending a required departmental briefing.',
        'self_reported_at' => $this->now,
        'attendance_source' => AttendanceRecordSource::SELF_REPORTED,
    ]);

    $this->actingAs($this->otherDean, 'teacher')
        ->post(route('teacher.unit.self-reported-absences.reply', [
            'kind' => 'lecturer',
            'attendance' => $attendance->id,
        ]), [
            'body' => 'This supervisor is outside the assigned faculty and must be rejected.',
        ])
        ->assertForbidden();

    $this->actingAs($this->lecturer, 'teacher')
        ->post(route('teacher.unit.self-reported-absences.reply', [
            'kind' => 'lecturer',
            'attendance' => $attendance->id,
        ]), [
            'body' => 'Staff members should not reply through the leadership endpoint.',
        ])
        ->assertForbidden();

    $this->actingAs($this->otherDean, 'teacher')
        ->get(route('teacher.self-reported-absences.show', [
            'kind' => 'lecturer',
            'attendance' => $attendance->id,
        ]))
        ->assertForbidden();

    expect(SelfReportedAbsenceReply::query()->count())->toBe(0);
});
