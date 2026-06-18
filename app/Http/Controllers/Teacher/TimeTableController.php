<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\TimeTable;
use App\Models\RescheduledSession;
use App\Models\ClassRoom;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;

class TimeTableController extends Controller
{
    public function index(Request $request)
    {
        $teacherId = auth('teacher')->id();

        $query = TimeTable::with(['academicYear', 'course.program', 'course.teacher', 'classRoom'])
            ->where('teacher_id', $teacherId)
            ->where('staff_type', \App\Models\Teacher::STAFF_TYPE_LECTURER)
            ->orderBy('day_of_week')
            ->orderBy('start_time');

        $timeTables = $query->get();

        $reschedules = RescheduledSession::with(['timetable.course'])
            ->where('teacher_id', $teacherId)
            ->orderBy('created_at', 'desc')
            ->get();

        return Inertia::render('teacher/timetable/index', [
            'timeTables' => $timeTables->map(function ($t) {
                return [
                    'id' => $t->id,
                    'day' => $t->day_of_week ?? $t->day,
                    'start_time' => $t->start_time,
                    'end_time' => $t->end_time,
                    'course' => $t->course ? ['id' => $t->course->id, 'name' => $t->course->name, 'course_code' => $t->course->course_code] : null,
                    'program' => $t->course && $t->course->program ? ['id' => $t->course->program->id, 'name' => $t->course->program->name] : null,
                    'classroom' => $t->classRoom ? ['id' => $t->classRoom->id, 'name' => $t->classRoom->name] : null,
                    'academic_year' => $t->academicYear ? ['id' => $t->academicYear->id, 'name' => $t->academicYear->name] : null,
                ];
            }),
            'reschedules' => $reschedules->map(function ($r) {
                // fallback: try to load timetable->course name; if missing, fetch timetable directly
                $courseName = null;
                if ($r->timetable && $r->timetable->course && $r->timetable->course->name) {
                    $courseName = $r->timetable->course->name;
                } else {
                    try {
                        $tt = TimeTable::with('course')->find($r->timetable_id);
                        if ($tt && $tt->course) $courseName = $tt->course->name;
                    } catch (\Exception $e) {
                        $courseName = null;
                    }
                }

                // original_day: derive weekday name from original_date if possible
                $originalDay = null;
                if (!empty($r->original_date)) {
                    try {
                        $originalDay = Carbon::parse($r->original_date)->format('l');
                    } catch (\Exception $e) {
                        $originalDay = null;
                    }
                }

                return [
                    'id' => $r->id,
                    'timetable_id' => $r->timetable_id,
                    'course_name' => $courseName,
                    'original_day' => $originalDay,
                    'original_date' => $r->original_date,
                    'original_start_time' => $r->original_start_time,
                    'original_end_time' => $r->original_end_time,
                    'new_date' => $r->new_date,
                    'new_start_time' => $r->new_start_time,
                    'new_end_time' => $r->new_end_time,
                    'reason' => $r->reason,
                    'note' => $r->note,
                    'status' => $r->status,
                    'created_at' => $r->created_at,
                ];
            }),
            'classrooms' => ClassRoom::where('is_active', true)->orderBy('name')->get(['id','name']),
        ]);
    }

    /**
     * Export timetable for authenticated teacher. Supports csv or print view.
     */
    public function export(Request $request)
    {
        $teacherId = auth('teacher')->id();
        $format = $request->get('format', 'csv');

        $timeTables = TimeTable::with(['academicYear', 'course.program', 'course.teacher', 'classRoom'])
            ->where('teacher_id', $teacherId)
            ->where('staff_type', \App\Models\Teacher::STAFF_TYPE_LECTURER)
            ->orderBy('day_of_week')
            ->orderBy('start_time')
            ->get();

        if ($format === 'print') {
            return Inertia::render('teacher/timetable/print', [
                'timeTables' => $timeTables,
            ]);
        }

        // PDF export (server-side) - requires barryvdh/laravel-dompdf
        if ($format === 'pdf') {
            $filename = 'timetable_' . $teacherId . '_' . now()->format('Ymd_His') . '.pdf';

            // Use the PDF facade if available; otherwise throw a helpful exception
            if (!class_exists('\\Barryvdh\\DomPDF\\Facade\\Pdf')) {
                abort(500, 'PDF export requires the barryvdh/laravel-dompdf package. Run: composer require barryvdh/laravel-dompdf');
            }

            $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('teacher.timetable_pdf', ['timeTables' => $timeTables]);
            $pdf->setPaper('a4', 'landscape');

            return $pdf->download($filename);
        }

        // CSV export
        $filename = 'timetable_' . $teacherId . '_' . now()->format('Ymd_His') . '.csv';
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ];

        return response()->streamDownload(function () use ($timeTables) {
            $out = fopen('php://output', 'w');
            // BOM for Excel
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, ['Day', 'Start Time', 'End Time', 'Course Code', 'Course Name', 'Program', 'Classroom', 'Academic Year']);
            foreach ($timeTables as $t) {
                fputcsv($out, [
                    $t->day_of_week ?? $t->day,
                    $t->start_time,
                    $t->end_time,
                    $t->course->course_code ?? '',
                    $t->course->name ?? '',
                    $t->course->program->name ?? '',
                    $t->classRoom->name ?? '',
                    $t->academicYear->name ?? '',
                ]);
            }
            fclose($out);
        }, $filename, $headers);
    }
}
