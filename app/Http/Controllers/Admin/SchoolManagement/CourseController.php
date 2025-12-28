<?php

namespace App\Http\Controllers\Admin\SchoolManagement;

use App\Http\Controllers\Controller;
use App\Models\AcademicPeriod;
use App\Models\AcademicYear;
use App\Models\Course;
use App\Models\Level;
use App\Models\Program;
use App\Models\Teacher; // Add this import
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Http\JsonResponse;

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
}