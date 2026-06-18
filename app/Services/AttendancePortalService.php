<?php

namespace App\Services;

use App\Models\Teacher;
use Illuminate\Http\Request;

class AttendancePortalService
{
    public const SESSION_KEY = 'attendance_portal';

    public function start(Request $request, Teacher $teacher): void
    {
        $timestamp = now()->timestamp;

        $request->session()->put(self::SESSION_KEY, [
            'teacher_id' => $teacher->id,
            'employee_id' => $teacher->employee_id,
            'staff_type' => $teacher->staff_type,
            'started_at' => $timestamp,
            'last_activity_at' => $timestamp,
        ]);
    }

    public function isActive(Request $request): bool
    {
        return $request->session()->has(self::SESSION_KEY);
    }

    public function isExpired(Request $request): bool
    {
        $data = $request->session()->get(self::SESSION_KEY);

        if (! is_array($data)) {
            return true;
        }

        $timeoutSeconds = config('attendance_portal.timeout_minutes', 30) * 60;
        $lastActivity = (int) ($data['last_activity_at'] ?? $data['started_at'] ?? 0);

        return $lastActivity > 0 && (now()->timestamp - $lastActivity) > $timeoutSeconds;
    }

    public function touch(Request $request): void
    {
        if (! $this->isActive($request)) {
            return;
        }

        $data = $request->session()->get(self::SESSION_KEY, []);
        $data['last_activity_at'] = now()->timestamp;
        $request->session()->put(self::SESSION_KEY, $data);
    }

    public function clear(Request $request): void
    {
        $request->session()->forget(self::SESSION_KEY);
    }

    public function payload(Request $request): ?array
    {
        $data = $request->session()->get(self::SESSION_KEY);

        return is_array($data) ? $data : null;
    }

    public function allowedPath(Request $request): bool
    {
        $path = trim($request->path(), '/');

        foreach (config('attendance_portal.allowed_path_prefixes', []) as $prefix) {
            $prefix = trim($prefix, '/');
            if ($path === $prefix || str_starts_with($path, $prefix.'/')) {
                return true;
            }
        }

        return false;
    }

    public function remainingMinutes(Request $request): int
    {
        $data = $this->payload($request);
        if (! $data) {
            return 0;
        }

        $timeoutSeconds = config('attendance_portal.timeout_minutes', 30) * 60;
        $lastActivity = (int) ($data['last_activity_at'] ?? $data['started_at'] ?? now()->timestamp);
        $elapsed = now()->timestamp - $lastActivity;

        return max(0, (int) ceil(($timeoutSeconds - $elapsed) / 60));
    }

    /**
     * @return array<string, mixed>|null
     */
    public function shareData(Request $request): ?array
    {
        if (! $this->isActive($request) || $this->isExpired($request)) {
            return null;
        }

        $teacher = $request->user('teacher');
        if (! $teacher) {
            return null;
        }

        $teacher->loadMissing(['department', 'faculty']);

        return [
            'active' => true,
            'employee_id' => $teacher->employee_id,
            'name' => trim("{$teacher->title} {$teacher->first_name} {$teacher->last_name}"),
            'staff_type' => $teacher->staff_type,
            'role_label' => $teacher->isLecturer() ? 'Lecturer' : 'Administrator',
            'department' => $teacher->department?->name,
            'faculty' => $teacher->faculty?->name,
            'timeout_minutes' => config('attendance_portal.timeout_minutes', 30),
            'remaining_minutes' => $this->remainingMinutes($request),
        ];
    }
}
