<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Http\Requests\Teacher\VerifyFaceRequest;
use App\Models\Teacher;
use App\Models\TimeTable;
use App\Services\FacialRecognitionService;
use Illuminate\Http\JsonResponse;

class FaceVerificationController extends Controller
{
    public function verify(VerifyFaceRequest $request, FacialRecognitionService $facialRecognition): JsonResponse
    {
        /** @var Teacher $teacher */
        $teacher = auth('teacher')->user();
        $timetableId = (int) $request->validated('timetable_id');

        $timetable = TimeTable::where('id', $timetableId)
            ->where('teacher_id', $teacher->id)
            ->where('staff_type', Teacher::STAFF_TYPE_LECTURER)
            ->first();

        if (!$timetable) {
            $facialRecognition->logAttempt($teacher, $timetableId, 'failed', null, 'invalid_timetable');

            return response()->json([
                'success' => false,
                'message' => 'Invalid timetable for facial verification.',
            ], 404);
        }

        if (!$facialRecognition->isEnabled()) {
            return response()->json([
                'success' => true,
                'message' => 'Facial recognition is disabled.',
                'verification_token' => null,
                'score' => null,
            ]);
        }

        if (!$teacher->hasFaceEnrollment()) {
            $facialRecognition->logAttempt($teacher, $timetableId, 'failed', null, 'not_enrolled');

            return response()->json([
                'success' => false,
                'message' => 'Face enrollment is required before attendance can be marked.',
            ], 422);
        }

        $score = $facialRecognition->compareDescriptors(
            $teacher->face_descriptor,
            $request->validated('face_descriptor')
        );

        if ($score > $facialRecognition->threshold()) {
            $facialRecognition->logAttempt($teacher, $timetableId, 'failed', $score, 'face_not_recognized');

            return response()->json([
                'success' => false,
                'message' => 'Face verification failed. Face not recognized.',
                'score' => $score,
            ], 422);
        }

        $facialRecognition->logAttempt($teacher, $timetableId, 'passed', $score);

        return response()->json([
            'success' => true,
            'message' => 'Face verification successful.',
            'verification_token' => $facialRecognition->issueVerificationToken($teacher, $timetableId, $score),
            'score' => $score,
        ]);
    }

    public function verifyStaff(VerifyFaceRequest $request, FacialRecognitionService $facialRecognition): JsonResponse
    {
        /** @var Teacher $teacher */
        $teacher = auth('teacher')->user();
        $timetableId = (int) $request->validated('timetable_id');

        $timetable = TimeTable::where('id', $timetableId)
            ->where('teacher_id', $teacher->id)
            ->where('staff_type', Teacher::STAFF_TYPE_ADMINISTRATOR)
            ->first();

        if (!$timetable) {
            $facialRecognition->logAttempt($teacher, $timetableId, 'failed', null, 'invalid_staff_timetable');

            return response()->json([
                'success' => false,
                'message' => 'Invalid staff schedule for facial verification.',
            ], 404);
        }

        if (!$facialRecognition->isEnabled()) {
            return response()->json([
                'success' => true,
                'message' => 'Facial recognition is disabled.',
                'verification_token' => null,
                'score' => null,
            ]);
        }

        if (!$teacher->hasFaceEnrollment()) {
            $facialRecognition->logAttempt($teacher, $timetableId, 'failed', null, 'not_enrolled');

            return response()->json([
                'success' => false,
                'message' => 'Face enrollment is required before staff attendance can be marked.',
            ], 422);
        }

        $score = $facialRecognition->compareDescriptors(
            $teacher->face_descriptor,
            $request->validated('face_descriptor')
        );

        if ($score > $facialRecognition->threshold()) {
            $facialRecognition->logAttempt($teacher, $timetableId, 'failed', $score, 'face_not_recognized');

            return response()->json([
                'success' => false,
                'message' => 'Face verification failed. Face not recognized.',
                'score' => $score,
            ], 422);
        }

        $facialRecognition->logAttempt($teacher, $timetableId, 'passed', $score);

        return response()->json([
            'success' => true,
            'message' => 'Face verification successful.',
            'verification_token' => $facialRecognition->issueVerificationToken($teacher, $timetableId, $score),
            'score' => $score,
        ]);
    }
}
