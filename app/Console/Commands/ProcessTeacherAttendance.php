<?php

namespace App\Console\Commands;

use App\Models\TeacherAttendance;
use App\Models\TimeTable;
use Carbon\Carbon;
use Illuminate\Console\Command;

class ProcessTeacherAttendance extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'attendance:process';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Command description';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        //
        logger('Attendance processor ran at ' . now());
        $now = Carbon::now();

        // Get today's lectures
        $todayLectures = TimeTable::with('course')
            ->where('day', now()->format('l'))
            ->whereTime('end_time', '<', $now->format('H:i:s'))
            ->get();

        foreach ($todayLectures as $lecture) {

            $lectureEnd = Carbon::parse($lecture->end_time);

            // Only process if lecture has ended
            if ($now->greaterThan($lectureEnd)) {

                $attendance = TeacherAttendance::where('timetable_id', $lecture->id)
                    ->whereDate('date', today())
                    ->first();

                // 🚨 CASE 1: No record at all → Absent
                if (!$attendance) {

                    TeacherAttendance::create([
                        'teacher_id' => $lecture->course->teacher_id,
                        'timetable_id' => $lecture->id,
                        'classroom_id' => $lecture->class_room_id,
                        'academic_year_id' => $lecture->academic_year_id,
                        'course_id' => $lecture->course_id,
                        'date' => today(),
                        'status' => 'absent',
                    ]);

                    continue;
                }

                // 🚨 CASE 2: Checked in but no checkout → Incomplete
                if ($attendance->check_in_time && !$attendance->check_out_time) {

                    $attendance->update([
                        'status' => 'incomplete'
                    ]);
                }

                // ✅ CASE 3: Checked in & out → Completed
                if ($attendance->check_in_time && $attendance->check_out_time) {

                    $attendance->update([
                        'status' => 'completed'
                    ]);
                }
            }
        }

        return 0;

    }
}
