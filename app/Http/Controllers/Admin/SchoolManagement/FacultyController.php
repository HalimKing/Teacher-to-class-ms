<?php

namespace App\Http\Controllers\Admin\SchoolManagement;

use App\Http\Controllers\Controller;
use App\Models\Faculty;
use Exception;
use Illuminate\Http\Request;
use Inertia\Inertia;

class FacultyController extends Controller
{
    /**
     * Display a listing of the resource.
     */
   public function index(Request $request)
    {
        $query = Faculty::query();
        
        // Only apply search filter if search term is provided and not empty
        if ($request->has('search') && !empty($request->search)) {
            $searchTerm = $request->search;
            $query->where(function ($q) use ($searchTerm) {
                $q->where('name', 'like', '%' . $searchTerm . '%')
                ->orWhere('description', 'like', '%' . $searchTerm . '%');
            });
        }
        
        $facultiesData = $query->paginate(10);
        return Inertia::render('admin/school-management/faculty/index', 
        compact('facultiesData'));
    }
    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
        return Inertia::render('admin/school-management/faculty/create');
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        //
        $validator = $request->validate([
            'name' => 'required|string|max:255|unique:faculties,name',
            'description' => 'string|nullable'
        ]);
        try {
            $faculty = new Faculty();
            $faculty->name = $request->name;
            $faculty->description = $request->description;
            $faculty->save();
            return redirect()->route('admin.school-management.faculties.index')
            ->with('success', 'Successful created!');
        }catch(Exception $e){
            return redirect()->route('admin.school-management.faculties.index')
            ->with('error', $e->getMessage());
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
    public function edit(Faculty $faculty)
    {
        //
        
        return Inertia::render('admin/school-management/faculty/edit', compact('faculty'));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Faculty $faculty)
    {
        //
        $request->validate([
            'name' => 'required|string|max:255|unique:faculties,name,'. $faculty->id,
            'description' => 'string|nullable'
        ]);
        $faculty->name = $request->name;
        $faculty->description = $request->description;
        $faculty->save();
        return redirect()->route('admin.school-management.faculties.index')
            ->with('success', 'Successful updated!');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Faculty $faculty)
    {
        //
        $faculty->delete();
        // dd('working');
        return redirect()->route('admin.school-management.faculties.index')
            ->with('success', 'Successful deleted faculty!');
    }
}
