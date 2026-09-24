<?php

namespace App\Http\Controllers\Concerns;

use App\Models\AttendanceActivityLog;
use App\Models\ClassRoom;
use App\Models\SystemSetting;
use App\Services\AttendanceGeofenceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

trait EnforcesAttendanceGeofence
{
    /**
     * Recalculate the geofence on the server. Returns a rejection response, or null when attendance may continue.
     * When the reading is verified, the request distance and within_range are replaced with the server result.
     */
    protected function rejectUnlessInsideVenue(
        Request $request,
        ?ClassRoom $classroom,
        ?int $teacherId,
        ?int $timetableId,
    ): ?JsonResponse {
        if (! SystemSetting::getValue('gps_enforcement_enabled', true)) {
            return null;
        }

        $verdict = app(AttendanceGeofenceService::class)->verify(
            (float) $request->input('coordinates.latitude'),
            (float) $request->input('coordinates.longitude'),
            (float) $request->input('coordinates.accuracy'),
            $request->input('coordinates.captured_at'),
            $classroom?->latitude,
            $classroom?->longitude,
            $classroom?->radius_meters,
        );

        if ($verdict['status'] === 'verified') {
            $request->merge([
                'distance' => $verdict['distance'],
                'within_range' => true,
            ]);
        }

        if ($verdict['accepted']) {
            return null;
        }

        AttendanceActivityLog::logAttempt('attempt_failed', $teacherId, $timetableId, array_merge($verdict['diagnostics'], [
            'reason' => $verdict['diagnostics']['failure_reason'] ?? 'geofence_rejected',
            'browser' => $request->userAgent(),
        ]));

        return response()->json([
            'success' => false,
            'message' => $verdict['message'],
            'location' => [
                'status' => $verdict['status'],
                'distance' => $verdict['distance'],
                'accuracy' => $verdict['diagnostics']['accuracy_meters'] ?? null,
                'radius' => $verdict['diagnostics']['radius_meters'] ?? null,
            ],
        ], 422);
    }
}
