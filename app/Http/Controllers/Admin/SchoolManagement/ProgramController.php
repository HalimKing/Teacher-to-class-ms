<?php

namespace App\Http\Controllers\Admin\SchoolManagement;

use App\Http\Controllers\Controller;
use App\Models\Faculty;
use App\Models\Program;
use App\Models\Department;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ProgramController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        // Get filter parameters from request
        $facultyId = $request->input('faculty_id');
        $departmentId = $request->input('department_id');
        
        // Start query
        $query = Program::with('faculty', 'department');
        
        // Apply filters if provided
        if ($facultyId) {
            $query->where('faculty_id', $facultyId);
        }
        
        if ($departmentId) {
            $query->where('department_id', $departmentId);
        }
        
        $programsData = $query->orderBy('name')->get();
        
        // Get all faculties and departments for filters
        $faculties = Faculty::select('id', 'name')->orderBy('name')->get();
        $departments = Department::select('id', 'name')->orderBy('name')->get();
        
        // Transform for frontend dropdowns
        $facultyOptions = $faculties->map(function ($faculty) {
            return [
                'label' => $faculty->name,
                'value' => $faculty->id
            ];
        })->toArray();
        
        $departmentOptions = $departments->map(function ($department) {
            return [
                'label' => $department->name,
                'value' => $department->id
            ];
        })->toArray();
    
        return Inertia::render('admin/school-management/programs/index', 
            compact('programsData', 'facultyOptions', 'departmentOptions'));
    }

    /**
     * API endpoint to get departments for a specific faculty
     */
    public function getDepartmentsByFaculty($facultyId)
    {
        $departments = Department::where('faculty_id', $facultyId)
            ->select('id', 'name')
            ->orderBy('name')
            ->get();
        
        $departmentOptions = $departments->map(function ($department) {
            return [
                'label' => $department->name,
                'value' => $department->id
            ];
        })->toArray();
        
        return response()->json($departmentOptions);
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
        return Inertia::render('admin/school-management/programs/create', 
            compact('facultyOptions'));
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|unique:programs,name',
            'faculty' => 'required|exists:faculties,id',
            'department' => 'required|exists:departments,id',
        ]);

        $program = new Program();
        $program->name = $validated['name'];
        $program->faculty_id = $validated['faculty'];
        $program->department_id = $validated['department'];
        $program->save();
        return redirect()->route('admin.school-management.programs.index')
            ->with('success', 'Program created successfully.');
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
    public function edit(Program $program)
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
        
        return Inertia::render('admin/school-management/programs/edit', 
            compact('program', 'facultyOptions'));
        
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        //
        $request->validate([
            'name' => 'required|string|unique:programs,name,'. $id,
            'faculty' => 'required|exists:faculties,id',
            'department' => 'required|exists:departments,id',
        ]);
        $program = Program::findOrFail($id);
        $program->name = $request->input('name');
        $program->faculty_id = $request->input('faculty');
        $program->department_id = $request->input('department');
        $program->save();
        return redirect()->route('admin.school-management.programs.index')
            ->with('success', 'Program updated successfully.');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Program $program)
    {
        //
        $program->delete();
        return redirect()->route('admin.school-management.programs.index')
            ->with('success', 'Program deleted successfully.');

    }
}