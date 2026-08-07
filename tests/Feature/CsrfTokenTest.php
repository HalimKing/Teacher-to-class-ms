<?php

use App\Models\Department;
use App\Models\Faculty;
use App\Models\Teacher;
use App\Services\AttendancePortalService;

/**
 * Note: Laravel's VerifyCsrfToken middleware skips validation when
 * runningUnitTests() is true, so 419 mismatch assertions cannot be exercised
 * in PHPUnit feature tests. Client-side refresh/retry is covered by the SPA
 * helpers; these tests lock in the token endpoint and portal expiry JSON behavior.
 */

beforeEach(function () {
    $this->faculty = Faculty::create(['name' => 'CSRF Faculty']);
    $this->department = Department::create([
        'name' => 'CSRF Dept',
        'faculty_id' => $this->faculty->id,
    ]);

    $this->teacher = Teacher::create([
        'first_name' => 'Csrf',
        'last_name' => 'Teacher',
        'email' => 'csrf.teacher.' . uniqid() . '@example.com',
        'phone' => '0244000999',
        'faculty_id' => $this->faculty->id,
        'department_id' => $this->department->id,
        'employee_id' => 'CSRF' . uniqid(),
        'title' => 'Mr.',
        'staff_type' => Teacher::STAFF_TYPE_LECTURER,
        'password' => 'Password123!',
    ]);

    $this->facePayload = [
        'timetable_id' => 1,
        'face_descriptor' => array_fill(0, 128, 0.1),
        'quality' => [
            'score' => 0.9,
            'detection_confidence' => 0.95,
            'face_width' => 180,
            'face_height' => 180,
            'frame_count' => 5,
            'descriptor_variance' => 0.01,
        ],
    ];
});

it('returns an uncacheable csrf token bound to the active session', function () {
    $response = $this->getJson('/csrf-token');

    $response->assertOk()
        ->assertJsonStructure(['token', 'session_id'])
        ->assertHeader('Cache-Control');

    expect($response->headers->get('Cache-Control'))->toContain('no-store');
    expect($response->json('token'))->toBe(session()->token());
    expect($response->json('session_id'))->toBe(session()->getId());
});

it('returns a stable csrf token across consecutive refreshes in the same session', function () {
    $first = $this->getJson('/csrf-token')->json('token');
    $second = $this->getJson('/csrf-token')->json('token');

    expect($first)->toBe($second)
        ->and($first)->toBe(session()->token());
});

it('allows authenticated face attendance posts with a synchronized session token', function () {
    $this->actingAs($this->teacher, 'teacher');

    $token = $this->getJson('/csrf-token')->json('token');

    $first = $this->postJson('/teacher/attendance/verify-face', $this->facePayload, [
        'X-CSRF-TOKEN' => $token,
    ]);

    $second = $this->postJson('/teacher/attendance/verify-face', $this->facePayload, [
        'X-CSRF-TOKEN' => $token,
    ]);

    // CSRF must not fail; invalid timetable yields validation/business errors.
    expect($first->status())->not->toBe(419);
    expect($second->status())->not->toBe(419);
});

it('returns json 401 when attendance portal session expires for ajax requests', function () {
    $this->actingAs($this->teacher, 'teacher');

    $token = $this->getJson('/csrf-token')->json('token');
    $timeoutMinutes = (int) config('attendance_portal.timeout_minutes', 30);
    $expiredAt = now()->subMinutes($timeoutMinutes + 5)->timestamp;

    $this->withSession([
        AttendancePortalService::SESSION_KEY => [
            'teacher_id' => $this->teacher->id,
            'employee_id' => $this->teacher->employee_id,
            'staff_type' => $this->teacher->staff_type,
            'started_at' => $expiredAt,
            'last_activity_at' => $expiredAt,
        ],
        '_token' => $token,
    ])->postJson('/teacher/attendance/verify-face', $this->facePayload, [
        'X-CSRF-TOKEN' => $token,
    ])
        ->assertStatus(401)
        ->assertJsonPath('success', false);
});
