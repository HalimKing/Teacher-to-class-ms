<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\Teacher;
use App\Services\StaffActivityService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class StaffActivityController extends Controller
{
    public function __construct(
        private StaffActivityService $activities,
    ) {}

    public function index(Request $request): Response
    {
        /** @var Teacher $teacher */
        $teacher = $request->user('teacher');

        return Inertia::render('teacher/activities/index', [
            'activities' => $this->activities->paginateFor($teacher, $request),
            'filters' => [
                'search' => $request->string('search')->toString(),
                'category' => $request->string('category')->toString() ?: 'all',
                'status' => $request->string('status')->toString() ?: 'all',
                'start_date' => $request->string('start_date')->toString(),
                'end_date' => $request->string('end_date')->toString(),
            ],
            'options' => $this->activities->filterOptions(),
        ]);
    }
}
