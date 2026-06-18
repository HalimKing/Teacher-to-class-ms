<?php

use App\Models\AcademicYear;
use App\Models\ClassRoom;
use App\Models\Course;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\Program;
use App\Models\Teacher;
use App\Models\TeacherAttendance;
use App\Models\TimeTable;
use Carbon\Carbon;

beforeEach(function () {
    $this->faculty = Faculty::create(['name' => 'Reports Faculty']);
    $this->department = Department::create(['name' => 'Reports Dept', 'faculty_id' => $this->faculty->id]);

    $this->teacher = Teacher::create([
        'first_name' => 'Report',
        'last_name' => 'Lecturer',
        'email' => 'report-lecturer-' . uniqid() . '@example.com',
        'phone' => '1234567890',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'RL' . uniqid(),
        'title' => 'Mr.',
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
    ]);

    $this->otherTeacher = Teacher::create([
        'first_name' => 'Other',
        'last_name' => 'Lecturer',
        'email' => 'other-lecturer-' . uniqid() . '@example.com',
        'phone' => '1234567891',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'OL' . uniqid(),
        'title' => 'Ms.',
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
    ]);

    $this->academicYear = AcademicYear::create(['name' => '2025/2026', 'status' => 'active']);
    $this->classroom = ClassRoom::factory()->create();
    $this->program = Program::create([
        'name' => 'Reports Program',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
    ]);

    $this->course = Course::create([
        'course_code' => 'REP-101',
        'name' => 'Reporting Course',
        'program_id' => $this->program->id,
        'teacher_id' => $this->teacher->id,
        'student_size' => 30,
    ]);

    $this->timetable = TimeTable::create([
        'academic_year_id' => $this->academicYear->id,
        'course_id' => $this->course->id,
        'class_room_id' => $this->classroom->id,
        'teacher_id' => $this->teacher->id,
        'day' => Carbon::now()->format('l'),
        'start_time' => '09:00:00',
        'end_time' => '11:00:00',
    ]);

    $this->attendance = TeacherAttendance::create([
        'teacher_id' => $this->teacher->id,
        'course_id' => $this->course->id,
        'timetable_id' => $this->timetable->id,
        'classroom_id' => $this->classroom->id,
        'academic_year_id' => $this->academicYear->id,
        'date' => Carbon::now()->toDateString(),
        'check_in_time' => Carbon::now()->setTime(9, 5)->format('H:i:s'),
        'check_out_time' => Carbon::now()->setTime(10, 55)->format('H:i:s'),
        'status' => 'completed',
        'arrival_category' => 'on_time',
        'face_verified' => true,
        'check_in_within_range' => true,
    ]);
});

it('renders the lecturer analytics page', function () {
    $this->actingAs($this->teacher, 'teacher')
        ->get('/teacher/reports')
        ->assertOk();
});

it('returns dashboard analytics json for the authenticated lecturer', function () {
    $response = $this->actingAs($this->teacher, 'teacher')
        ->getJson('/teacher/reports/data?start_date=' . now()->subMonth()->toDateString() . '&end_date=' . now()->toDateString());

    $response->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonStructure([
            'data' => [
                'summaryCards',
                'analytics' => ['dailyTrend', 'weeklyTrend', 'monthlyTrend', 'verificationAnalytics'],
                'insights',
                'attendanceCalendar',
            ],
        ]);
});

it('returns paginated attendance records scoped to the authenticated lecturer', function () {
    TeacherAttendance::create([
        'teacher_id' => $this->otherTeacher->id,
        'course_id' => $this->course->id,
        'timetable_id' => $this->timetable->id,
        'classroom_id' => $this->classroom->id,
        'academic_year_id' => $this->academicYear->id,
        'date' => Carbon::now()->toDateString(),
        'status' => 'completed',
    ]);

    $response = $this->actingAs($this->teacher, 'teacher')
        ->getJson('/teacher/reports/records?start_date=' . now()->subMonth()->toDateString() . '&end_date=' . now()->toDateString());

    $response->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.total', 1);
});

it('returns session detail only for the authenticated lecturer records', function () {
    $this->actingAs($this->teacher, 'teacher')
        ->getJson('/teacher/reports/records/' . $this->attendance->id)
        ->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.record.id', $this->attendance->id);

    $this->actingAs($this->otherTeacher, 'teacher')
        ->getJson('/teacher/reports/records/' . $this->attendance->id)
        ->assertNotFound();
});

it('exports lecturer attendance as csv', function () {
    $response = $this->actingAs($this->teacher, 'teacher')
        ->get('/teacher/reports/export?format=csv&start_date=' . now()->subMonth()->toDateString() . '&end_date=' . now()->toDateString());

    $response->assertOk();
    expect($response->headers->get('content-type'))->toContain('text/csv');
});
