<?php

use App\Models\AcademicYear;
use App\Models\ClassRoom;
use App\Models\Course;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\Program;
use App\Models\Teacher;
use App\Models\TimeTable;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Permission::firstOrCreate(['name' => 'admin.academics.time-tables.create', 'guard_name' => 'web']);
    Permission::firstOrCreate(['name' => 'admin.academics.time-tables.view', 'guard_name' => 'web']);

    $role = Role::firstOrCreate(['name' => 'Super Admin', 'guard_name' => 'web']);
    $role->givePermissionTo([
        'admin.academics.time-tables.create',
        'admin.academics.time-tables.view',
    ]);

    $this->admin = User::factory()->create();
    $this->admin->assignRole($role);

    $this->faculty = Faculty::create(['name' => 'Schedule Faculty']);
    $this->department = Department::create(['name' => 'Schedule Dept', 'faculty_id' => $this->faculty->id]);
    $this->academicYear = AcademicYear::create(['name' => '2026/2027', 'status' => 'active']);
    $this->classroom = ClassRoom::factory()->create(['name' => 'Hall Alpha']);
    $this->classroomB = ClassRoom::factory()->create(['name' => 'Hall Beta']);

    $this->lecturer = Teacher::create([
        'first_name' => 'Bulk',
        'last_name' => 'Lecturer',
        'email' => 'bulk-lecturer-' . uniqid() . '@example.com',
        'phone' => '1234567890',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'BLK001',
        'title' => 'Mr.',
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
    ]);

    $this->adminStaff = Teacher::create([
        'first_name' => 'Bulk',
        'last_name' => 'Admin',
        'email' => 'bulk-admin-' . uniqid() . '@example.com',
        'phone' => '1234567891',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'BLK002',
        'title' => 'Ms.',
        'staff_type' => Teacher::STAFF_TYPE_ADMINISTRATOR,
    ]);

    $this->program = Program::create([
        'name' => 'Schedule Program',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
    ]);

    $this->course = Course::create([
        'course_code' => 'SCH101',
        'name' => 'Scheduling Course',
        'program_id' => $this->program->id,
        'teacher_id' => $this->lecturer->id,
        'academic_year_id' => $this->academicYear->id,
        'student_size' => 40,
    ]);
});

it('renders the bulk create schedules page', function () {
    $this->actingAs($this->admin)
        ->get(route('admin.academics.time-tables.bulk-create'))
        ->assertOk();
});

it('bulk creates valid schedules and reports invalid rows', function () {
    $response = $this->actingAs($this->admin)->post(route('admin.academics.time-tables.bulk-store'), [
        'academic_year_id' => $this->academicYear->id,
        'schedules' => [
            [
                'staff_type' => 'lecturer',
                'teacher_id' => $this->lecturer->id,
                'course_id' => $this->course->id,
                'class_room_id' => $this->classroom->id,
                'day' => 'Monday',
                'start_time' => '09:00',
                'end_time' => '11:00',
            ],
            [
                'staff_type' => 'administrator',
                'teacher_id' => $this->adminStaff->id,
                'course_id' => null,
                'class_room_id' => $this->classroomB->id,
                'day' => 'Tuesday',
                'start_time' => '08:00',
                'end_time' => '16:00',
            ],
            [
                'staff_type' => 'lecturer',
                'teacher_id' => $this->lecturer->id,
                'course_id' => $this->course->id,
                'class_room_id' => $this->classroom->id,
                'day' => 'Monday',
                'start_time' => '09:30',
                'end_time' => '10:30',
            ],
        ],
    ]);

    $response->assertRedirect();
    $response->assertSessionHas('bulk_result');

    expect(TimeTable::count())->toBe(2);
    expect(TimeTable::where('teacher_id', $this->lecturer->id)->where('day_of_week', 'Monday')->exists())->toBeTrue();
    expect(TimeTable::where('teacher_id', $this->adminStaff->id)->where('day_of_week', 'Tuesday')->exists())->toBeTrue();
});

it('downloads a schedule import template', function () {
    $this->actingAs($this->admin)
        ->get(route('admin.academics.time-tables.template'))
        ->assertOk()
        ->assertHeader('content-type', 'text/csv; charset=UTF-8');
});

it('previews and imports schedules from csv', function () {
    Storage::fake('local');

    $csv = implode("\n", [
        'academic_year,staff_type,employee_id,course_code,venue,day,start_time,end_time',
        '2026/2027,lecturer,BLK001,SCH101,Hall Alpha,Wednesday,10:00,12:00',
        '2026/2027,administrator,BLK002,,Hall Beta,Thursday,09:00,17:00',
        '2026/2027,lecturer,MISSING,SCH101,Hall Alpha,Friday,10:00,12:00',
    ]);

    $file = UploadedFile::fake()->createWithContent('schedules.csv', $csv);

    $preview = $this->actingAs($this->admin)
        ->post(route('admin.academics.time-tables.preview'), ['file' => $file])
        ->assertOk()
        ->json();

    expect($preview['summary']['total'])->toBe(3);
    expect($preview['summary']['valid'])->toBe(2);
    expect($preview['summary']['invalid'])->toBe(1);

    $confirmFile = UploadedFile::fake()->createWithContent('schedules-confirm.csv', $csv);

    $confirm = $this->actingAs($this->admin)
        ->post(route('admin.academics.time-tables.confirm-import'), ['file' => $confirmFile])
        ->assertOk()
        ->json();

    expect($confirm['imported'])->toBe(2);
    expect($confirm['failed'])->toBe(1);
    expect(TimeTable::count())->toBe(2);
});

it('rejects duplicate schedule imports', function () {
    TimeTable::create([
        'academic_year_id' => $this->academicYear->id,
        'teacher_id' => $this->lecturer->id,
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'course_id' => $this->course->id,
        'class_room_id' => $this->classroom->id,
        'day' => 'Monday',
        'day_of_week' => 'Monday',
        'start_time' => '09:00',
        'end_time' => '11:00',
    ]);

    $csv = implode("\n", [
        'academic_year,staff_type,employee_id,course_code,venue,day,start_time,end_time',
        '2026/2027,lecturer,BLK001,SCH101,Hall Alpha,Monday,09:00,11:00',
    ]);

    $file = UploadedFile::fake()->createWithContent('duplicate.csv', $csv);

    $preview = $this->actingAs($this->admin)
        ->post(route('admin.academics.time-tables.preview'), ['file' => $file])
        ->assertOk()
        ->json();

    expect($preview['summary']['valid'])->toBe(0);
    expect($preview['rows'][0]['errors'])->not->toBeEmpty();
});
