<?php

namespace App\Http\Controllers\Admin\SchoolManagement;

use App\Http\Controllers\Controller;
use App\Models\ClassRoom;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ClassRoomController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        //
        $query = ClassRoom::query();
        
        // Search filter
        if ($request->has('search') && !empty($request->search)) {
            $searchTerm = $request->search;
            $query->where(function ($q) use ($searchTerm) {
                $q->where('name', 'like', '%' . $searchTerm . '%');
            });
        }
        
      
        
        $classRoomData = $query->paginate(10);
        
  
        
        return Inertia::render('admin/school-management/class-room/index', 
            compact('classRoomData'));
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
        return Inertia::render('admin/school-management/class-room/create');
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        //
        $validator = $request->validate([
            'name' => 'required|string|max:255|unique:class_rooms,name',
            'capacity' => 'required|integer|min:1',
        ]);
        try {
            $classRoom = new ClassRoom();
            $classRoom->name = $request->name;
            $classRoom->capacity = $request->capacity;
            $classRoom->save();
            return redirect()->route('admin.school-management.class-rooms.index')
            ->with('success', 'Successful created!');
        }catch(\Exception $e){
            return redirect()->route('admin.school-management.class-rooms.index')
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
    public function edit(string $id)
    {
        //
        $classRoom = ClassRoom::findOrFail($id);
        return Inertia::render('admin/school-management/class-room/edit', compact('classRoom'));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        //
        $classRoom = ClassRoom::findOrFail($id);
        $request->validate([
            'name' => 'required|string|max:255|unique:class_rooms,name,'. $classRoom->id,
            'capacity' => 'required|integer|min:1',
        ]);
        try {
            $classRoom->name = $request->name;
            $classRoom->capacity = $request->capacity;  
            $classRoom->save();
            return redirect()->route('admin.school-management.class-rooms.index')
            ->with('success', 'Successful updated!');
        }catch(\Exception $e){
            return redirect()->route('admin.school-management.class-rooms.index')
            ->with('error', $e->getMessage());
        }
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        //
        $classRoom = ClassRoom::findOrFail($id);
        try {
            $classRoom->delete();
            return redirect()->route('admin.school-management.class-rooms.index')
            ->with('success', 'Successful deleted!');
        }catch(\Exception $e){
            return redirect()->route('admin.school-management.class-rooms.index')
            ->with('error', $e->getMessage());
        }   
    }
}
