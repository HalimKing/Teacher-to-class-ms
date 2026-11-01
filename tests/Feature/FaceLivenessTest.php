<?php

use App\Models\AcademicYear;
use App\Models\ClassRoom;
use App\Models\Course;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\Program;
use App\Models\StaffFaceProfile;
use App\Models\SystemSetting;
use App\Models\Teacher;
use App\Models\TeacherAttendance;
use App\Models\TimeTable;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Spatie\Permission\Models\Permission;

beforeEach(function () {
    Cache::forget('system_settings');
    config([
        'face.url' => 'http://127.0.0.1:8090',
        'face.api_key' => 'test-key',
        'face.enabled' => true,
        'face.timeout' => 5,
        'face.engine' => null,
    ]);

    foreach ([
        'facial_recognition_enabled' => ['1', 'boolean'],
        'face_recognition_engine' => ['arcface', 'string'],
        'arcface_match_threshold' => ['0.40', 'string'],
        'face_liveness_enabled' => ['1', 'boolean'],
        'face_quality_threshold' => ['0.55', 'string'],
        'gps_enforcement_enabled' => ['0', 'boolean'],
    ] as $key => [$value, $type]) {
        SystemSetting::query()->updateOrCreate(
            ['key' => $key],
            ['value' => $value, 'group' => 'attendance', 'type' => $type, 'description' => $key === 'face_liveness_enabled'
                ? 'Prevents attendance verification using photographs and other supported spoofing attempts by checking whether a live person is present in front of the camera.'
                : 'test'],
        );
    }
    Cache::forget('system_settings');

    $this->faculty = Faculty::create(['name' => 'Liveness Faculty']);
    $this->department = Department::create(['name' => 'Liveness Dept', 'faculty_id' => $this->faculty->id]);
    $this->teacher = Teacher::create([
        'first_name' => 'Live',
        'last_name' => 'Staff',
        'email' => 'liveness-'.uniqid().'@example.com',
        'phone' => '0244000099',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'LIV'.uniqid(),
        'title' => 'Dr.',
    ]);
    $this->academicYear = AcademicYear::create(['name' => '2026/2027 Liveness', 'status' => 'active']);
    $this->classroom = ClassRoom::factory()->create([
        'latitude' => 6.6731,
        'longitude' => -1.5654,
        'radius_meters' => 50,
    ]);
    $this->program = Program::create([
        'name' => 'Liveness Program',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
    ]);
    $this->course = Course::create([
        'course_code' => 'LIV-101',
        'name' => 'Liveness Course',
        'program_id' => $this->program->id,
        'teacher_id' => $this->teacher->id,
        'student_size' => 20,
    ]);
});

function liveProfile(Teacher $teacher): void
{
    StaffFaceProfile::query()->create([
        'teacher_id' => $teacher->id,
        'embedding' => array_fill(0, 32, 0.25),
        'embedding_dimension' => 32,
        'embedding_model' => 'w600k_r50',
        'embedding_version' => 'test',
        'is_active' => true,
        'migration_required' => false,
        'enrolled_at' => now(),
    ]);
}

function liveTimetable(Teacher $teacher, AcademicYear $year, ClassRoom $classroom, Course $course): TimeTable
{
    return TimeTable::create([
        'academic_year_id' => $year->id,
        'course_id' => $course->id,
        'class_room_id' => $classroom->id,
        'teacher_id' => $teacher->id,
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'day' => Carbon::now()->format('l'),
        'day_of_week' => Carbon::now()->format('l'),
        'start_time' => Carbon::now()->subMinutes(30)->format('H:i:s'),
        'end_time' => Carbon::now()->addHour()->format('H:i:s'),
    ]);
}

function fakeFaceService(array $payload): void
{
    Http::fake([
        'http://127.0.0.1:8090/v1/face/*' => Http::response($payload),
    ]);
}

function livePayload(array $overrides = []): array
{
    return array_merge([
        'success' => true,
        'status' => 'READY',
        'verified' => true,
        'match_score' => 0.91,
        'threshold' => 0.2,
        'liveness' => true,
        'quality_score' => 0.93,
        'processing_time_ms' => 90,
        'embedding_model' => 'w600k_r50',
    ], $overrides);
}

it('rejects a matched face when liveness fails and does not record attendance', function () {
    liveProfile($this->teacher);
    $timetable = liveTimetable($this->teacher, $this->academicYear, $this->classroom, $this->course);
    fakeFaceService(livePayload([
        'success' => false,
        'status' => 'PRESENTATION_ATTACK',
        'verified' => true,
        'liveness' => false,
        'match_score' => 0.91,
    ]));

    $this->actingAs($this->teacher, 'teacher')
        ->postJson('/teacher/attendance/verify-face', [
            'timetable_id' => $timetable->id,
            'image' => base64_encode(random_bytes(48)),
            'liveness_frames' => [base64_encode(random_bytes(48)), base64_encode(random_bytes(48))],
            'verified' => true,
            'liveness' => true,
            'match_score' => 0.99,
        ])
        ->assertStatus(422)
        ->assertJsonPath('message', "A possible photograph or screen presentation was detected.");

    expect(TeacherAttendance::query()->count())->toBe(0);
});

it('rejects attendance when the face does not match even if liveness passes', function () {
    liveProfile($this->teacher);
    $timetable = liveTimetable($this->teacher, $this->academicYear, $this->classroom, $this->course);
    fakeFaceService(livePayload([
        'success' => false,
        'status' => 'NOT_MATCHED',
        'verified' => false,
        'liveness' => true,
        'match_score' => 0.12,
    ]));

    $this->actingAs($this->teacher, 'teacher')
        ->postJson('/teacher/attendance/verify-face', [
            'timetable_id' => $timetable->id,
            'image' => base64_encode(random_bytes(48)),
            'liveness_frames' => [base64_encode(random_bytes(48)), base64_encode(random_bytes(48))],
        ])
        ->assertStatus(422)
        ->assertJsonPath('message', "Face not recognized.\nPlease try again.");

    expect(TeacherAttendance::query()->count())->toBe(0);
});

it('does not record attendance when a required liveness service is unavailable', function () {
    liveProfile($this->teacher);
    $timetable = liveTimetable($this->teacher, $this->academicYear, $this->classroom, $this->course);
    Http::fake(function () {
        throw new ConnectionException('offline');
    });

    $this->actingAs($this->teacher, 'teacher')
        ->postJson('/teacher/attendance/verify-face', [
            'timetable_id' => $timetable->id,
            'image' => base64_encode(random_bytes(48)),
            'liveness_frames' => [base64_encode(random_bytes(48)), base64_encode(random_bytes(48))],
            'verified' => true,
            'liveness' => true,
        ])
        ->assertStatus(503);

    expect(TeacherAttendance::query()->count())->toBe(0);
});

it('allows the existing verification workflow when liveness is disabled', function () {
    SystemSetting::setValue('face_liveness_enabled', false);
    liveProfile($this->teacher);
    $timetable = liveTimetable($this->teacher, $this->academicYear, $this->classroom, $this->course);
    fakeFaceService(livePayload([
        'liveness' => false,
        'verified' => true,
        'match_score' => 0.88,
    ]));

    $verification = $this->actingAs($this->teacher, 'teacher')
        ->postJson('/teacher/attendance/verify-face', [
            'timetable_id' => $timetable->id,
            'image' => base64_encode(random_bytes(48)),
            'liveness_frames' => [base64_encode(random_bytes(48)), base64_encode(random_bytes(48))],
        ])
        ->assertOk()
        ->json();

    $this->actingAs($this->teacher, 'teacher')
        ->postJson('/teacher/attendance/check-in', [
            'coordinates' => ['latitude' => 6.6731, 'longitude' => -1.5654, 'accuracy' => 5, 'captured_at' => Carbon::now()->toIso8601String()],
            'course_id' => $this->course->id,
            'course_name' => $this->course->name,
            'class_room' => $this->classroom->name,
            'timetable_id' => $timetable->id,
            'check_in_time' => Carbon::now()->toDateTimeString(),
            'distance' => 1,
            'within_range' => true,
            'face_verification_token' => $verification['verification_token'],
        ])
        ->assertOk();

    expect(TeacherAttendance::query()->count())->toBe(1);
});

it('records attendance only when liveness and the face match both pass', function () {
    liveProfile($this->teacher);
    $timetable = liveTimetable($this->teacher, $this->academicYear, $this->classroom, $this->course);
    fakeFaceService(livePayload());

    $verification = $this->actingAs($this->teacher, 'teacher')
        ->postJson('/teacher/attendance/verify-face', [
            'timetable_id' => $timetable->id,
            'image' => base64_encode(random_bytes(48)),
            'liveness_frames' => [base64_encode(random_bytes(48)), base64_encode(random_bytes(48))],
        ])
        ->assertOk()
        ->json();

    $this->actingAs($this->teacher, 'teacher')
        ->postJson('/teacher/attendance/check-in', [
            'coordinates' => ['latitude' => 6.6731, 'longitude' => -1.5654, 'accuracy' => 5, 'captured_at' => Carbon::now()->toIso8601String()],
            'course_id' => $this->course->id,
            'course_name' => $this->course->name,
            'class_room' => $this->classroom->name,
            'timetable_id' => $timetable->id,
            'check_in_time' => Carbon::now()->toDateTimeString(),
            'distance' => 1,
            'within_range' => true,
            'face_verification_token' => $verification['verification_token'],
        ])
        ->assertOk();

    expect(TeacherAttendance::query()->where('face_liveness_passed', true)->count())->toBe(1);
});

it('does not record attendance when geolocation fails after both face checks pass', function () {
    SystemSetting::setValue('gps_enforcement_enabled', true);
    liveProfile($this->teacher);
    $timetable = liveTimetable($this->teacher, $this->academicYear, $this->classroom, $this->course);
    fakeFaceService(livePayload());

    $verification = $this->actingAs($this->teacher, 'teacher')
        ->postJson('/teacher/attendance/verify-face', [
            'timetable_id' => $timetable->id,
            'image' => base64_encode(random_bytes(48)),
            'liveness_frames' => [base64_encode(random_bytes(48)), base64_encode(random_bytes(48))],
        ])
        ->assertOk()
        ->json();

    $this->actingAs($this->teacher, 'teacher')
        ->postJson('/teacher/attendance/check-in', [
            'coordinates' => [
                'latitude' => 7.5,
                'longitude' => -0.2,
                'accuracy' => 5,
                'captured_at' => Carbon::now()->toIso8601String(),
            ],
            'course_id' => $this->course->id,
            'course_name' => $this->course->name,
            'class_room' => $this->classroom->name,
            'timetable_id' => $timetable->id,
            'check_in_time' => Carbon::now()->toDateTimeString(),
            'distance' => 1,
            'within_range' => true,
            'face_verification_token' => $verification['verification_token'],
        ])
        ->assertStatus(422);

    expect(TeacherAttendance::query()->count())->toBe(0);
});

it('lets an administrator persist the liveness setting and reloads it', function () {
    Permission::firstOrCreate(['name' => 'admin.settings.edit', 'guard_name' => 'web']);
    Permission::firstOrCreate(['name' => 'admin.settings.view', 'guard_name' => 'web']);
    $admin = User::factory()->create();
    $admin->givePermissionTo(['admin.settings.edit', 'admin.settings.view']);

    $this->actingAs($admin)
        ->get(route('admin.settings-reports.settings.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('settings.attendance.face_liveness_enabled.value', true)
            ->where('settings.attendance.face_liveness_enabled.description', 'Prevents attendance verification using photographs and other supported spoofing attempts by checking whether a live person is present in front of the camera.')
        );

    $this->actingAs($admin)
        ->put(route('admin.settings-reports.settings.update'), [
            'group' => 'attendance',
            'settings' => ['face_liveness_enabled' => false],
        ])
        ->assertRedirect();

    expect(SystemSetting::getValue('face_liveness_enabled'))->toBeFalse();

    $this->actingAs($admin)
        ->get(route('admin.settings-reports.settings.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where('settings.attendance.face_liveness_enabled.value', false));
});

it('forbids an unauthorized user from changing liveness detection', function () {
    Permission::firstOrCreate(['name' => 'admin.settings.edit', 'guard_name' => 'web']);
    $user = User::factory()->create();

    $this->actingAs($user)
        ->put(route('admin.settings-reports.settings.update'), [
            'group' => 'attendance',
            'settings' => ['face_liveness_enabled' => false],
        ])
        ->assertForbidden();

    expect(SystemSetting::getValue('face_liveness_enabled'))->toBeTrue();
});
