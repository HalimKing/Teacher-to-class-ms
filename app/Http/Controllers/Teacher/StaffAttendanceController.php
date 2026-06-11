<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use Inertia\Inertia;
use Inertia\Response;

class StaffAttendanceController extends Controller
{
    public function index(): Response
    {
        $teacher = auth('teacher')->user();

        return Inertia::render('teacher/staff-attendance', [
            'staffMember' => [
                'name' => trim("{$teacher->title} {$teacher->first_name} {$teacher->last_name}"),
                'email' => $teacher->email,
                'staff_type' => $teacher->staff_type,
                'faculty' => $teacher->faculty?->name,
                'department' => $teacher->department?->name,
            ],
        ]);
    }
}
