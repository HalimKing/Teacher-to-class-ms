<?php

namespace App\Http\Controllers\Admin\SchoolManagement;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\Faculty;
use Exception;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;

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

    /**
     * Export departments to Excel or CSV
     */
    public function export($format = 'excel')
    {
        $fileName = 'departments_' . now()->format('Ymd_His');

        // Prefer streaming CSV to avoid dependency interface issues
        if ($format === 'csv') {
            $fileName .= '.csv';
            $headers = [
                'Content-Type' => 'text/csv',
                'Content-Disposition' => "attachment; filename=\"{$fileName}\"",
            ];

            $callback = function () {
                $out = fopen('php://output', 'w');
                fputcsv($out, ['ID', 'Name', 'Faculty', 'Created At', 'Updated At']);
                Department::with('faculty')->chunk(200, function ($departments) use ($out) {
                    foreach ($departments as $d) {
                        fputcsv($out, [
                            $d->id,
                            $d->name,
                            $d->faculty->name ?? '',
                            optional($d->created_at)->toDateTimeString(),
                            optional($d->updated_at)->toDateTimeString(),
                        ]);
                    }
                });
                fclose($out);
            };

            return response()->streamDownload($callback, $fileName, $headers);
        }

        // For xlsx attempt to use the Excel package, but fall back to CSV if it fails
        $fileName .= '.xlsx';
        try {
            // If you have a DepartmentsExport class, use it here
            // $export = new DepartmentsExport();
            // return Excel::download($export, $fileName, 'xlsx');
            
            // Fallback to CSV for now
            $csvName = 'departments_' . now()->format('Ymd_His') . '.csv';
            $headers = [
                'Content-Type' => 'text/csv',
                'Content-Disposition' => "attachment; filename=\"{$csvName}\"",
            ];

            $callback = function () {
                $out = fopen('php://output', 'w');
                fputcsv($out, ['ID', 'Name', 'Faculty', 'Created At', 'Updated At']);
                Department::with('faculty')->chunk(200, function ($departments) use ($out) {
                    foreach ($departments as $d) {
                        fputcsv($out, [
                            $d->id,
                            $d->name,
                            $d->faculty->name ?? '',
                            optional($d->created_at)->toDateTimeString(),
                            optional($d->updated_at)->toDateTimeString(),
                        ]);
                    }
                });
                fclose($out);
            };

            return response()->streamDownload($callback, $csvName, $headers);
        } catch (\Throwable $e) {
            // fallback to CSV
            $csvName = 'departments_' . now()->format('Ymd_His') . '.csv';
            $headers = [
                'Content-Type' => 'text/csv',
                'Content-Disposition' => "attachment; filename=\"{$csvName}\"",
            ];

            $callback = function () {
                $out = fopen('php://output', 'w');
                fputcsv($out, ['ID', 'Name', 'Faculty', 'Created At', 'Updated At']);
                Department::with('faculty')->chunk(200, function ($departments) use ($out) {
                    foreach ($departments as $d) {
                        fputcsv($out, [
                            $d->id,
                            $d->name,
                            $d->faculty->name ?? '',
                            optional($d->created_at)->toDateTimeString(),
                            optional($d->updated_at)->toDateTimeString(),
                        ]);
                    }
                });
                fclose($out);
            };

            return response()->streamDownload($callback, $csvName, $headers);
        }
    }

    /**
     * Download a template spreadsheet with model headings for departments
     */
    public function template()
    {
        $fileName = 'departments_template_' . now()->format('Ymd') . '.csv';
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$fileName}\"",
        ];

        $callback = function () {
            $out = fopen('php://output', 'w');
            // Instructions row
            fputcsv($out, ['# IMPORT RULES AND INSTRUCTIONS']);
            fputcsv($out, ['# 1. Name is REQUIRED - Must be unique, cannot be empty']);
            fputcsv($out, ['# 2. Faculty is REQUIRED - Must match an existing faculty name exactly']);
            fputcsv($out, ['# 3. Do not modify the header row (name, faculty)']);
            fputcsv($out, ['# 4. Remove this instruction row and example rows before uploading']);
            fputcsv($out, ['# 5. Each row represents one department to import']);
            fputcsv($out, ['# 6. Faculty name must exist in the system - check spelling and case']);
            fputcsv($out, ['# 7. Duplicate department names will be skipped']);
            fputcsv($out, ['']);
            // heading row
            fputcsv($out, ['name', 'faculty']);
            // example rows
            fputcsv($out, ['Computer Science', 'Faculty of Engineering']);
            fputcsv($out, ['Mathematics', 'Faculty of Science']);
            fclose($out);
        };

        return response()->streamDownload($callback, $fileName, $headers);
    }

    /**
     * Preview uploaded file and return parsed rows with validation info (JSON)
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
                    $allowedExtensions = ['xlsx', 'xls', 'csv'];
                    
                    if (!in_array($ext, $allowedExtensions)) {
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
                // Skip comment rows and find header
                $header = null;
                $line = 0;
                while (($row = fgetcsv($handle)) !== false) {
                    $line++;
                    $firstCell = trim($row[0] ?? '');
                    // Skip comment rows (starting with #) and empty rows
                    if (empty($firstCell) || strpos($firstCell, '#') === 0) {
                        continue;
                    }
                    // Found header row
                    $header = $row;
                    break;
                }
                
                if ($header === null) {
                    fclose($handle);
                    return response()->json(['error' => 'Header row not found in CSV file'], 422);
                }

                $normalizedHeader = array_map(function ($h) {
                    return strtolower(trim($h));
                }, $header);

                $seen = [];
                while (($data = fgetcsv($handle)) !== false) {
                    $line++;
                    $firstCell = trim($data[0] ?? '');
                    // Skip comment rows and empty rows
                    if (empty($firstCell) || strpos($firstCell, '#') === 0) {
                        continue;
                    }
                    
                    $row = [];
                    foreach ($normalizedHeader as $i => $key) {
                        $row[$key] = $data[$i] ?? null;
                    }

                    $errors = [];
                    if (empty($row['name'])) {
                        $errors[] = 'Name is required';
                    }

                    if (empty($row['faculty'])) {
                        $errors[] = 'Faculty is required';
                    } else {
                        // Check if faculty exists
                        $faculty = Faculty::where('name', trim($row['faculty']))->first();
                        if (!$faculty) {
                            $errors[] = 'Faculty "' . $row['faculty'] . '" not found';
                        }
                    }

                    $nameKey = strtolower(trim($row['name'] ?? ''));
                    if ($nameKey && isset($seen[$nameKey])) {
                        $errors[] = 'Duplicate in file (line ' . $seen[$nameKey] . ')';
                    } elseif ($nameKey) {
                        $seen[$nameKey] = $line;
                    }

                    $exists = false;
                    if (!empty($row['name'])) {
                        $exists = Department::where('name', $row['name'])->exists();
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
                    
                    // Find header row (skip comment rows)
                    $headerRowIndex = 0;
                    for ($i = 0; $i < count($sheet); $i++) {
                        $firstCell = trim($sheet[$i][0] ?? '');
                        if (!empty($firstCell) && strpos($firstCell, '#') !== 0) {
                            $headerRowIndex = $i;
                            break;
                        }
                    }
                    
                    $header = array_map(function ($h) {
                        return strtolower(trim($h));
                    }, $sheet[$headerRowIndex] ?? []);

                    $seen = [];
                    for ($i = $headerRowIndex + 1; $i < count($sheet); $i++) {
                        $data = $sheet[$i];
                        $firstCell = trim($data[0] ?? '');
                        // Skip comment rows and empty rows
                        if (empty($firstCell) || strpos($firstCell, '#') === 0) {
                            continue;
                        }
                        
                        $row = [];
                        foreach ($header as $j => $key) {
                            $row[$key] = $data[$j] ?? null;
                        }

                        $errors = [];
                        if (empty($row['name'])) {
                            $errors[] = 'Name is required';
                        }

                        if (empty($row['faculty'])) {
                            $errors[] = 'Faculty is required';
                        } else {
                            // Check if faculty exists
                            $faculty = Faculty::where('name', trim($row['faculty']))->first();
                            if (!$faculty) {
                                $errors[] = 'Faculty "' . $row['faculty'] . '" not found';
                            }
                        }

                        $line = $i + 1;
                        $nameKey = strtolower(trim($row['name'] ?? ''));
                        if ($nameKey && isset($seen[$nameKey])) {
                            $errors[] = 'Duplicate in file (line ' . $seen[$nameKey] . ')';
                        } elseif ($nameKey) {
                            $seen[$nameKey] = $line;
                        }

                        $exists = false;
                        if (!empty($row['name'])) {
                            $exists = Department::where('name', $row['name'])->exists();
                        }

                        $rows[] = [
                            'line' => $line,
                            'data' => $row,
                            'errors' => $errors,
                            'exists' => $exists,
                        ];
                    }
                }
            } catch (\Throwable $e) {
                return response()->json(['error' => 'Unable to parse uploaded file: ' . $e->getMessage()], 422);
            }
        }

        return response()->json(['rows' => $rows]);
    }

    /**
     * Confirm import: parse file and persist rows, returning JSON summary
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
                    $allowedExtensions = ['xlsx', 'xls', 'csv'];
                    
                    if (!in_array($ext, $allowedExtensions)) {
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
                // Skip comment rows and find header
                $header = null;
                while (($row = fgetcsv($handle)) !== false) {
                    $firstCell = trim($row[0] ?? '');
                    // Skip comment rows (starting with #) and empty rows
                    if (empty($firstCell) || strpos($firstCell, '#') === 0) {
                        continue;
                    }
                    // Found header row
                    $header = $row;
                    break;
                }
                
                if ($header === null) {
                    fclose($handle);
                    return response()->json(['error' => 'Header row not found in CSV file'], 422);
                }

                $normalizedHeader = array_map(function ($h) {
                    return strtolower(trim($h));
                }, $header);

                while (($data = fgetcsv($handle)) !== false) {
                    $firstCell = trim($data[0] ?? '');
                    // Skip comment rows and empty rows
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
                    
                    // Find header row (skip comment rows)
                    $headerRowIndex = 0;
                    for ($i = 0; $i < count($sheet); $i++) {
                        $firstCell = trim($sheet[$i][0] ?? '');
                        if (!empty($firstCell) && strpos($firstCell, '#') !== 0) {
                            $headerRowIndex = $i;
                            break;
                        }
                    }
                    
                    $header = array_map(function ($h) {
                        return strtolower(trim($h));
                    }, $sheet[$headerRowIndex] ?? []);

                    for ($i = $headerRowIndex + 1; $i < count($sheet); $i++) {
                        $data = $sheet[$i];
                        $firstCell = trim($data[0] ?? '');
                        // Skip comment rows and empty rows
                        if (empty($firstCell) || strpos($firstCell, '#') === 0) {
                            continue;
                        }
                        
                        $row = [];
                        foreach ($header as $j => $key) {
                            $row[$key] = $data[$j] ?? null;
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
            $name = $r['name'] ?? null;
            $facultyName = trim($r['faculty'] ?? '');
            
            if (empty($name)) {
                $skipped++;
                $failed[] = ['index' => $idx, 'reason' => 'Name is required'];
                continue;
            }

            if (empty($facultyName)) {
                $skipped++;
                $failed[] = ['index' => $idx, 'reason' => 'Faculty is required'];
                continue;
            }

            $faculty = Faculty::where('name', $facultyName)->first();
            if (!$faculty) {
                $skipped++;
                $failed[] = ['index' => $idx, 'reason' => 'Faculty "' . $facultyName . '" not found'];
                continue;
            }

            try {
                Department::updateOrCreate(
                    ['name' => $name],
                    ['faculty_id' => $faculty->id]
                );
                $imported++;
            } catch (\Throwable $e) {
                $failed[] = ['index' => $idx, 'reason' => $e->getMessage()];
            }
        }

        return response()->json(['imported' => $imported, 'skipped' => $skipped, 'failed' => $failed]);
    }
}