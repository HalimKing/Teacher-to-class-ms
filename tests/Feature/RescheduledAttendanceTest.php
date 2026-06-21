<?php

use App\Models\AcademicYear;
use App\Models\ClassRoom;
use App\Models\Course;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\Program;
use App\Models\RescheduledSession;
use App\Models\SystemSetting;
use App\Models\Teacher;
use App\Models\TimeTable;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;

beforeEach(function () {
    Cache::forget('system_settings');

    SystemSetting::query()->updateOrCreate(
        ['key' => 'facial_recognition_enabled'],
        [
            'value' => '0',
            'group' => 'attendance',
            'type' => 'boolean',
            'description' => 'Facial recognition disabled for tests',
        ],
    );

    $this->faculty = Faculty::create(['name' => 'Test Faculty']);
    $this->department = Department::create(['name' => 'Test Dept', 'faculty_id' => $this->faculty->id]);

    $this->teacher = Teacher::create([
        'first_name' => 'John',
        'last_name' => 'Doe',
        'email' => 'teacher-reschedule@example.com',
        'phone' => '1234567890',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'EMP999',
        'title' => 'Mr.',
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
    ]);

    $this->academicYear = AcademicYear::create(['name' => '2025/2026', 'status' => 'active']);
    $this->originalClassroom = ClassRoom::factory()->create(['name' => 'Hall 1']);
    $this->newClassroom = ClassRoom::factory()->create(['name' => 'Hall 4']);

    $this->program = Program::create([
        'name' => 'Test Program',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
    ]);

    $this->course = Course::create([
        'course_code' => 'ECO-101',
        'name' => 'Economics',
        'program_id' => $this->program->id,
        'teacher_id' => $this->teacher->id,
        'student_size' => 30,
    ]);
});

it('blocks check-in on the original date when a session has been rescheduled', function () {
    $today = Carbon::now();
    $tomorrow = $today->copy()->addDay();

    $start = $today->copy()->setTime(8, 0)->format('H:i:s');
    $end = $today->copy()->setTime(10, 0)->format('H:i:s');

    $timetable = TimeTable::create([
        'academic_year_id' => $this->academicYear->id,
        'course_id' => $this->course->id,
        'class_room_id' => $this->originalClassroom->id,
        'teacher_id' => $this->teacher->id,
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'day' => $today->format('l'),
        'day_of_week' => $today->format('l'),
        'start_time' => $start,
        'end_time' => $end,
    ]);

    RescheduledSession::create([
        'timetable_id' => $timetable->id,
        'teacher_id' => $this->teacher->id,
        'classroom_id' => $this->newClassroom->id,
        'original_date' => $today->toDateString(),
        'original_start_time' => $start,
        'original_end_time' => $end,
        'new_date' => $tomorrow->toDateString(),
        'new_start_time' => '14:30:00',
        'new_end_time' => '17:30:00',
        'reason' => 'Public holiday overlap',
        'status' => RescheduledSession::STATUS_APPROVED,
    ]);

    $payload = [
        'coordinates' => ['latitude' => 1.2345, 'longitude' => 2.3456, 'accuracy' => 5],
        'course_id' => $this->course->id,
        'course_name' => $this->course->name,
        'class_room' => $this->originalClassroom->name,
        'timetable_id' => $timetable->id,
        'check_in_time' => $today->toDateTimeString(),
        'distance' => 10,
        'within_range' => true,
    ];

    $this->actingAs($this->teacher, 'teacher')
        ->postJson('/teacher/attendance/check-in', $payload)
        ->assertStatus(422)
        ->assertJson([
            'success' => false,
            'message' => 'Attendance is unavailable because this session has been rescheduled.',
            'state' => 'rescheduled_away',
        ]);

    $this->assertDatabaseMissing('teacher_attendances', [
        'teacher_id' => $this->teacher->id,
        'timetable_id' => $timetable->id,
        'date' => $today->toDateString(),
    ]);
});

it('blocks attendance when original_date was stored one week ahead by mistake', function () {
    $today = Carbon::parse('2026-06-17'); // Wednesday
    Carbon::setTestNow($today->copy()->setTime(20, 45));

    $start = '20:40:00';
    $end = '20:44:00';

    $timetable = TimeTable::create([
        'academic_year_id' => $this->academicYear->id,
        'course_id' => $this->course->id,
        'class_room_id' => $this->originalClassroom->id,
        'teacher_id' => $this->teacher->id,
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'day' => 'Wednesday',
        'day_of_week' => 'Wednesday',
        'start_time' => $start,
        'end_time' => $end,
    ]);

    RescheduledSession::create([
        'timetable_id' => $timetable->id,
        'teacher_id' => $this->teacher->id,
        'classroom_id' => $this->newClassroom->id,
        'original_date' => '2026-06-24',
        'original_start_time' => $start,
        'original_end_time' => $end,
        'new_date' => '2026-06-18',
        'new_start_time' => '14:30:00',
        'new_end_time' => '17:30:00',
        'status' => RescheduledSession::STATUS_APPROVED,
    ]);

    $response = $this->actingAs($this->teacher, 'teacher')
        ->getJson('/teacher/attendance/todays-classes');

    $response->assertOk();

    $session = collect($response->json('data'))
        ->firstWhere('timetable_id', $timetable->id);

    expect($session)->not->toBeNull()
        ->and($session['attendance_state'])->toBe('rescheduled_away')
        ->and($session['can_take_attendance'])->toBeFalse();

    Carbon::setTestNow();
});

it('includes rescheduled away sessions in todays classes with attendance disabled', function () {
    $today = Carbon::now();
    $tomorrow = $today->copy()->addDay();

    $start = $today->copy()->setTime(8, 0)->format('H:i:s');
    $end = $today->copy()->setTime(10, 0)->format('H:i:s');

    $timetable = TimeTable::create([
        'academic_year_id' => $this->academicYear->id,
        'course_id' => $this->course->id,
        'class_room_id' => $this->originalClassroom->id,
        'teacher_id' => $this->teacher->id,
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'day' => $today->format('l'),
        'day_of_week' => $today->format('l'),
        'start_time' => $start,
        'end_time' => $end,
    ]);

    RescheduledSession::create([
        'timetable_id' => $timetable->id,
        'teacher_id' => $this->teacher->id,
        'classroom_id' => $this->newClassroom->id,
        'original_date' => $today->toDateString(),
        'original_start_time' => $start,
        'original_end_time' => $end,
        'new_date' => $tomorrow->toDateString(),
        'new_start_time' => '14:30:00',
        'new_end_time' => '17:30:00',
        'status' => RescheduledSession::STATUS_APPROVED,
    ]);

    $response = $this->actingAs($this->teacher, 'teacher')
        ->getJson('/teacher/attendance/todays-classes');

    $response->assertOk()
        ->assertJsonPath('success', true);

    $session = collect($response->json('data'))
        ->firstWhere('timetable_id', $timetable->id);

    expect($session)->not->toBeNull()
        ->and($session['attendance_state'])->toBe('rescheduled_away')
        ->and($session['can_take_attendance'])->toBeFalse()
        ->and($session['reschedule']['new_venue'])->toBe('Hall 4');
});

it('marks auto-absent sessions as missed and blocks attendance actions', function () {
    $today = Carbon::now();
    $start = $today->copy()->setTime(8, 0)->format('H:i:s');
    $end = $today->copy()->setTime(10, 0)->format('H:i:s');

    $timetable = TimeTable::create([
        'academic_year_id' => $this->academicYear->id,
        'course_id' => $this->course->id,
        'class_room_id' => $this->originalClassroom->id,
        'teacher_id' => $this->teacher->id,
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'day' => $today->format('l'),
        'day_of_week' => $today->format('l'),
        'start_time' => $start,
        'end_time' => $end,
    ]);

    \App\Models\TeacherAttendance::create([
        'teacher_id' => $this->teacher->id,
        'timetable_id' => $timetable->id,
        'course_id' => $this->course->id,
        'classroom_id' => $this->originalClassroom->id,
        'academic_year_id' => $this->academicYear->id,
        'date' => $today->toDateString(),
        'status' => 'absent',
        'attendance_source' => 'system',
        'auto_generated' => true,
        'auto_generated_at' => now(),
        'auto_absence_reason' => 'session_expired',
    ]);

    $listResponse = $this->actingAs($this->teacher, 'teacher')
        ->getJson('/teacher/attendance/todays-classes');

    $listResponse->assertOk();

    $session = collect($listResponse->json('data'))
        ->firstWhere('timetable_id', $timetable->id);

    expect($session)->not->toBeNull()
        ->and($session['is_missed'])->toBeTrue()
        ->and($session['can_take_attendance'])->toBeFalse()
        ->and($session['attendance_state'])->toBe('missed');

    $this->actingAs($this->teacher, 'teacher')
        ->postJson('/teacher/attendance/check-in', [
            'coordinates' => ['latitude' => 1.2345, 'longitude' => 2.3456, 'accuracy' => 5],
            'course_id' => $this->course->id,
            'course_name' => $this->course->name,
            'class_room' => $this->originalClassroom->name,
            'timetable_id' => $timetable->id,
            'check_in_time' => $today->toDateTimeString(),
            'distance' => 10,
            'within_range' => true,
        ])
        ->assertStatus(422)
        ->assertJson([
            'success' => false,
            'state' => 'missed',
        ]);
});

it('allows a lecturer to reschedule when assigned on the timetable even if course teacher differs', function () {
    $otherTeacher = Teacher::create([
        'first_name' => 'Other',
        'last_name' => 'Lecturer',
        'email' => 'other-lecturer-' . uniqid() . '@example.com',
        'phone' => '1234567891',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'EMPOTHER' . uniqid(),
        'title' => 'Dr.',
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
    ]);

    $this->course->update(['teacher_id' => $otherTeacher->id]);

    $originalDate = Carbon::now()->addDays(3);
    $newDate = Carbon::now()->addDays(5);
    $start = '08:00:00';
    $end = '10:00:00';

    $timetable = TimeTable::create([
        'academic_year_id' => $this->academicYear->id,
        'course_id' => $this->course->id,
        'class_room_id' => $this->originalClassroom->id,
        'teacher_id' => $this->teacher->id,
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'day' => $originalDate->format('l'),
        'day_of_week' => $originalDate->format('l'),
        'start_time' => $start,
        'end_time' => $end,
    ]);

    $this->actingAs($this->teacher, 'teacher')
        ->post(route('teacher.reschedules.store'), [
            'timetable_id' => $timetable->id,
            'classroom_id' => $this->newClassroom->id,
            'original_date' => $originalDate->toDateString(),
            'original_start_time' => $start,
            'original_end_time' => $end,
            'new_date' => $newDate->toDateString(),
            'new_start_time' => '14:00:00',
            'new_end_time' => '16:00:00',
            'reason' => 'Department meeting',
        ])
        ->assertRedirect(route('teacher.timetable'))
        ->assertSessionHas('success');

    expect(RescheduledSession::query()->where('timetable_id', $timetable->id)->exists())->toBeTrue();
});

it('shows rescheduled session as active on the new date for cross-day reschedules', function () {
    $sunday = Carbon::parse('next Sunday')->startOfDay();
    $monday = $sunday->copy()->addDay();

    Carbon::setTestNow($monday->copy()->setTime(14, 0));

    $timetable = TimeTable::create([
        'academic_year_id' => $this->academicYear->id,
        'course_id' => $this->course->id,
        'class_room_id' => $this->originalClassroom->id,
        'teacher_id' => $this->teacher->id,
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'day' => 'Sunday',
        'day_of_week' => 'Sunday',
        'start_time' => '08:00:00',
        'end_time' => '10:00:00',
    ]);

    RescheduledSession::create([
        'timetable_id' => $timetable->id,
        'teacher_id' => $this->teacher->id,
        'classroom_id' => $this->newClassroom->id,
        'original_date' => $sunday->toDateString(),
        'original_start_time' => '08:00:00',
        'original_end_time' => '10:00:00',
        'new_date' => $monday->toDateString(),
        'new_start_time' => '14:30:00',
        'new_end_time' => '17:30:00',
        'status' => RescheduledSession::STATUS_APPROVED,
    ]);

    $response = $this->actingAs($this->teacher, 'teacher')
        ->getJson('/teacher/attendance/todays-classes');

    $response->assertOk();

    $session = collect($response->json('data'))
        ->firstWhere('timetable_id', $timetable->id);

    expect($session)->not->toBeNull()
        ->and($session['attendance_state'])->toBe('rescheduled_active')
        ->and($session['can_take_attendance'])->toBeTrue()
        ->and($session['start_time'])->toBe('14:30:00')
        ->and($session['end_time'])->toBe('17:30:00')
        ->and($session['building'])->toBe('Hall 4');

    Carbon::setTestNow();
});

it('allows check-in on the rescheduled date for cross-day reschedules', function () {
    $sunday = Carbon::parse('next Sunday')->startOfDay();
    $monday = $sunday->copy()->addDay();

    Carbon::setTestNow($monday->copy()->setTime(14, 35));

    $timetable = TimeTable::create([
        'academic_year_id' => $this->academicYear->id,
        'course_id' => $this->course->id,
        'class_room_id' => $this->originalClassroom->id,
        'teacher_id' => $this->teacher->id,
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'day' => 'Sunday',
        'day_of_week' => 'Sunday',
        'start_time' => '08:00:00',
        'end_time' => '10:00:00',
    ]);

    $reschedule = RescheduledSession::create([
        'timetable_id' => $timetable->id,
        'teacher_id' => $this->teacher->id,
        'classroom_id' => $this->newClassroom->id,
        'original_date' => $sunday->toDateString(),
        'original_start_time' => '08:00:00',
        'original_end_time' => '10:00:00',
        'new_date' => $monday->toDateString(),
        'new_start_time' => '14:30:00',
        'new_end_time' => '17:30:00',
        'status' => RescheduledSession::STATUS_APPROVED,
    ]);

    $this->actingAs($this->teacher, 'teacher')
        ->postJson('/teacher/attendance/check-in', [
            'coordinates' => ['latitude' => 1.2345, 'longitude' => 2.3456, 'accuracy' => 5],
            'course_id' => $this->course->id,
            'course_name' => $this->course->name,
            'class_room' => $this->newClassroom->name,
            'timetable_id' => $timetable->id,
            'check_in_time' => $monday->copy()->setTime(14, 35)->toDateTimeString(),
            'distance' => 10,
            'within_range' => true,
        ])
        ->assertOk()
        ->assertJson(['success' => true]);

    $this->assertDatabaseHas('teacher_attendances', [
        'teacher_id' => $this->teacher->id,
        'timetable_id' => $timetable->id,
        'rescheduled_session_id' => $reschedule->id,
    ]);

    expect(\App\Models\TeacherAttendance::query()
        ->where('teacher_id', $this->teacher->id)
        ->where('timetable_id', $timetable->id)
        ->whereDate('date', $monday->toDateString())
        ->exists())->toBeTrue();

    Carbon::setTestNow();
});

it('activates same-day reschedules once the rescheduled attendance window opens', function () {
    $today = Carbon::parse('2026-06-20'); // Saturday
    Carbon::setTestNow($today->copy()->setTime(15, 45));

    $timetable = TimeTable::create([
        'academic_year_id' => $this->academicYear->id,
        'course_id' => $this->course->id,
        'class_room_id' => $this->originalClassroom->id,
        'teacher_id' => $this->teacher->id,
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'day' => 'Saturday',
        'day_of_week' => 'Saturday',
        'start_time' => '15:20:00',
        'end_time' => '15:38:00',
    ]);

    RescheduledSession::create([
        'timetable_id' => $timetable->id,
        'teacher_id' => $this->teacher->id,
        'classroom_id' => $this->originalClassroom->id,
        'original_date' => $today->toDateString(),
        'original_start_time' => '15:20:00',
        'original_end_time' => '15:38:00',
        'new_date' => $today->toDateString(),
        'new_start_time' => '15:50:00',
        'new_end_time' => '16:00:00',
        'status' => RescheduledSession::STATUS_APPROVED,
    ]);

    $response = $this->actingAs($this->teacher, 'teacher')
        ->getJson('/teacher/attendance/todays-classes');

    $response->assertOk();

    $session = collect($response->json('data'))
        ->firstWhere('timetable_id', $timetable->id);

    expect($session)->not->toBeNull()
        ->and($session['attendance_state'])->toBe('rescheduled_active')
        ->and($session['can_take_attendance'])->toBeTrue()
        ->and($session['start_time'])->toBe('15:50:00')
        ->and($session['end_time'])->toBe('16:00:00');

    Carbon::setTestNow();
});

it('keeps same-day reschedules blocked before the rescheduled attendance window opens', function () {
    $today = Carbon::parse('2026-06-20'); // Saturday
    Carbon::setTestNow($today->copy()->setTime(15, 10));

    $timetable = TimeTable::create([
        'academic_year_id' => $this->academicYear->id,
        'course_id' => $this->course->id,
        'class_room_id' => $this->originalClassroom->id,
        'teacher_id' => $this->teacher->id,
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'day' => 'Saturday',
        'day_of_week' => 'Saturday',
        'start_time' => '15:20:00',
        'end_time' => '15:38:00',
    ]);

    RescheduledSession::create([
        'timetable_id' => $timetable->id,
        'teacher_id' => $this->teacher->id,
        'classroom_id' => $this->originalClassroom->id,
        'original_date' => $today->toDateString(),
        'original_start_time' => '15:20:00',
        'original_end_time' => '15:38:00',
        'new_date' => $today->toDateString(),
        'new_start_time' => '15:50:00',
        'new_end_time' => '16:00:00',
        'status' => RescheduledSession::STATUS_APPROVED,
    ]);

    $response = $this->actingAs($this->teacher, 'teacher')
        ->getJson('/teacher/attendance/todays-classes');

    $response->assertOk();

    $session = collect($response->json('data'))
        ->firstWhere('timetable_id', $timetable->id);

    expect($session)->not->toBeNull()
        ->and($session['attendance_state'])->toBe('rescheduled_away')
        ->and($session['can_take_attendance'])->toBeFalse();

    Carbon::setTestNow();
});

it('marks rescheduled sessions as missed when auto-absent was recorded without rescheduled_session_id', function () {
    $today = Carbon::parse('2026-06-20');
    Carbon::setTestNow($today->copy()->setTime(16, 10));

    $timetable = TimeTable::create([
        'academic_year_id' => $this->academicYear->id,
        'course_id' => $this->course->id,
        'class_room_id' => $this->originalClassroom->id,
        'teacher_id' => $this->teacher->id,
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'day' => 'Saturday',
        'day_of_week' => 'Saturday',
        'start_time' => '15:20:00',
        'end_time' => '15:38:00',
    ]);

    RescheduledSession::create([
        'timetable_id' => $timetable->id,
        'teacher_id' => $this->teacher->id,
        'classroom_id' => $this->originalClassroom->id,
        'original_date' => $today->toDateString(),
        'original_start_time' => '15:20:00',
        'original_end_time' => '15:38:00',
        'new_date' => $today->toDateString(),
        'new_start_time' => '15:50:00',
        'new_end_time' => '16:00:00',
        'status' => RescheduledSession::STATUS_APPROVED,
    ]);

    \App\Models\TeacherAttendance::create([
        'teacher_id' => $this->teacher->id,
        'timetable_id' => $timetable->id,
        'course_id' => $this->course->id,
        'classroom_id' => $this->originalClassroom->id,
        'academic_year_id' => $this->academicYear->id,
        'date' => $today->toDateString(),
        'status' => 'absent',
        'attendance_source' => 'system',
        'auto_generated' => true,
        'auto_generated_at' => $today->copy()->setTime(16, 5),
        'auto_absence_reason' => 'session_expired',
        'rescheduled_session_id' => null,
    ]);

    $response = $this->actingAs($this->teacher, 'teacher')
        ->getJson('/teacher/attendance/todays-classes');

    $response->assertOk();

    $session = collect($response->json('data'))
        ->firstWhere('timetable_id', $timetable->id);

    expect($session)->not->toBeNull()
        ->and($session['is_missed'])->toBeTrue()
        ->and($session['can_take_attendance'])->toBeFalse()
        ->and($session['attendance_state'])->toBe('missed');

    $this->actingAs($this->teacher, 'teacher')
        ->postJson('/teacher/attendance/check-in', [
            'coordinates' => ['latitude' => 1.2345, 'longitude' => 2.3456, 'accuracy' => 5],
            'course_id' => $this->course->id,
            'course_name' => $this->course->name,
            'class_room' => $this->originalClassroom->name,
            'timetable_id' => $timetable->id,
            'check_in_time' => $today->copy()->setTime(16, 10)->toDateTimeString(),
            'distance' => 10,
            'within_range' => true,
        ])
        ->assertStatus(422)
        ->assertJson([
            'success' => false,
            'state' => 'missed',
        ]);

    Carbon::setTestNow();
});

it('allows check-in to a fresh session when another session was auto-marked absent the same day', function () {
    $today = Carbon::parse('2026-06-20');
    Carbon::setTestNow($today->copy()->setTime(17, 40));

    $missedTimetable = TimeTable::create([
        'academic_year_id' => $this->academicYear->id,
        'course_id' => $this->course->id,
        'class_room_id' => $this->originalClassroom->id,
        'teacher_id' => $this->teacher->id,
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'day' => 'Saturday',
        'day_of_week' => 'Saturday',
        'start_time' => '15:20:00',
        'end_time' => '15:38:00',
    ]);

    $freshCourse = Course::create([
        'course_code' => 'ECO-102',
        'name' => 'Economics II',
        'program_id' => $this->program->id,
        'teacher_id' => $this->teacher->id,
        'student_size' => 25,
    ]);

    $freshTimetable = TimeTable::create([
        'academic_year_id' => $this->academicYear->id,
        'course_id' => $freshCourse->id,
        'class_room_id' => $this->newClassroom->id,
        'teacher_id' => $this->teacher->id,
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'day' => 'Saturday',
        'day_of_week' => 'Saturday',
        'start_time' => '17:30:00',
        'end_time' => '18:30:00',
    ]);

    \App\Models\TeacherAttendance::create([
        'teacher_id' => $this->teacher->id,
        'timetable_id' => $missedTimetable->id,
        'course_id' => $this->course->id,
        'classroom_id' => $this->originalClassroom->id,
        'academic_year_id' => $this->academicYear->id,
        'date' => $today->toDateString(),
        'status' => 'absent',
        'attendance_source' => 'system',
        'auto_generated' => true,
        'auto_generated_at' => $today->copy()->setTime(16, 5),
        'auto_absence_reason' => 'session_expired',
    ]);

    $this->actingAs($this->teacher, 'teacher')
        ->postJson('/teacher/attendance/check-in', [
            'coordinates' => ['latitude' => 1.2345, 'longitude' => 2.3456, 'accuracy' => 5],
            'course_id' => $freshCourse->id,
            'course_name' => $freshCourse->name,
            'class_room' => $this->newClassroom->name,
            'timetable_id' => $freshTimetable->id,
            'check_in_time' => $today->copy()->setTime(17, 40)->toDateTimeString(),
            'distance' => 10,
            'within_range' => true,
        ])
        ->assertOk()
        ->assertJson(['success' => true]);

    $this->assertDatabaseHas('teacher_attendances', [
        'teacher_id' => $this->teacher->id,
        'timetable_id' => $freshTimetable->id,
        'status' => 'pending',
    ]);

    Carbon::setTestNow();
});

it('allows check-out for an open rescheduled session check-in on the same day', function () {
    $today = Carbon::parse('2026-06-20');
    Carbon::setTestNow($today->copy()->setTime(15, 55));

    $timetable = TimeTable::create([
        'academic_year_id' => $this->academicYear->id,
        'course_id' => $this->course->id,
        'class_room_id' => $this->originalClassroom->id,
        'teacher_id' => $this->teacher->id,
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'day' => 'Saturday',
        'day_of_week' => 'Saturday',
        'start_time' => '15:20:00',
        'end_time' => '15:38:00',
    ]);

    $reschedule = RescheduledSession::create([
        'timetable_id' => $timetable->id,
        'teacher_id' => $this->teacher->id,
        'classroom_id' => $this->originalClassroom->id,
        'original_date' => $today->toDateString(),
        'original_start_time' => '15:20:00',
        'original_end_time' => '15:38:00',
        'new_date' => $today->toDateString(),
        'new_start_time' => '15:50:00',
        'new_end_time' => '16:00:00',
        'status' => RescheduledSession::STATUS_APPROVED,
    ]);

    $attendance = \App\Models\TeacherAttendance::create([
        'teacher_id' => $this->teacher->id,
        'timetable_id' => $timetable->id,
        'rescheduled_session_id' => $reschedule->id,
        'course_id' => $this->course->id,
        'classroom_id' => $this->originalClassroom->id,
        'academic_year_id' => $this->academicYear->id,
        'date' => $today->toDateString(),
        'check_in_time' => '15:52:00',
        'check_in_latitude' => 1.2345,
        'check_in_longitude' => 2.3456,
        'check_in_distance' => 10,
        'check_in_within_range' => true,
        'status' => 'pending',
    ]);

    $this->actingAs($this->teacher, 'teacher')
        ->postJson('/teacher/attendance/check-out', [
            'attendance_id' => $attendance->id,
            'check_out_time' => $today->copy()->setTime(15, 55)->toDateTimeString(),
            'coordinates' => ['latitude' => 1.2345, 'longitude' => 2.3456, 'accuracy' => 5],
            'distance' => 5,
            'within_range' => true,
        ])
        ->assertOk()
        ->assertJson([
            'success' => true,
            'departure' => ['category' => 'early_leave'],
        ]);

    expect($attendance->fresh()->check_out_time)->not->toBeNull();

    Carbon::setTestNow();
});
