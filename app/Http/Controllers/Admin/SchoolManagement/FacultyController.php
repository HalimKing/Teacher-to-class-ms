<?php

namespace App\Http\Controllers\Admin\SchoolManagement;

use App\Http\Controllers\Controller;
use App\Models\Faculty;
use App\Exports\FacultiesExport;
use App\Imports\FacultiesImport;
use Exception;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;

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
        return Inertia::render(
            'admin/school-management/faculty/index',
            compact('facultiesData')
        );
    }

    /**
     * Export faculties to Excel or CSV
     */
    public function export($format = 'excel')
    {
        $fileName = 'faculties_' . now()->format('Ymd_His');

        // Prefer streaming CSV to avoid dependency interface issues
        if ($format === 'csv') {
            $fileName .= '.csv';
            $headers = [
                'Content-Type' => 'text/csv',
                'Content-Disposition' => "attachment; filename=\"{$fileName}\"",
            ];

            $callback = function () {
                $out = fopen('php://output', 'w');
                fputcsv($out, ['ID', 'Name', 'Description', 'Created At', 'Updated At']);
                \App\Models\Faculty::chunk(200, function ($faculties) use ($out) {
                    foreach ($faculties as $f) {
                        fputcsv($out, [
                            $f->id,
                            $f->name,
                            $f->description,
                            optional($f->created_at)->toDateTimeString(),
                            optional($f->updated_at)->toDateTimeString(),
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
            $export = new FacultiesExport();
            return Excel::download($export, $fileName, 'xlsx');
        } catch (\Throwable $e) {
            // fallback to CSV
            $csvName = 'faculties_' . now()->format('Ymd_His') . '.csv';
            $headers = [
                'Content-Type' => 'text/csv',
                'Content-Disposition' => "attachment; filename=\"{$csvName}\"",
            ];

            $callback = function () {
                $out = fopen('php://output', 'w');
                fputcsv($out, ['ID', 'Name', 'Description', 'Created At', 'Updated At']);
                \App\Models\Faculty::chunk(200, function ($faculties) use ($out) {
                    foreach ($faculties as $f) {
                        fputcsv($out, [
                            $f->id,
                            $f->name,
                            $f->description,
                            optional($f->created_at)->toDateTimeString(),
                            optional($f->updated_at)->toDateTimeString(),
                        ]);
                    }
                });
                fclose($out);
            };

            return response()->streamDownload($callback, $csvName, $headers);
        }
    }

    /**
     * Download a template spreadsheet with model headings for faculties
     */
    public function template()
    {
        $fileName = 'faculties_template_' . now()->format('Ymd') . '.csv';
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$fileName}\"",
        ];

        $callback = function () {
            $out = fopen('php://output', 'w');
            // Instructions row
            fputcsv($out, ['# IMPORT RULES AND INSTRUCTIONS']);
            fputcsv($out, ['# 1. Name is REQUIRED - Must be unique, cannot be empty']);
            fputcsv($out, ['# 2. Description is OPTIONAL - Can be left blank']);
            fputcsv($out, ['# 3. Do not modify the header row (name, description)']);
            fputcsv($out, ['# 4. Remove this instruction row and example row before uploading']);
            fputcsv($out, ['# 5. Each row represents one faculty to import']);
            fputcsv($out, ['# 6. Duplicate names will be skipped']);
            fputcsv($out, ['']);
            // heading row
            fputcsv($out, ['name', 'description']);
            // example row
            fputcsv($out, ['Faculty of Engineering', 'Engineering and Technology']);
            fputcsv($out, ['Faculty of Science', 'Natural Sciences']);
            fclose($out);
        };

        return response()->streamDownload($callback, $fileName, $headers);
    }

    /**
     * Import faculties from uploaded spreadsheet
     */
    public function import(Request $request)
    {
        // $request->validate([
        //     'file' => 'required|file|mimes:xlsx,xls,csv',
        // ]);

        try {
            $file = $request->file('file');
            
            if (!$file) {
                throw new \Exception('No file uploaded');
            }
            
            $ext = strtolower($file->getClientOriginalExtension());

            $rows = [];

            if ($ext === 'csv') {
                $path = $file->getRealPath();
                if (($handle = fopen($path, 'r')) !== false) {
                    $header = fgetcsv($handle);
                    if ($header === false) {
                        throw new \Exception('Empty CSV file');
                    }

                    $normalizedHeader = array_map(function ($h) {
                        return strtolower(trim($h));
                    }, $header);

                    while (($data = fgetcsv($handle)) !== false) {
                        $row = [];
                        foreach ($normalizedHeader as $i => $key) {
                            $row[$key] = $data[$i] ?? null;
                        }
                        $rows[] = $row;
                    }

                    fclose($handle);
                }
            } else {
                // Try to read with the Excel package to support xlsx/xls if available
                try {
                    $array = Excel::toArray([], $file);
                    if (!empty($array) && isset($array[0])) {
                        $sheet = $array[0];
                        $header = array_map(function ($h) {
                            return strtolower(trim($h));
                        }, $sheet[0] ?? []);

                        for ($i = 1; $i < count($sheet); $i++) {
                            $data = $sheet[$i];
                            $row = [];
                            foreach ($header as $j => $key) {
                                $row[$key] = $data[$j] ?? null;
                            }
                            $rows[] = $row;
                        }
                    }
                } catch (\Throwable $e) {
                    throw new \Exception('Unable to parse uploaded file: ' . $e->getMessage());
                }
            }

            // Process rows
            $imported = 0;
            foreach ($rows as $r) {
                $name = $r['name'] ?? $r['Name'] ?? null;
                $description = $r['description'] ?? null;
                if (empty($name)) {
                    continue;
                }

                \App\Models\Faculty::updateOrCreate(
                    ['name' => $name],
                    ['description' => $description]
                );
                $imported++;
            }

            return redirect()->route('admin.school-management.faculties.index')
                ->with('success', "Faculties imported successfully ({$imported} rows)!");
        } catch (Exception $e) {
            return redirect()->route('admin.school-management.faculties.index')
                ->with('error', $e->getMessage());
        }
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

                    $nameKey = strtolower(trim($row['name'] ?? ''));
                    if ($nameKey && isset($seen[$nameKey])) {
                        $errors[] = 'Duplicate in file (line ' . $seen[$nameKey] . ')';
                    } elseif ($nameKey) {
                        $seen[$nameKey] = $line;
                    }

                    $exists = false;
                    if (!empty($row['name'])) {
                        $exists = \App\Models\Faculty::where('name', $row['name'])->exists();
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

                        $line = $i + 1;
                        $nameKey = strtolower(trim($row['name'] ?? ''));
                        if ($nameKey && isset($seen[$nameKey])) {
                            $errors[] = 'Duplicate in file (line ' . $seen[$nameKey] . ')';
                        } elseif ($nameKey) {
                            $seen[$nameKey] = $line;
                        }

                        $exists = false;
                        if (!empty($row['name'])) {
                            $exists = \App\Models\Faculty::where('name', $row['name'])->exists();
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
            $description = $r['description'] ?? null;
            if (empty($name)) {
                $skipped++;
                $failed[] = ['index' => $idx, 'reason' => 'Name is required'];
                continue;
            }

            try {
                \App\Models\Faculty::updateOrCreate(['name' => $name], ['description' => $description]);
                $imported++;
            } catch (\Throwable $e) {
                $failed[] = ['index' => $idx, 'reason' => $e->getMessage()];
            }
        }

        return response()->json(['imported' => $imported, 'skipped' => $skipped, 'failed' => $failed]);
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
        } catch (Exception $e) {
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
            'name' => 'required|string|max:255|unique:faculties,name,' . $faculty->id,
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
