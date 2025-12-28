<?php

namespace App\Http\Controllers\Admin\SchoolManagement;

use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Models\ClassRoom;
use App\Models\Course;
use App\Models\Program;
use App\Models\Teacher;
use App\Models\TimeTable;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;
use App\Exports\TimeTablesExport;
use Carbon\Carbon;

class TimeTableController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = TimeTable::with(['academicYear', 'course.program', 'course.teacher', 'classRoom'])
            ->latest();

        // Apply filters
        if ($request->filled('academic_year_id')) {
            $query->where('academic_year_id', $request->academic_year_id);
        }

        // Apply program filter
        if ($request->filled('program_id')) {
            $query->whereHas('course', function ($q) use ($request) {
                $q->where('program_id', $request->program_id);
            });
        }

        if ($request->filled('course_id')) {
            $query->where('course_id', $request->course_id);
        }

        if ($request->filled('class_room_id')) {
            $query->where('class_room_id', $request->class_room_id);
        }

        if ($request->filled('teacher_id')) {
            $query->whereHas('course', function ($q) use ($request) {
                $q->where('teacher_id', $request->teacher_id);
            });
        }

        if ($request->filled('day')) {
            $query->where('day', $request->day);
        }

        $timeTables = $query->paginate(10);

        // Get courses with teachers for filtering
        $courseOptions = Course::with('teacher', 'program')
            ->orderBy('name')
            ->get()
            ->map(function ($course) {
                return [
                    'value' => $course->id,
                    'label' => $course->name . ' (' . $course->course_code . ')' . 
                              ($course->teacher ? ' - ' . $course->teacher->full_name : '')
                ];
            });

        return Inertia::render('admin/academics/time-table/index', [
            'timeTables' => $timeTables,
            'academicYearOptions' => AcademicYear::active()->get()->map(function ($year) {
                return [
                    'value' => $year->id,
                    'label' => $year->name
                ];
            }),
            'programOptions' => Program::orderBy('name')->get()->map(function ($program) {
                return [
                    'value' => $program->id,
                    'label' => $program->name . ($program->program_code ? ' (' . $program->program_code . ')' : '')
                ];
            }),
            'courseOptions' => $courseOptions,
            'classRoomOptions' => ClassRoom::orderBy('name')->get()->map(function ($room) {
                return [
                    'value' => $room->id,
                    'label' => $room->name . ' - Capacity: ' . $room->capacity
                ];
            }),
            'dayOptions' => [
                ['value' => 'Monday', 'label' => 'Monday'],
                ['value' => 'Tuesday', 'label' => 'Tuesday'],
                ['value' => 'Wednesday', 'label' => 'Wednesday'],
                ['value' => 'Thursday', 'label' => 'Thursday'],
                ['value' => 'Friday', 'label' => 'Friday'],
                ['value' => 'Saturday', 'label' => 'Saturday'],
                ['value' => 'Sunday', 'label' => 'Sunday'],
            ],
            'filters' => $request->only(['academic_year_id', 'program_id', 'course_id', 'class_room_id', 'teacher_id', 'day']),
        ]);
    }

    /**
     * Export time tables based on filters
     */
    public function export(Request $request, $format = 'excel')
    {
        // Apply the same filters as index method
        $query = TimeTable::with(['academicYear', 'course.program', 'course.teacher', 'classRoom'])
            ->latest();

        // Apply filters (same as index method)
        if ($request->filled('academic_year_id')) {
            $query->where('academic_year_id', $request->academic_year_id);
        }

        if ($request->filled('program_id')) {
            $query->whereHas('course', function ($q) use ($request) {
                $q->where('program_id', $request->program_id);
            });
        }

        if ($request->filled('course_id')) {
            $query->where('course_id', $request->course_id);
        }

        if ($request->filled('class_room_id')) {
            $query->where('class_room_id', $request->class_room_id);
        }

        if ($request->filled('teacher_id')) {
            $query->whereHas('course', function ($q) use ($request) {
                $q->where('teacher_id', $request->teacher_id);
            });
        }

        if ($request->filled('day')) {
            $query->where('day', $request->day);
        }

        $timeTables = $query->get();

        // Generate filename with filters
        $filename = $this->generateExportFilename($request, $format);

        if ($format === 'csv') {
            return $this->exportToCsv($timeTables, $filename);
        }

        // Default to Excel export using Laravel Excel
        return Excel::download(new TimeTablesExport($timeTables), $filename);
    }

    /**
     * Export to CSV (simple implementation)
     */
    private function exportToCsv($timeTables, $filename)
    {
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ];

        return response()->streamDownload(function () use ($timeTables) {
            $output = fopen('php://output', 'w');
            
            // Add UTF-8 BOM for Excel compatibility
            fwrite($output, "\xEF\xBB\xBF");
            
            // Add headers
            $headers = [
                'Day',
                'Start Time',
                'End Time',
                'Duration',
                'Course Code',
                'Course Name',
                'Program',
                'Program Code',
                'Classroom',
                'Classroom Capacity',
                'Teacher',
                'Teacher ID',
                'Academic Year',
                'Academic Year Period',
            ];
            fputcsv($output, $headers);
            
            // Add data rows
            foreach ($timeTables as $timetable) {
                $row = [
                    'Day' => $timetable->day,
                    'Start Time' => $this->formatTimeForExport($timetable->start_time),
                    'End Time' => $this->formatTimeForExport($timetable->end_time),
                    'Duration' => $this->calculateDuration($timetable->start_time, $timetable->end_time),
                    'Course Code' => $timetable->course->course_code ?? 'N/A',
                    'Course Name' => $timetable->course->name ?? 'N/A',
                    'Program' => $timetable->course->program->name ?? 'N/A',
                    'Program Code' => $timetable->course->program->program_code ?? 'N/A',
                    'Classroom' => $timetable->classRoom->name ?? 'N/A',
                    'Classroom Capacity' => $timetable->classRoom->capacity ?? 'N/A',
                    'Teacher' => $timetable->course->teacher ? 
                        $timetable->course->teacher->title . ' ' . 
                        $timetable->course->teacher->first_name . ' ' . 
                        $timetable->course->teacher->last_name : 'Not Assigned',
                    'Teacher ID' => $timetable->course->teacher->employee_id ?? 'N/A',
                    'Academic Year' => $timetable->academicYear->name ?? 'N/A',
                    'Academic Year Period' => $timetable->course->academicPeriod->name ?? '',
                ];
                fputcsv($output, $row);
            }
            
            fclose($output);
        }, $filename, $headers);
    }

    /**
     * Generate export filename based on filters
     */
    private function generateExportFilename(Request $request, $format)
    {
        $parts = ['timetables'];
        
        // Add filter info to filename
        if ($request->filled('academic_year_id')) {
            $academicYear = AcademicYear::find($request->academic_year_id);
            if ($academicYear) {
                $parts[] = preg_replace('/[^a-zA-Z0-9_-]/', '_', $academicYear->name);
            }
        }
        
        if ($request->filled('program_id')) {
            $program = Program::find($request->program_id);
            if ($program) {
                $parts[] = preg_replace('/[^a-zA-Z0-9_-]/', '_', $program->name);
            }
        }
        
        if ($request->filled('day')) {
            $parts[] = $request->day;
        }
        
        $parts[] = Carbon::now()->format('Y_m_d_H_i_s');
        
        if ($format === 'csv') {
            $filename = implode('_', $parts) . '.csv';
        } else {
            $filename = implode('_', $parts) . '.xlsx';
        }
        
        return $filename;
    }

    /**
     * Format time for export (24-hour format)
     */
    private function formatTimeForExport($time)
    {
        return Carbon::parse($time)->format('H:i');
    }

    /**
     * Calculate duration for export
     */
    private function calculateDuration($start, $end)
    {
        $startTime = Carbon::parse($start);
        $endTime = Carbon::parse($end);
        
        $hours = $startTime->diffInHours($endTime);
        $minutes = $startTime->diffInMinutes($endTime) % 60;
        
        if ($hours === 0) {
            return "{$minutes} minutes";
        } elseif ($minutes === 0) {
            return "{$hours} hour" . ($hours > 1 ? 's' : '');
        }
        
        return "{$hours}h {$minutes}m";
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        $query = Course::with(['academicYear', 'teacher', 'program'])
            ->whereHas('academicYear', function ($q) {
                $q->where('status', 'active');
            })
            ->select('id', 'name', 'course_code', 'teacher_id', 'academic_year_id', 'program_id')
            ->orderBy('name');
            
        $courseData = $query->get();

        $classRoomsData = ClassRoom::select('id', 'name', 'capacity')->orderBy('name')->get();

        $courses = $courseData->map(function ($course) {
            return [
                'value' => $course->id,
                'label' => $course->name . ' (' . $course->course_code . ')', 
                'academic_year_id' => $course->academic_year_id,
                'program_id' => $course->program_id,
                'teacher' => $course->teacher ? [
                    'id' => $course->teacher->id,
                    'name' => $course->teacher->full_name,
                    'employee_id' => $course->teacher->employee_id
                ] : null,
                'program' => $course->program ? [
                    'id' => $course->program->id,
                    'name' => $course->program->name,
                    'program_code' => $course->program->program_code
                ] : null
            ];
        });

        $classRooms = $classRoomsData->map(function ($room) {
            return [
                'value' => $room->id,
                'label' => $room->name . ' - Capacity: ' . $room->capacity
            ];
        });

        $academicYear = AcademicYear::active()->first();  

        return Inertia::render('admin/academics/time-table/create', [
            'academicYear' => $academicYear,
            'courses' => $courses,
            'classRooms' => $classRooms,
            'days' => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'academic_year_id' => 'required|exists:academic_years,id',
            'course_id' => 'required|exists:courses,id',
            'class_room_id' => 'required|exists:class_rooms,id',
            'day' => 'required|string|in:Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'create_another' => 'nullable|boolean',
        ]);

        // Get the course to check teacher
        $course = Course::with('teacher')->findOrFail($validated['course_id']);
        $teacherId = $course->teacher_id;

        // Check for time conflicts for classroom
        $classroomConflict = TimeTable::where('academic_year_id', $validated['academic_year_id'])
            ->where('class_room_id', $validated['class_room_id'])
            ->where('day', $validated['day'])
            ->where(function ($query) use ($validated) {
                $query->where(function ($q) use ($validated) {
                    $q->where('start_time', '<', $validated['end_time'])
                      ->where('end_time', '>', $validated['start_time']);
                });
            })
            ->exists();

        if ($classroomConflict) {
            return back()->withErrors([
                'start_time' => 'Time slot conflicts with existing schedule for this classroom on the selected day.'
            ]);
        }

        // Check for teacher conflict if course has a teacher assigned
        if ($teacherId) {
            $teacherConflict = TimeTable::where('academic_year_id', $validated['academic_year_id'])
                ->whereHas('course', function ($q) use ($teacherId) {
                    $q->where('teacher_id', $teacherId);
                })
                ->where('day', $validated['day'])
                ->where(function ($query) use ($validated) {
                    $query->where(function ($q) use ($validated) {
                        $q->where('start_time', '<', $validated['end_time'])
                          ->where('end_time', '>', $validated['start_time']);
                    });
                })
                ->exists();

            if ($teacherConflict) {
                return back()->withErrors([
                    'course_id' => 'Teacher already has a scheduled class during this time slot.'
                ]);
            }
        }

        // Create the timetable entry
        TimeTable::create([
            'academic_year_id' => $validated['academic_year_id'],
            'course_id' => $validated['course_id'],
            'class_room_id' => $validated['class_room_id'],
            'day' => $validated['day'],
            'start_time' => $validated['start_time'],
            'end_time' => $validated['end_time'],
        ]);

        $createAnother = $request->boolean('create_another', false);

        if ($createAnother) {
            return back()->with('success', 'Time table entry created successfully. Add another?');
        }

        return redirect()->route('admin.academics.time-tables.index')
            ->with('success', 'Time table entry created successfully.');
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(string $id)
    {
        $timeTable = TimeTable::with(['academicYear', 'course.teacher', 'course.program', 'classRoom'])
            ->findOrFail($id);

        // Get all courses for the academic year
        $courseData = Course::with('teacher', 'program')
            ->where('academic_year_id', $timeTable->academic_year_id)
            ->select('id', 'name', 'course_code', 'teacher_id', 'program_id')
            ->orderBy('name')
            ->get();

        $classRoomsData = ClassRoom::select('id', 'name', 'capacity')
            ->orderBy('name')
            ->get();

        $courses = $courseData->map(function ($course) {
            return [
                'value' => $course->id,
                'label' => $course->name . ' (' . $course->course_code . ')' . 
                          ($course->teacher ? ' - ' . $course->teacher->full_name : ''),
                'teacher' => $course->teacher ? [
                    'id' => $course->teacher->id,
                    'name' => $course->teacher->full_name,
                    'employee_id' => $course->teacher->employee_id
                ] : null,
                'program' => $course->program ? [
                    'id' => $course->program->id,
                    'name' => $course->program->name,
                    'program_code' => $course->program->program_code
                ] : null
            ];
        });

        $classRooms = $classRoomsData->map(function ($room) {
            return [
                'value' => $room->id,
                'label' => $room->name . ' - Capacity: ' . $room->capacity
            ];
        });

        // Get current values for pre-selection
        $currentCourse = $courses->firstWhere('value', $timeTable->course_id);
        $currentClassRoom = $classRooms->firstWhere('value', $timeTable->class_room_id);

        return Inertia::render('admin/academics/time-table/edit', [
            'timeTable' => $timeTable,
            'academicYear' => $timeTable->academicYear,
            'courses' => $courses,
            'classRooms' => $classRooms,
            'days' => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            'currentCourse' => $currentCourse,
            'currentClassRoom' => $currentClassRoom,
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        $timeTable = TimeTable::findOrFail($id);
        
        $validated = $request->validate([
            'academic_year_id' => 'required|exists:academic_years,id',
            'course_id' => 'required|exists:courses,id',
            'class_room_id' => 'required|exists:class_rooms,id',
            'day' => 'required|string|in:Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
        ]);

        // Get the course to check teacher
        $course = Course::with('teacher')->findOrFail($validated['course_id']);
        $teacherId = $course->teacher_id;

        // Check for classroom time conflicts (excluding current record)
        $classroomConflict = TimeTable::where('academic_year_id', $validated['academic_year_id'])
            ->where('class_room_id', $validated['class_room_id'])
            ->where('day', $validated['day'])
            ->where('id', '!=', $id)
            ->where(function ($query) use ($validated) {
                $query->where(function ($q) use ($validated) {
                    $q->where('start_time', '<', $validated['end_time'])
                      ->where('end_time', '>', $validated['start_time']);
                });
            })
            ->exists();

        if ($classroomConflict) {
            return back()->withErrors([
                'start_time' => 'Time slot conflicts with existing schedule for this classroom on the selected day.'
            ]);
        }

        // Check for teacher conflict if course has a teacher assigned (excluding current record)
        if ($teacherId) {
            $teacherConflict = TimeTable::where('academic_year_id', $validated['academic_year_id'])
                ->whereHas('course', function ($q) use ($teacherId) {
                    $q->where('teacher_id', $teacherId);
                })
                ->where('day', $validated['day'])
                ->where('id', '!=', $id)
                ->where(function ($query) use ($validated) {
                    $query->where(function ($q) use ($validated) {
                        $q->where('start_time', '<', $validated['end_time'])
                          ->where('end_time', '>', $validated['start_time']);
                    });
                })
                ->exists();

            if ($teacherConflict) {
                return back()->withErrors([
                    'course_id' => 'Teacher already has a scheduled class during this time slot.'
                ]);
            }
        }

        $timeTable->update($validated);

        return redirect()->route('admin.academics.time-tables.index')
            ->with('success', 'Time table entry updated successfully.');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(TimeTable $timeTable)
    {
        $timeTable->delete();
        return redirect()->route('admin.academics.time-tables.index')
            ->with('success', 'Time table entry deleted successfully.');
    }

    /**
     * Check for time conflicts
     */
    public function checkConflict(Request $request)
    {
        $validated = $request->validate([
            'academic_year_id' => 'required|exists:academic_years,id',
            'course_id' => 'required|exists:courses,id',
            'class_room_id' => 'required|exists:class_rooms,id',
            'day' => 'required|string|in:Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'exclude_id' => 'nullable|exists:time_tables,id',
        ]);

        // Get the course to check teacher
        $course = Course::with('teacher')->findOrFail($validated['course_id']);
        $teacherId = $course->teacher_id;

        $query = TimeTable::where('academic_year_id', $validated['academic_year_id'])
            ->where('day', $validated['day'])
            ->where(function ($query) use ($validated) {
                $query->where(function ($q) use ($validated) {
                    $q->where('start_time', '<', $validated['end_time'])
                      ->where('end_time', '>', $validated['start_time']);
                });
            });

        if ($request->filled('exclude_id')) {
            $query->where('id', '!=', $validated['exclude_id']);
        }

        $conflicts = $query->get();
        
        $hasClassroomConflict = false;
        $hasTeacherConflict = false;
        $conflictType = '';
        $classroomName = '';

        foreach ($conflicts as $conflict) {
            if ($conflict->class_room_id == $validated['class_room_id']) {
                $hasClassroomConflict = true;
                $classroomName = $conflict->classRoom->name ?? '';
            }
            
            // Check for teacher conflict
            if ($teacherId && $conflict->course && $conflict->course->teacher_id == $teacherId) {
                $hasTeacherConflict = true;
            }
        }

        if ($hasClassroomConflict && $hasTeacherConflict) {
            $conflictType = 'both';
        } elseif ($hasTeacherConflict) {
            $conflictType = 'teacher';
        } elseif ($hasClassroomConflict) {
            $conflictType = 'classroom';
        }

        return response()->json([
            'has_conflict' => $hasClassroomConflict || $hasTeacherConflict,
            'conflict_type' => $conflictType,
            'classroom_name' => $classroomName,
        ]);
    }

    /**
     * Get courses by academic year with teacher details
     */
    public function getCoursesByAcademicYear($academicYearId)
    {
        $courses = Course::with('teacher', 'program')
            ->where('academic_year_id', $academicYearId)
            ->orderBy('name')
            ->get()
            ->map(function ($course) {
                return [
                    'id' => $course->id,
                    'name' => $course->name,
                    'course_code' => $course->course_code,
                    'teacher' => $course->teacher ? [
                        'id' => $course->teacher->id,
                        'name' => $course->teacher->full_name,
                        'employee_id' => $course->teacher->employee_id
                    ] : null,
                    'program' => $course->program ? [
                        'id' => $course->program->id,
                        'name' => $course->program->name,
                        'program_code' => $course->program->program_code
                    ] : null
                ];
            });

        return response()->json($courses);
    }
}