<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Http\Requests\Teacher\VerifyFaceRequest;
use App\Models\Teacher;
use App\Models\TimeTable;
use App\Services\FacialRecognitionService;
use App\Services\LecturerNotificationService;
use App\Services\RescheduledAttendanceService;
use App\Support\LecturerNotificationPayload;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

class FaceVerificationController extends Controller
{
    public function __construct(
        private LecturerNotificationService $lecturerNotifications,
        private RescheduledAttendanceService $rescheduledAttendance,
    ) {}

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

        if ($blocked = $this->rescheduledAttendance->assertSessionAttendanceAllowed(
            $timetable,
            now(),
            $this->rescheduledAttendance->resolveAttendanceContext($timetable, now())['rescheduled_session_id'],
        )) {
            return response()->json($blocked, 422);
        }

        if (!$facialRecognition->isEnabled()) {
            return response()->json([
                'success' => false,
                'message' => 'Facial recognition is disabled.',
                'verification_token' => null,
                'score' => null,
            ], 422);
        }

        return $this->performVerification(
            $facialRecognition,
            $teacher,
            $timetableId,
            $request->validated('face_descriptor'),
            $request->validated('quality'),
            'Face enrollment is required before attendance can be marked.',
            'Face verification failed. Face not recognized.',
        );
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
                'success' => false,
                'message' => 'Facial recognition is disabled.',
                'verification_token' => null,
                'score' => null,
            ], 422);
        }

        return $this->performVerification(
            $facialRecognition,
            $teacher,
            $timetableId,
            $request->validated('face_descriptor'),
            $request->validated('quality'),
            'Face enrollment is required before staff attendance can be marked.',
            'Face verification failed. Face not recognized.',
        );
    }

    /**
     * @param  array<int, float|int>  $faceDescriptor
     * @param  array<string, mixed>  $quality
     */
    private function performVerification(
        FacialRecognitionService $facialRecognition,
        Teacher $teacher,
        int $timetableId,
        array $faceDescriptor,
        array $quality,
        string $enrollmentRequiredMessage,
        string $faceNotRecognizedMessage,
    ): JsonResponse {
        try {
            $match = $facialRecognition->verifyLiveCapture($teacher, $faceDescriptor, $quality);
        } catch (ValidationException $exception) {
            $facialRecognition->logAttempt($teacher, $timetableId, 'failed', null, 'invalid_capture_quality');

            return response()->json([
                'success' => false,
                'message' => collect($exception->errors())->flatten()->first() ?? 'Invalid face capture quality.',
            ], 422);
        }

        if ($match['reason'] === 'not_enrolled') {
            $facialRecognition->logAttempt($teacher, $timetableId, 'failed', null, 'not_enrolled');
            $this->notifyFaceVerificationFailure(
                $teacher,
                'face_enrollment_required',
                'Face Enrollment Required',
                $enrollmentRequiredMessage,
            );

            return response()->json([
                'success' => false,
                'message' => $enrollmentRequiredMessage,
            ], 422);
        }

        if (!$match['matched']) {
            $facialRecognition->logAttempt($teacher, $timetableId, 'failed', $match['score'], 'face_not_recognized');
            $this->notifyFaceVerificationFailure(
                $teacher,
                'face_verification_failed',
                'Face Verification Failed',
                $faceNotRecognizedMessage,
            );

            return response()->json([
                'success' => false,
                'message' => $faceNotRecognizedMessage,
                'score' => $match['score'],
                'threshold' => $match['threshold'],
            ], 422);
        }

        $facialRecognition->logAttempt($teacher, $timetableId, 'passed', $match['score']);

        return response()->json([
            'success' => true,
            'message' => 'Face verification successful.',
            'verification_token' => $facialRecognition->issueVerificationToken($teacher, $timetableId, $match['score']),
            'score' => $match['score'],
            'threshold' => $match['threshold'],
        ]);
    }

    private function notifyFaceVerificationFailure(
        Teacher $teacher,
        string $type,
        string $title,
        string $message,
    ): void {
        $this->lecturerNotifications->notify($teacher, LecturerNotificationPayload::make(
            $type,
            LecturerNotificationPayload::CATEGORY_ATTENDANCE,
            LecturerNotificationPayload::PRIORITY_HIGH,
            $title,
            $message,
            '/teacher/attendance',
        ), false);
    }
}
