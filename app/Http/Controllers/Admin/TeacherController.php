<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Faculty;
use App\Models\Department;
use App\Models\Teacher;
use App\Services\ActivityLogService;
use App\Services\AdminTeacherManagementService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;

class TeacherController extends Controller
{
    public function __construct(
        private AdminTeacherManagementService $teacherManagementService
    ) {}

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        return Inertia::render('admin/teacher/index', $this->teacherManagementService->getIndexPayload($request));
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
        
        return Inertia::render('admin/teacher/create', 
            compact('facultyOptions'));
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'firstName' => 'required|string|max:255',
            'lastName' => 'required|string|max:255',
            'email' => 'required|email|unique:teachers,email',
            'phone' => 'required|string|max:20',
            'faculty' => 'required|exists:faculties,id',
            'department' => 'required|exists:departments,id',
            'employeeId' => 'required|string|unique:teachers,employee_id',
            'title' => 'required|string|max:255|in:Prof.,Dr.,Mr.,Ms.',
            'staffType' => ['required', Rule::in(Teacher::STAFF_TYPES)],
            // Add other validation rules
        ]);
        
        try{
            $teacher = new Teacher();
            $teacher->first_name = $validated['firstName'];
            $teacher->last_name = $validated['lastName'];
            $teacher->email = $validated['email'];
            $teacher->phone = $validated['phone'];
            $teacher->faculty_id = $validated['faculty'];
            $teacher->department_id = $validated['department'];
            $teacher->employee_id = $validated['employeeId'];
            $teacher->title = $validated['title'];
            $teacher->staff_type = $validated['staffType'];
            // Assign other fields
            $teacher->save();

            app(ActivityLogService::class)->logUserManagement(
                'teacher_created',
                "Created {$teacher->staff_type} {$teacher->first_name} {$teacher->last_name}",
                ['teacher_id' => $teacher->id, 'employee_id' => $teacher->employee_id]
            );

            return redirect()->route('admin.teachers.index')
            ->with('success', 'Teacher created successfully!');
        } catch(\Throwable $e) {
            return redirect()->route('admin.teachers.create')
                ->with('error', 'Error creating teacher: ' . $e->getMessage());
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(Teacher $teacher)
    {
        return redirect()->route('admin.teachers.edit', $teacher);
    }

    public function quickView(Teacher $teacher)
    {
        return response()->json([
            'success' => true,
            'data' => $this->teacherManagementService->getQuickView($teacher),
        ]);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(string $id)
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

        $teacher = Teacher::findOrFail($id);
        $teacher->setAttribute('face_enrollment_status', $teacher->faceEnrollmentStatus());
        
        return Inertia::render('admin/teacher/edit', 
            compact('facultyOptions', 'teacher'));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
{
    $teacher = Teacher::findOrFail($id);
    
    $validated = $request->validate([
        'firstName' => 'required|string|max:255',
        'lastName' => 'required|string|max:255',
        'email' => 'required|email|unique:teachers,email,' . $id,
        'phone' => 'required|string|max:20',
        'faculty' => 'required|exists:faculties,id',
        'department' => 'required|exists:departments,id',
        'employeeId' => 'required|string|unique:teachers,employee_id,' . $id,
        'title' => 'required|string|max:255|in:Prof.,Dr.,Mr.,Ms.',
        'staffType' => ['required', Rule::in(Teacher::STAFF_TYPES)],
    ]);
    
    try {
        $teacher->first_name = $validated['firstName'];
        $teacher->last_name = $validated['lastName'];
        $teacher->email = $validated['email'];
        $teacher->phone = $validated['phone'];
        $teacher->faculty_id = $validated['faculty'];
        $teacher->department_id = $validated['department'];
        $teacher->employee_id = $validated['employeeId'];
        $teacher->title = $validated['title'];
        $teacher->staff_type = $validated['staffType'];
        $teacher->save();

        app(ActivityLogService::class)->logUserManagement(
            'teacher_updated',
            "Updated {$teacher->staff_type} {$teacher->first_name} {$teacher->last_name}",
            ['teacher_id' => $teacher->id, 'employee_id' => $teacher->employee_id]
        );
        
        return redirect()->route('admin.teachers.index')
            ->with('success', 'Teacher updated successfully!');
    } catch(\Throwable $e) {
        return redirect()->back()
            ->with('error', 'Error updating teacher: ' . $e->getMessage());
    }
}

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        //
        $teacher = Teacher::findOrFail($id);
        $label = trim("{$teacher->first_name} {$teacher->last_name}");
        $teacherId = $teacher->id;
        $teacher->delete();

        app(ActivityLogService::class)->logUserManagement(
            'teacher_deleted',
            "Deleted staff member {$label}",
            ['teacher_id' => $teacherId]
        );

        return redirect()->route('admin.teachers.index')
            ->with('success', 'Teacher deleted successfully!');
    }

        public function passwordManagement(Request $request)
    {
        $teacher = null;
        
        // If employee_id is provided, search for the teacher
        if ($request->has('employee_id') && !empty($request->employee_id)) {
            $teacher = Teacher::with(['faculty', 'department'])
                ->where('employee_id', $request->employee_id)
                ->first();
            
            if (!$teacher) {
                return Inertia::render('admin/teacher/password-management', [
                    'teacher' => null,
                ])->with('error', 'No teacher found with this employee ID.');
            }
        }

        return Inertia::render('admin/teacher/password-management', [
            'teacher' => $teacher,
        ]);
    }

   public function resetPassword(Request $request, Teacher $teacher)
    {
        try {
            // Generate a secure random password
            $newPassword = 'password' . rand(1000, 9999); // Example: you can use a more secure method
            
            // Hash and update the password
            $teacher->password = Hash::make($newPassword);
            $teacher->password_changed_at = null; // Force password change on next login
            $teacher->save();
            
            // Log the password reset action
            Log::info('Password reset for teacher', [
                'teacher_id' => $teacher->id,
                'employee_id' => $teacher->employee_id,
                'reset_by' => auth()->id(),
                'reset_at' => now(),
            ]);
            
            // Optional: Send email notification to teacher
         
            
            // Load relationships for response
            $teacher->load(['faculty', 'department']);
            
            return Inertia::render('admin/teacher/password-management', [
                'teacher' => $teacher,
                'generatedPassword' => $newPassword,
            ])->with('success', 'Password reset successfully! Please provide the new password to the teacher.');
            
        } catch (\Exception $e) {
            Log::error('Password reset failed', [
                'teacher_id' => $teacher->id,
                'error' => $e->getMessage(),
            ]);
            
            return back()->with('error', 'Failed to reset password. Please try again.');
        }
    }

    /**
     * Export teachers to CSV
     */
    public function export(Request $request, $format = 'csv')
    {
        $format = strtolower((string) $format);
        $fileName = 'teachers_' . now()->format('Ymd_His') . ($format === 'excel' ? '.xlsx' : '.csv');
        $teachers = $this->teacherManagementService->filteredQuery($request)
            ->with(['faculty', 'department'])
            ->get();

        $rows = $teachers->map(function (Teacher $teacher) {
            return [
                'ID' => $teacher->id,
                'First Name' => $teacher->first_name,
                'Last Name' => $teacher->last_name,
                'Email' => $teacher->email,
                'Phone' => $teacher->phone ?? '',
                'Employee ID' => $teacher->employee_id ?? '',
                'Faculty' => $teacher->faculty->name ?? '',
                'Department' => $teacher->department->name ?? '',
                'Title' => $teacher->title ?? '',
                'Staff Type' => $teacher->staff_type ?? Teacher::STAFF_TYPE_LECTURER,
                'Face Enrolled' => $teacher->faceEnrollmentStatus(),
                'Created At' => optional($teacher->created_at)->toDateTimeString(),
            ];
        })->all();

        if ($format === 'print') {
            return view('admin.teachers-print', [
                'rows' => $rows,
                'generatedAt' => now()->format('Y-m-d H:i:s'),
            ]);
        }

        if ($format === 'pdf') {
            if (!class_exists(\Barryvdh\DomPDF\Facade\Pdf::class)) {
                abort(500, 'PDF export requires barryvdh/laravel-dompdf.');
            }

            $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('admin.teachers-print', [
                'rows' => $rows,
                'generatedAt' => now()->format('Y-m-d H:i:s'),
            ]);

            return $pdf->download(str_replace('.csv', '.pdf', $fileName));
        }

        if ($format === 'excel') {
            return Excel::download(new \App\Exports\GenericArrayExport($rows), str_replace('.csv', '.xlsx', $fileName));
        }

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$fileName}\"",
        ];

        $callback = function () use ($rows) {
            $out = fopen('php://output', 'w');
            if (!empty($rows)) {
                fputcsv($out, array_keys($rows[0]));
                foreach ($rows as $row) {
                    fputcsv($out, array_values($row));
                }
            }
            fclose($out);
        };

        return response()->streamDownload($callback, $fileName, $headers);
    }

    /**
     * Download template for teacher import
     */
    public function template()
    {
        $fileName = 'teachers_template_' . now()->format('Ymd') . '.csv';
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$fileName}\"",
        ];

        $callback = function () {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['# IMPORT RULES AND INSTRUCTIONS']);
            fputcsv($out, ['# 1. first_name, last_name, email, phone, employee_id, faculty, department, title are REQUIRED']);
            fputcsv($out, ['# 2. faculty and department must match existing names exactly. Department must belong to faculty']);
            fputcsv($out, ['# 3. title must be one of: Prof., Dr., Mr., Ms.']);
            fputcsv($out, ['# 4. staff_type is optional and must be one of: lecturer, administrator. Defaults to lecturer']);
            fputcsv($out, ['# 5. email and employee_id must be unique']);
            fputcsv($out, ['# 6. Do not modify the header row. Remove instruction rows before uploading']);
            fputcsv($out, ['# 7. Duplicate employee_id will update existing teacher']);
            fputcsv($out, ['']);
            fputcsv($out, ['first_name', 'last_name', 'email', 'phone', 'employee_id', 'faculty', 'department', 'title', 'staff_type']);
            fputcsv($out, ['John', 'Doe', 'john.doe@example.com', '+1234567890', 'EMP001', 'Faculty of Engineering', 'Computer Science', 'Dr.', 'lecturer']);
            fputcsv($out, ['Jane', 'Smith', 'jane.smith@example.com', '+0987654321', 'EMP002', 'Faculty of Science', 'Mathematics', 'Prof.', 'administrator']);
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

                $normalizedHeader = array_map(fn($h) => strtolower(trim(str_replace(' ', '_', $h))), $header);
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
                    if (empty($row['first_name'])) {
                        $errors[] = 'First name is required';
                    }
                    if (empty($row['last_name'])) {
                        $errors[] = 'Last name is required';
                    }
                    if (empty($row['email'])) {
                        $errors[] = 'Email is required';
                    } elseif (!filter_var(trim($row['email']), FILTER_VALIDATE_EMAIL)) {
                        $errors[] = 'Invalid email format';
                    }
                    if (empty($row['phone'])) {
                        $errors[] = 'Phone is required';
                    }
                    if (empty($row['employee_id'])) {
                        $errors[] = 'Employee ID is required';
                    }
                    if (empty($row['faculty'])) {
                        $errors[] = 'Faculty is required';
                    } else {
                        if (!Faculty::where('name', trim($row['faculty']))->exists()) {
                            $errors[] = 'Faculty "' . $row['faculty'] . '" not found';
                        }
                    }
                    if (empty($row['department'])) {
                        $errors[] = 'Department is required';
                    } elseif (!empty($row['faculty'])) {
                        $faculty = Faculty::where('name', trim($row['faculty']))->first();
                        if ($faculty) {
                            $dept = Department::where('name', trim($row['department']))->where('faculty_id', $faculty->id)->first();
                            if (!$dept) {
                                $errors[] = 'Department "' . $row['department'] . '" not found or does not belong to faculty';
                            }
                        }
                    }
                    $title = trim($row['title'] ?? '');
                    if (empty($title)) {
                        $errors[] = 'Title is required';
                    } elseif (!in_array($title, ['Prof.', 'Dr.', 'Mr.', 'Ms.'])) {
                        $errors[] = 'Title must be Prof., Dr., Mr., or Ms.';
                    }
                    $staffTypeError = $this->getStaffTypeValidationError($row['staff_type'] ?? null);
                    if ($staffTypeError) {
                        $errors[] = $staffTypeError;
                    }

                    $empKey = strtolower(trim($row['employee_id'] ?? ''));
                    if ($empKey && isset($seen[$empKey])) {
                        $errors[] = 'Duplicate employee_id in file (line ' . $seen[$empKey] . ')';
                    } elseif ($empKey) {
                        $seen[$empKey] = $line;
                    }

                    $exists = !empty($row['employee_id']) && Teacher::where('employee_id', $row['employee_id'])->exists();

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
                    $header = array_map(fn($h) => strtolower(trim(str_replace(' ', '_', (string)$h))), $sheet[$headerRowIndex] ?? []);
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
                        if (empty($row['first_name'])) {
                            $errors[] = 'First name is required';
                        }
                        if (empty($row['last_name'])) {
                            $errors[] = 'Last name is required';
                        }
                        if (empty($row['email'])) {
                            $errors[] = 'Email is required';
                        } elseif (!filter_var(trim((string)$row['email']), FILTER_VALIDATE_EMAIL)) {
                            $errors[] = 'Invalid email format';
                        }
                        if (empty($row['phone'])) {
                            $errors[] = 'Phone is required';
                        }
                        if (empty($row['employee_id'])) {
                            $errors[] = 'Employee ID is required';
                        }
                        if (empty($row['faculty'])) {
                            $errors[] = 'Faculty is required';
                        } else {
                            if (!Faculty::where('name', trim($row['faculty']))->exists()) {
                                $errors[] = 'Faculty "' . $row['faculty'] . '" not found';
                            }
                        }
                        if (empty($row['department'])) {
                            $errors[] = 'Department is required';
                        } elseif (!empty($row['faculty'])) {
                            $faculty = Faculty::where('name', trim($row['faculty']))->first();
                            if ($faculty) {
                                $dept = Department::where('name', trim($row['department']))->where('faculty_id', $faculty->id)->first();
                                if (!$dept) {
                                    $errors[] = 'Department not found or does not belong to faculty';
                                }
                            }
                        }
                        $title = trim((string)($row['title'] ?? ''));
                        if (empty($title)) {
                            $errors[] = 'Title is required';
                        } elseif (!in_array($title, ['Prof.', 'Dr.', 'Mr.', 'Ms.'])) {
                            $errors[] = 'Title must be Prof., Dr., Mr., or Ms.';
                        }
                        $staffTypeError = $this->getStaffTypeValidationError($row['staff_type'] ?? null);
                        if ($staffTypeError) {
                            $errors[] = $staffTypeError;
                        }

                        $line = $i + 1;
                        $empKey = strtolower(trim($row['employee_id'] ?? ''));
                        if ($empKey && isset($seen[$empKey])) {
                            $errors[] = 'Duplicate employee_id in file (line ' . $seen[$empKey] . ')';
                        } elseif ($empKey) {
                            $seen[$empKey] = $line;
                        }
                        $exists = !empty($row['employee_id']) && Teacher::where('employee_id', $row['employee_id'])->exists();
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
     * Confirm import: parse file and persist teachers (JSON)
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
                $normalizedHeader = array_map(fn($h) => strtolower(trim(str_replace(' ', '_', $h))), $header);
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
                    $header = array_map(fn($h) => strtolower(trim(str_replace(' ', '_', $h))), $sheet[$headerRowIndex] ?? []);
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
            $firstName = trim($r['first_name'] ?? '');
            $lastName = trim($r['last_name'] ?? '');
            $email = trim($r['email'] ?? '');
            $phone = trim($r['phone'] ?? '');
            $employeeId = trim($r['employee_id'] ?? '');
            $facultyName = trim($r['faculty'] ?? '');
            $departmentName = trim($r['department'] ?? '');
            $title = trim($r['title'] ?? '');
            $staffType = $this->normalizeStaffType($r['staff_type'] ?? null);

            if (empty($firstName) || empty($lastName) || empty($email) || empty($phone) || empty($employeeId)) {
                $skipped++;
                $failed[] = ['index' => $idx, 'reason' => 'Required field missing (first_name, last_name, email, phone, employee_id)'];
                continue;
            }
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $skipped++;
                $failed[] = ['index' => $idx, 'reason' => 'Invalid email format'];
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
            if (empty($departmentName)) {
                $skipped++;
                $failed[] = ['index' => $idx, 'reason' => 'Department is required'];
                continue;
            }
            $department = Department::where('name', $departmentName)->where('faculty_id', $faculty->id)->first();
            if (!$department) {
                $skipped++;
                $failed[] = ['index' => $idx, 'reason' => 'Department "' . $departmentName . '" not found or does not belong to faculty'];
                continue;
            }
            if (!in_array($title, ['Prof.', 'Dr.', 'Mr.', 'Ms.'])) {
                $skipped++;
                $failed[] = ['index' => $idx, 'reason' => 'Title must be Prof., Dr., Mr., or Ms.'];
                continue;
            }
            $staffTypeError = $this->getStaffTypeValidationError($r['staff_type'] ?? null);
            if ($staffTypeError) {
                $skipped++;
                $failed[] = ['index' => $idx, 'reason' => $staffTypeError];
                continue;
            }

            try {
                Teacher::updateOrCreate(
                    ['employee_id' => $employeeId],
                    [
                        'first_name' => $firstName,
                        'last_name' => $lastName,
                        'email' => $email,
                        'phone' => $phone,
                        'faculty_id' => $faculty->id,
                        'department_id' => $department->id,
                        'title' => $title,
                        'staff_type' => $staffType,
                    ]
                );
                $imported++;
            } catch (\Throwable $e) {
                $failed[] = ['index' => $idx, 'reason' => $e->getMessage()];
            }
        }

        return response()->json(['imported' => $imported, 'skipped' => $skipped, 'failed' => $failed]);
    }

    private function normalizeStaffType(mixed $staffType): string
    {
        $normalized = strtolower(trim((string) $staffType));

        return $normalized === '' ? Teacher::STAFF_TYPE_LECTURER : $normalized;
    }

    private function getStaffTypeValidationError(mixed $staffType): ?string
    {
        $normalized = $this->normalizeStaffType($staffType);

        if (!in_array($normalized, Teacher::STAFF_TYPES, true)) {
            return 'Staff type must be lecturer or administrator.';
        }

        return null;
    }
}