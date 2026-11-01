<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreTeacherFaceEnrollmentRequest;
use App\Models\StaffFaceProfile;
use App\Models\Teacher;
use App\Services\FaceServiceClient;
use App\Services\FaceServiceException;
use App\Services\FacialRecognitionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class TeacherFaceEnrollmentController extends Controller
{
    public function store(StoreTeacherFaceEnrollmentRequest $request, Teacher $teacher, FacialRecognitionService $facialRecognition): JsonResponse
    {
        if ($facialRecognition->usesArcFace()) {
            return $this->storeArcFaceProfile($request, $teacher, $facialRecognition);
        }

        $teacher->forceFill([
            'face_descriptor' => $facialRecognition->normalizeDescriptor($request->validated('face_descriptor')),
            'face_registered_at' => now(),
        ])->save();

        return response()->json([
            'success' => true,
            'message' => 'Face enrollment saved successfully.',
            'face_enrollment_status' => $teacher->faceEnrollmentStatus(),
            'face_registered_at' => $teacher->face_registered_at?->toIso8601String(),
        ]);
    }

    public function destroy(Teacher $teacher): JsonResponse
    {
        $teacher->faceProfiles()->update([
            'is_active' => false,
            'migration_required' => true,
        ]);
        $teacher->forceFill([
            'face_descriptor' => null,
            'face_registered_at' => null,
        ])->save();

        return response()->json([
            'success' => true,
            'message' => 'Face enrollment removed successfully.',
            'face_enrollment_status' => $teacher->fresh()->faceEnrollmentStatus(),
        ]);
    }

    public function requireReenrollment(Teacher $teacher): JsonResponse
    {
        $teacher->faceProfiles()->update([
            'is_active' => false,
            'migration_required' => true,
        ]);

        Log::info('FACE_ENROLLMENT_FAILED', [
            'teacher_id' => $teacher->id,
            'reason' => 'reenrollment_required',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'This staff member must enroll their face again before verification can continue.',
            'face_enrollment_status' => $teacher->fresh()->faceEnrollmentStatus(),
        ]);
    }

    private function storeArcFaceProfile(
        StoreTeacherFaceEnrollmentRequest $request,
        Teacher $teacher,
        FacialRecognitionService $facialRecognition,
    ): JsonResponse {
        try {
            $result = app(FaceServiceClient::class)->enroll(
                $request->validated('images'),
                $facialRecognition->livenessEnabled(),
            );
        } catch (FaceServiceException $exception) {
            Log::warning('FACE_ENROLLMENT_FAILED', [
                'teacher_id' => $teacher->id,
                'reason' => $exception->errorCode,
            ]);

            return response()->json([
                'success' => false,
                'message' => $exception->publicMessage,
            ], 503);
        }

        $status = (string) ($result['status'] ?? 'SERVICE_UNAVAILABLE');
        $embedding = $result['embedding'] ?? null;
        if ($status !== 'READY' || ! is_array($embedding) || count($embedding) < 32) {
            Log::warning('FACE_ENROLLMENT_FAILED', [
                'teacher_id' => $teacher->id,
                'status' => $status,
            ]);

            return response()->json([
                'success' => false,
                'message' => FacialRecognitionService::staffMessage($status),
            ], 422);
        }

        StaffFaceProfile::query()->updateOrCreate(
            ['teacher_id' => $teacher->id],
            [
                'embedding' => array_map('floatval', $embedding),
                'embedding_dimension' => (int) ($result['embedding_dimension'] ?? count($embedding)),
                'embedding_model' => (string) ($result['embedding_model'] ?? 'w600k_r50'),
                'embedding_version' => (string) ($result['embedding_version'] ?? 'buffalo_l-arcface-r50'),
                'quality_score' => $result['quality_score'] ?? null,
                'liveness_score' => $result['liveness_score'] ?? null,
                'enrolled_at' => now(),
                'is_active' => true,
                'migration_required' => false,
            ],
        );

        $teacher->forceFill(['face_registered_at' => now()])->save();

        Log::info('FACE_ENROLLMENT_SUCCESS', [
            'teacher_id' => $teacher->id,
            'model' => $result['embedding_model'] ?? 'w600k_r50',
            'processing_time_ms' => $result['processing_time_ms'] ?? null,
        ]);

        $teacher = $teacher->fresh();

        return response()->json([
            'success' => true,
            'message' => 'Face enrollment saved successfully.',
            'face_enrollment_status' => $teacher->faceEnrollmentStatus(),
            'face_registered_at' => $teacher->face_registered_at?->toIso8601String(),
        ]);
    }
}
