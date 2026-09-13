<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\Teacher;
use App\Services\AdminTeacherManagementService;
use App\Services\LeadershipScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class UnitStaffController extends Controller
{
    public function __construct(
        private AdminTeacherManagementService $teacherManagement,
        private LeadershipScope $leadershipScope,
    ) {}

    public function index(Request $request): Response
    {
        $leader = $this->leader();

        return Inertia::render('teacher/unit/staff', [
            ...$this->teacherManagement->getIndexPayload($request, $leader),
        ]);
    }

    public function quickView(Teacher $teacher): JsonResponse
    {
        $this->authorizeManage($teacher);

        return response()->json([
            'success' => true,
            'data' => $this->teacherManagement->getQuickView($teacher),
        ]);
    }

    public function edit(Teacher $teacher): Response
    {
        $this->authorizeManage($teacher);

        $leader = $this->leader();
        $faculties = Faculty::query()
            ->select('id', 'name')
            ->when($leader->isDirectorDean() || $leader->isHeadOfDepartment(), function ($query) use ($leader) {
                $query->where('id', $leader->leadership_faculty_id);
            })
            ->orderBy('name')
            ->get()
            ->map(fn (Faculty $faculty) => [
                'label' => $faculty->name,
                'value' => $faculty->id,
            ]);

        $teacher->setAttribute('face_enrollment_status', $teacher->faceEnrollmentStatus());

        return Inertia::render('admin/teacher/edit', [
            'facultyOptions' => $faculties,
            'teacher' => $teacher,
            'assignLeadership' => false,
            'lockOrganization' => $leader->isHeadOfDepartment(),
            'submitRoute' => route('teacher.unit.staff.update', $teacher),
        ]);
    }

    public function update(Request $request, Teacher $teacher): RedirectResponse
    {
        $this->authorizeManage($teacher);
        $leader = $this->leader();

        $validated = $request->validate([
            'firstName' => 'required|string|max:255',
            'lastName' => 'required|string|max:255',
            'email' => 'required|email|unique:teachers,email,'.$teacher->id,
            'phone' => 'required|string|max:20',
            'faculty' => 'required|exists:faculties,id',
            'department' => 'required|exists:departments,id',
            'employeeId' => 'required|string|unique:teachers,employee_id,'.$teacher->id,
            'title' => 'required|string|max:255|in:Prof.,Dr.,Mr.,Ms.',
            'staffType' => ['required', Rule::in(Teacher::STAFF_TYPES)],
            'employmentStatus' => ['required', Rule::in(Teacher::EMPLOYMENT_STATUSES)],
        ]);

        $departmentBelongs = Department::query()
            ->where('id', $validated['department'])
            ->where('faculty_id', $validated['faculty'])
            ->exists();

        if (! $departmentBelongs) {
            throw ValidationException::withMessages([
                'department' => 'The selected department does not belong to the selected Directorate/Faculty.',
            ]);
        }

        if (! $this->leadershipScope->constrainStaffOrganization(
            $leader,
            (int) $validated['faculty'],
            (int) $validated['department'],
        )) {
            throw ValidationException::withMessages([
                'faculty' => 'You can only assign staff within your leadership unit.',
                'department' => 'You can only assign staff within your leadership unit.',
            ]);
        }

        $teacher->first_name = $validated['firstName'];
        $teacher->last_name = $validated['lastName'];
        $teacher->email = $validated['email'];
        $teacher->phone = $validated['phone'];
        $teacher->faculty_id = $validated['faculty'];
        $teacher->department_id = $validated['department'];
        $teacher->employee_id = $validated['employeeId'];
        $teacher->title = $validated['title'];
        $teacher->staff_type = $validated['staffType'];
        $teacher->employment_status = $validated['employmentStatus'];
        $teacher->save();

        return redirect()
            ->route('teacher.unit.staff.index')
            ->with('success', 'Staff member updated successfully.');
    }

    private function authorizeManage(Teacher $teacher): void
    {
        abort_unless($this->leadershipScope->canManage($this->leader(), $teacher), 403);
    }

    private function leader(): Teacher
    {
        /** @var Teacher $teacher */
        $teacher = auth('teacher')->user();

        return $teacher;
    }
}
