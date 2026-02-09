<?php

namespace App\Http\Controllers;

use App\Models\AcademicPeriod;
use App\Models\AcademicYear;
use App\Models\Course;
use App\Models\TimeTable;
use Illuminate\Http\Request;

class TeacherCoursesController extends Controller
{
    //
    public function index()
    {
        // Select all courses that the teacher is teaching in the current academic period
        $courses = Course::with('program', 'level', 'academicYear', 'academicPeriod')
        ->where('teacher_id', auth()->id())
            ->whereHas('timeTables', function ($query) {
                $query->where('academic_year_id', AcademicYear::current()->id);
            })
            ->get();

        $coursesData = [];
        foreach ($courses as $course) {
            $totalHours = 0;

           if ($course->timeTables) {
                foreach ($course->timeTables as $timeTable) {
                    $startTime = new \DateTime($timeTable->start_time);
                    $endTime = new \DateTime($timeTable->end_time);
                    $interval = $startTime->diff($endTime);
                    $totalHours += ($interval->h + ($interval->i / 60));
                }
            }
            $coursesData[] = [
                'id' => $course->id,
                'title' => $course->name,
                'code' => $course->course_code,
                'student_size' => $course->student_size,
                'total_hours' => round($totalHours, 2),
                'icone' => '📖',
            ];
        }
       
        // dd($coursesData);
        return inertia('teacher/my-courses', compact('coursesData'));
    }
}














// $courses = TimeTable::with('course.teacher')
//         ->whereHas('course', fn ($q) => $q->where('teacher_id', auth()->id()))
//         ->where('academic_year_id', AcademicYear::current()->id)
//         ->get()
//         ->pluck('course')
//         ->unique('id')
//         ->values();
//         $coursesData = [];

//         foreach ($courses as $course) {
//             $courseTimeTables = TimeTable::where('course_id', $course->id)->get();
//             $totalHours = 0;

//             foreach ($courseTimeTables as $timeTable) {
//                 $startTime = new \DateTime($timeTable->start_time);
//                 $endTime = new \DateTime($timeTable->end_time);
//                 $interval = $startTime->diff($endTime);
//                 $totalHours += ($interval->h + ($interval->i / 60));
//             }

//             $coursesData[] = [
//                 'id' => $course->id,
//                 'name' => $course->name,
//                 'code' => $course->course_code,
//                 'student_size' => $course->student_size,
//                 'total_hours' => round($totalHours, 2),
//             ];
//         }