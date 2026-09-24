<?php

namespace App\Services;

use Carbon\Carbon;

/**
 * Server-side attendance geofence. The reported GPS point is not treated as exact:
 * a reading is accepted only when its accuracy is usable and the accuracy circle
 * still reaches the venue radius. Poor accuracy is rejected instead of being
 * reported as out of range.
 */
class AttendanceGeofenceService
{
    public const MAX_ACCEPTABLE_ACCURACY_METERS = 100;

    public const MAX_FIX_AGE_SECONDS = 120;

    /**
     * @return array{
     *     status: string,
     *     accepted: bool,
     *     distance: float|null,
     *     message: string,
     *     diagnostics: array<string, mixed>
     * }
     */
    public function verify(
        float $latitude,
        float $longitude,
        float $accuracy,
        mixed $capturedAt,
        mixed $venueLatitude,
        mixed $venueLongitude,
        mixed $radiusMeters,
    ): array {
        $venueLat = $this->finite($venueLatitude);
        $venueLng = $this->finite($venueLongitude);
        $radius = $this->finite($radiusMeters);

        $diagnostics = [
            'device_latitude' => $latitude,
            'device_longitude' => $longitude,
            'accuracy_meters' => $accuracy,
            'captured_at' => $capturedAt,
            'venue_latitude' => $venueLat,
            'venue_longitude' => $venueLng,
            'radius_meters' => $radius,
            'distance_meters' => null,
            'result' => 'skipped',
            'failure_reason' => null,
        ];

        if ($venueLat === null || $venueLng === null || $radius === null || $radius <= 0) {
            return $this->result('skipped', true, null, 'Attendance location is not configured for this session.', $diagnostics);
        }

        if (! $this->validCoordinate($latitude, $longitude) || ! $this->validCoordinate($venueLat, $venueLng)) {
            $diagnostics['failure_reason'] = 'invalid_coordinates';

            return $this->result('invalid', false, null, 'Location could not be determined. Please try again.', $diagnostics);
        }

        $captured = $this->parseCapturedAt($capturedAt);
        if ($capturedAt !== null && $capturedAt !== '' && $captured === null) {
            $diagnostics['failure_reason'] = 'invalid_timestamp';

            return $this->result('stale', false, null, 'This location reading is too old. Please try again.', $diagnostics);
        }

        if ($captured !== null && ($captured->lt(Carbon::now()->subSeconds(self::MAX_FIX_AGE_SECONDS)) || $captured->gt(Carbon::now()->addMinute()))) {
            $diagnostics['failure_reason'] = 'stale_location';

            return $this->result('stale', false, null, 'This location reading is too old. Please try again.', $diagnostics);
        }

        $distance = $this->distanceInMeters($latitude, $longitude, $venueLat, $venueLng);
        $diagnostics['distance_meters'] = round($distance, 1);

        if (! is_finite($accuracy) || $accuracy <= 0 || $accuracy > self::MAX_ACCEPTABLE_ACCURACY_METERS) {
            $diagnostics['failure_reason'] = 'poor_accuracy';

            return $this->result(
                'accuracy_too_low',
                false,
                $distance,
                'Location accuracy is too low. Please enable GPS/location services, move to an area with a clearer GPS signal, and try again.',
                $diagnostics,
            );
        }

        if (($distance - $accuracy) > $radius) {
            $diagnostics['failure_reason'] = 'out_of_range';

            return $this->result(
                'out_of_range',
                false,
                $distance,
                sprintf(
                    'You are outside the permitted attendance location. Please move within the required range and try again. You are currently about %dm away. Required range: %dm.',
                    (int) round($distance),
                    (int) round($radius),
                ),
                $diagnostics,
            );
        }

        $diagnostics['failure_reason'] = null;

        return $this->result('verified', true, $distance, 'Location verified.', $diagnostics);
    }

    public function distanceInMeters(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $earthRadius = 6371000.0;
        $phi1 = deg2rad($lat1);
        $phi2 = deg2rad($lat2);
        $deltaPhi = deg2rad($lat2 - $lat1);
        $deltaLambda = deg2rad($lon2 - $lon1);
        $a = sin($deltaPhi / 2) ** 2 + cos($phi1) * cos($phi2) * sin($deltaLambda / 2) ** 2;

        return $earthRadius * (2 * atan2(sqrt($a), sqrt(1 - $a)));
    }

    /**
     * @param  array<string, mixed>  $diagnostics
     * @return array{status: string, accepted: bool, distance: float|null, message: string, diagnostics: array<string, mixed>}
     */
    private function result(string $status, bool $accepted, ?float $distance, string $message, array $diagnostics): array
    {
        $diagnostics['result'] = $status;

        return [
            'status' => $status,
            'accepted' => $accepted,
            'distance' => $distance === null ? null : round($distance, 1),
            'message' => $message,
            'diagnostics' => $diagnostics,
        ];
    }

    private function finite(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (! is_numeric($value)) {
            return null;
        }

        $number = (float) $value;

        return is_finite($number) ? $number : null;
    }

    private function validCoordinate(float $latitude, float $longitude): bool
    {
        return $latitude >= -90 && $latitude <= 90 && $longitude >= -180 && $longitude <= 180;
    }

    private function parseCapturedAt(mixed $capturedAt): ?Carbon
    {
        if ($capturedAt === null || $capturedAt === '') {
            return null;
        }

        if (is_numeric($capturedAt)) {
            $value = (float) $capturedAt;
            $seconds = $value > 100000000000 ? (int) round($value / 1000) : (int) round($value);

            return Carbon::createFromTimestamp($seconds);
        }

        try {
            return Carbon::parse((string) $capturedAt);
        } catch (\Throwable) {
            return null;
        }
    }
}
