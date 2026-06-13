<?php

namespace App\Http\Controllers\Admin\SchoolManagement;

use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Models\ClassRoom;
use App\Models\Course;
use App\Models\Program;
use App\Models\Teacher;
use App\Models\TimeTable;
use App\Services\ActivityLogService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;
use App\Exports\TimeTablesExport;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Throwable;

class TimeTableController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = TimeTable::with(['academicYear', 'course.program', 'course.teacher', 'classRoom', 'teacher'])
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
            $query->where('teacher_id', $request->teacher_id);
        }

        if ($request->filled('staff_type') && in_array($request->staff_type, Teacher::STAFF_TYPES, true)) {
            $query->where('staff_type', $request->staff_type);
        }

        if ($request->filled('day')) {
            $query->where('day_of_week', $request->day);
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
            'teacherOptions' => Teacher::orderBy('last_name')->orderBy('first_name')->get()->map(function ($teacher) {
                return [
                    'value' => $teacher->id,
                    'label' => trim("{$teacher->title} {$teacher->first_name} {$teacher->last_name}") . ' (' . ucfirst($teacher->staff_type) . ')',
                    'staff_type' => $teacher->staff_type,
                ];
            }),
            'staffTypeOptions' => [
                ['value' => Teacher::STAFF_TYPE_LECTURER, 'label' => 'Lecturer'],
                ['value' => Teacher::STAFF_TYPE_ADMINISTRATOR, 'label' => 'Administrator'],
            ],
            'dayOptions' => [
                ['value' => 'Monday', 'label' => 'Monday'],
                ['value' => 'Tuesday', 'label' => 'Tuesday'],
                ['value' => 'Wednesday', 'label' => 'Wednesday'],
                ['value' => 'Thursday', 'label' => 'Thursday'],
                ['value' => 'Friday', 'label' => 'Friday'],
                ['value' => 'Saturday', 'label' => 'Saturday'],
                ['value' => 'Sunday', 'label' => 'Sunday'],
            ],
            'filters' => $request->only(['academic_year_id', 'program_id', 'course_id', 'class_room_id', 'teacher_id', 'staff_type', 'day']),
        ]);
    }

    /**
     * Export time tables based on filters
     */
    public function export(Request $request, $format = 'excel')
    {
        // Apply the same filters as index method
        $query = TimeTable::with(['academicYear', 'course.program', 'course.teacher', 'classRoom', 'teacher'])
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
            $query->where('teacher_id', $request->teacher_id);
        }

        if ($request->filled('staff_type') && in_array($request->staff_type, Teacher::STAFF_TYPES, true)) {
            $query->where('staff_type', $request->staff_type);
        }

        if ($request->filled('day')) {
            $query->where('day_of_week', $request->day);
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
                'Staff Type',
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
                    'Staff Type' => ucfirst($timetable->staff_type ?? Teacher::STAFF_TYPE_LECTURER),
                    'Program' => $timetable->course->program->name ?? 'N/A',
                    'Program Code' => $timetable->course->program->program_code ?? 'N/A',
                    'Classroom' => $timetable->classRoom->name ?? 'N/A',
                    'Classroom Capacity' => $timetable->classRoom->capacity ?? 'N/A',
                    'Teacher' => $timetable->teacher ? 
                        $timetable->teacher->title . ' ' . 
                        $timetable->teacher->first_name . ' ' . 
                        $timetable->teacher->last_name : 'Not Assigned',
                    'Teacher ID' => $timetable->teacher->employee_id ?? 'N/A',
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
            'teachers' => Teacher::orderBy('last_name')->orderBy('first_name')->get()->map(function ($teacher) {
                return [
                    'value' => $teacher->id,
                    'label' => trim("{$teacher->title} {$teacher->first_name} {$teacher->last_name}") . ' (' . ucfirst($teacher->staff_type) . ')',
                    'staff_type' => $teacher->staff_type,
                ];
            }),
            'staffTypeOptions' => [
                ['value' => Teacher::STAFF_TYPE_LECTURER, 'label' => 'Lecturer'],
                ['value' => Teacher::STAFF_TYPE_ADMINISTRATOR, 'label' => 'Administrator'],
            ],
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
            'staff_type' => ['required', Rule::in(Teacher::STAFF_TYPES)],
            'teacher_id' => 'required|exists:teachers,id',
            'course_id' => 'required_if:staff_type,lecturer|nullable|exists:courses,id',
            'class_room_id' => 'required|exists:class_rooms,id',
            'day' => 'required_if:staff_type,lecturer|nullable|string|in:Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday',
            'days' => 'exclude_unless:staff_type,administrator|required|array|min:1',
            'days.*' => 'string|in:Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'create_another' => 'nullable|boolean',
        ]);

        $teacher = Teacher::findOrFail($validated['teacher_id']);
        if ($teacher->staff_type !== $validated['staff_type']) {
            return back()->withErrors(['teacher_id' => 'Selected staff member does not match the selected staff type.']);
        }

        if ($validated['staff_type'] === Teacher::STAFF_TYPE_LECTURER) {
            $course = Course::findOrFail($validated['course_id']);
            if (empty($course->course_code) || empty($course->name)) {
                return back()->withErrors(['course_id' => 'Lecturer timetables require a course code and course title.']);
            }
        } else {
            $validated['course_id'] = null;
        }

        $scheduleDays = $validated['staff_type'] === Teacher::STAFF_TYPE_ADMINISTRATOR
            ? array_values(array_unique($validated['days']))
            : [$validated['day']];

        if ($validated['staff_type'] === Teacher::STAFF_TYPE_LECTURER) {
            foreach ($scheduleDays as $day) {
                $scheduleData = array_merge($validated, ['day' => $day]);

                // Check for time conflicts for classroom
                $classroomConflict = TimeTable::where('academic_year_id', $scheduleData['academic_year_id'])
                    ->where('class_room_id', $scheduleData['class_room_id'])
                    ->where('day_of_week', $day)
                    ->where(function ($query) use ($scheduleData) {
                        $query->where(function ($q) use ($scheduleData) {
                            $q->where('start_time', '<', $scheduleData['end_time'])
                              ->where('end_time', '>', $scheduleData['start_time']);
                        });
                    })
                    ->exists();

                if ($classroomConflict) {
                    return back()->withErrors([
                        'start_time' => "Time slot conflicts with existing schedule for this classroom on {$day}."
                    ]);
                }

                if ($this->hasStaffOverlap($scheduleData)) {
                    return back()->withErrors([
                        'start_time' => "Selected staff member already has a schedule during this time slot on {$day}."
                    ]);
                }

                if ($this->hasDuplicateEntry($scheduleData)) {
                    return back()->withErrors([
                        'start_time' => "Duplicate timetable entry already exists for this staff member on {$day}."
                    ]);
                }
            }
        }

        try {
            DB::transaction(function () use ($scheduleDays, $validated) {
                foreach ($scheduleDays as $day) {
                    TimeTable::create([
                        'academic_year_id' => $validated['academic_year_id'],
                        'teacher_id' => $validated['teacher_id'],
                        'staff_type' => $validated['staff_type'],
                        'course_id' => $validated['course_id'],
                        'class_room_id' => $validated['class_room_id'],
                        'day' => $day,
                        'day_of_week' => $day,
                        'start_time' => $validated['start_time'],
                        'end_time' => $validated['end_time'],
                    ]);
                }
            });
        } catch (Throwable $e) {
            report($e);

            return back()
                ->withInput()
                ->withErrors(['error' => 'Unable to create the time slot. Please check the selected staff, class room, and time, then try again.'])
                ->with('error', 'Unable to create the time slot. Please check the selected staff, class room, and time, then try again.');
        }

        $createAnother = $request->boolean('create_another', false);

        if ($createAnother) {
            return back()->with('success', count($scheduleDays) . ' time table entr' . (count($scheduleDays) === 1 ? 'y' : 'ies') . ' created successfully. Add another?');
        }

        app(ActivityLogService::class)->logTimetable(
            'timetable_created',
            'Created ' . count($scheduleDays) . ' timetable entr' . (count($scheduleDays) === 1 ? 'y' : 'ies'),
            ['teacher_id' => $validated['teacher_id'], 'days' => $scheduleDays]
        );

        return redirect()->route('admin.academics.time-tables.index')
            ->with('success', count($scheduleDays) . ' time table entr' . (count($scheduleDays) === 1 ? 'y' : 'ies') . ' created successfully.');
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
        $timeTable = TimeTable::with(['academicYear', 'course.teacher', 'course.program', 'classRoom', 'teacher'])
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
            'teachers' => Teacher::orderBy('last_name')->orderBy('first_name')->get()->map(function ($teacher) {
                return [
                    'value' => $teacher->id,
                    'label' => trim("{$teacher->title} {$teacher->first_name} {$teacher->last_name}") . ' (' . ucfirst($teacher->staff_type) . ')',
                    'staff_type' => $teacher->staff_type,
                ];
            }),
            'staffTypeOptions' => [
                ['value' => Teacher::STAFF_TYPE_LECTURER, 'label' => 'Lecturer'],
                ['value' => Teacher::STAFF_TYPE_ADMINISTRATOR, 'label' => 'Administrator'],
            ],
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
            'staff_type' => ['required', Rule::in(Teacher::STAFF_TYPES)],
            'teacher_id' => 'required|exists:teachers,id',
            'course_id' => 'required_if:staff_type,lecturer|nullable|exists:courses,id',
            'class_room_id' => 'required|exists:class_rooms,id',
            'day' => 'required|string|in:Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
        ]);

        $teacher = Teacher::findOrFail($validated['teacher_id']);
        if ($teacher->staff_type !== $validated['staff_type']) {
            return back()->withErrors(['teacher_id' => 'Selected staff member does not match the selected staff type.']);
        }

        if ($validated['staff_type'] === Teacher::STAFF_TYPE_LECTURER) {
            $course = Course::findOrFail($validated['course_id']);
            if (empty($course->course_code) || empty($course->name)) {
                return back()->withErrors(['course_id' => 'Lecturer timetables require a course code and course title.']);
            }
        } else {
            $validated['course_id'] = null;
        }

        if ($validated['staff_type'] === Teacher::STAFF_TYPE_LECTURER) {
            // Check for classroom time conflicts (excluding current record)
            $classroomConflict = TimeTable::where('academic_year_id', $validated['academic_year_id'])
                ->where('class_room_id', $validated['class_room_id'])
                ->where('day_of_week', $validated['day'])
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

            if ($this->hasStaffOverlap($validated, (int) $id)) {
                return back()->withErrors([
                    'start_time' => 'Selected staff member already has a schedule during this time slot.'
                ]);
            }

            if ($this->hasDuplicateEntry($validated, (int) $id)) {
                return back()->withErrors([
                    'start_time' => 'Duplicate timetable entry already exists for this staff member.'
                ]);
            }
        }

        $timeTable->update([
            'academic_year_id' => $validated['academic_year_id'],
            'teacher_id' => $validated['teacher_id'],
            'staff_type' => $validated['staff_type'],
            'course_id' => $validated['course_id'],
            'class_room_id' => $validated['class_room_id'],
            'day' => $validated['day'],
            'day_of_week' => $validated['day'],
            'start_time' => $validated['start_time'],
            'end_time' => $validated['end_time'],
        ]);

        app(ActivityLogService::class)->logTimetable(
            'timetable_updated',
            "Updated timetable entry #{$timeTable->id}",
            ['timetable_id' => $timeTable->id, 'teacher_id' => $validated['teacher_id']]
        );

        return redirect()->route('admin.academics.time-tables.index')
            ->with('success', 'Time table entry updated successfully.');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(TimeTable $timeTable)
    {
        $timetableId = $timeTable->id;
        $timeTable->delete();

        app(ActivityLogService::class)->logTimetable(
            'timetable_deleted',
            "Deleted timetable entry #{$timetableId}",
            ['timetable_id' => $timetableId]
        );

        return redirect()->route('admin.academics.time-tables.index')
            ->with('success', 'Time table entry deleted successfully.');
    }

    public function bulkAssign(Request $request)
    {
        $validated = $request->validate([
            'academic_year_id' => 'required|exists:academic_years,id',
            'staff_type' => ['required', Rule::in(Teacher::STAFF_TYPES)],
            'teacher_ids' => 'required|array|min:1',
            'teacher_ids.*' => 'required|exists:teachers,id',
            'course_id' => 'required_if:staff_type,lecturer|nullable|exists:courses,id',
            'class_room_id' => 'required|exists:class_rooms,id',
            'day' => 'required|string|in:Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
        ]);

        $created = 0;
        $skipped = [];

        foreach ($validated['teacher_ids'] as $teacherId) {
            $data = $validated;
            $data['teacher_id'] = $teacherId;
            unset($data['teacher_ids']);

            $teacher = Teacher::find($teacherId);
            if (!$teacher || $teacher->staff_type !== $validated['staff_type']) {
                $skipped[] = ['teacher_id' => $teacherId, 'reason' => 'Staff type mismatch'];
                continue;
            }

            if ($validated['staff_type'] === Teacher::STAFF_TYPE_ADMINISTRATOR) {
                $data['course_id'] = null;
            }

            if ($validated['staff_type'] === Teacher::STAFF_TYPE_LECTURER && ($this->hasStaffOverlap($data) || $this->hasDuplicateEntry($data))) {
                $skipped[] = ['teacher_id' => $teacherId, 'reason' => 'Duplicate or overlapping schedule'];
                continue;
            }

            TimeTable::create([
                'academic_year_id' => $data['academic_year_id'],
                'teacher_id' => $data['teacher_id'],
                'staff_type' => $data['staff_type'],
                'course_id' => $data['course_id'],
                'class_room_id' => $data['class_room_id'],
                'day' => $data['day'],
                'day_of_week' => $data['day'],
                'start_time' => $data['start_time'],
                'end_time' => $data['end_time'],
            ]);
            $created++;
        }

        return back()->with('success', "Bulk assignment complete. Created {$created} schedule(s), skipped " . count($skipped) . '.');
    }

    public function report(Request $request)
    {
        $query = TimeTable::with(['teacher', 'course.program', 'classRoom', 'academicYear'])
            ->orderBy('day_of_week')
            ->orderBy('start_time');

        if ($request->filled('staff_type') && in_array($request->staff_type, Teacher::STAFF_TYPES, true)) {
            $query->where('staff_type', $request->staff_type);
        }

        if ($request->filled('day')) {
            $query->where('day_of_week', $request->day);
        }

        if ($request->filled('teacher_id')) {
            $query->where('teacher_id', $request->teacher_id);
        }

        $records = $query->get()->map(function (TimeTable $timeTable) {
            return [
                'staff_name' => $timeTable->teacher ? trim("{$timeTable->teacher->title} {$timeTable->teacher->first_name} {$timeTable->teacher->last_name}") : 'Unassigned',
                'staff_type' => $timeTable->staff_type,
                'course_code' => $timeTable->course?->course_code,
                'course_title' => $timeTable->course?->name,
                'classroom' => $timeTable->classRoom?->name,
                'day' => $timeTable->day_of_week,
                'start_time' => $timeTable->start_time,
                'end_time' => $timeTable->end_time,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $records,
        ]);
    }

    /**
     * Check for time conflicts
     */
    public function checkConflict(Request $request)
    {
        $validated = $request->validate([
            'academic_year_id' => 'required|exists:academic_years,id',
            'staff_type' => ['nullable', Rule::in(Teacher::STAFF_TYPES)],
            'teacher_id' => 'nullable|exists:teachers,id',
            'course_id' => 'nullable|exists:courses,id',
            'class_room_id' => 'nullable|exists:class_rooms,id',
            'day' => 'required|string|in:Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'exclude_id' => 'nullable|exists:time_tables,id',
        ]);

        $staffType = $validated['staff_type'] ?? Teacher::STAFF_TYPE_LECTURER;

        if ($staffType === Teacher::STAFF_TYPE_ADMINISTRATOR) {
            return response()->json([
                'has_conflict' => false,
                'conflict_type' => '',
                'classroom_name' => '',
                'staff_type' => $staffType,
            ]);
        }

        $teacherId = $validated['teacher_id'] ?? null;
        if (!$teacherId && !empty($validated['course_id'])) {
            $teacherId = Course::find($validated['course_id'])?->teacher_id;
        }

        $query = TimeTable::where('academic_year_id', $validated['academic_year_id'])
            ->where('day_of_week', $validated['day'])
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
            if (!empty($validated['class_room_id']) && $conflict->class_room_id == $validated['class_room_id']) {
                $hasClassroomConflict = true;
                $classroomName = $conflict->classRoom->name ?? '';
            }
            
            // Check for teacher conflict
            if ($teacherId && (int) $conflict->teacher_id === (int) $teacherId) {
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
            'staff_type' => $staffType,
        ]);
    }

    private function hasStaffOverlap(array $data, ?int $excludeId = null): bool
    {
        $query = TimeTable::where('academic_year_id', $data['academic_year_id'])
            ->where('teacher_id', $data['teacher_id'])
            ->where('day_of_week', $data['day'])
            ->where(function ($query) use ($data) {
                $query->where('start_time', '<', $data['end_time'])
                    ->where('end_time', '>', $data['start_time']);
            });

        if ($excludeId) {
            $query->where('id', '!=', $excludeId);
        }

        return $query->exists();
    }

    private function hasDuplicateEntry(array $data, ?int $excludeId = null): bool
    {
        $query = TimeTable::where('academic_year_id', $data['academic_year_id'])
            ->where('teacher_id', $data['teacher_id'])
            ->where('staff_type', $data['staff_type'])
            ->where('course_id', $data['course_id'])
            ->where('class_room_id', $data['class_room_id'])
            ->where('day_of_week', $data['day'])
            ->where('start_time', $data['start_time'])
            ->where('end_time', $data['end_time']);

        if ($excludeId) {
            $query->where('id', '!=', $excludeId);
        }

        return $query->exists();
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