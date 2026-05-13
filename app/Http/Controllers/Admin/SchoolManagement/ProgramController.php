<?php

namespace App\Http\Controllers\Admin\SchoolManagement;

use App\Http\Controllers\Controller;
use App\Models\Faculty;
use App\Models\Program;
use App\Models\Department;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;

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

    /**
     * Export programs to Excel or CSV
     */
    public function export($format = 'excel')
    {
        $fileName = 'programs_' . now()->format('Ymd_His');

        if ($format === 'csv') {
            $fileName .= '.csv';
            $headers = [
                'Content-Type' => 'text/csv',
                'Content-Disposition' => "attachment; filename=\"{$fileName}\"",
            ];

            $callback = function () {
                $out = fopen('php://output', 'w');
                fputcsv($out, ['ID', 'Name', 'Faculty', 'Department', 'Created At', 'Updated At']);
                Program::with(['faculty', 'department'])->chunk(200, function ($programs) use ($out) {
                    foreach ($programs as $p) {
                        fputcsv($out, [
                            $p->id,
                            $p->name,
                            $p->faculty->name ?? '',
                            $p->department->name ?? '',
                            optional($p->created_at)->toDateTimeString(),
                            optional($p->updated_at)->toDateTimeString(),
                        ]);
                    }
                });
                fclose($out);
            };

            return response()->streamDownload($callback, $fileName, $headers);
        }

        $fileName .= '.xlsx';
        try {
            $csvName = 'programs_' . now()->format('Ymd_His') . '.csv';
            $headers = [
                'Content-Type' => 'text/csv',
                'Content-Disposition' => "attachment; filename=\"{$csvName}\"",
            ];

            $callback = function () {
                $out = fopen('php://output', 'w');
                fputcsv($out, ['ID', 'Name', 'Faculty', 'Department', 'Created At', 'Updated At']);
                Program::with(['faculty', 'department'])->chunk(200, function ($programs) use ($out) {
                    foreach ($programs as $p) {
                        fputcsv($out, [
                            $p->id,
                            $p->name,
                            $p->faculty->name ?? '',
                            $p->department->name ?? '',
                            optional($p->created_at)->toDateTimeString(),
                            optional($p->updated_at)->toDateTimeString(),
                        ]);
                    }
                });
                fclose($out);
            };

            return response()->streamDownload($callback, $csvName, $headers);
        } catch (\Throwable $e) {
            $csvName = 'programs_' . now()->format('Ymd_His') . '.csv';
            $headers = [
                'Content-Type' => 'text/csv',
                'Content-Disposition' => "attachment; filename=\"{$csvName}\"",
            ];

            $callback = function () {
                $out = fopen('php://output', 'w');
                fputcsv($out, ['ID', 'Name', 'Faculty', 'Department', 'Created At', 'Updated At']);
                Program::with(['faculty', 'department'])->chunk(200, function ($programs) use ($out) {
                    foreach ($programs as $p) {
                        fputcsv($out, [
                            $p->id,
                            $p->name,
                            $p->faculty->name ?? '',
                            $p->department->name ?? '',
                            optional($p->created_at)->toDateTimeString(),
                            optional($p->updated_at)->toDateTimeString(),
                        ]);
                    }
                });
                fclose($out);
            };

            return response()->streamDownload($callback, $csvName, $headers);
        }
    }

    /**
     * Download a template spreadsheet with model headings for programs
     */
    public function template()
    {
        $fileName = 'programs_template_' . now()->format('Ymd') . '.csv';
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$fileName}\"",
        ];

        $callback = function () {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['# IMPORT RULES AND INSTRUCTIONS']);
            fputcsv($out, ['# 1. Name is REQUIRED - Must be unique, cannot be empty']);
            fputcsv($out, ['# 2. Faculty is REQUIRED - Must match an existing faculty name exactly']);
            fputcsv($out, ['# 3. Department is REQUIRED - Must match an existing department name exactly']);
            fputcsv($out, ['# 4. Department must belong to the given Faculty']);
            fputcsv($out, ['# 5. Do not modify the header row (name, faculty, department)']);
            fputcsv($out, ['# 6. Remove this instruction row and example rows before uploading']);
            fputcsv($out, ['# 7. Each row represents one program to import']);
            fputcsv($out, ['# 8. Duplicate program names will be skipped']);
            fputcsv($out, ['']);
            fputcsv($out, ['name', 'faculty', 'department']);
            fputcsv($out, ['BSc Computer Science', 'Faculty of Engineering', 'Computer Science']);
            fputcsv($out, ['BSc Mathematics', 'Faculty of Science', 'Mathematics']);
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

                $normalizedHeader = array_map(function ($h) {
                    return strtolower(trim($h));
                }, $header);

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
                    if (empty($row['name'])) {
                        $errors[] = 'Name is required';
                    }
                    $faculty = null;
                    if (empty($row['faculty'])) {
                        $errors[] = 'Faculty is required';
                    } else {
                        $faculty = Faculty::where('name', trim($row['faculty']))->first();
                        if (!$faculty) {
                            $errors[] = 'Faculty "' . $row['faculty'] . '" not found';
                        }
                    }
                    if (empty($row['department'])) {
                        $errors[] = 'Department is required';
                    } elseif ($faculty) {
                        $dept = Department::where('name', trim($row['department']))
                            ->where('faculty_id', $faculty->id)
                            ->first();
                        if (!$dept) {
                            $errors[] = 'Department "' . $row['department'] . '" not found or does not belong to faculty';
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
                        $exists = Program::where('name', $row['name'])->exists();
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

                    $header = array_map(function ($h) {
                        return strtolower(trim($h));
                    }, $sheet[$headerRowIndex] ?? []);

                    $seen = [];
                    for ($i = $headerRowIndex + 1; $i < count($sheet); $i++) {
                        $data = $sheet[$i];
                        $firstCell = trim($data[0] ?? '');
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
                        $faculty = null;
                        if (empty($row['faculty'])) {
                            $errors[] = 'Faculty is required';
                        } else {
                            $faculty = Faculty::where('name', trim($row['faculty']))->first();
                            if (!$faculty) {
                                $errors[] = 'Faculty "' . $row['faculty'] . '" not found';
                            }
                        }
                        if (empty($row['department'])) {
                            $errors[] = 'Department is required';
                        } elseif ($faculty) {
                            $dept = Department::where('name', trim($row['department']))
                                ->where('faculty_id', $faculty->id)
                                ->first();
                            if (!$dept) {
                                $errors[] = 'Department "' . $row['department'] . '" not found or does not belong to faculty';
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
                            $exists = Program::where('name', $row['name'])->exists();
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

                $normalizedHeader = array_map(function ($h) {
                    return strtolower(trim($h));
                }, $header);

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

                    $header = array_map(function ($h) {
                        return strtolower(trim($h));
                    }, $sheet[$headerRowIndex] ?? []);

                    for ($i = $headerRowIndex + 1; $i < count($sheet); $i++) {
                        $data = $sheet[$i];
                        $firstCell = trim($data[0] ?? '');
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
            $departmentName = trim($r['department'] ?? '');

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
            if (empty($departmentName)) {
                $skipped++;
                $failed[] = ['index' => $idx, 'reason' => 'Department is required'];
                continue;
            }

            $faculty = Faculty::where('name', $facultyName)->first();
            if (!$faculty) {
                $skipped++;
                $failed[] = ['index' => $idx, 'reason' => 'Faculty "' . $facultyName . '" not found'];
                continue;
            }

            $department = Department::where('name', $departmentName)->where('faculty_id', $faculty->id)->first();
            if (!$department) {
                $skipped++;
                $failed[] = ['index' => $idx, 'reason' => 'Department "' . $departmentName . '" not found or does not belong to faculty'];
                continue;
            }

            try {
                Program::updateOrCreate(
                    ['name' => $name],
                    ['faculty_id' => $faculty->id, 'department_id' => $department->id]
                );
                $imported++;
            } catch (\Throwable $e) {
                $failed[] = ['index' => $idx, 'reason' => $e->getMessage()];
            }
        }

        return response()->json(['imported' => $imported, 'skipped' => $skipped, 'failed' => $failed]);
    }
}