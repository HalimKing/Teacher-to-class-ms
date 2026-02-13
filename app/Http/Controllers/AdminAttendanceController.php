<?php

namespace App\Http\Controllers;

use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Support\Facades\Log;
use App\Models\AdminAttendance;
use App\Models\Faculty;
use App\Models\Department;
use App\Models\Program;
use App\Models\Level;
use App\Models\AcademicYear;
use App\Models\TeacherAttendance;
use App\Models\Teacher;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AdminAttendanceController extends Controller
{
    public function index(Request $request)
    {
        $faculties = Faculty::all();
        $departments = Department::all();
        $programs = Program::all();
        $levels = Level::all();
        $academicYears = AcademicYear::all();

        return Inertia::render('admin/attendance/index', [
            'faculties' => $faculties,
            'departments' => $departments,
            'programs' => $programs,
            'levels' => $levels,
            'academicYears' => $academicYears,
        ]);
    }

    public function filter(Request $request)
    {
        $query = TeacherAttendance::query();
        if ($request->faculty_id) {
            $query->whereHas('teacher', function ($q) use ($request) {
                $q->where('faculty_id', $request->faculty_id);
            });
        }
        if ($request->department_id) {
            $query->whereHas('teacher', function ($q) use ($request) {
                $q->where('department_id', $request->department_id);
            });
        }
        if ($request->program_id) {
            $query->whereHas('course', function ($q) use ($request) {
                $q->where('program_id', $request->program_id);
            });
        }
        if ($request->level_id) {
            $query->whereHas('course', function ($q) use ($request) {
                $q->where('level_id', $request->level_id);
            });
        }
        if ($request->academic_year_id) {
            $query->where('academic_year_id', $request->academic_year_id);
        }
        if ($request->date) {
            $query->where('date', $request->date);
        }
        $records = $query->with(['teacher', 'course', 'classroom', 'academicYear'])->paginate(50);

        // Log admin attendance view
        AdminAttendance::create([
            'admin_id' => auth()->id(),
            'action' => 'viewed',
            'filters' => json_encode($request->all()),
            'date' => now()->toDateString(),
        ]);

        return response()->json(['records' => $records]);
    }

    public function export(Request $request)
    {
        $query = TeacherAttendance::query();
        if ($request->faculty_id) {
            $query->whereHas('teacher', function ($q) use ($request) {
                $q->where('faculty_id', $request->faculty_id);
            });
        }
        if ($request->department_id) {
            $query->whereHas('teacher', function ($q) use ($request) {
                $q->where('department_id', $request->department_id);
            });
        }
        if ($request->program_id) {
            $query->whereHas('course', function ($q) use ($request) {
                $q->where('program_id', $request->program_id);
            });
        }
        if ($request->level_id) {
            $query->whereHas('course', function ($q) use ($request) {
                $q->where('level_id', $request->level_id);
            });
        }
        if ($request->academic_year_id) {
            $query->where('academic_year_id', $request->academic_year_id);
        }
        if ($request->date) {
            $query->where('date', $request->date);
        }
        $records = $query->with(['teacher', 'course', 'classroom', 'academicYear'])->get();

        AdminAttendance::create([
            'admin_id' => auth()->id(),
            'action' => 'exported',
            'filters' => json_encode($request->all()),
            'date' => now()->toDateString(),
        ]);

        $exportData = $records->map(function ($rec) {
            return [
                'Teacher' => $rec->teacher?->first_name . ' ' . $rec->teacher?->last_name,
                'Course' => $rec->course?->name,
                'Classroom' => $rec->classroom?->name,
                'Date' => $rec->date,
                'Check In' => $rec->check_in_time,
                'Check Out' => $rec->check_out_time,
                'Status' => $rec->status,
            ];
        });

        $filename = 'teacher_attendance_export_' . now()->format('Ymd_His') . '.xlsx';

        return Excel::download(new \App\Exports\GenericArrayExport($exportData->toArray()), $filename);
    }
}
