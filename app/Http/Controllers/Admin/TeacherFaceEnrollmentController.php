<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreTeacherFaceEnrollmentRequest;
use App\Models\Teacher;
use App\Services\FacialRecognitionService;
use Illuminate\Http\JsonResponse;

class TeacherFaceEnrollmentController extends Controller
{
    public function store(StoreTeacherFaceEnrollmentRequest $request, Teacher $teacher, FacialRecognitionService $facialRecognition): JsonResponse
    {
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
        $teacher->forceFill([
            'face_descriptor' => null,
            'face_registered_at' => null,
        ])->save();

        return response()->json([
            'success' => true,
            'message' => 'Face enrollment removed successfully.',
            'face_enrollment_status' => $teacher->faceEnrollmentStatus(),
        ]);
    }
}
