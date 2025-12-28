<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Faculty;
use App\Models\Department;
use App\Models\Teacher;
use Illuminate\Http\Request;
use Inertia\Inertia;

class TeacherController extends Controller
{   
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = Teacher::with('faculty', 'department');
        
        // Search functionality
        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                  ->orWhere('last_name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('employee_id', 'like', "%{$search}%");
            });
        }
        
        // Faculty filter
        if ($request->has('faculty') && !empty($request->faculty) && $request->faculty !== 'all') {
            $query->where('faculty_id', $request->faculty);
        }
        
        // Department filter
        if ($request->has('department') && !empty($request->department) && $request->department !== 'all') {
            $query->where('department_id', $request->department);
        }
        
        // Pagination
        $teachers = $query->paginate(10)->withQueryString();
        
        // Get faculties and departments for filters
        $faculties = Faculty::select('id', 'name')->orderBy('name')->get();
        $departments = Department::select('id', 'name')->orderBy('name')->get();
        
        // Get current filters
        $filters = $request->only(['search', 'faculty', 'department']);
        
        return Inertia::render('admin/teacher/index', 
            compact('teachers', 'faculties', 'departments', 'filters'));
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        $faculties = Faculty::select('id', 'name')->orderBy('name')->get();
        $facultyOptions = [];
        
        foreach($faculties as $faculty) {
            $facultyOptions[] = [
                'label' => $faculty->name,
                'value' => $faculty->id
            ];
        }
        
        return Inertia::render('admin/teacher/create', 
            compact('facultyOptions'));
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'firstName' => 'required|string|max:255',
            'lastName' => 'required|string|max:255',
            'email' => 'required|email|unique:teachers,email',
            'phone' => 'required|string|max:20',
            'faculty' => 'required|exists:faculties,id',
            'department' => 'required|exists:departments,id',
            'employeeId' => 'required|string|unique:teachers,employee_id',
            'title' => 'required|string|max:255|in:Prof.,Dr.,Mr.,Ms.',
            // Add other validation rules
        ]);
        
        try{
            $teacher = new Teacher();
            $teacher->first_name = $validated['firstName'];
            $teacher->last_name = $validated['lastName'];
            $teacher->email = $validated['email'];
            $teacher->phone = $validated['phone'];
            $teacher->faculty_id = $validated['faculty'];
            $teacher->department_id = $validated['department'];
            $teacher->employee_id = $validated['employeeId'];
            $teacher->title = $validated['title'];
            // Assign other fields
            $teacher->save();
            return redirect()->route('admin.teachers.index')
            ->with('success', 'Teacher created successfully!');
        } catch(\Throwable $e) {
            return redirect()->route('admin.teachers.create')
                ->with('error', 'Error creating teacher: ' . $e->getMessage());
        }
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
        //
        $faculties = Faculty::select('id', 'name')->orderBy('name')->get();
        $facultyOptions = [];
        
        foreach($faculties as $faculty) {
            $facultyOptions[] = [
                'label' => $faculty->name,
                'value' => $faculty->id
            ];
        }

        $teacher = Teacher::findOrFail($id);
        
        return Inertia::render('admin/teacher/edit', 
            compact('facultyOptions', 'teacher'));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
{
    $teacher = Teacher::findOrFail($id);
    
    $validated = $request->validate([
        'firstName' => 'required|string|max:255',
        'lastName' => 'required|string|max:255',
        'email' => 'required|email|unique:teachers,email,' . $id,
        'phone' => 'required|string|max:20',
        'faculty' => 'required|exists:faculties,id',
        'department' => 'required|exists:departments,id',
        'employeeId' => 'required|string|unique:teachers,employee_id,' . $id,
        'title' => 'required|string|max:255|in:Prof.,Dr.,Mr.,Ms.',
    ]);
    
    try {
        $teacher->first_name = $validated['firstName'];
        $teacher->last_name = $validated['lastName'];
        $teacher->email = $validated['email'];
        $teacher->phone = $validated['phone'];
        $teacher->faculty_id = $validated['faculty'];
        $teacher->department_id = $validated['department'];
        $teacher->employee_id = $validated['employeeId'];
        $teacher->title = $validated['title'];
        $teacher->save();
        
        return redirect()->route('admin.teachers.index')
            ->with('success', 'Teacher updated successfully!');
    } catch(\Throwable $e) {
        return redirect()->back()
            ->with('error', 'Error updating teacher: ' . $e->getMessage());
    }
}

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        //
        $teacher = Teacher::findOrFail($id);
        $teacher->delete();
        return redirect()->route('admin.teachers.index')
            ->with('success', 'Teacher deleted successfully!');
    }
}