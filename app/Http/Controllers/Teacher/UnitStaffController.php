<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\Teacher;
use App\Services\AdminTeacherManagementService;
use App\Services\LeadershipScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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

    public function edit(Teacher $teacher): never
    {
        abort(403);
    }

    public function update(Request $request, Teacher $teacher): never
    {
        abort(403);
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
