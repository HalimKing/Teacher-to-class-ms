<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\StaffAttendance;
use App\Models\Teacher;
use App\Models\TeacherAttendance;
use App\Services\LeadershipScope;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class UnitAttendanceController extends Controller
{
    public function __construct(
        private LeadershipScope $leadershipScope,
    ) {}

    public function index(Request $request): Response
    {
        /** @var Teacher $leader */
        $leader = auth('teacher')->user();

        $from = $request->filled('date_from')
            ? Carbon::parse($request->date_from)->toDateString()
            : now()->subDays(30)->toDateString();
        $to = $request->filled('date_to')
            ? Carbon::parse($request->date_to)->toDateString()
            : now()->toDateString();

        $staffQuery = $this->leadershipScope->applyToTeachers(Teacher::query(), $leader);
        $staffIds = (clone $staffQuery)->pluck('id');

        if ($request->filled('teacher_id')) {
            $requestedId = (int) $request->teacher_id;
            abort_unless($staffIds->contains($requestedId), 403);
            $staffIds = collect([$requestedId]);
        }

        $lecturerRecords = TeacherAttendance::query()
            ->with(['teacher:id,first_name,last_name,title,employee_id,faculty_id,department_id,staff_type'])
            ->whereIn('teacher_id', $staffIds)
            ->whereDate('date', '>=', $from)
            ->whereDate('date', '<=', $to)
            ->latest('date')
            ->limit(200)
            ->get()
            ->map(fn (TeacherAttendance $record) => [
                'id' => $record->id,
                'kind' => 'lecturer',
                'staff_name' => trim("{$record->teacher?->title} {$record->teacher?->first_name} {$record->teacher?->last_name}"),
                'employee_id' => $record->teacher?->employee_id,
                'staff_type' => $record->teacher?->staff_type,
                'date' => Carbon::parse($record->date)->toDateString(),
                'status' => $record->status,
                'check_in' => $record->check_in_time,
                'check_out' => $record->check_out_time,
            ]);

        $administratorRecords = StaffAttendance::query()
            ->with(['staff:id,first_name,last_name,title,employee_id,faculty_id,department_id,staff_type'])
            ->whereIn('staff_id', $staffIds)
            ->whereDate('date', '>=', $from)
            ->whereDate('date', '<=', $to)
            ->latest('date')
            ->limit(200)
            ->get()
            ->map(fn (StaffAttendance $record) => [
                'id' => $record->id,
                'kind' => 'administrator',
                'staff_name' => trim("{$record->staff?->title} {$record->staff?->first_name} {$record->staff?->last_name}"),
                'employee_id' => $record->staff?->employee_id,
                'staff_type' => $record->staff?->staff_type,
                'date' => Carbon::parse($record->date)->toDateString(),
                'status' => $record->attendance_status,
                'check_in' => $record->check_in_time,
                'check_out' => $record->check_out_time,
            ]);

        $records = $lecturerRecords
            ->concat($administratorRecords)
            ->sortByDesc('date')
            ->values();

        return Inertia::render('teacher/unit/attendance', [
            'records' => $records,
            'staff' => $staffQuery->orderBy('first_name')->get(['id', 'first_name', 'last_name', 'title', 'employee_id', 'staff_type']),
            'filters' => [
                'date_from' => $from,
                'date_to' => $to,
                'teacher_id' => $request->teacher_id,
            ],
            'leadershipScope' => $this->leadershipScope->summary($leader),
        ]);
    }
}
