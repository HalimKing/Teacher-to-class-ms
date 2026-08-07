<?php

use App\Models\Department;
use App\Models\Faculty;
use App\Models\Teacher;
use App\Services\AttendancePortalService;
use Illuminate\Support\Facades\Auth;

beforeEach(function () {
    $this->faculty = Faculty::create(['name' => 'Portal Faculty']);
    $this->department = Department::create([
        'name' => 'Portal Dept',
        'faculty_id' => $this->faculty->id,
    ]);

    $this->teacher = Teacher::create([
        'first_name' => 'Portal',
        'last_name' => 'Staff',
        'email' => 'portal.staff.' . uniqid() . '@example.com',
        'phone' => '0244000888',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'PORTAL' . uniqid(),
        'title' => 'Mr.',
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'password' => 'Password123!',
    ]);
});

it('signs out of the attendance portal and flashes a check-in success message', function () {
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

    $message = 'Attendance recorded successfully. You have been checked in.';

    $response = $this->post(route('attendance.logout'), [
        'success' => $message,
    ]);

    $response->assertRedirect(route('attendance.login'))
        ->assertSessionHas('success', $message);

    expect(Auth::guard('teacher')->check())->toBeFalse()
        ->and(session()->has(AttendancePortalService::SESSION_KEY))->toBeFalse();
});

it('signs out without a success flash when no message is provided', function () {
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

    $response = $this->post(route('attendance.logout'));

    $response->assertRedirect(route('attendance.login'))
        ->assertSessionMissing('success');

    expect(Auth::guard('teacher')->check())->toBeFalse();
});
