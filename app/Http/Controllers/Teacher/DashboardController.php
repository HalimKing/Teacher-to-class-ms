<?php

namespace App\Http\Controllers\Teacher;

use App\Http\Controllers\Controller;
use App\Models\TimeTable;
use DateTime;
use Illuminate\Http\Request;
use ZipStream\Time;

class DashboardController extends Controller
{
    //

    public function index()
{
    $todayLectures = TimeTable::with('course.teacher', 'classroom')
        ->where('day', now()->format('l'))
        ->where('course_id', function($query) {
            $query->select('id')
                ->from('courses')
                ->where('teacher_id', auth()->id());
        })
        ->orderBy('start_time')
        ->get();

    $upcomingClasses = [];
    foreach ($todayLectures as $lecture) {
        $startTime = new DateTime($lecture->start_time);
        $endTime = new DateTime($lecture->end_time);
        $interval = $startTime->diff($endTime);
        
        $upcomingClasses[] = [
            'id' => $lecture->course->id,
            'course' => $lecture->course->name,
            'code' => $lecture->course->course_code,
            'room' => $lecture->classroom->name,
            'type' => 'lecture',
            'students' => $lecture->course->student_size,
            'start_time' => $lecture->start_time,
            'end_time' => $lecture->end_time,
            'duration' => $interval->format('%h hours %i minutes'),
            'status' => $startTime < now() ? 'upcoming' : 'finished',
        ];
    }

    // For debugging
    // dd($upcomingClasses);

    return inertia('teacher/dashboard', [
        'todayLectures' => $todayLectures,
        'upcomingClasses' => $upcomingClasses
    ]);
}
}
