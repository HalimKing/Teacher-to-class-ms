<?php

namespace App\Http\Controllers\Admin\SchoolManagement;

use App\Http\Controllers\Controller;
use App\Models\ClassRoom;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;

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
            'latitude' => 'nullable|numeric|min:-90|max:90',
            'longitude' => 'nullable|numeric|min:-180|max:180',
            'radius_meters' => 'nullable|numeric|min:0',
            'is_active' => 'nullable|boolean',
        ]);
        try {
            $classRoom = new ClassRoom();
            $classRoom->name = $request->name;
            $classRoom->capacity = $request->capacity;
            $classRoom->latitude = $request->latitude;
            $classRoom->longitude = $request->longitude;
            $classRoom->radius_meters = $request->radius_meters;
            $classRoom->is_active = $request->is_active;
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
            'latitude' => 'nullable|numeric|min:-90|max:90',
            'longitude' => 'nullable|numeric|min:-180|max:180',
            'radius_meters' => 'nullable|numeric|min:0',
            'is_active' => 'nullable|boolean',
        ]);
        try {
            $classRoom->name = $request->name;
            $classRoom->capacity = $request->capacity;
            $classRoom->latitude = $request->latitude;
            $classRoom->longitude = $request->longitude;
            $classRoom->radius_meters = $request->radius_meters;
            $classRoom->is_active = $request->is_active;
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

    /**
     * Export class rooms to CSV
     */
    public function export($format = 'excel')
    {
        $fileName = 'class_rooms_' . now()->format('Ymd_His') . '.csv';
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$fileName}\"",
        ];

        $callback = function () {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['ID', 'Name', 'Capacity', 'Latitude', 'Longitude', 'Radius (m)', 'Is Active', 'Created At', 'Updated At']);
            ClassRoom::chunk(200, function ($rooms) use ($out) {
                foreach ($rooms as $r) {
                    fputcsv($out, [
                        $r->id,
                        $r->name,
                        $r->capacity,
                        $r->latitude ?? '',
                        $r->longitude ?? '',
                        $r->radius_meters ?? '',
                        $r->is_active ? '1' : '0',
                        optional($r->created_at)->toDateTimeString(),
                        optional($r->updated_at)->toDateTimeString(),
                    ]);
                }
            });
            fclose($out);
        };

        return response()->streamDownload($callback, $fileName, $headers);
    }

    /**
     * Download template for class room import
     */
    public function template()
    {
        $fileName = 'class_rooms_template_' . now()->format('Ymd') . '.csv';
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$fileName}\"",
        ];

        $callback = function () {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['# IMPORT RULES AND INSTRUCTIONS']);
            fputcsv($out, ['# 1. name is REQUIRED - Must be unique']);
            fputcsv($out, ['# 2. capacity is REQUIRED - Integer, min 1']);
            fputcsv($out, ['# 3. latitude, longitude, radius_meters are OPTIONAL - Numeric']);
            fputcsv($out, ['# 4. is_active is OPTIONAL - Use 1 or 0 (default 1)']);
            fputcsv($out, ['# 5. Do not modify the header row. Remove instruction rows before uploading']);
            fputcsv($out, ['# 6. Duplicate name will update existing class room']);
            fputcsv($out, ['']);
            fputcsv($out, ['name', 'capacity', 'latitude', 'longitude', 'radius_meters', 'is_active']);
            fputcsv($out, ['Room A101', '50', '', '', '', '1']);
            fputcsv($out, ['Room B205', '30', '6.5244', '3.3792', '100', '1']);
            fclose($out);
        };

        return response()->streamDownload($callback, $fileName, $headers);
    }

    /**
     * Preview uploaded file and return parsed rows with validation (JSON)
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
                    if (!in_array($ext, ['xlsx', 'xls', 'csv'])) {
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

                $normalizedHeader = array_map(fn($h) => strtolower(trim($h)), $header);
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
                    if (!isset($row['capacity']) || $row['capacity'] === '') {
                        $errors[] = 'Capacity is required';
                    } elseif (!is_numeric(trim($row['capacity'])) || (int) $row['capacity'] < 1) {
                        $errors[] = 'Capacity must be an integer >= 1';
                    }
                    if (!empty($row['latitude']) && !is_numeric(trim($row['latitude']))) {
                        $errors[] = 'Latitude must be numeric';
                    }
                    if (!empty($row['longitude']) && !is_numeric(trim($row['longitude']))) {
                        $errors[] = 'Longitude must be numeric';
                    }
                    if (!empty($row['radius_meters']) && (!is_numeric(trim($row['radius_meters'])) || (float) $row['radius_meters'] < 0)) {
                        $errors[] = 'Radius must be a non-negative number';
                    }
                    if (!empty($row['is_active']) && !in_array(strtolower(trim($row['is_active'])), ['0', '1', 'true', 'false', 'yes', 'no'])) {
                        $errors[] = 'Is active must be 1, 0, true, or false';
                    }

                    $nameKey = strtolower(trim($row['name'] ?? ''));
                    if ($nameKey && isset($seen[$nameKey])) {
                        $errors[] = 'Duplicate in file (line ' . $seen[$nameKey] . ')';
                    } elseif ($nameKey) {
                        $seen[$nameKey] = $line;
                    }

                    $exists = !empty($row['name']) && ClassRoom::where('name', $row['name'])->exists();

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
                $array = Excel::toArray(new \App\Imports\RawSheetImport(), $file);
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
                    $header = array_map(fn($h) => strtolower(trim($h)), $sheet[$headerRowIndex] ?? []);
                    $seen = [];
                    for ($i = $headerRowIndex + 1; $i < count($sheet); $i++) {
                        $data = $sheet[$i];
                        $firstCell = trim($data[0] ?? '');
                        if (empty($firstCell) || strpos($firstCell, '#') === 0) {
                            continue;
                        }
                        $row = [];
                        foreach ($header as $j => $key) {
                            $row[$key] = isset($data[$j]) ? (is_string($data[$j]) ? trim($data[$j]) : $data[$j]) : null;
                        }

                        $errors = [];
                        if (empty($row['name'])) {
                            $errors[] = 'Name is required';
                        }
                        if (!isset($row['capacity']) || $row['capacity'] === '') {
                            $errors[] = 'Capacity is required';
                        } elseif (!is_numeric(trim((string)$row['capacity'])) || (int) $row['capacity'] < 1) {
                            $errors[] = 'Capacity must be an integer >= 1';
                        }
                        if (!empty($row['latitude']) && !is_numeric(trim((string)$row['latitude']))) {
                            $errors[] = 'Latitude must be numeric';
                        }
                        if (!empty($row['longitude']) && !is_numeric(trim((string)$row['longitude']))) {
                            $errors[] = 'Longitude must be numeric';
                        }
                        if (!empty($row['radius_meters']) && (!is_numeric(trim((string)$row['radius_meters'])) || (float) $row['radius_meters'] < 0)) {
                            $errors[] = 'Radius must be a non-negative number';
                        }
                        if (!empty($row['is_active']) && !in_array(strtolower(trim((string)$row['is_active'])), ['0', '1', 'true', 'false', 'yes', 'no'])) {
                            $errors[] = 'Is active must be 1, 0, true, or false';
                        }

                        $line = $i + 1;
                        $nameKey = strtolower(trim($row['name'] ?? ''));
                        if ($nameKey && isset($seen[$nameKey])) {
                            $errors[] = 'Duplicate in file (line ' . $seen[$nameKey] . ')';
                        } elseif ($nameKey) {
                            $seen[$nameKey] = $line;
                        }
                        $exists = !empty($row['name']) && ClassRoom::where('name', $row['name'])->exists();
                        $rows[] = ['line' => $line, 'data' => $row, 'errors' => $errors, 'exists' => $exists];
                    }
                }
            } catch (\Throwable $e) {
                return response()->json(['error' => 'Unable to parse uploaded file: ' . $e->getMessage()], 422);
            }
        }

        return response()->json(['rows' => $rows]);
    }

    /**
     * Confirm import: parse file and persist class rooms (JSON)
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
                    if (!in_array($ext, ['xlsx', 'xls', 'csv'])) {
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
                $normalizedHeader = array_map(fn($h) => strtolower(trim($h)), $header);
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
                $array = Excel::toArray(new \App\Imports\RawSheetImport(), $file);
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
                    $header = array_map(fn($h) => strtolower(trim($h)), $sheet[$headerRowIndex] ?? []);
                    for ($i = $headerRowIndex + 1; $i < count($sheet); $i++) {
                        $data = $sheet[$i];
                        $firstCell = trim($data[0] ?? '');
                        if (empty($firstCell) || strpos($firstCell, '#') === 0) {
                            continue;
                        }
                        $row = [];
                        foreach ($header as $j => $key) {
                            $row[$key] = isset($data[$j]) ? (is_string($data[$j]) ? trim($data[$j]) : $data[$j]) : null;
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
            $name = trim($r['name'] ?? '');
            $capacityVal = isset($r['capacity']) && $r['capacity'] !== '' ? (int) $r['capacity'] : null;
            $latitude = isset($r['latitude']) && $r['latitude'] !== '' ? (float) $r['latitude'] : null;
            $longitude = isset($r['longitude']) && $r['longitude'] !== '' ? (float) $r['longitude'] : null;
            $radiusMeters = isset($r['radius_meters']) && $r['radius_meters'] !== '' ? (float) $r['radius_meters'] : null;
            $isActive = true;
            if (isset($r['is_active']) && $r['is_active'] !== '') {
                $v = strtolower(trim((string) $r['is_active']));
                $isActive = in_array($v, ['1', 'true', 'yes']);
            }

            if (empty($name)) {
                $skipped++;
                $failed[] = ['index' => $idx, 'reason' => 'Name is required'];
                continue;
            }
            if ($capacityVal === null || $capacityVal < 1) {
                $skipped++;
                $failed[] = ['index' => $idx, 'reason' => 'Capacity is required and must be >= 1'];
                continue;
            }

            try {
                ClassRoom::updateOrCreate(
                    ['name' => $name],
                    [
                        'capacity' => $capacityVal,
                        'latitude' => $latitude,
                        'longitude' => $longitude,
                        'radius_meters' => $radiusMeters,
                        'is_active' => $isActive,
                    ]
                );
                $imported++;
            } catch (\Throwable $e) {
                $failed[] = ['index' => $idx, 'reason' => $e->getMessage()];
            }
        }

        return response()->json(['imported' => $imported, 'skipped' => $skipped, 'failed' => $failed]);
    }
}
