<?php

use App\Models\Course;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\HelpDeskTicket;
use App\Models\Program;
use App\Models\Teacher;
use App\Models\User;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    $permissions = [
        'admin.teachers.view',
        'admin.school-management.courses.view',
        'admin.school-management.class-rooms.view',
        'admin.academics.time-tables.view',
        'admin.school-management.departments.view',
        'admin.school-management.faculties.view',
        'admin.school-management.programs.view',
        'admin.help-desk.view',
        'admin.attendance.view',
        'admin.user-management.users.view',
    ];

    foreach ($permissions as $permission) {
        Permission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
    }

    $role = Role::firstOrCreate(['name' => 'Search Admin', 'guard_name' => 'web']);
    $role->givePermissionTo($permissions);

    $this->admin = User::factory()->create([
        'must_change_password' => false,
        'password_changed_at' => now(),
        'email_verified_at' => now(),
        'status' => User::STATUS_ACTIVE,
    ]);
    $this->admin->assignRole($role);

    $this->limitedAdmin = User::factory()->create([
        'must_change_password' => false,
        'password_changed_at' => now(),
        'email_verified_at' => now(),
        'status' => User::STATUS_ACTIVE,
    ]);

    $this->faculty = Faculty::create(['name' => 'Search Faculty']);
    $this->department = Department::create([
        'name' => 'Search Department',
        'faculty_id' => $this->faculty->id,
    ]);
    $this->program = Program::create([
        'name' => 'Computer Science',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
    ]);

    $this->teacher = Teacher::create([
        'first_name' => 'Ada',
        'last_name' => 'Lovelace',
        'email' => 'ada.search.' . uniqid() . '@example.com',
        'phone' => '0244111000',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'SRCH' . uniqid(),
        'title' => 'Dr.',
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
    ]);

    $this->otherTeacher = Teacher::create([
        'first_name' => 'Grace',
        'last_name' => 'Hopper',
        'email' => 'grace.search.' . uniqid() . '@example.com',
        'phone' => '0244111001',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'OTH' . uniqid(),
        'title' => 'Prof.',
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
    ]);

    Course::create([
        'name' => 'Algorithms 101',
        'course_code' => 'ALG101',
        'program_id' => $this->program->id,
        'teacher_id' => $this->teacher->id,
    ]);

    HelpDeskTicket::create([
        'ticket_number' => 'HD-SEARCH-0001',
        'subject' => 'Projector not working',
        'description' => 'Room A projector fails during lectures.',
        'category' => 'technical',
        'priority' => 'high',
        'status' => HelpDeskTicket::STATUS_OPEN,
        'created_by' => $this->teacher->id,
    ]);

    HelpDeskTicket::create([
        'ticket_number' => 'HD-SEARCH-0002',
        'subject' => 'Private ticket',
        'description' => 'Should only appear for owner.',
        'category' => 'other',
        'priority' => 'low',
        'status' => HelpDeskTicket::STATUS_OPEN,
        'created_by' => $this->otherTeacher->id,
    ]);
});

it('redirects unauthenticated users away from search', function () {
    $this->getJson(route('search', ['q' => 'ada']))
        ->assertRedirect(route('login'));
});

it('allows admins to search authorized modules', function () {
    $staffResponse = $this->actingAs($this->admin)
        ->getJson(route('search', ['q' => 'Ada']));

    $staffResponse->assertOk()->assertJsonPath('success', true);

    $staffGroup = collect($staffResponse->json('data.groups'))->firstWhere('key', 'staff');
    expect($staffGroup)->not->toBeNull();
    expect(collect($staffGroup['items'])->pluck('title')->implode(' '))->toContain('Ada');

    $courseResponse = $this->actingAs($this->admin)
        ->getJson(route('search', ['q' => 'ALG101']));

    $courseGroup = collect($courseResponse->json('data.groups'))->firstWhere('key', 'courses');
    expect($courseGroup)->not->toBeNull();
    expect(collect($courseGroup['items'])->pluck('title'))->toContain('Algorithms 101');

    $ticketResponse = $this->actingAs($this->admin)
        ->getJson(route('search', ['q' => 'Projector']));

    $ticketGroup = collect($ticketResponse->json('data.groups'))->firstWhere('key', 'help_desk');
    expect($ticketGroup)->not->toBeNull();
    expect(collect($ticketGroup['items'])->pluck('title'))->toContain('Projector not working');
});

it('hides permissioned modules for admins without access', function () {
    $response = $this->actingAs($this->limitedAdmin)
        ->getJson(route('search', ['q' => 'Ada']));

    $response->assertOk();

    $keys = collect($response->json('data.groups'))->pluck('key');
    expect($keys)->not->toContain('staff');
    expect($keys)->not->toContain('courses');
    expect($keys)->not->toContain('help_desk');
});

it('filters teacher help desk results to own tickets', function () {
    $response = $this->actingAs($this->teacher, 'teacher')
        ->getJson(route('search', ['q' => 'HD-SEARCH', 'category' => 'help_desk']));

    $response->assertOk();

    $ticketGroup = collect($response->json('data.groups'))->firstWhere('key', 'help_desk');
    expect($ticketGroup)->not->toBeNull();

    $titles = collect($ticketGroup['items'])->pluck('title');
    expect($titles)->toContain('Projector not working');
    expect($titles)->not->toContain('Private ticket');
});

it('supports category filters', function () {
    $response = $this->actingAs($this->admin)
        ->getJson(route('search', ['q' => 'Algorithms', 'category' => 'courses']));

    $response->assertOk();

    $keys = collect($response->json('data.groups'))->pluck('key');
    expect($keys)->toContain('courses');
    expect($keys)->not->toContain('staff');
    expect(collect($response->json('data.groups.0.items'))->pluck('title'))->toContain('Algorithms 101');
});

it('returns categories without requiring a query', function () {
    $response = $this->actingAs($this->admin)
        ->getJson(route('search'));

    $response->assertOk()
        ->assertJsonPath('data.groups', [])
        ->assertJsonFragment(['value' => 'staff', 'label' => 'Staff']);
});
