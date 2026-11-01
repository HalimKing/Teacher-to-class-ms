<?php

use App\Models\AcademicYear;
use App\Models\ClassRoom;
use App\Models\Course;
use App\Models\Department;
use App\Models\FaceVerificationAttempt;
use App\Models\Faculty;
use App\Models\Program;
use App\Models\StaffFaceProfile;
use App\Models\SystemSetting;
use App\Models\Teacher;
use App\Models\TeacherAttendance;
use App\Models\TimeTable;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

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
            ['value' => $value, 'group' => 'attendance', 'type' => $type, 'description' => 'test'],
        );
    }
    Cache::forget('system_settings');

    $this->faculty = Faculty::create(['name' => 'ArcFace Faculty']);
    $this->department = Department::create(['name' => 'ArcFace Dept', 'faculty_id' => $this->faculty->id]);
    $this->teacher = Teacher::create([
        'first_name' => 'Ada',
        'last_name' => 'Lecturer',
        'email' => 'arcface-'.uniqid().'@example.com',
        'phone' => '0244000001',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'ARC'.uniqid(),
        'title' => 'Dr.',
    ]);
    $this->academicYear = AcademicYear::create(['name' => '2026/2027 ArcFace', 'status' => 'active']);
    $this->classroom = ClassRoom::factory()->create();
    $this->program = Program::create([
        'name' => 'ArcFace Program',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
    ]);
    $this->course = Course::create([
        'course_code' => 'ARC-101',
        'name' => 'ArcFace Course',
        'program_id' => $this->program->id,
        'teacher_id' => $this->teacher->id,
        'student_size' => 20,
    ]);
});

function arcfaceEmbedding(): array
{
    return array_fill(0, 32, 0.25);
}

function arcfaceImage(): string
{
    return base64_encode(random_bytes(48));
}

function arcfaceTimetable(Teacher $teacher, AcademicYear $year, ClassRoom $classroom, Course $course): TimeTable
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

function fakeArcFaceMatch(float $score = 0.91, bool $verified = true): void
{
    Http::fake([
        'http://127.0.0.1:8090/v1/face/*' => Http::response([
            'success' => $verified,
            'status' => $verified ? 'READY' : 'READY',
            'verified' => $verified,
            'match_score' => $score,
            'threshold' => 0.2,
            'liveness' => true,
            'quality_score' => 0.93,
            'processing_time_ms' => 118,
            'embedding_model' => 'w600k_r50',
            'embedding_version' => 'buffalo_l-arcface-r50',
            'embedding' => array_fill(0, 32, 9.9),
            'embedding_dimension' => 32,
        ]),
    ]);
}

it('rejects an unauthenticated verification request', function () {
    $timetable = arcfaceTimetable($this->teacher, $this->academicYear, $this->classroom, $this->course);

    $this->postJson('/teacher/attendance/verify-face', [
        'timetable_id' => $timetable->id,
        'image' => arcfaceImage(),
        'liveness_frames' => [arcfaceImage(), arcfaceImage()],
        'verified' => true,
        'match_score' => 0.99,
    ])->assertUnauthorized();
});

it('tells staff to contact an administrator when no arcface profile exists', function () {
    $timetable = arcfaceTimetable($this->teacher, $this->academicYear, $this->classroom, $this->course);

    $this->actingAs($this->teacher, 'teacher')
        ->postJson('/teacher/attendance/verify-face', [
            'timetable_id' => $timetable->id,
            'image' => arcfaceImage(),
            'liveness_frames' => [arcfaceImage(), arcfaceImage()],
        ])
        ->assertStatus(422)
        ->assertJsonPath('success', false);

    expect(FaceVerificationAttempt::query()->where('teacher_id', $this->teacher->id)->where('failure_reason', 'not_enrolled')->exists())->toBeTrue();
});

it('requires re-enrollment for a face-api.js profile', function () {
    $this->teacher->forceFill([
        'face_descriptor' => array_fill(0, 128, 0.1),
        'face_registered_at' => now(),
    ])->save();
    $timetable = arcfaceTimetable($this->teacher, $this->academicYear, $this->classroom, $this->course);

    $response = $this->actingAs($this->teacher, 'teacher')
        ->postJson('/teacher/attendance/verify-face', [
            'timetable_id' => $timetable->id,
            'image' => arcfaceImage(),
            'liveness_frames' => [arcfaceImage(), arcfaceImage()],
        ]);

    $response->assertStatus(422);
    expect($response->json('message'))->toContain('administrator');
    expect(FaceVerificationAttempt::query()->where('failure_reason', 'migration_required')->exists())->toBeTrue();
});

it('records attendance from the face service score and ignores a browser verified flag', function () {
    StaffFaceProfile::query()->create([
        'teacher_id' => $this->teacher->id,
        'embedding' => arcfaceEmbedding(),
        'embedding_dimension' => 32,
        'embedding_model' => 'w600k_r50',
        'embedding_version' => 'test',
        'is_active' => true,
        'migration_required' => false,
        'enrolled_at' => now(),
    ]);
    $timetable = arcfaceTimetable($this->teacher, $this->academicYear, $this->classroom, $this->course);
    fakeArcFaceMatch(0.91, true);

    $verification = $this->actingAs($this->teacher, 'teacher')
        ->postJson('/teacher/attendance/verify-face', [
            'timetable_id' => $timetable->id,
            'image' => arcfaceImage(),
            'liveness_frames' => [arcfaceImage(), arcfaceImage()],
            'verified' => false,
            'match_score' => 0.01,
        ])
        ->assertOk()
        ->json();

    expect($verification['verification_token'])->not->toBeEmpty()
        ->and(json_encode($verification))->not->toContain('9.9');

    $this->actingAs($this->teacher, 'teacher')
        ->postJson('/teacher/attendance/check-in', [
            'coordinates' => ['latitude' => 1.2345, 'longitude' => 2.3456, 'accuracy' => 5],
            'course_id' => $this->course->id,
            'course_name' => $this->course->name,
            'class_room' => $this->classroom->name,
            'timetable_id' => $timetable->id,
            'check_in_time' => Carbon::now()->toDateTimeString(),
            'distance' => 10,
            'within_range' => true,
            'verified' => true,
            'match_score' => 0.99,
            'face_verification_token' => $verification['verification_token'],
        ])
        ->assertOk();

    $record = TeacherAttendance::query()->where('teacher_id', $this->teacher->id)->first();
    expect($record)->not->toBeNull()
        ->and($record->face_verified)->toBeTrue()
        ->and((float) $record->face_match_score)->toBe(0.91)
        ->and($record->face_liveness_passed)->toBeTrue()
        ->and($record->face_model)->toBe('w600k_r50');

    $this->actingAs($this->teacher, 'teacher')
        ->postJson('/teacher/attendance/check-in', [
            'coordinates' => ['latitude' => 1.2345, 'longitude' => 2.3456, 'accuracy' => 5],
            'course_id' => $this->course->id,
            'course_name' => $this->course->name,
            'class_room' => $this->classroom->name,
            'timetable_id' => $timetable->id,
            'check_in_time' => Carbon::now()->toDateTimeString(),
            'distance' => 10,
            'within_range' => true,
            'verified' => true,
            'match_score' => 0.99,
            'face_verification_token' => $verification['verification_token'],
        ])
        ->assertStatus(400);

    expect(FaceVerificationAttempt::query()->where('teacher_id', $this->teacher->id)->where('result', 'passed')->exists())->toBeTrue();
});

it('rejects attendance when the browser claims success without a face-service token', function () {
    StaffFaceProfile::query()->create([
        'teacher_id' => $this->teacher->id,
        'embedding' => arcfaceEmbedding(),
        'embedding_dimension' => 32,
        'embedding_model' => 'w600k_r50',
        'embedding_version' => 'test',
        'is_active' => true,
        'migration_required' => false,
        'enrolled_at' => now(),
    ]);
    $timetable = arcfaceTimetable($this->teacher, $this->academicYear, $this->classroom, $this->course);

    $this->actingAs($this->teacher, 'teacher')
        ->postJson('/teacher/attendance/check-in', [
            'coordinates' => ['latitude' => 1.2345, 'longitude' => 2.3456, 'accuracy' => 5],
            'course_id' => $this->course->id,
            'course_name' => $this->course->name,
            'class_room' => $this->classroom->name,
            'timetable_id' => $timetable->id,
            'check_in_time' => Carbon::now()->toDateTimeString(),
            'distance' => 10,
            'within_range' => true,
            'verified' => true,
            'match_score' => 0.99,
        ])
        ->assertStatus(422);

    expect(TeacherAttendance::query()->count())->toBe(0);
});

it('rejects a failed face-service match', function () {
    StaffFaceProfile::query()->create([
        'teacher_id' => $this->teacher->id,
        'embedding' => arcfaceEmbedding(),
        'embedding_dimension' => 32,
        'embedding_model' => 'w600k_r50',
        'embedding_version' => 'test',
        'is_active' => true,
        'migration_required' => false,
        'enrolled_at' => now(),
    ]);
    $timetable = arcfaceTimetable($this->teacher, $this->academicYear, $this->classroom, $this->course);
    fakeArcFaceMatch(0.12, false);

    $this->actingAs($this->teacher, 'teacher')
        ->postJson('/teacher/attendance/verify-face', [
            'timetable_id' => $timetable->id,
            'image' => arcfaceImage(),
            'liveness_frames' => [arcfaceImage(), arcfaceImage()],
        ])
        ->assertStatus(422);

    expect(FaceVerificationAttempt::query()->where('result', 'failed')->where('failure_reason', 'face_not_recognized')->exists())->toBeTrue();
});

it('blocks unauthorized enrollment and stores an embedding only for an authorized administrator', function () {
    $timetableTeacher = $this->teacher;

    $this->postJson('/admin/teachers/'.$timetableTeacher->id.'/face-enrollment', [
        'images' => [arcfaceImage(), arcfaceImage()],
        'verified' => true,
    ])->assertUnauthorized();

    Permission::firstOrCreate(['name' => 'admin.teachers.edit', 'guard_name' => 'web']);
    $role = Role::firstOrCreate(['name' => 'ArcFace Admin', 'guard_name' => 'web']);
    $role->givePermissionTo('admin.teachers.edit');
    $admin = User::factory()->create();
    $admin->assignRole($role);

    fakeArcFaceMatch();

    $response = $this->actingAs($admin)
        ->postJson('/admin/teachers/'.$timetableTeacher->id.'/face-enrollment', [
            'images' => [arcfaceImage(), arcfaceImage()],
        ])
        ->assertOk();

    expect($response->json('embedding'))->toBeNull();
    expect(json_encode($response->json()))->not->toContain('9.9');

    $profile = StaffFaceProfile::query()->where('teacher_id', $timetableTeacher->id)->first();
    expect($profile)->not->toBeNull()
        ->and($profile->is_active)->toBeTrue()
        ->and($profile->embedding_model)->toBe('w600k_r50')
        ->and($profile->embedding)->toHaveCount(32);
});
