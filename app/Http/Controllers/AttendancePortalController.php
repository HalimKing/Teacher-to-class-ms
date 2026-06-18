<?php

namespace App\Http\Controllers;

use App\Http\Requests\AttendancePortalLoginRequest;
use App\Models\StaffAttendance;
use App\Models\Teacher;
use App\Models\TeacherAttendance;
use App\Services\ActivityLogService;
use App\Services\AttendancePortalService;
use App\Services\FacialRecognitionService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Inertia\Inertia;
use Inertia\Response;

class AttendancePortalController extends Controller
{
    public function __construct(
        private AttendancePortalService $portal,
        private ActivityLogService $activityLog,
    ) {}

    public function showLogin(Request $request): Response|RedirectResponse
    {
        if ($this->portal->isActive($request) && ! $this->portal->isExpired($request) && Auth::guard('teacher')->check()) {
            return redirect()->route('attendance.portal');
        }

        if ($this->portal->isActive($request)) {
            $this->portal->clear($request);
            Auth::guard('teacher')->logout();
        }

        return Inertia::render('attendance/login', [
            'timeoutMinutes' => config('attendance_portal.timeout_minutes', 30),
        ]);
    }

    public function login(AttendancePortalLoginRequest $request): RedirectResponse
    {
        $key = 'attendance-portal:'.$request->ip();
        if (RateLimiter::tooManyAttempts($key, config('attendance_portal.login_rate_limit', 10))) {
            return back()->withErrors([
                'staff_id' => 'Too many attempts. Please wait a moment and try again.',
            ]);
        }

        RateLimiter::hit($key, 60);

        $staffId = trim($request->validated('staff_id'));
        $teacher = Teacher::query()
            ->with(['department', 'faculty'])
            ->where('employee_id', $staffId)
            ->first();

        if (! $teacher) {
            $this->activityLog->logSecurityEvent(
                eventType: 'attendance_portal_login_failed',
                description: 'Invalid Staff ID used on attendance portal.',
                metadata: ['staff_id' => $staffId, 'ip' => $request->ip()],
            );

            return back()->withErrors([
                'staff_id' => 'Staff ID not found. Please check your ID and try again.',
            ]);
        }

        Auth::guard('web')->logout();
        Auth::guard('teacher')->logout();

        Auth::guard('teacher')->login($teacher);
        $request->session()->regenerate();
        $this->portal->start($request, $teacher);

        $this->activityLog->logSecurityEvent(
            eventType: 'attendance_portal_login',
            description: 'Staff signed in to attendance portal.',
            metadata: [
                'teacher_id' => $teacher->id,
                'employee_id' => $teacher->employee_id,
                'staff_type' => $teacher->staff_type,
            ],
        );

        RateLimiter::clear($key);

        return redirect()->route('attendance.portal');
    }

    public function portal(Request $request): Response
    {
        $teacher = $request->user('teacher');
        $teacher->loadMissing(['department', 'faculty']);
        $today = now()->toDateString();

        $attendanceSummary = $teacher->isLecturer()
            ? $this->lecturerAttendanceSummary($teacher->id, $today)
            : $this->staffAttendanceSummary($teacher->id, $today);

        return Inertia::render('attendance/portal', [
            'profile' => [
                'name' => trim("{$teacher->title} {$teacher->first_name} {$teacher->last_name}"),
                'employee_id' => $teacher->employee_id,
                'staff_type' => $teacher->staff_type,
                'role_label' => $teacher->isLecturer() ? 'Lecturer' : 'Administrator',
                'department' => $teacher->department?->name,
                'faculty' => $teacher->faculty?->name,
            ],
            'attendanceSummary' => $attendanceSummary,
        ]);
    }

    public function mark(FacialRecognitionService $facialRecognition): Response
    {
        $teacher = auth('teacher')->user();

        return Inertia::render('attendance/mark', [
            'staffType' => $teacher->staff_type,
            'roleLabel' => $teacher->isLecturer() ? 'Lecturer' : 'Administrator',
            'facialRecognitionEnabled' => $facialRecognition->isEnabled(),
        ]);
    }

    public function refresh(Request $request): RedirectResponse
    {
        $this->portal->touch($request);

        return back()->with('success', 'Session refreshed.');
    }

    public function logout(Request $request): RedirectResponse
    {
        $teacher = $request->user('teacher');

        if ($teacher) {
            $this->activityLog->logSecurityEvent(
                eventType: 'attendance_portal_logout',
                description: 'Staff signed out of attendance portal.',
                metadata: [
                    'teacher_id' => $teacher->id,
                    'employee_id' => $teacher->employee_id,
                ],
            );
        }

        $this->portal->clear($request);
        Auth::guard('teacher')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('attendance.login');
    }

    /**
     * @return array<string, mixed>
     */
    private function lecturerAttendanceSummary(int $teacherId, string $today): array
    {
        $records = TeacherAttendance::query()
            ->where('teacher_id', $teacherId)
            ->whereDate('date', $today)
            ->get();

        $active = $records->first(fn ($record) => $record->check_in_time && ! $record->check_out_time);

        return [
            'sessions_today' => $records->count(),
            'checked_in' => $active !== null,
            'completed' => $records->whereNotNull('check_out_time')->count(),
            'status_label' => $active
                ? 'Checked in'
                : ($records->whereNotNull('check_out_time')->count() > 0 ? 'Completed session(s)' : 'Not checked in'),
            'check_in_time' => $active?->check_in_time,
            'check_out_time' => $active?->check_out_time,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function staffAttendanceSummary(int $teacherId, string $today): array
    {
        $records = StaffAttendance::query()
            ->where('staff_id', $teacherId)
            ->whereDate('date', $today)
            ->get();

        $active = $records->first(fn ($record) => $record->check_in_time && ! $record->check_out_time);

        return [
            'sessions_today' => $records->count(),
            'checked_in' => $active !== null,
            'completed' => $records->whereNotNull('check_out_time')->count(),
            'status_label' => $active
                ? 'Checked in'
                : ($records->whereNotNull('check_out_time')->count() > 0 ? 'Completed shift' : 'Not checked in'),
            'check_in_time' => $active?->check_in_time,
            'check_out_time' => $active?->check_out_time,
        ];
    }
}
