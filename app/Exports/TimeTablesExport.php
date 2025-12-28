<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Illuminate\Support\Collection;
use Carbon\Carbon;

class TimeTablesExport implements FromCollection, WithHeadings
{
    /**
     * @var Collection
     */
    protected $timeTables;

    /**
     * Constructor
     */
    public function __construct($timeTables)
    {
        $this->timeTables = $timeTables;
    }

    /**
     * Get the collection for export
     */
    public function collection()
    {
        return $this->timeTables->map(function ($timetable) {
            return [
                'day' => $timetable->day,
                'start_time' => $this->formatTimeForExport($timetable->start_time),
                'end_time' => $this->formatTimeForExport($timetable->end_time),
                'duration' => $this->calculateDuration($timetable->start_time, $timetable->end_time),
                'course_code' => $timetable->course->course_code ?? 'N/A',
                'course_name' => $timetable->course->name ?? 'N/A',
                'program' => $timetable->course->program->name ?? 'N/A',
                'program_code' => $timetable->course->program->program_code ?? 'N/A',
                'classroom' => $timetable->classRoom->name ?? 'N/A',
                'classroom_capacity' => $timetable->classRoom->capacity ?? 'N/A',
                'teacher' => $timetable->course->teacher ? 
                    $timetable->course->teacher->title . ' ' . 
                    $timetable->course->teacher->first_name . ' ' . 
                    $timetable->course->teacher->last_name : 'Not Assigned',
                'teacher_id' => $timetable->course->teacher->employee_id ?? 'N/A',
                'academic_year' => $timetable->academicYear->name ?? 'N/A',
                'academic_year_period' => ($timetable->course->academicPeriod->name ?? ''),
            ];
        });
    }

    /**
     * Get the headings for the export
     */
    public function headings(): array
    {
        return [
            'Day',
            'Start Time',
            'End Time',
            'Duration',
            'Course Code',
            'Course Name',
            'Program',
            'Program Code',
            'Classroom',
            'Classroom Capacity',
            'Teacher',
            'Teacher ID',
            'Academic Year',
            'Academic Year Period',
        ];
    }

    /**
     * Format time for export (24-hour format)
     */
    private function formatTimeForExport($time)
    {
        return Carbon::parse($time)->format('H:i');
    }

    /**
     * Calculate duration for export
     */
    private function calculateDuration($start, $end)
    {
        $startTime = Carbon::parse($start);
        $endTime = Carbon::parse($end);
        
        $hours = $startTime->diffInHours($endTime);
        $minutes = $startTime->diffInMinutes($endTime) % 60;
        
        if ($hours === 0) {
            return "{$minutes} minutes";
        } elseif ($minutes === 0) {
            return "{$hours} hour" . ($hours > 1 ? 's' : '');
        }
        
        return "{$hours}h {$minutes}m";
    }
}