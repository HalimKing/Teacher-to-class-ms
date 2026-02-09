<?php

namespace App\Http\Controllers;

use App\Models\TeacherAttendance;
use App\Models\TimeTable;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;

class TeacherAttendanceController extends Controller
{
   public function index()
    {
        // $Lectures = TimeTable::todaysLectures();
        // $teacherId = auth()->id();
        // $today = Carbon::now()->format('Y-m-d');

        // $todaysClasses = [];
        // foreach ($Lectures as $lecture) {
        //     // Check attendance status for this lecture
        //     $attendance = TeacherAttendance::where('teacher_id', $teacherId)
        //         ->where('timetable_id', $lecture->id)
        //         ->where('date', $today)
        //         ->first();
            
        //     $attendanceStatus = null;
        //     $attendanceTaken = false;
            
        //     if ($attendance) {
        //         $attendanceTaken = true;
        //         $attendanceStatus = [
        //             'id' => $attendance->id,
        //             'check_in_time' => $attendance->check_in_time,
        //             'check_out_time' => $attendance->check_out_time,
        //             'status' => $attendance->check_out_time ? 'completed' : 'checked_in',
        //             'location_match' => $attendance->check_in_within_range,
        //         ];
        //     }

        //     $todaysClasses[] = [
        //         'timetable_id' => $lecture->id,
        //         'id' => $lecture->course->id,
        //         'name' => $lecture->course->name,
        //         'code' => $lecture->course->course_code,
        //         'building' => $lecture->classroom->name,
        //         'room' => $lecture->classroom->room_number ?? 'N/A',
        //         'type' => 'lecture',
        //         'students' => $lecture->course->student_size,
        //         'start_time' => $lecture->start_time,
        //         'end_time' => $lecture->end_time,
        //         'coordinates' => [
        //             'lat' => $lecture->classroom->latitude,
        //             'lng' => $lecture->classroom->longitude,
        //         ],
        //         'radius' => $lecture->classroom->radius_meters,
        //         'attendance_taken' => $attendanceTaken,
        //         'attendance_status' => $attendanceStatus,
        //         'is_completed' => $attendance && $attendance->check_out_time !== null,
        //     ];
        // }
        
        return Inertia::render('teacher/attendance');
    }



     public function getTodaysClasses(Request $request)
    {
        $Lectures = TimeTable::todaysLectures();
        $teacherId = auth()->id();
        $today = Carbon::now()->format('Y-m-d');

        $todaysClasses = [];
        foreach ($Lectures as $lecture) {
            // Check attendance status for this lecture
            $attendance = TeacherAttendance::where('teacher_id', $teacherId)
                ->where('timetable_id', $lecture->id)
                ->where('date', $today)
                ->first();
            
            $attendanceStatus = null;
            $attendanceTaken = false;
            
            if ($attendance) {
                $attendanceTaken = true;
                $attendanceStatus = [
                    'id' => $attendance->id,
                    'check_in_time' => $attendance->check_in_time,
                    'check_out_time' => $attendance->check_out_time,
                    'status' => $attendance->check_out_time ? 'completed' : 'checked_in',
                    'location_match' => $attendance->check_in_within_range,
                ];
            }

            $todaysClasses[] = [
                'timetable_id' => $lecture->id,
                'id' => $lecture->course->id,
                'name' => $lecture->course->name,
                'code' => $lecture->course->course_code,
                'building' => $lecture->classroom->name,
                'room' => $lecture->classroom->room_number ?? 'N/A',
                'type' => 'lecture',
                'students' => $lecture->course->student_size,
                'start_time' => $lecture->start_time,
                'end_time' => $lecture->end_time,
                'coordinates' => [
                    'lat' => $lecture->classroom->latitude,
                    'lng' => $lecture->classroom->longitude,
                ],
                'radius' => $lecture->classroom->radius_meters,
                'attendance_taken' => $attendanceTaken,
                'attendance_status' => $attendanceStatus,
                'is_completed' => $attendance && $attendance->check_out_time !== null,
            ];
        }
        
        return response()->json([
            'success' => true,
            'data' => $todaysClasses,
            'message' => 'Today\'s classes fetched successfully'
        ]);
    }




    public function checkIn(Request $request)
    {
        // Validate request
        $request->validate([
            'coordinates.latitude' => 'required|numeric',
            'coordinates.longitude' => 'required|numeric',
            'coordinates.accuracy' => 'required|numeric',
            'course_id' => 'required|exists:courses,id',
            'course_name' => 'required|string',
            'class_room' => 'required|string',
            'timetable_id' => 'required|exists:time_tables,id',
            'check_in_time' => 'required|date',
            'distance' => 'required|numeric',
            'within_range' => 'required|boolean',
        ]);
        
        // Select from timetable where id = timetable_id
        $timetable = TimeTable::find($request->timetable_id);
        if (!$timetable) {
            return response()->json(['success' => false, 'message' => 'Invalid timetable ID'], 400);
        }

        // Check if the course_id matches the timetable's course_id
        if ($timetable->course_id != $request->course_id) {
            return response()->json(['success' => false, 'message' => 'Course ID does not match timetable'], 400);
        }

        // Check if user already has an active check-in for today
        $existingActiveAttendance = TeacherAttendance::where('teacher_id', auth()->id())
            ->where('date', Carbon::now()->format('Y-m-d'))
            ->whereNull('check_out_time')
            ->first();
            
        if ($existingActiveAttendance) {
            return response()->json([
                'success' => false, 
                'message' => 'You already have an active check-in. Please check out first.'
            ], 400);
        }

        // Check if class start_time => current_time
        $classStartTime = Carbon::parse($timetable->start_time);
        if ($classStartTime->gt(Carbon::now())) {
            return response()->json([
                'success' => false, 
                'message' => 'Class has not started yet'
            ], 400);
        }

        try {
            $attendance = new TeacherAttendance();
            $attendance->classroom_id = $timetable->class_room_id;
            $attendance->teacher_id = auth()->id();
            $attendance->course_id = $request->course_id;
            $attendance->timetable_id = $request->timetable_id;
            $attendance->academic_year_id = $timetable->academic_year_id; 
            $attendance->date = Carbon::now()->format('Y-m-d');
            $attendance->check_in_time = Carbon::now()->format('h:i A');
            $attendance->check_in_latitude = $request->coordinates['latitude'];
            $attendance->check_in_longitude = $request->coordinates['longitude'];
            $attendance->check_in_distance = $request->distance;
            $attendance->check_in_within_range = $request->within_range;
            $attendance->save();
           
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Error during check-in: ' . $e->getMessage()], 500);
        }

        return response()->json([
            'success' => true, 
            'message' => 'Check-in successful', 
            'attendance_id' => $attendance->id,
            'attendance' => $attendance
        ]);
    }

    public function checkOut(Request $request)
    {
        $request->validate([
            'attendance_id' => 'required|exists:teacher_attendances,id',
            'check_out_time' => 'required|date',
            'coordinates.latitude' => 'required|numeric',
            'coordinates.longitude' => 'required|numeric',
            'coordinates.accuracy' => 'required|numeric',
        ]);
        
        // Find the attendance record
        $attendance = TeacherAttendance::find($request->attendance_id);
        
        // Verify the attendance belongs to the current teacher
        if ($attendance->teacher_id !== auth()->id()) {
            return response()->json([
                'success' => false, 
                'message' => 'You are not authorized to check out this attendance record'
            ], 403);
        }
        
        // Check if already checked out
        if ($attendance->check_out_time !== null) {
            return response()->json([
                'success' => false, 
                'message' => 'Already checked out'
            ], 400);
        }

        // Check if class end_time => current_time
        $timetable = TimeTable::find($attendance->timetable_id);
        $classEndTime = Carbon::parse($timetable->end_time);

        // Return if class is still on going
        if ($classEndTime->gt(Carbon::now())) {
            return response()->json([
                'success' => false, 
                'message' => 'Class is still on going'
            ], 400);
        }
        
        
        try {
            $attendance->check_out_time = Carbon::now()->format('h:i A');
            $attendance->check_out_latitude = $request->coordinates['latitude'];
            $attendance->check_out_longitude = $request->coordinates['longitude'];
            $attendance->check_out_distance = $request->distance;
            $attendance->check_out_within_range = $request->within_range;
            $attendance->status = $request->status;
            // $attendance->check_out_accuracy = $request->coordinates['accuracy'];
            $attendance->save();
            
            return response()->json([
                'success' => true, 
                'message' => 'Check-out successful', 
                'attendance' => $attendance
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false, 
                'message' => 'Error during check-out: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getAttendanceHistory(Request $request)
    {
        // Get date from request or use today
        $date = $request->has('date') 
            ? Carbon::parse($request->date)->format('Y-m-d')
            : Carbon::now()->format('Y-m-d');
            
        $attendance = TeacherAttendance::where('teacher_id', auth()->id())
            ->where('date', $date)
            ->with(['course', 'classroom'])
            ->orderBy('check_in_time', 'desc')
            ->get();
            
        $todayAttendance = [];
        foreach($attendance as $today) {
            $todayAttendance[] = [
                'id' => $today->id,
                'timetable_id' => $today->timetable_id,
                'course_id' => $today->course_id,
                'date' => $today->date,
                'course_name' => $today->course->name,
                'class_room' => $today->classroom->name,
                'room_number' => $today->classroom->room_number ?? 'N/A',
                'check_in_time' => $today->check_in_time,
                'check_out_time' => $today->check_out_time,
                'check_in_latitude' => $today->check_in_latitude,
                'check_in_longitude' => $today->check_in_longitude,
                'check_out_latitude' => $today->check_out_latitude,
                'check_out_longitude' => $today->check_out_longitude,
                'check_in_distance' => $today->check_in_distance,
                'status' => $today->status ?? 'present',
                'location_match' => $today->check_in_within_range,
                'coordinates' => $today->check_in_latitude && $today->check_in_longitude 
                    ? ['lat' => (float)$today->check_in_latitude, 'lng' => (float)$today->check_in_longitude]
                    : null
            ];
        }
        
        return response()->json(['success' => true, 'data' => $todayAttendance]);
    }
    
    // Optional: Add endpoint to get specific attendance by timetable_id
    public function getAttendanceByTimetable($timetableId)
    {
        $attendance = TeacherAttendance::where('teacher_id', auth()->id())
            ->where('timetable_id', $timetableId)
            ->where('date', Carbon::now()->format('Y-m-d'))
            ->with(['course', 'classroom'])
            ->first();
            
        if (!$attendance) {
            return response()->json(['success' => false, 'message' => 'No attendance record found'], 404);
        }
        
        return response()->json([
            'success' => true,
            'data' => [
                'id' => $attendance->id,
                'timetable_id' => $attendance->timetable_id,
                'course_id' => $attendance->course_id,
                'date' => $attendance->date,
                'course_name' => $attendance->course->name,
                'class_room' => $attendance->classroom->name,
                'check_in_time' => $attendance->check_in_time,
                'check_out_time' => $attendance->check_out_time,
                'status' => $attendance->status ?? 'present',
                'location_match' => $attendance->check_in_within_range,
            ]
        ]);
    }
}