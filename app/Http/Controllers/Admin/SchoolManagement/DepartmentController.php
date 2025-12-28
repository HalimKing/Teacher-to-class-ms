<?php

namespace App\Http\Controllers\Admin\SchoolManagement;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\Faculty;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DepartmentController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = Department::query()->with('faculty');
        
        // Search filter
        if ($request->has('search') && !empty($request->search)) {
            $searchTerm = $request->search;
            $query->where(function ($q) use ($searchTerm) {
                $q->where('name', 'like', '%' . $searchTerm . '%')
                ->orWhereHas('faculty', function ($q) use ($searchTerm) {
                    $q->where('name', 'like', '%' . $searchTerm . '%');
                });
            });
        }
        
        // Faculty filter
        if ($request->has('faculty') && !empty($request->faculty)) {
            $query->where('faculty_id', $request->faculty);
        }
        
        $departmentData = $query->paginate(10);
        
        // Get faculties for filter dropdown
        $faculties = Faculty::select('id', 'name')->orderBy('name')->get();
        $facultyOptions = [];
        foreach($faculties as $faculty){
            $facultyOptions[] = [
                'label' => $faculty->name,
                'value' => $faculty->id
            ];
        }
        
        return Inertia::render('admin/school-management/department/index', 
            compact('departmentData', 'facultyOptions'));
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        $faculties = Faculty::select('id', 'name')->orderBy('name')->get();
        $facultyOptions = [];
        foreach($faculties as $faculty){
            $facultyOptions[] = [
                'label' => $faculty->name,
                'value' => $faculty->id
            ];
        }
        return Inertia::render('admin/school-management/department/create', compact('facultyOptions'));
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255|unique:departments,name',
            'faculty' => 'required|exists:faculties,id'
        ]);
        
        $department = new Department();
        $department->name = $request->name;
        $department->faculty_id = $request->faculty;
        $department->save();
        
        return redirect()->route('admin.school-management.departments.index')
            ->with('success', 'Department created successfully!');
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
        $department = Department::find($id);
        if(!$department){
            return redirect()->route('admin.school-management.departments.index')
            ->with('error', 'Department not found!');
        }
        $faculties = Faculty::select('id', 'name')->orderBy('name')->get();
        $facultyOptions = [];
        foreach($faculties as $faculty){
            $facultyOptions[] = [
                'label' => $faculty->name,
                'value' => $faculty->id
            ];
        }

        return Inertia::render('admin/school-management/department/edit', compact('department', 'facultyOptions'));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        //
        $request->validate([
            'name' => 'required|string|max:255|unique:departments,name,'.$id,
            'faculty' => 'required|exists:faculties,id'
        ]);
        $department = Department::find($id);
        if(!$department){
            return redirect()->route('admin.school-management.departments.index')
            ->with('error', 'Department not found!');
        }
        $department->name = $request->name;
        $department->faculty_id = $request->faculty;
        $department->save();
        
        return redirect()->route('admin.school-management.departments.index')
            ->with('success', 'Department updated successfully!');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        //
        $department = Department::find($id);
        if(!$department){
            return redirect()->route('admin.school-management.departments.index')
            ->with('error', 'Department not found!');
        }
        $department->delete();
        return redirect()->route('admin.school-management.departments.index')
            ->with('success', 'Department deleted successfully!');
    }

     public function getByFaculty($facultyId)
    {
        $departments = Department::where('faculty_id', $facultyId)
            ->select('id', 'name')
            ->orderBy('name')
            ->get();
        
        return response()->json($departments);
    }
}