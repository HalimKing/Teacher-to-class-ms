<?php

use App\Models\SystemSetting;
use App\Models\Teacher;
use App\Services\FacialRecognitionService;

beforeEach(function () {
    SystemSetting::clearCache();
    SystemSetting::setValue('facial_recognition_enabled', true);
    SystemSetting::setValue('face_match_threshold', 0.45);
});

function makeDescriptor(array $overrides = []): array
{
    $descriptor = array_fill(0, 128, 0.0);

    foreach ($overrides as $index => $value) {
        $descriptor[$index] = $value;
    }

    return $descriptor;
}

it('accepts an identical face descriptor', function () {
    $service = app(FacialRecognitionService::class);
    $descriptor = makeDescriptor([0 => 0.12, 1 => -0.08, 2 => 0.41]);

    $score = $service->compareDescriptors($descriptor, $descriptor);

    expect($score)->toBe(0.0);
    expect($score <= $service->threshold())->toBeTrue();
});

it('rejects descriptors that are far apart', function () {
    $service = app(FacialRecognitionService::class);
    $enrolled = makeDescriptor([0 => 1.0, 1 => 0.0, 2 => 0.0]);
    $impostor = makeDescriptor([0 => -1.0, 1 => 0.0, 2 => 0.0]);

    $score = $service->compareDescriptors($enrolled, $impostor);

    expect($score)->toBeGreaterThan($service->threshold());
});

it('requires a valid enrolled descriptor before matching', function () {
    $teacher = new Teacher([
        'face_registered_at' => now(),
        'face_descriptor' => makeDescriptor([0 => 0.25]),
    ]);

    $service = app(FacialRecognitionService::class);
    $quality = [
        'detection_confidence' => 0.95,
        'face_width' => 120,
        'face_height' => 120,
        'frame_count' => 3,
        'descriptor_variance' => 0.05,
    ];

    $match = $service->verifyLiveCapture($teacher, makeDescriptor([0 => 0.25]), $quality);

    expect($match['matched'])->toBeTrue();

    $teacher->face_descriptor = makeDescriptor([0 => 1.0]);
    $mismatch = $service->verifyLiveCapture($teacher, makeDescriptor([0 => -1.0]), $quality);

    expect($mismatch['matched'])->toBeFalse();
});

it('rejects check-in when token and live face do not match enrollment', function () {
    $teacher = new Teacher([
        'id' => 99,
        'face_registered_at' => now(),
        'face_descriptor' => makeDescriptor([0 => 1.0]),
    ]);

    $service = app(FacialRecognitionService::class);
    $token = $service->issueVerificationToken($teacher, 5, 0.1);

    $result = $service->resolveVerifiedAttendanceFace(
        $teacher,
        5,
        $token,
        makeDescriptor([0 => -1.0]),
        [
            'detection_confidence' => 0.95,
            'face_width' => 120,
            'face_height' => 120,
            'frame_count' => 3,
            'descriptor_variance' => 0.05,
        ],
    );

    expect($result)->toBeNull();
});
