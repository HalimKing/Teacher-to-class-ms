<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\SessionReminder;
use App\Models\TimeTable;
use Illuminate\Http\Request;
use Inertia\Inertia;

class SessionReminderController extends Controller
{
    public function index(Request $request)
    {
        $teacherId = auth('teacher')->id();
        $filter = $request->query('filter', 'upcoming'); // upcoming | past | all

        $query = SessionReminder::with('timetable.course', 'timetable.classRoom')
            ->where('teacher_id', $teacherId)
            ->orderBy('reminder_at', 'desc');

        if ($filter === 'upcoming') {
            $query->where('reminder_at', '>=', now())->whereNull('triggered_at');
        } elseif ($filter === 'past') {
            $query->where(function ($q) {
                $q->where('reminder_at', '<', now())->orWhereNotNull('triggered_at');
            });
        }

        $reminders = $query->get()->map(function ($r) {
            return [
                'id' => $r->id,
                'title' => $r->title,
                'message' => $r->message,
                'send_via' => $r->send_via ?? 'mail',
                'status' => $r->status ?? 'pending',
                'error_message' => $r->error_message,
                'reminder_at' => $r->reminder_at->toIso8601String(),
                'triggered_at' => $r->triggered_at?->toIso8601String(),
                'timetable_id' => $r->timetable_id,
                'session' => $r->timetable ? [
                    'id' => $r->timetable->id,
                    'day' => $r->timetable->day,
                    'start_time' => $r->timetable->start_time,
                    'end_time' => $r->timetable->end_time,
                    'course' => $r->timetable->course ? $r->timetable->course->name : null,
                    'course_code' => $r->timetable->course ? $r->timetable->course->course_code : null,
                    'classroom' => $r->timetable->classRoom ? $r->timetable->classRoom->name : null,
                ] : null,
            ];
        });

        $timetableOptions = TimeTable::with(['course', 'classRoom'])
            ->where('teacher_id', $teacherId)
            ->where('staff_type', \App\Models\Teacher::STAFF_TYPE_LECTURER)
            ->orderBy('day_of_week')
            ->orderBy('start_time')
            ->get()
            ->map(function ($t) {
                return [
                    'id' => $t->id,
                    'label' => $t->day . ' ' . substr($t->start_time, 0, 5) . ' - ' . ($t->course ? $t->course->name : '') . ($t->classRoom ? ' (' . $t->classRoom->name . ')' : ''),
                    'day' => $t->day_of_week ?? $t->day,
                    'start_time' => $t->start_time,
                    'end_time' => $t->end_time,
                    'course_name' => $t->course ? $t->course->name : null,
                    'classroom_name' => $t->classRoom ? $t->classRoom->name : null,
                ];
            });

        return Inertia::render('teacher/reminders/index', [
            'reminders' => $reminders,
            'timetableOptions' => $timetableOptions,
            'filter' => $filter,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'message' => 'nullable|string|max:1000',
            'reminder_at' => 'required|date',
            'timetable_id' => 'nullable|exists:time_tables,id',
            'send_via' => 'nullable|in:mail,sms,both',
        ]);

        $teacherId = auth('teacher')->id();

        if (!empty($validated['timetable_id'])) {
            $belongsToTeacher = TimeTable::where('id', $validated['timetable_id'])
                ->where('teacher_id', $teacherId)
                ->where('staff_type', \App\Models\Teacher::STAFF_TYPE_LECTURER)
                ->exists();
            if (!$belongsToTeacher) {
                return back()->withErrors(['timetable_id' => 'Invalid session.']);
            }
        }

        SessionReminder::create([
            'teacher_id' => $teacherId,
            'timetable_id' => $validated['timetable_id'] ?? null,
            'title' => $validated['title'],
            'message' => $validated['message'] ?? null,
            'send_via' => $validated['send_via'] ?? 'mail',
            'reminder_at' => $validated['reminder_at'],
        ]);

        return redirect()->route('teacher.reminders.index')->with('success', 'Reminder created.');
    }

    public function update(Request $request, SessionReminder $reminder)
    {
        if ($reminder->teacher_id !== auth('teacher')->id()) {
            abort(403);
        }

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'message' => 'nullable|string|max:1000',
            'reminder_at' => 'required|date',
            'timetable_id' => 'nullable|exists:time_tables,id',
            'send_via' => 'nullable|in:mail,sms,both',
        ]);

        $teacherId = auth('teacher')->id();
        if (!empty($validated['timetable_id'])) {
            $belongsToTeacher = TimeTable::where('id', $validated['timetable_id'])
                ->where('teacher_id', $teacherId)
                ->where('staff_type', \App\Models\Teacher::STAFF_TYPE_LECTURER)
                ->exists();
            if (!$belongsToTeacher) {
                return back()->withErrors(['timetable_id' => 'Invalid session.']);
            }
        }

        $reminder->update([
            'timetable_id' => $validated['timetable_id'] ?? null,
            'title' => $validated['title'],
            'message' => $validated['message'] ?? null,
            'send_via' => $validated['send_via'] ?? 'mail',
            'reminder_at' => $validated['reminder_at'],
        ]);

        return redirect()->route('teacher.reminders.index')->with('success', 'Reminder updated.');
    }

    public function destroy(SessionReminder $reminder)
    {
        if ($reminder->teacher_id !== auth('teacher')->id()) {
            abort(403);
        }
        $reminder->delete();
        return redirect()->route('teacher.reminders.index')->with('success', 'Reminder deleted.');
    }

    public function resend(SessionReminder $reminder)
    {
        if ($reminder->teacher_id !== auth('teacher')->id()) {
            abort(403);
        }

        if ($reminder->status !== 'failed') {
            return back()->with('error', 'Only failed reminders can be retried.');
        }

        // log retry request
        logger()->info('Reminder retry requested', ['reminder_id' => $reminder->id, 'teacher_id' => auth('teacher')->id()]);

        // reset state and dispatch
        $reminder->update([
            'status' => 'processing',
            'error_message' => null,
            'triggered_at' => null,
        ]);

        \App\Jobs\SendSessionReminderJob::dispatch($reminder->id);

        logger()->info('Reminder retry dispatched', ['reminder_id' => $reminder->id, 'teacher_id' => auth('teacher')->id()]);

        return back()->with('success', 'Retry dispatched.');
    }
}
