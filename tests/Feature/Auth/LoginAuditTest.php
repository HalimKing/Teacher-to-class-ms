<?php

use App\Models\ActivityLog;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\Teacher;
use App\Models\User;
use App\Support\LeadershipAssignment;

function makeLoginAuditTeacher(array $overrides = []): Teacher
{
    $faculty = Faculty::create(['name' => 'Audit Faculty '.uniqid()]);
    $department = Department::create([
        'name' => 'Audit Department '.uniqid(),
        'faculty_id' => $faculty->id,
    ]);

    return Teacher::create(array_merge([
        'first_name' => 'Audit',
        'last_name' => 'Staff',
        'email' => 'audit-'.uniqid().'@example.com',
        'phone' => '1234567890',
        'faculty_id' => $faculty->id,
        'department_id' => $department->id,
        'employee_id' => 'AUD'.uniqid(),
        'title' => 'Mr.',
        'password' => 'password',
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'leadership_faculty_id' => $faculty->id,
        'leadership_department_id' => $department->id,
    ], $overrides));
}

function authenticationLogs()
{
    return ActivityLog::query()
        ->where('event_category', 'authentication')
        ->whereIn('event_type', ['login', 'failed_login'])
        ->orderBy('id')
        ->get();
}

it('records one successful administrator login', function () {
    $user = User::factory()->create(['name' => 'Abdul Halim Mohammed']);

    $this->post('/login', [
        'email' => $user->email,
        'password' => 'password',
    ])->assertRedirect();

    $logs = authenticationLogs();

    expect($logs)->toHaveCount(1)
        ->and($logs->first()->event_type)->toBe('login')
        ->and($logs->first()->status)->toBe('success')
        ->and($logs->first()->actor_name)->toBe('Abdul Halim Mohammed')
        ->and($logs->first()->actor_role)->toBe('Administrator')
        ->and($logs->first()->ip_address)->not->toBeEmpty();
});

it('records one successful lecturer login without a prior failed lookup', function () {
    $teacher = makeLoginAuditTeacher([
        'first_name' => 'Ama',
        'last_name' => 'Mensah',
    ]);

    $this->post('/login', [
        'email' => $teacher->email,
        'password' => 'password',
    ])->assertRedirect();

    $logs = authenticationLogs();

    expect($logs)->toHaveCount(1)
        ->and($logs->first()->event_type)->toBe('login')
        ->and($logs->first()->status)->toBe('success')
        ->and($logs->first()->actor_name)->toBe('Ama Mensah')
        ->and($logs->first()->actor_role)->toBe('Lecturer');
});

it('records one successful director login', function () {
    $dean = makeLoginAuditTeacher([
        'first_name' => 'Kwame',
        'last_name' => 'Boateng',
        'leadership_role' => LeadershipAssignment::DIRECTOR_DEAN,
    ]);

    $this->post('/login', [
        'email' => $dean->email,
        'password' => 'password',
    ])->assertRedirect();

    $logs = authenticationLogs();

    expect($logs)->toHaveCount(1)
        ->and($logs->first()->event_type)->toBe('login')
        ->and($logs->first()->actor_role)->toBe('Director/Dean');
});

it('records one successful head of department login', function () {
    $hod = makeLoginAuditTeacher([
        'leadership_role' => LeadershipAssignment::HEAD_OF_DEPARTMENT,
    ]);

    $this->post('/login', [
        'email' => $hod->email,
        'password' => 'password',
    ])->assertRedirect();

    expect(authenticationLogs())->toHaveCount(1)
        ->and(authenticationLogs()->first()->actor_role)->toBe('Head of Department');
});

it('records one failed login for an unknown email', function () {
    $this->from('/login')->post('/login', [
        'email' => 'missing@example.com',
        'password' => 'password',
    ])->assertRedirect('/login');

    $logs = authenticationLogs();

    expect($logs)->toHaveCount(1)
        ->and($logs->first()->event_type)->toBe('failed_login')
        ->and($logs->first()->status)->toBe('failed')
        ->and($logs->first()->actor_name)->toBe('missing@example.com')
        ->and($logs->first()->actor_role)->toBe('Guest');
});

it('records one failed login for a valid lecturer with the wrong password', function () {
    $teacher = makeLoginAuditTeacher([
        'first_name' => 'Yaw',
        'last_name' => 'Owusu',
    ]);

    $this->from('/login')->post('/login', [
        'email' => $teacher->email,
        'password' => 'wrong-password',
    ])->assertRedirect('/login');

    $logs = authenticationLogs();

    expect($logs)->toHaveCount(1)
        ->and($logs->first()->event_type)->toBe('failed_login')
        ->and($logs->first()->status)->toBe('failed')
        ->and($logs->first()->actor_name)->toBe('Yaw Owusu')
        ->and($logs->first()->actor_role)->toBe('Lecturer')
        ->and($logs->first()->actor_id)->toBe($teacher->id);
});

it('does not write a failed log when the email exists only in the staff table', function () {
    $teacher = makeLoginAuditTeacher();

    expect(User::query()->where('email', $teacher->email)->exists())->toBeFalse();

    $this->post('/login', [
        'email' => $teacher->email,
        'password' => 'password',
    ])->assertRedirect();

    expect(authenticationLogs()->pluck('event_type')->all())->toBe(['login']);
});
