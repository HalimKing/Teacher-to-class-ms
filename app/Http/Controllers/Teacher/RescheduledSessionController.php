<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use App\Models\RescheduledSession;
use App\Models\TimeTable;
use Carbon\Carbon;

class RescheduledSessionController extends Controller
{
    public function index()
    {
        $teacherId = auth('teacher')->id();
        $reschedules = RescheduledSession::where('teacher_id', $teacherId)->orderBy('created_at', 'desc')->get();
        return inertia('teacher/reschedules/index', [
            'reschedules' => $reschedules,
        ]);
    }

    public function store(Request $request)
    {
        $teacherId = auth('teacher')->id();

        $data = $request->validate([
            'timetable_id' => 'required|integer|exists:time_tables,id',
            'classroom_id' => 'required|integer|exists:class_rooms,id',
            'original_date' => 'required|date',
            'original_start_time' => 'required',
            'original_end_time' => 'required',
            'new_date' => 'required|date',
            'new_start_time' => 'required',
            'new_end_time' => 'required',
            'reason' => 'nullable|string|max:255',
            'note' => 'nullable|string',
        ]);

        $timetable = TimeTable::with('course')->findOrFail($data['timetable_id']);

        if (!$this->teacherOwnsTimetable($timetable, $teacherId)) {
            abort(403, 'You may only reschedule your own sessions.');
        }

        // ensure original date/time is in the future (upcoming session)
        try {
            $originalDt = Carbon::createFromFormat('Y-m-d H:i:s', $data['original_date'].' '.(strlen($data['original_start_time'])===5? $data['original_start_time'].':00':$data['original_start_time']));
        } catch (\Exception $e) {
            return back()->withErrors(['original_date' => 'Invalid original date/time.']);
        }
        if ($originalDt->lessThanOrEqualTo(now())) {
            return back()->withErrors(['original_date' => 'Original session must be in the future.']);
        }

        // conflict checks: teacher timetable conflicts (same day)
        $newDay = Carbon::parse($data['new_date'])->format('l');
        $newStart = $data['new_start_time'];
        $newEnd = $data['new_end_time'];

        $conflict = TimeTable::where('teacher_id', $teacherId)
            ->where('day', $newDay)
            ->where(function($q) use ($newStart, $newEnd) {
                $q->whereBetween('start_time', [$newStart, $newEnd])
                  ->orWhereBetween('end_time', [$newStart, $newEnd])
                  ->orWhere(function($q2) use ($newStart, $newEnd) {
                      $q2->where('start_time', '<', $newStart)->where('end_time', '>', $newEnd);
                  });
            })->exists();

        if ($conflict) {
            return back()->withErrors(['new_date' => 'The selected time conflicts with your other timetable entries.']);
        }

        // conflict checks: same class/program timetable conflict
        $classConflict = TimeTable::where('course_id', $timetable->course_id)
            ->where('day', $newDay)
            ->where(function($q) use ($newStart, $newEnd) {
                $q->whereBetween('start_time', [$newStart, $newEnd])
                  ->orWhereBetween('end_time', [$newStart, $newEnd])
                  ->orWhere(function($q2) use ($newStart, $newEnd) {
                      $q2->where('start_time', '<', $newStart)->where('end_time', '>', $newEnd);
                  });
            })->exists();

        if ($classConflict) {
            return back()->withErrors(['new_date' => 'The selected time conflicts with the class/program timetable.']);
        }

        // conflict checks with existing reschedules
        $otherRes = RescheduledSession::where('teacher_id', $teacherId)
            ->whereIn('status', ['pending','approved'])
            ->where('new_date', $data['new_date'])
            ->where(function($q) use ($newStart, $newEnd) {
                $q->whereBetween('new_start_time', [$newStart, $newEnd])
                  ->orWhereBetween('new_end_time', [$newStart, $newEnd])
                  ->orWhere(function($q2) use ($newStart, $newEnd) {
                      $q2->where('new_start_time', '<', $newStart)->where('new_end_time', '>', $newEnd);
                  });
            })->exists();

        if ($otherRes) {
            return back()->withErrors(['new_date' => 'The selected time conflicts with another rescheduled session.']);
        }

        $res = RescheduledSession::create([
            'timetable_id' => $data['timetable_id'],
            'classroom_id' => $data['classroom_id'] ?? null,
            'teacher_id' => $teacherId,
            'original_date' => $data['original_date'],
            'original_start_time' => $data['original_start_time'],
            'original_end_time' => $data['original_end_time'],
            'new_date' => $data['new_date'],
            'new_start_time' => $data['new_start_time'],
            'new_end_time' => $data['new_end_time'],
            'reason' => $data['reason'] ?? null,
            'note' => $data['note'] ?? null,
            'status' => 'pending',
        ]);

        Log::info('[Reschedule] created', ['id' => $res->id, 'teacher' => $teacherId, 'timetable' => $data['timetable_id']]);

        return redirect()->route('teacher.timetable')->with('success', 'Reschedule request submitted.');
    }

    private function teacherOwnsTimetable(TimeTable $timetable, int $teacherId): bool
    {
        if ((int) $timetable->teacher_id === $teacherId) {
            return true;
        }

        $courseTeacherId = $timetable->course?->teacher_id;

        return $courseTeacherId !== null && (int) $courseTeacherId === $teacherId;
    }
}
