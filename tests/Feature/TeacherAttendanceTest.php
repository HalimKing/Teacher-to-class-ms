<?php

use App\Models\AcademicYear;
use App\Models\ClassRoom;
use App\Models\Course;
use App\Models\Program;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\Teacher;
use App\Models\TimeTable;
use App\Models\TeacherAttendance;
use Carbon\Carbon;

beforeEach(function () {
    // Create minimal domain data
    $this->faculty = Faculty::create(['name' => 'Test Faculty']);
    $this->department = Department::create(['name' => 'Test Dept', 'faculty_id' => $this->faculty->id]);

    $this->teacher = Teacher::create([
        'first_name' => 'John',
        'last_name' => 'Doe',
        'email' => 'teacher@example.com',
        'phone' => '1234567890',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'EMP123',
        'title' => 'Mr.',
    ]);

    $this->academicYear = AcademicYear::create(['name' => '2025/2026', 'status' => 'active']);

    $this->classroom = ClassRoom::factory()->create();

    $this->program = Program::create([
        'name' => 'Test Program',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
    ]);

    $this->course = Course::create([
        'course_code' => 'C-101',
        'name' => 'Test Course',
        'program_id' => $this->program->id,
        'teacher_id' => $this->teacher->id,
        'student_size' => 30,
    ]);
});

it('allows a teacher to check in successfully', function () {
    // timetable that started 30 minutes ago and ends in 1 minute
    $start = Carbon::now()->subMinutes(30)->format('H:i:s');
    $end = Carbon::now()->addMinutes(1)->format('H:i:s');

    $timetable = TimeTable::create([
        'academic_year_id' => $this->academicYear->id,
        'course_id' => $this->course->id,
        'class_room_id' => $this->classroom->id,
        'day' => Carbon::now()->format('l'),
        'start_time' => $start,
        'end_time' => $end,
    ]);

    $payload = [
        'coordinates' => ['latitude' => 1.2345, 'longitude' => 2.3456, 'accuracy' => 5],
        'course_id' => $this->course->id,
        'course_name' => $this->course->name,
        'class_room' => $this->classroom->name,
        'timetable_id' => $timetable->id,
        'check_in_time' => Carbon::now()->toDateTimeString(),
        'lateCheckInMinute' => 120,
        'distance' => 10,
        'within_range' => true,
    ];

    $response = $this->actingAs($this->teacher, 'teacher')
        ->postJson('/teacher/attendance/check-in', $payload);

    if ($response->status() !== 200) {
        fwrite(STDERR, "CHECK-IN RESPONSE:\n" . $response->getContent() . "\n");
    }

    $response->assertStatus(200)
        ->assertJson(['success' => true]);

    $this->assertDatabaseHas('teacher_attendances', [
        'teacher_id' => $this->teacher->id,
        'timetable_id' => $timetable->id,
        'course_id' => $this->course->id,
        'date' => Carbon::now()->format('Y-m-d'),
    ]);
});

it('allows a teacher to check out successfully after class end', function () {
    // timetable that started 60 minutes ago and ended 1 minute ago
    $start = Carbon::now()->subMinutes(60)->format('H:i:s');
    $end = Carbon::now()->subMinutes(1)->format('H:i:s');

    $timetable = TimeTable::create([
        'academic_year_id' => $this->academicYear->id,
        'course_id' => $this->course->id,
        'class_room_id' => $this->classroom->id,
        'day' => Carbon::now()->format('l'),
        'start_time' => $start,
        'end_time' => $end,
    ]);

    // Create an attendance record (checked-in)
    $attendance = TeacherAttendance::create([
        'classroom_id' => $this->classroom->id,
        'teacher_id' => $this->teacher->id,
        'course_id' => $this->course->id,
        'timetable_id' => $timetable->id,
        'academic_year_id' => $this->academicYear->id,
        'date' => Carbon::now()->format('Y-m-d'),
        'check_in_time' => Carbon::now()->subMinutes(30)->format('h:i A'),
        'check_in_latitude' => 1.2345,
        'check_in_longitude' => 2.3456,
        'check_in_distance' => 10,
        'check_in_within_range' => true,
        'status' => 'pending',
    ]);

    $payload = [
        'attendance_id' => $attendance->id,
        'check_out_time' => Carbon::now()->toDateTimeString(),
        'coordinates' => ['latitude' => 1.2345, 'longitude' => 2.3456, 'accuracy' => 5],
        'distance' => 5,
        'within_range' => true,
    ];

    $this->actingAs($this->teacher, 'teacher')
        ->postJson('/teacher/attendance/check-out', $payload)
        ->assertStatus(200)
        ->assertJson(['success' => true]);

    $this->assertDatabaseHas('teacher_attendances', [
        'id' => $attendance->id,
        'check_out_within_range' => true,
    ]);
});
