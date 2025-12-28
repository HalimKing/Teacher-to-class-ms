<?php

namespace App\Http\Controllers\Admin\SchoolManagement;

use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use Exception;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AcademicYearController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        //
        $academicYears = \App\Models\AcademicYear::all();
        return Inertia::render('admin/school-management/academic-year/index', [
            'academicYearData' => $academicYears,
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
        return Inertia::render('admin/school-management/academic-year/create');
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        //
        $validated = $request->validate([
            'name' => 'required|string|unique:academic_years,name',
        ]);

        AcademicYear::create($validated);
        return redirect()->route('admin.school-management.academic-years.index')->with('success', 'Academic Year created successfully.');
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
    public function edit(AcademicYear $academicYear)
    {
        //
        return Inertia::render('admin/school-management/academic-year/edit', [
            'academicYear' => $academicYear
        ]);

    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, AcademicYear $academicYear)
    {
        //
         $validated = $request->validate([
            'name' => 'required|string|unique:academic_years,name,'. $academicYear->id,
        ]);
        try {
            $academicYear->name = $request->name;
            $academicYear->update();
            return redirect()->route('admin.school-management.academic-years.index')
                ->with('success', 'Academic Year updated successfully.');
        } catch (Exception $e) {
             return redirect()->route('admin.school-management.academic-years.index')
                ->with('error', 'Error occure, ' . $e->getMessage());
        }
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy( AcademicYear $academicYear)
    {
        //
        $academicYear->delete();
        return redirect()->route('admin.school-management.academic-years.index')
            ->with('success', 'Academic Year deleted successfully.');
    }



    public function toggleStatus(AcademicYear $academicYear)
    {
        $newStatus = request('status');
        
        // Validate status
        if (!in_array($newStatus, ['active', 'inactive'])) {
            return back()->with('error', 'Invalid status');
        }
        
        // If setting to active, deactivate all other records
        if ($newStatus === 'active') {
            AcademicYear::where('id', '!=', $academicYear->id)->update(['status' => 'inactive']);
            $academicYear->update(['status' => 'active']);
            return back()->with('success', 'Academic year set as active. All other academic years have been deactivated.');
        }
        
        // If trying to set to inactive, ensure at least one active record remains
        if ($newStatus === 'inactive') {
            $activeCount = AcademicYear::where('status', 'active')->count();
            if ($activeCount === 1 && $academicYear->status === 'active') {
                return back()->with('error', 'Cannot deactivate. At least one academic year must remain active.');
            }
            $academicYear->update(['status' => 'inactive']);
            return back()->with('success', 'Academic year deactivated successfully!');
        }
    }
}
