<?php

namespace App\Http\Controllers\Admin\SchoolManagement;

use App\Http\Controllers\Controller;
use App\Services\RescheduleNotificationService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\RescheduledSession;
use App\Models\TimeTable;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SchedulesController extends Controller
{
    public function __construct(
        private RescheduleNotificationService $rescheduleNotificationService,
    ) {}

    public function index(Request $request)
    {
        $q = RescheduledSession::with(['timetable.course.program', 'timetable.course.teacher', 'classroom']);

        if ($status = $request->get('status')) {
            $q->where('status', $status);
        }

        if ($search = $request->get('search')) {
            $q->whereHas('timetable.course', function ($qq) use ($search) {
                $qq->where('name', 'like', "%{$search}%")->orWhere('course_code', 'like', "%{$search}%");
            })->orWhereHas('timetable.course.teacher', function ($qq) use ($search) {
                $qq->where('first_name', 'like', "%{$search}%")->orWhere('last_name', 'like', "%{$search}%");
            });
        }

        // Date range filter for requested new_date
        $dateFrom = $request->get('date_from');
        $dateTo = $request->get('date_to');
        if ($dateFrom && $dateTo) {
            try {
                define('DATE_FORMAT', 'Y-m-d');
                
                $from = Carbon::parse($dateFrom)->startOfDay()->toDateString();
                $to = Carbon::parse($dateTo)->endOfDay()->toDateString();
                $q->whereBetween('new_date', [$from, $to]);
            } catch (\Exception $e) {
                // ignore parse errors and do not apply date filter
            }
        } elseif ($dateFrom) {
            try {
                $from = Carbon::parse($dateFrom)->startOfDay()->toDateString();
                $q->where('new_date', '>=', $from);
            } catch (\Exception $e) {
            }
        } elseif ($dateTo) {
            try {
                $to = Carbon::parse($dateTo)->endOfDay()->toDateString();
                $q->where('new_date', '<=', $to);
            } catch (\Exception $e) {
            }
        }

        $items = $q->orderBy('created_at', 'desc')->paginate(25)->appends($request->all());

        return Inertia::render('admin/school-management/schedules/index', [
            'schedules' => $items,
            'filters' => $request->only(['status','search']),
        ]);
    }

    public function show(RescheduledSession $schedule)
    {
        $schedule->load(['timetable.course.program', 'timetable.course.teacher', 'classroom']);
        return Inertia::render('admin/school-management/schedules/show', ['schedule' => $schedule]);
    }

    public function approve(Request $request, RescheduledSession $schedule)
    {
        $data = $request->validate([
            'admin_remarks' => 'nullable|string',
        ]);

        try {
            

        // conflict checks: ensure no approved timetable/reschedule conflict for teacher or classroom
        $newDay = Carbon::parse($schedule->new_date)->format('l');
        $ns = $schedule->new_start_time;
        $ne = $schedule->new_end_time;
        $conflict = TimeTable::where(function($q) use ($schedule) {
            $q->where('teacher_id', $schedule->teacher_id)
              ->orWhere('class_room_id', $schedule->classroom_id);
        })->where('day', $newDay)
        ->where(function($q) use ($ns, $ne) {
            $q->whereBetween('start_time', [$ns, $ne])
              ->orWhereBetween('end_time', [$ns, $ne])
              ->orWhere(function($q2) use ($ns, $ne) {
                  $q2->where('start_time', '<', $ns)->where('end_time', '>', $ne);
              });
        })->exists();

        // dd($conflict);
        // also check approved reschedules that would collide
        $resConf = RescheduledSession::where('id', '!=', $schedule->id)
            ->where('status', 'approved')
            ->where('new_date', $schedule->new_date)
            ->where(function($q) use ($ns, $ne) {
                $q->whereBetween('new_start_time', [$ns, $ne])
                  ->orWhereBetween('new_end_time', [$ns, $ne])
                  ->orWhere(function($q2) use ($ns, $ne) {
                      $q2->where('new_start_time', '<', $ns)->where('new_end_time', '>', $ne);
                  });
            })->exists();
            // dd($resConf);
            if ($conflict || $resConf) {
                $message = 'Cannot approve: the requested time conflicts with existing approved sessions.';
                if ($request->ajax() || $request->wantsJson() || $request->header('X-Inertia')) {
                    throw ValidationException::withMessages(['admin_remarks' => [$message]]);
                }

                return redirect()->back()->with('error', $message);
            }

            DB::transaction(function () use ($schedule, $data) {
                // Do NOT modify the main TimeTable. Keep timetable entries unchanged
                // and record the reschedule approval separately on the RescheduledSession.
                $schedule->status = 'approved';
                $schedule->approved_by = auth()->id();
                $schedule->approved_at = now();
                $schedule->admin_remarks = $data['admin_remarks'] ?? null;
                $schedule->save();
            });

            $schedule->refresh();
            $this->rescheduleNotificationService->notifyTeacher($schedule, 'approved');

            return redirect()->route('admin.school-management.schedules.index')->with('success', 'Reschedule approved. The lecturer has been notified by email and dashboard alert.');
        } catch (\Throwable $e) {
            \Log::error('Error approving schedule: ' . $e->getMessage(), ['exception' => $e]);
            $message = 'Error approving schedule: ' . $e->getMessage();
            if ($request->ajax() || $request->wantsJson() || $request->header('X-Inertia')) {
                throw ValidationException::withMessages(['admin_remarks' => [$message]]);
            }

            return redirect()->back()->with('error', $message);
        }
    }

    public function reject(Request $request, RescheduledSession $schedule)
    {
        $data = $request->validate([
            'admin_remarks' => 'nullable|string',
        ]);

        try {
            $schedule->status = 'rejected';
            $schedule->approved_by = auth()->id();
            $schedule->approved_at = now();
            $schedule->admin_remarks = $data['admin_remarks'] ?? null;
            $schedule->save();

            $this->rescheduleNotificationService->notifyTeacher($schedule, 'rejected');

            return redirect()->route('admin.school-management.schedules.index')->with('success', 'Schedule rejected. The lecturer has been notified by email and dashboard alert.');
        } catch (\Throwable $e) {
            \Log::error('Error rejecting schedule: ' . $e->getMessage(), ['exception' => $e]);
            return redirect()->back()->with('error', 'Error rejecting schedule: ' . $e->getMessage());
        }
    }
}
