<?php

namespace App\Http\Controllers\Admin\SchoolManagement;

use App\Http\Controllers\Controller;
use App\Models\AcademicPeriod;
use App\Support\ListQuery;
use App\Support\SqlDialect;
use Exception;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AcademicPeriodController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = AcademicPeriod::query();
        $search = trim((string) $request->get('search', ''));

        if ($search !== '') {
            $like = SqlDialect::containsLike($search);
            $query->whereRaw('LOWER(name) LIKE ?', [$like]);
        }

        [$sortBy, $sortDir] = ListQuery::applySort($query, $request, [
            'name' => 'name',
            'created_at' => 'created_at',
        ], 'name');

        $perPage = ListQuery::perPage($request);

        return Inertia::render('admin/school-management/academic-period/index', [
            'academicPeriodData' => $query->paginate($perPage)->withQueryString(),
            'filters' => ListQuery::meta([
                'search' => $search,
            ], $sortBy, $sortDir, $perPage),
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
        return Inertia::render('admin/school-management/academic-period/create');
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        //
         $validated = $request->validate([
            'name' => 'required|string|unique:academic_periods,name',
        ]);

        try {
            AcademicPeriod::create($validated);
            return redirect()->route('admin.school-management.academic-periods.index')->with('success', 'Academic Period created successfully.');
        } catch (\Exception $e) {
            return redirect()->back()->withErrors(['error' => 'An error occurred while creating the Academic Period.'])->withInput();
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
    public function edit(AcademicPeriod $academicPeriod)
    {
        //
        return Inertia::render('admin/school-management/academic-period/edit', [
            'academicPeriod' => $academicPeriod
        ]);

    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, AcademicPeriod $academicPeriod)
    {
        //
         $validated = $request->validate([
            'name' => 'required|string|unique:academic_periods,name,'. $academicPeriod->id,
        ]);
        try {
            $academicPeriod->name = $request->name;
            $academicPeriod->update();
            return redirect()->route('admin.school-management.academic-periods.index')
                ->with('success', 'Academic Period updated successfully.');
        } catch (Exception $e) {
            return redirect()->back()->withErrors(['error' => 'An error occurred while updating the Academic Period.'])->withInput();
        }
    }
    

    /**
     * Remove the specified resource from storage.
     */
    public function destroy( AcademicPeriod $academicPeriod)
    {
        //
        $academicPeriod->delete();
        return redirect()->route('admin.school-management.academic-periods.index')
            ->with('success', 'Academic Period deleted successfully.');
    }

    
}
