<?php

namespace App\Http\Controllers\Admin\SchoolManagement;

use App\Http\Controllers\Controller;
use App\Models\AcademicPeriod;
use App\Models\AcademicYear;
use App\Models\Course;
use App\Models\Level;
use App\Models\Program;
use App\Models\Teacher;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Http\JsonResponse;
use Maatwebsite\Excel\Facades\Excel;

class CourseController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        // Handle axios json request
        if ($request->expectsJson() || $request->wantsJson()) {
            return response()->json($this->getCoursesData($request));
        }

        // Filter options for first page load
        $filterOptions = $this->getFilterOptions();

        return Inertia::render('admin/school-management/course/index', [
            'initialData' => $this->getCoursesData($request),
            'filterOptions' => $filterOptions,
        ]);
    }

    /**
     * Get courses data with filtering + pagination
     */
    private function getCoursesData(Request $request)
    {
        /**
         * Convert camelCase filters coming from React
         * to snake_case used in Laravel DB fields
         */
        $request->merge([
            'academic_year'   => $request->academicYear,
            'academic_period' => $request->academicPeriod,
        ]);

        $query = Course::with([
            'program.department.faculty',
            'level',
            'academicYear',
            'academicPeriod',
            'teacher' // Add this relationship
        ]);

        // SEARCH
        if ($request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('course_code', 'like', "%{$search}%")
                    ->orWhere('course_type', 'like', "%{$search}%")
                    ->orWhereHas('program', function ($q) use ($search) {
                        $q->where('name', 'like', "%{$search}%");
                    })
                    ->orWhereHas('teacher', function ($q) use ($search) {
                        $q->where('first_name', 'like', "%{$search}%")
                          ->orWhere('last_name', 'like', "%{$search}%");
                    });
            });
        }

        // PROGRAM
        if ($request->program) {
            $query->where('program_id', $request->program);
        }

        // LEVEL
        if ($request->level) {
            $query->where('level_id', $request->level);
        }

        // ACADEMIC YEAR
        if ($request->academic_year) {
            $query->where('academic_year_id', $request->academic_year);
        }

        // ACADEMIC PERIOD
        if ($request->academic_period) {
            $query->where('academic_period_id', $request->academic_period);
        }

        // COURSE TYPE
        if ($request->course_type) {
            $query->where('course_type', $request->course_type);
        }

        // TEACHER
        if ($request->teacher) {
            $query->where('teacher_id', $request->teacher);
        }

        // FACULTY
        if ($request->faculty) {
            $query->whereHas('program.department.faculty', function ($q) use ($request) {
                $q->where('id', $request->faculty);
            });
        }

        // DEPARTMENT
        if ($request->department) {
            $query->whereHas('program.department', function ($q) use ($request) {
                $q->where('id', $request->department);
            });
        }

        $total = $query->count();

        $sortBy = $request->get('sort_by', 'id');
        $sortOrder = $request->get('sort_order', 'asc');

        $query->orderBy($sortBy, $sortOrder);

        $perPage = $request->get('per_page', 10);
        $page = $request->get('page', 1);

        $courses = $query->paginate($perPage, ['*'], 'page', $page);

        return [
            'data' => $courses->items(),
            'total' => $total,
            'current_page' => $courses->currentPage(),
            'per_page' => $courses->perPage(),
            'last_page' => $courses->lastPage(),
            'from' => $courses->firstItem(),
            'to' => $courses->lastItem(),
        ];
    }

    /**
     * Filter dropdown options
     */
    private function getFilterOptions()
    {
        return [
            'programs' => Program::select('id', 'name')->orderBy('name')->get(),
            'levels' => Level::select('id', 'name')->orderBy('name')->get(),
            'academicYears' => AcademicYear::select('id', 'name')->orderBy('name')->get(),
            'academicPeriods' => AcademicPeriod::select('id', 'name')->orderBy('name')->get(),
            'teachers' => Teacher::select('id', 'first_name', 'last_name')
                ->orderBy('first_name')
                ->get()
                ->map(function ($teacher) {
                    return [
                        'id' => $teacher->id,
                        'name' => $teacher->full_name ?? $teacher->first_name . ' ' . $teacher->last_name
                    ];
                }),
            'courseTypes' => [
                ['id' => 'core', 'name' => 'Core'],
                ['id' => 'elective', 'name' => 'Elective']
            ],
            'faculties' => \App\Models\Faculty::select('id', 'name')->orderBy('name')->get(),
            'departments' => \App\Models\Department::select('id', 'name')->orderBy('name')->get(),
        ];
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        $programs = Program::select('id', 'name')->orderBy('name')->get();
        $levels = Level::select('id', 'name')->orderBy('name')->get();
        $academicYears = AcademicYear::select('id', 'name')->orderBy('name')->get();
        $academicPeriods = AcademicPeriod::select('id', 'name')->orderBy('name')->get();
        $teachers = Teacher::select('id', 'first_name', 'last_name', 'employee_id')
            ->orderBy('first_name')
            ->get();

        $programOptions = [];
        $levelOptions = [];
        $academicYearOptions = [];
        $academicPeriodOptions = [];
        $teacherOptions = [];

        foreach($programs as $program){
            $programOptions[] = [
                'label' => $program->name,
                'value' => $program->id
            ];
        }

        foreach($levels as $level){
            $levelOptions[] = [
                'label' => $level->name,
                'value' => $level->id
            ];
        }

        foreach($academicYears as $academicYear){
            $academicYearOptions[] = [
                'label' => $academicYear->name,
                'value' => $academicYear->id
            ];
        }

        foreach($academicPeriods as $academicPeriod){
            $academicPeriodOptions[] = [
                'label' => $academicPeriod->name,
                'value' => $academicPeriod->id
            ];
        }

        foreach($teachers as $teacher){
            $teacherOptions[] = [
                'label' => $teacher->first_name . ' ' . $teacher->last_name . ' (' . $teacher->employee_id . ')',
                'value' => $teacher->id
            ];
        }

        return Inertia::render('admin/school-management/course/create', 
            compact('programOptions', 'levelOptions', 'academicYearOptions', 'academicPeriodOptions', 'teacherOptions'));
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|unique:courses,name',
            'course_code' => 'required|string|unique:courses,course_code',
            'program' => 'required|exists:programs,id',
            'level' => 'nullable|exists:levels,id',
            'academic_year' => 'nullable|exists:academic_years,id',
            'academic_period' => 'nullable|exists:academic_periods,id',
            'student_size' => 'nullable|integer|min:0',
            'teacher_id' => 'nullable|exists:teachers,id',
            'course_type' => 'required|in:core,elective',
            'credit_hours' => 'nullable|integer|min:0',
        ]);

        $course = new Course();
        $course->name = $validated['name'];
        $course->course_code = $validated['course_code'];
        $course->program_id = $validated['program'];
        $course->student_size = $validated['student_size'] ?? 0;
        $course->course_type = $validated['course_type'];
        $course->credit_hours = $validated['credit_hours'] ?? 0;
        
        // Add the new fields if they exist in the request
        if (isset($validated['level'])) {
            $course->level_id = $validated['level'];
        }
        
        if (isset($validated['academic_year'])) {
            $course->academic_year_id = $validated['academic_year'];
        }
        
        if (isset($validated['academic_period'])) {
            $course->academic_period_id = $validated['academic_period'];
        }
        
        if (isset($validated['teacher_id'])) {
            $course->teacher_id = $validated['teacher_id'];
        }
        
        $course->save();
        
        return redirect()->route('admin.school-management.courses.index')
            ->with('success', 'Course created successfully.');
    }

    /**
     * Show the form for editing the specified resource.
     */
     public function edit(Course $course)
    {
        $programs = Program::select('id', 'name')->orderBy('name')->get();
        $levels = Level::select('id', 'name')->orderBy('name')->get();
        $academicYears = AcademicYear::select('id', 'name')->orderBy('name')->get();
        $academicPeriods = AcademicPeriod::select('id', 'name')->orderBy('name')->get();
        $teachers = Teacher::select('id', 'first_name', 'last_name', 'employee_id')
            ->orderBy('first_name')
            ->get();

        $programOptions = [];
        $levelOptions = [];
        $academicYearOptions = [];
        $academicPeriodOptions = [];
        $teacherOptions = [];

        foreach($programs as $program){
            $programOptions[] = [
                'label' => $program->name,
                'value' => $program->id
            ];
        }

        foreach($levels as $level){
            $levelOptions[] = [
                'label' => $level->name,
                'value' => $level->id
            ];
        }

        foreach($academicYears as $academicYear){
            $academicYearOptions[] = [
                'label' => $academicYear->name,
                'value' => $academicYear->id
            ];
        }

        foreach($academicPeriods as $academicPeriod){
            $academicPeriodOptions[] = [
                'label' => $academicPeriod->name,
                'value' => $academicPeriod->id
            ];
        }

        foreach($teachers as $teacher){
            $teacherOptions[] = [
                'label' => $teacher->first_name . ' ' . $teacher->last_name . ' (' . $teacher->employee_id . ')',
                'value' => $teacher->id
            ];
        }

        return Inertia::render('admin/school-management/course/edit', 
        compact('programOptions', 'levelOptions', 'academicYearOptions', 'academicPeriodOptions', 'teacherOptions', 'course'));
    }

    /**
     * Update the specified resource in storage.
     */
     public function update(Request $request, Course $course)
    {
        $validated = $request->validate([
            'name' => 'required|string|unique:courses,name,'. $course->id,
            'course_code' => 'required|string|unique:courses,course_code,'. $course->id,
            'program' => 'required|exists:programs,id',
            'level' => 'nullable|exists:levels,id',
            'academic_year' => 'nullable|exists:academic_years,id',
            'academic_period' => 'nullable|exists:academic_periods,id',
            'student_size' => 'nullable|integer|min:0',
            'teacher_id' => 'nullable|exists:teachers,id',
            'course_type' => 'required|in:core,elective',
            'credit_hours' => 'nullable|integer|min:0',
        ]);
        
        try {
            $course->name = $validated['name'];
            $course->course_code = $validated['course_code'];
            $course->program_id = $validated['program'];
            $course->course_type = $validated['course_type'];
            $course->credit_hours = $validated['credit_hours'] ?? 0;
            
            // Update the new fields if they exist in the request
            if (isset($validated['level'])) {
                $course->level_id = $validated['level'];
            } else {
                $course->level_id = null;
            }
            
            if (isset($validated['academic_year'])) {
                $course->academic_year_id = $validated['academic_year'];
            } else {
                $course->academic_year_id = null;
            }
            
            if (isset($validated['academic_period'])) {
                $course->academic_period_id = $validated['academic_period'];
            } else {
                $course->academic_period_id = null;
            }
            
            if (isset($validated['teacher_id'])) {
                $course->teacher_id = $validated['teacher_id'];
            } else {
                $course->teacher_id = null;
            }
            
            if (isset($validated['student_size'])) {
                $course->student_size = $validated['student_size'];
            } else {
                $course->student_size = null;
            }
            
            $course->update();
            
            return redirect()->route('admin.school-management.courses.index')
                ->with('success', 'Course updated successfully.');
        } catch(\Exception $e) {
            return redirect()->route('admin.school-management.courses.index')
                ->with('error', $e->getMessage());
        }
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Course $course)
    {
        $course->delete();
        return redirect()->route('admin.school-management.courses.index')
            ->with('success', 'Course deleted successfully.');
    }

    /**
     * Export courses to CSV
     */
    public function export($format = 'excel')
    {
        $fileName = 'courses_' . now()->format('Ymd_His') . '.csv';
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$fileName}\"",
        ];

        $callback = function () {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['ID', 'Course Code', 'Name', 'Program', 'Level', 'Academic Year', 'Academic Period', 'Course Type', 'Credit Hours', 'Student Size', 'Teacher', 'Created At', 'Updated At']);
            Course::with(['program', 'level', 'academicYear', 'academicPeriod', 'teacher'])->chunk(200, function ($courses) use ($out) {
                foreach ($courses as $c) {
                    $teacherName = $c->teacher
                        ? trim($c->teacher->first_name . ' ' . $c->teacher->last_name)
                        : '';
                    fputcsv($out, [
                        $c->id,
                        $c->course_code,
                        $c->name,
                        $c->program->name ?? '',
                        $c->level->name ?? '',
                        $c->academicYear->name ?? '',
                        $c->academicPeriod->name ?? '',
                        $c->course_type ?? '',
                        $c->credit_hours ?? '',
                        $c->student_size ?? '',
                        $teacherName,
                        optional($c->created_at)->toDateTimeString(),
                        optional($c->updated_at)->toDateTimeString(),
                    ]);
                }
            });
            fclose($out);
        };

        return response()->streamDownload($callback, $fileName, $headers);
    }

    /**
     * Download template for course import
     */
    public function template()
    {
        $fileName = 'courses_template_' . now()->format('Ymd') . '.csv';
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$fileName}\"",
        ];

        $callback = function () {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['# IMPORT RULES AND INSTRUCTIONS']);
            fputcsv($out, ['# 1. course_code is REQUIRED - Must be unique']);
            fputcsv($out, ['# 2. name is REQUIRED']);
            fputcsv($out, ['# 3. program is REQUIRED - Must match an existing program name exactly']);
            fputcsv($out, ['# 4. level, academic_year, academic_period, teacher are OPTIONAL - Match existing names']);
            fputcsv($out, ['# 5. course_type is REQUIRED - Must be "core" or "elective"']);
            fputcsv($out, ['# 6. credit_hours and student_size are OPTIONAL - Numeric (integer)']);
            fputcsv($out, ['# 7. Do not modify the header row. Remove instruction rows before uploading']);
            fputcsv($out, ['# 8. Duplicate course_code will update existing course']);
            fputcsv($out, ['']);
            fputcsv($out, ['course_code', 'name', 'program', 'level', 'academic_year', 'academic_period', 'course_type', 'credit_hours', 'student_size', 'teacher']);
            fputcsv($out, ['CS101', 'Introduction to Programming', 'BSc Computer Science', 'Level 100', '2024/2025', 'Semester 1', 'core', '3', '50', '']);
            fputcsv($out, ['MATH201', 'Calculus II', 'BSc Mathematics', 'Level 200', '2024/2025', 'Semester 1', 'core', '4', '45', '']);
            fclose($out);
        };

        return response()->streamDownload($callback, $fileName, $headers);
    }

    /**
     * Preview uploaded file and return parsed rows with validation (JSON)
     */
    public function preview(Request $request)
    {
        $request->validate([
            'file' => [
                'required',
                'file',
                function ($attribute, $value, $fail) {
                    if (!$value) {
                        $fail('The file field is required.');
                        return;
                    }
                    $ext = strtolower($value->getClientOriginalExtension());
                    if (!in_array($ext, ['xlsx', 'xls', 'csv'])) {
                        $fail('The file must be a file of type: xlsx, xls, csv.');
                    }
                },
            ],
        ]);

        $file = $request->file('file');
        if (!$file) {
            return response()->json(['error' => 'No file uploaded'], 422);
        }

        $ext = strtolower($file->getClientOriginalExtension());
        $rows = [];

        if ($ext === 'csv') {
            $path = $file->getRealPath();
            if (($handle = fopen($path, 'r')) !== false) {
                $header = null;
                $line = 0;
                while (($row = fgetcsv($handle)) !== false) {
                    $line++;
                    $firstCell = trim($row[0] ?? '');
                    if (empty($firstCell) || strpos($firstCell, '#') === 0) {
                        continue;
                    }
                    $header = $row;
                    break;
                }

                if ($header === null) {
                    fclose($handle);
                    return response()->json(['error' => 'Header row not found in CSV file'], 422);
                }

                $normalizedHeader = array_map(fn($h) => strtolower(trim($h)), $header);
                $seen = [];
                while (($data = fgetcsv($handle)) !== false) {
                    $line++;
                    $firstCell = trim($data[0] ?? '');
                    if (empty($firstCell) || strpos($firstCell, '#') === 0) {
                        continue;
                    }

                    $row = [];
                    foreach ($normalizedHeader as $i => $key) {
                        $row[$key] = $data[$i] ?? null;
                    }

                    $errors = [];
                    if (empty($row['course_code'])) {
                        $errors[] = 'Course code is required';
                    }
                    if (empty($row['name'])) {
                        $errors[] = 'Name is required';
                    }
                    if (empty($row['program'])) {
                        $errors[] = 'Program is required';
                    } else {
                        if (!Program::where('name', trim($row['program']))->exists()) {
                            $errors[] = 'Program "' . $row['program'] . '" not found';
                        }
                    }
                    if (!empty($row['level']) && !Level::where('name', trim($row['level']))->exists()) {
                        $errors[] = 'Level "' . $row['level'] . '" not found';
                    }
                    if (!empty($row['academic_year']) && !AcademicYear::where('name', trim($row['academic_year']))->exists()) {
                        $errors[] = 'Academic year "' . $row['academic_year'] . '" not found';
                    }
                    if (!empty($row['academic_period']) && !AcademicPeriod::where('name', trim($row['academic_period']))->exists()) {
                        $errors[] = 'Academic period "' . $row['academic_period'] . '" not found';
                    }
                    $courseType = strtolower(trim($row['course_type'] ?? ''));
                    if (empty($courseType)) {
                        $errors[] = 'Course type is required';
                    } elseif (!in_array($courseType, ['core', 'elective'])) {
                        $errors[] = 'Course type must be "core" or "elective"';
                    }
                    if (!empty($row['credit_hours']) && !is_numeric(trim($row['credit_hours']))) {
                        $errors[] = 'Credit hours must be numeric';
                    }
                    if (!empty($row['student_size']) && (!is_numeric(trim($row['student_size'])) || (int) $row['student_size'] < 0)) {
                        $errors[] = 'Student size must be a non-negative number';
                    }
                    if (!empty($row['teacher'])) {
                        $teacherName = trim($row['teacher']);
                        $found = Teacher::whereRaw("CONCAT(first_name, ' ', last_name) = ?", [$teacherName])->exists();
                        if (!$found) {
                            $errors[] = 'Teacher "' . $teacherName . '" not found';
                        }
                    }

                    $codeKey = strtolower(trim($row['course_code'] ?? ''));
                    if ($codeKey && isset($seen[$codeKey])) {
                        $errors[] = 'Duplicate course_code in file (line ' . $seen[$codeKey] . ')';
                    } elseif ($codeKey) {
                        $seen[$codeKey] = $line;
                    }

                    $exists = false;
                    if (!empty($row['course_code'])) {
                        $exists = Course::where('course_code', $row['course_code'])->exists();
                    }

                    $rows[] = [
                        'line' => $line,
                        'data' => $row,
                        'errors' => $errors,
                        'exists' => $exists,
                    ];
                }
                fclose($handle);
            }
        } else {
            try {
                $array = Excel::toArray([], $file);
                if (!empty($array) && isset($array[0])) {
                    $sheet = $array[0];
                    $headerRowIndex = 0;
                    for ($i = 0; $i < count($sheet); $i++) {
                        $firstCell = trim($sheet[$i][0] ?? '');
                        if (!empty($firstCell) && strpos($firstCell, '#') !== 0) {
                            $headerRowIndex = $i;
                            break;
                        }
                    }
                    $header = array_map(fn($h) => strtolower(trim($h)), $sheet[$headerRowIndex] ?? []);
                    $seen = [];
                    for ($i = $headerRowIndex + 1; $i < count($sheet); $i++) {
                        $data = $sheet[$i];
                        $firstCell = trim($data[0] ?? '');
                        if (empty($firstCell) || strpos($firstCell, '#') === 0) {
                            continue;
                        }
                        $row = [];
                        foreach ($header as $j => $key) {
                            $row[$key] = isset($data[$j]) ? (is_string($data[$j]) ? trim($data[$j]) : $data[$j]) : null;
                        }

                        $errors = [];
                        if (empty($row['course_code'])) {
                            $errors[] = 'Course code is required';
                        }
                        if (empty($row['name'])) {
                            $errors[] = 'Name is required';
                        }
                        if (empty($row['program'])) {
                            $errors[] = 'Program is required';
                        } else {
                            if (!Program::where('name', trim($row['program']))->exists()) {
                                $errors[] = 'Program "' . $row['program'] . '" not found';
                            }
                        }
                        if (!empty($row['level']) && !Level::where('name', trim($row['level']))->exists()) {
                            $errors[] = 'Level "' . $row['level'] . '" not found';
                        }
                        if (!empty($row['academic_year']) && !AcademicYear::where('name', trim($row['academic_year']))->exists()) {
                            $errors[] = 'Academic year "' . $row['academic_year'] . '" not found';
                        }
                        if (!empty($row['academic_period']) && !AcademicPeriod::where('name', trim($row['academic_period']))->exists()) {
                            $errors[] = 'Academic period "' . $row['academic_period'] . '" not found';
                        }
                        $courseType = strtolower(trim((string)($row['course_type'] ?? '')));
                        if (empty($courseType)) {
                            $errors[] = 'Course type is required';
                        } elseif (!in_array($courseType, ['core', 'elective'])) {
                            $errors[] = 'Course type must be "core" or "elective"';
                        }
                        if (!empty($row['credit_hours']) && !is_numeric(trim((string)$row['credit_hours']))) {
                            $errors[] = 'Credit hours must be numeric';
                        }
                        if (!empty($row['student_size']) && (!is_numeric(trim((string)$row['student_size'])) || (int) $row['student_size'] < 0)) {
                            $errors[] = 'Student size must be a non-negative number';
                        }
                        if (!empty($row['teacher'])) {
                            $teacherName = trim((string)$row['teacher']);
                            $found = Teacher::whereRaw("CONCAT(first_name, ' ', last_name) = ?", [$teacherName])->exists();
                            if (!$found) {
                                $errors[] = 'Teacher "' . $teacherName . '" not found';
                            }
                        }

                        $line = $i + 1;
                        $codeKey = strtolower(trim($row['course_code'] ?? ''));
                        if ($codeKey && isset($seen[$codeKey])) {
                            $errors[] = 'Duplicate course_code in file (line ' . $seen[$codeKey] . ')';
                        } elseif ($codeKey) {
                            $seen[$codeKey] = $line;
                        }
                        $exists = !empty($row['course_code']) && Course::where('course_code', $row['course_code'])->exists();
                        $rows[] = ['line' => $line, 'data' => $row, 'errors' => $errors, 'exists' => $exists];
                    }
                }
            } catch (\Throwable $e) {
                return response()->json(['error' => 'Unable to parse uploaded file: ' . $e->getMessage()], 422);
            }
        }

        return response()->json(['rows' => $rows]);
    }

    /**
     * Confirm import: parse file and persist courses (JSON)
     */
    public function confirmImport(Request $request)
    {
        $request->validate([
            'file' => [
                'required',
                'file',
                function ($attribute, $value, $fail) {
                    if (!$value) {
                        $fail('The file field is required.');
                        return;
                    }
                    $ext = strtolower($value->getClientOriginalExtension());
                    if (!in_array($ext, ['xlsx', 'xls', 'csv'])) {
                        $fail('The file must be a file of type: xlsx, xls, csv.');
                    }
                },
            ],
        ]);

        $file = $request->file('file');
        $ext = strtolower($file->getClientOriginalExtension());
        $rows = [];

        if ($ext === 'csv') {
            $path = $file->getRealPath();
            if (($handle = fopen($path, 'r')) !== false) {
                $header = null;
                while (($row = fgetcsv($handle)) !== false) {
                    $firstCell = trim($row[0] ?? '');
                    if (empty($firstCell) || strpos($firstCell, '#') === 0) {
                        continue;
                    }
                    $header = $row;
                    break;
                }
                if ($header === null) {
                    fclose($handle);
                    return response()->json(['error' => 'Header row not found in CSV file'], 422);
                }
                $normalizedHeader = array_map(fn($h) => strtolower(trim($h)), $header);
                while (($data = fgetcsv($handle)) !== false) {
                    $firstCell = trim($data[0] ?? '');
                    if (empty($firstCell) || strpos($firstCell, '#') === 0) {
                        continue;
                    }
                    $row = [];
                    foreach ($normalizedHeader as $i => $key) {
                        $row[$key] = $data[$i] ?? null;
                    }
                    $rows[] = $row;
                }
                fclose($handle);
            }
        } else {
            try {
                $array = Excel::toArray([], $file);
                if (!empty($array) && isset($array[0])) {
                    $sheet = $array[0];
                    $headerRowIndex = 0;
                    for ($i = 0; $i < count($sheet); $i++) {
                        $firstCell = trim($sheet[$i][0] ?? '');
                        if (!empty($firstCell) && strpos($firstCell, '#') !== 0) {
                            $headerRowIndex = $i;
                            break;
                        }
                    }
                    $header = array_map(fn($h) => strtolower(trim($h)), $sheet[$headerRowIndex] ?? []);
                    for ($i = $headerRowIndex + 1; $i < count($sheet); $i++) {
                        $data = $sheet[$i];
                        $firstCell = trim($data[0] ?? '');
                        if (empty($firstCell) || strpos($firstCell, '#') === 0) {
                            continue;
                        }
                        $row = [];
                        foreach ($header as $j => $key) {
                            $row[$key] = isset($data[$j]) ? (is_string($data[$j]) ? trim($data[$j]) : $data[$j]) : null;
                        }
                        $rows[] = $row;
                    }
                }
            } catch (\Throwable $e) {
                return response()->json(['error' => 'Unable to parse uploaded file: ' . $e->getMessage()], 422);
            }
        }

        $imported = 0;
        $skipped = 0;
        $failed = [];

        foreach ($rows as $idx => $r) {
            $courseCode = trim($r['course_code'] ?? '');
            $name = trim($r['name'] ?? '');
            $programName = trim($r['program'] ?? '');
            $levelName = trim($r['level'] ?? '');
            $academicYearName = trim($r['academic_year'] ?? '');
            $academicPeriodName = trim($r['academic_period'] ?? '');
            $courseType = strtolower(trim($r['course_type'] ?? ''));
            $creditHours = isset($r['credit_hours']) && $r['credit_hours'] !== '' ? (int) $r['credit_hours'] : 0;
            $studentSize = null;
            if (isset($r['student_size']) && $r['student_size'] !== '') {
                $val = (int) $r['student_size'];
                if ($val >= 0) {
                    $studentSize = $val;
                }
            }
            $teacherName = trim($r['teacher'] ?? '');

            if (empty($courseCode)) {
                $skipped++;
                $failed[] = ['index' => $idx, 'reason' => 'Course code is required'];
                continue;
            }
            if (empty($name)) {
                $skipped++;
                $failed[] = ['index' => $idx, 'reason' => 'Name is required'];
                continue;
            }
            if (empty($programName)) {
                $skipped++;
                $failed[] = ['index' => $idx, 'reason' => 'Program is required'];
                continue;
            }
            $program = Program::where('name', $programName)->first();
            if (!$program) {
                $skipped++;
                $failed[] = ['index' => $idx, 'reason' => 'Program "' . $programName . '" not found'];
                continue;
            }
            if (!in_array($courseType, ['core', 'elective'])) {
                $skipped++;
                $failed[] = ['index' => $idx, 'reason' => 'Course type must be core or elective'];
                continue;
            }

            $levelId = null;
            if (!empty($levelName)) {
                $level = Level::where('name', $levelName)->first();
                if ($level) {
                    $levelId = $level->id;
                }
            }
            $academicYearId = null;
            if (!empty($academicYearName)) {
                $ay = AcademicYear::where('name', $academicYearName)->first();
                if ($ay) {
                    $academicYearId = $ay->id;
                }
            }
            $academicPeriodId = null;
            if (!empty($academicPeriodName)) {
                $ap = AcademicPeriod::where('name', $academicPeriodName)->first();
                if ($ap) {
                    $academicPeriodId = $ap->id;
                }
            }
            $teacherId = null;
            if (!empty($teacherName)) {
                $teacher = Teacher::whereRaw("CONCAT(first_name, ' ', last_name) = ?", [$teacherName])->first();
                if ($teacher) {
                    $teacherId = $teacher->id;
                }
            }

            try {
                Course::updateOrCreate(
                    ['course_code' => $courseCode],
                    [
                        'name' => $name,
                        'program_id' => $program->id,
                        'level_id' => $levelId,
                        'academic_year_id' => $academicYearId,
                        'academic_period_id' => $academicPeriodId,
                        'course_type' => $courseType,
                        'credit_hours' => $creditHours,
                        'student_size' => $studentSize,
                        'teacher_id' => $teacherId,
                    ]
                );
                $imported++;
            } catch (\Throwable $e) {
                $failed[] = ['index' => $idx, 'reason' => $e->getMessage()];
            }
        }

        return response()->json(['imported' => $imported, 'skipped' => $skipped, 'failed' => $failed]);
    }
}