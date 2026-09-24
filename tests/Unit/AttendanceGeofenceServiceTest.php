<?php

use App\Services\AttendanceGeofenceService;
use Carbon\Carbon;

beforeEach(function () {
    $this->geofence = new AttendanceGeofenceService();
});

it('verifies a fresh accurate reading inside the venue radius', function () {
    $verdict = $this->geofence->verify(5.6, -0.18, 12, Carbon::now()->getTimestampMs(), 5.6, -0.18, 50);

    expect($verdict['status'])->toBe('verified')
        ->and($verdict['accepted'])->toBeTrue()
        ->and($verdict['distance'])->toEqual(0.0);
});

it('accepts a reading whose accuracy circle still reaches the venue', function () {
    $verdict = $this->geofence->verify(0, 0.0007, 40, null, 0, 0, 50);

    expect($verdict['status'])->toBe('verified')
        ->and($verdict['distance'])->toBeGreaterThan(50)
        ->and($verdict['distance'] - 40)->toBeLessThanOrEqual(50);
});

it('rejects a reading that is outside the venue even after accuracy is applied', function () {
    $verdict = $this->geofence->verify(0, 0.01, 15, null, 0, 0, 50);

    expect($verdict['status'])->toBe('out_of_range')
        ->and($verdict['accepted'])->toBeFalse()
        ->and($verdict['distance'])->toBeGreaterThan(500);
});

it('asks for another reading when gps accuracy is too poor', function () {
    $verdict = $this->geofence->verify(0, 0.001, 150, null, 0, 0, 50);

    expect($verdict['status'])->toBe('accuracy_too_low')
        ->and($verdict['accepted'])->toBeFalse()
        ->and($verdict['message'])->toContain('Location accuracy is too low');
});

it('rejects a stale location timestamp', function () {
    $verdict = $this->geofence->verify(0, 0, 8, Carbon::now()->subMinutes(5)->getTimestampMs(), 0, 0, 50);

    expect($verdict['status'])->toBe('stale')
        ->and($verdict['accepted'])->toBeFalse();
});

it('skips enforcement when the venue has no coordinates', function () {
    $verdict = $this->geofence->verify(1.2, 2.3, 5, null, null, null, 50);

    expect($verdict['status'])->toBe('skipped')
        ->and($verdict['accepted'])->toBeTrue();
});
