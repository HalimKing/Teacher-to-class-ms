
<?php

use App\Http\Controllers\Admin\SchoolManagement\AcademicPeriodController;
use App\Http\Controllers\Admin\SchoolManagement\AcademicYearController;
use App\Http\Controllers\Admin\SchoolManagement\ClassRoomController;
use App\Http\Controllers\Admin\SchoolManagement\CourseController;
use App\Http\Controllers\Admin\SchoolManagement\DepartmentController;
use App\Http\Controllers\Admin\SchoolManagement\FacultyController;
use App\Http\Controllers\Admin\SchoolManagement\ProgramController;
use App\Http\Controllers\Admin\SchoolManagement\TimeTableController;
use App\Http\Controllers\Admin\TeacherFaceEnrollmentController;
use App\Http\Controllers\Admin\TeacherController;
use App\Http\Controllers\Admin\SystemLogController;
use App\Http\Controllers\Admin\SystemSettingsController;
use App\Http\Controllers\Admin\TeacherAttendanceReportController;
use App\Http\Controllers\Admin\StaffAttendanceReportController;
use App\Http\Controllers\Admin\TeacherAttendanceAnalysisController;
use App\Http\Controllers\AttendanceRecordController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\Teacher\DashboardController;
use App\Http\Controllers\TeacherAttendanceController;
use App\Http\Controllers\TeacherCoursesController;
use App\Http\Controllers\UserController;

use App\Http\Controllers\Teacher\TimeTableController as TeacherTimeTableController;
use App\Http\Controllers\Teacher\FaceVerificationController;
use App\Http\Controllers\Teacher\SessionReminderController;
use App\Http\Controllers\Teacher\NotificationController;
use App\Http\Controllers\Teacher\StaffAttendanceController;
use App\Http\Controllers\Teacher\StaffAttendanceReportController as TeacherStaffAttendanceReportController;

use App\Http\Controllers\AdminAttendanceController;
use App\Models\AcademicPeriod;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return redirect()->route('login');
})->name('home');



Route::get('api/faculties/{faculty}/departments', [DepartmentController::class, 'getByFaculty']);
Route::post('api/time-tables/check-conflict', [TimeTableController::class, 'checkConflict'])
    ->middleware(['auth:web', 'permission:admin.academics.time-tables.view']);

// teachers middleware group
Route::middleware('auth:teacher')->group(function () {



    Route::get('/api/teacher/attendance-data', [DashboardController::class, 'getAttendanceData'])
        ->middleware('teacher.staff_type:lecturer');

    Route::prefix('teacher/attendance')
        ->middleware('teacher.staff_type:lecturer')
        ->group(
        function () {
            Route::get('/todays-classes', [TeacherAttendanceController::class, 'getTodaysClasses']);
            Route::post('/verify-face', [FaceVerificationController::class, 'verify']);
            Route::post('/check-in', [TeacherAttendanceController::class, 'checkIn']);
            Route::post('/check-out', [TeacherAttendanceController::class, 'checkOut']);
            Route::get('/history', [TeacherAttendanceController::class, 'getAttendanceHistory']);
            Route::get('/records', [TeacherAttendanceController::class, 'getAttendanceRecords']);
            Route::get('/by-timetable/{timetableId}', [TeacherAttendanceController::class, 'getAttendanceByTimetable']);
            Route::get('/', [TeacherAttendanceController::class, 'index'])->name('teacher.attendance');
        }
    );

    // Teacher timetable
    Route::middleware('teacher.staff_type:lecturer')->group(function () {
        Route::get('/teacher/timetable', [TeacherTimeTableController::class, 'index'])->name('teacher.timetable');
        Route::get('/teacher/timetable/print', [TeacherTimeTableController::class, 'export'])->name('teacher.timetable.print');
        Route::get('/teacher/timetable/export', [TeacherTimeTableController::class, 'export'])->name('teacher.timetable.export');
    });

    // Route::post('/teacher/attendance/check-in', [TeacherAttendanceController::class, 'checkIn'])->name('teacher.attendance.check-in');
    // Route::post('/teacher/attendance/check-out', [TeacherAttendanceController::class, 'checkOut'])->name('teacher.attendance.check-out');
    // Route::get('/teacher/attendance/history', [TeacherAttendanceController::class, 'getAttendanceHistory'])->name('teacher.attendance.history');

    Route::get('/teacher/dashboard', [DashboardController::class, 'index'])->name('teacher.dashboard');

    Route::get('/teacher/attendance', [TeacherAttendanceController::class, 'index'])
        ->middleware('teacher.staff_type:lecturer')
        ->name('teacher.attendance');
    //  Route::get('/by-timetable/{timetableId}', [TeacherAttendanceController::class, 'getAttendanceByTimetable']);
    //   Route::get('/todays-classes', [TeacherAttendanceController::class, 'getTodaysClasses']);

    Route::get('/teacher/staff-attendance', [StaffAttendanceController::class, 'index'])
        ->middleware('teacher.staff_type:administrator')
        ->name('teacher.staff-attendance');
    Route::prefix('teacher/staff-attendance')
        ->middleware('teacher.staff_type:administrator')
        ->group(function () {
            Route::get('/todays-schedules', [StaffAttendanceController::class, 'todaysSchedules']);
            Route::post('/verify-face', [FaceVerificationController::class, 'verifyStaff']);
            Route::post('/check-in', [StaffAttendanceController::class, 'checkIn']);
            Route::post('/check-out', [StaffAttendanceController::class, 'checkOut']);
            Route::get('/history', [StaffAttendanceController::class, 'history']);
        });

    Route::middleware('teacher.staff_type:administrator')->group(function () {
        Route::get('/teacher/staff-reports', [TeacherStaffAttendanceReportController::class, 'index'])->name('teacher.staff-reports');
        Route::get('/teacher/staff-reports/data', [TeacherStaffAttendanceReportController::class, 'data'])->name('teacher.staff-reports.data');
    });

    Route::get('/teacher/records', [AttendanceRecordController::class, 'index'])
        ->middleware('teacher.staff_type:lecturer')
        ->name('teacher.records');

    Route::middleware('teacher.staff_type:lecturer')->group(function () {
        Route::get('/teacher/reports', [TeacherAttendanceReportController::class, 'index'])->name('teacher.reports');
        Route::get('/teacher/reports/data', [TeacherAttendanceReportController::class, 'getReportData'])->name('teacher.reports.data');
    });

    Route::get('/teacher/my-courses', [TeacherCoursesController::class, 'index'])
        ->middleware('teacher.staff_type:lecturer')
        ->name('teacher.my-courses');

    // Rescheduled sessions (teacher)
    Route::middleware('teacher.staff_type:lecturer')->group(function () {
        Route::get('/teacher/reschedules', [\App\Http\Controllers\Teacher\RescheduledSessionController::class, 'index'])->name('teacher.reschedules.index');
        Route::post('/teacher/reschedules', [\App\Http\Controllers\Teacher\RescheduledSessionController::class, 'store'])->name('teacher.reschedules.store');
    });

    // Session reminders for teachers
    Route::middleware('teacher.staff_type:lecturer')->group(function () {
        Route::get('/teacher/reminders', [SessionReminderController::class, 'index'])->name('teacher.reminders.index');
        Route::post('/teacher/reminders', [SessionReminderController::class, 'store'])->name('teacher.reminders.store');
        Route::put('/teacher/reminders/{reminder}', [SessionReminderController::class, 'update'])->name('teacher.reminders.update');
        Route::post('/teacher/reminders/{reminder}/resend', [SessionReminderController::class, 'resend'])->name('teacher.reminders.resend');
        Route::delete('/teacher/reminders/{reminder}', [SessionReminderController::class, 'destroy'])->name('teacher.reminders.destroy');
    });

    Route::post('/teacher/notifications/{id}/read', [NotificationController::class, 'markAsRead'])->name('teacher.notifications.mark-read');
    Route::post('/teacher/notifications/read-all', [NotificationController::class, 'markAllAsRead'])->name('teacher.notifications.mark-all-read');
});

Route::middleware(['auth:web', 'verified'])->group(function () {



    Route::prefix('admin')->name('admin.')->group(
        function () {
            // Admin Attendance Management

            Route::prefix('attendance')->group(function () {
                Route::get('/', [TeacherAttendanceReportController::class, 'index'])->name('admin.attendance.index')
                    ->middleware('permission:admin.attendance.view');
                Route::get('/data', [TeacherAttendanceReportController::class, 'data'])->name('admin.attendance.data')
                    ->middleware('permission:admin.attendance.view');
                Route::get('/export', [TeacherAttendanceReportController::class, 'export'])->name('admin.attendance.export')
                    ->middleware('permission:admin.attendance.export');
                Route::get('/{teacher}', [TeacherAttendanceReportController::class, 'show'])->name('admin.attendance.show')
                    ->middleware('permission:admin.attendance.view');
                Route::get('/{teacher}/data', [TeacherAttendanceReportController::class, 'showData'])->name('admin.attendance.show-data')
                    ->middleware('permission:admin.attendance.view');
            });

            Route::get('dashboard', [\App\Http\Controllers\Admin\DashboardController::class, 'index'])->name('dashboard');

            Route::get('dashboard/attendance-data', [\App\Http\Controllers\Admin\DashboardController::class, 'getAttendanceData'])->name('dashboard.attendance-data');

            Route::prefix('system-logs')->name('system-logs.')->group(function () {
                Route::get('/', [SystemLogController::class, 'index'])
                    ->name('index')
                    ->middleware('permission:admin.system-logs.view');
                Route::get('/data', [SystemLogController::class, 'data'])
                    ->name('data')
                    ->middleware('permission:admin.system-logs.view');
                Route::get('/export', [SystemLogController::class, 'export'])
                    ->name('export')
                    ->middleware('permission:admin.system-logs.export');
                Route::post('/prune', [SystemLogController::class, 'prune'])
                    ->name('prune')
                    ->middleware('permission:admin.system-logs.manage');
                Route::get('/{activityLog}', [SystemLogController::class, 'show'])
                    ->name('show')
                    ->middleware('permission:admin.system-logs.view');
            });


            // System Settings (admin only)
            Route::prefix('settings-reports')->name('settings-reports.')->group(
                function () {
                    Route::get('settings', [SystemSettingsController::class, 'index'])
                        ->name('settings.index')
                        ->middleware('permission:admin.settings.view');
                    Route::put('settings', [SystemSettingsController::class, 'update'])
                        ->name('settings.update')
                        ->middleware('permission:admin.settings.edit');

                    // Teacher Attendance Analysis Routes
                    Route::get('attendance-analysis', [TeacherAttendanceAnalysisController::class, 'index'])
                        ->name('teachers.attendance-analysis')
                        ->middleware('permission:admin.attendance.view');
                    Route::get('attendance-analysis/data', [TeacherAttendanceAnalysisController::class, 'getAnalysisData'])
                        ->name('teachers.attendance-analysis.data')
                        ->middleware('permission:admin.attendance.view');

                    Route::get('staff-attendance-reports', [StaffAttendanceReportController::class, 'index'])
                        ->name('staff-attendance-reports.index')
                        ->middleware('permission:admin.staff-attendance.view');
                    Route::get('staff-attendance-reports/data', [StaffAttendanceReportController::class, 'data'])
                        ->name('staff-attendance-reports.data')
                        ->middleware('permission:admin.staff-attendance.view');
                    Route::get('staff-attendance-reports/export', [StaffAttendanceReportController::class, 'export'])
                        ->name('staff-attendance-reports.export')
                        ->middleware('permission:admin.staff-attendance.export');
                    Route::get('staff-attendance-reports/{teacher}', [StaffAttendanceReportController::class, 'show'])
                        ->name('staff-attendance-reports.show')
                        ->middleware('permission:admin.staff-attendance.view');
                    Route::get('staff-attendance-reports/{teacher}/data', [StaffAttendanceReportController::class, 'showData'])
                        ->name('staff-attendance-reports.show-data')
                        ->middleware('permission:admin.staff-attendance.view');
                }
            );


            Route::get('teachers/password-management', [TeacherController::class, 'passwordManagement'])
                ->name('teachers.password-management')
                ->middleware('permission:admin.teachers.password-management');

            Route::post('teachers/{teacher}/reset-password', [TeacherController::class, 'resetPassword'])
                ->name('teachers.reset-password');
            Route::post('teachers/{teacher}/face-enrollment', [TeacherFaceEnrollmentController::class, 'store'])
                ->name('teachers.face-enrollment.store')
                ->middleware('permission:admin.teachers.edit');
            Route::delete('teachers/{teacher}/face-enrollment', [TeacherFaceEnrollmentController::class, 'destroy'])
                ->name('teachers.face-enrollment.destroy')
                ->middleware('permission:admin.teachers.edit');
            Route::get('teachers/template', [TeacherController::class, 'template'])
                ->name('teachers.template');
            Route::get('teachers/export/{format}', [TeacherController::class, 'export'])
                ->name('teachers.export')
                ->where('format', 'excel|csv');
            Route::post('teachers/preview', [TeacherController::class, 'preview'])
                ->name('teachers.preview');
            Route::post('teachers/confirm-import', [TeacherController::class, 'confirmImport'])
                ->name('teachers.confirm-import');
            Route::resource('/teachers', TeacherController::class)
                ->only(['create', 'store'])
                ->middleware('permission:admin.teachers.create');
            Route::resource('/teachers', TeacherController::class)
                ->only(['index', 'show'])
                ->middleware('permission:admin.teachers.view');

            Route::resource('/teachers', TeacherController::class)
                ->only(['edit', 'update'])
                ->middleware('permission:admin.teachers.edit');
            Route::resource('/teachers', TeacherController::class)
                ->only(['destroy'])
                ->middleware('permission:admin.teachers.delete');



            Route::prefix('school-management')->name('school-management.')->group(
                function () {

                    Route::get('faculties/template', [FacultyController::class, 'template'])
                            ->name('faculties.template');
                    Route::resource('faculties', FacultyController::class);
                    Route::get('faculties/export/{format}', [FacultyController::class, 'export'])
                        ->name('faculties.export')
                        ->where('format', 'excel|csv');
                    
                    Route::post('faculties/preview', [FacultyController::class, 'preview'])
                        ->name('faculties.preview');
                    Route::post('faculties/confirm-import', [FacultyController::class, 'confirmImport'])
                        ->name('faculties.confirm-import');
                    Route::post('faculties/import', [FacultyController::class, 'import'])
                        ->name('faculties.import');
                    // Route::resource('faculties', FacultyController::class)
                    //     ->only(['create', 'store'])
                    //     ->middleware('permission:admin.school-management.faculties.create');
                    // Route::resource('faculties', FacultyController::class)
                    //     ->only(['index', 'show'])
                    //     ->middleware('permission:admin.school-management.faculties.view');
                    // Route::resource('faculties', FacultyController::class)
                    //     ->only(['edit', 'update'])
                    //     ->middleware('permission:admin.school-management.faculties.edit');
                    // Route::resource('faculties', FacultyController::class)
                    //     ->only(['destroy'])
                    //     ->middleware('permission:admin.school-management.faculties.delete');

                    Route::get('departments/template', [DepartmentController::class, 'template'])
                        ->name('departments.template');
                    Route::get('departments/export/{format}', [DepartmentController::class, 'export'])
                        ->name('departments.export')
                        ->where('format', 'excel|csv');
                    Route::post('departments/preview', [DepartmentController::class, 'preview'])
                        ->name('departments.preview');
                    Route::post('departments/confirm-import', [DepartmentController::class, 'confirmImport'])
                        ->name('departments.confirm-import');
                    Route::post('departments/import', [DepartmentController::class, 'import'])
                        ->name('departments.import');
                    Route::resource('departments', DepartmentController::class);

                    // Departments routes
                    Route::resource('departments', DepartmentController::class)
                        ->only(['create', 'store'])
                        ->middleware('permission:admin.school-management.departments.create');
                    Route::resource('departments', DepartmentController::class)
                        ->only(['index', 'show'])
                        ->middleware('permission:admin.school-management.departments.view');
                    Route::resource('departments', DepartmentController::class)
                        ->only(['edit', 'update'])
                        ->middleware('permission:admin.school-management.departments.edit');
                    Route::resource('departments', DepartmentController::class)
                        ->only(['destroy'])
                        ->middleware('permission:admin.school-management.departments.delete');

                    // Schedules management (reschedule approvals)
                    Route::get('schedules', [\App\Http\Controllers\Admin\SchoolManagement\SchedulesController::class, 'index'])
                        ->name('schedules.index')
                        ->middleware('permission:admin.schedules.view');
                    Route::get('schedules/{schedule}', [\App\Http\Controllers\Admin\SchoolManagement\SchedulesController::class, 'show'])
                        ->name('schedules.show')
                        ->middleware('permission:admin.schedules.view');
                    Route::post('schedules/{schedule}/approve', [\App\Http\Controllers\Admin\SchoolManagement\SchedulesController::class, 'approve'])
                        ->name('schedules.approve')
                        ->middleware('permission:admin.schedules.manage');
                    Route::post('schedules/{schedule}/reject', [\App\Http\Controllers\Admin\SchoolManagement\SchedulesController::class, 'reject'])
                        ->name('schedules.reject')
                        ->middleware('permission:admin.schedules.manage');


                    // Class Rooms routes
                    Route::get('class-rooms/template', [ClassRoomController::class, 'template'])
                        ->name('class-rooms.template');
                    Route::get('class-rooms/export/{format}', [ClassRoomController::class, 'export'])
                        ->name('class-rooms.export')
                        ->where('format', 'excel|csv');
                    Route::post('class-rooms/preview', [ClassRoomController::class, 'preview'])
                        ->name('class-rooms.preview');
                    Route::post('class-rooms/confirm-import', [ClassRoomController::class, 'confirmImport'])
                        ->name('class-rooms.confirm-import');
                    Route::resource('class-rooms', ClassRoomController::class)
                        ->only(['create', 'store'])
                        ->middleware('permission:admin.school-management.class-rooms.create');
                    Route::resource('class-rooms', ClassRoomController::class)
                        ->only(['index', 'show'])
                        ->middleware('permission:admin.school-management.class-rooms.view');
                    Route::resource('class-rooms', ClassRoomController::class)
                        ->only(['edit', 'update'])
                        ->middleware('permission:admin.school-management.class-rooms.edit');
                    Route::resource('class-rooms', ClassRoomController::class)
                        ->only(['destroy'])
                        ->middleware('permission:admin.school-management.class-rooms.delete');


                    // Academic Years routes
                    Route::resource('academic-years', AcademicYearController::class)
                        ->only(['create', 'store'])
                        ->middleware('permission:admin.school-management.academic-years.create');
                    Route::resource('academic-years', AcademicYearController::class)
                        ->only(['index', 'show'])
                        ->middleware('permission:admin.school-management.academic-years.view');
                    Route::resource('academic-years', AcademicYearController::class)
                        ->only(['edit', 'update'])
                        ->middleware('permission:admin.school-management.academic-years.edit');
                    Route::resource('academic-years', AcademicYearController::class)
                        ->only(['destroy'])
                        ->middleware('permission:admin.school-management.academic-years.delete');
                    Route::patch('/academic-years/{academicYear}/toggle-status', [AcademicYearController::class, 'toggleStatus'])
                        ->name('academic-years.toggle-status')
                        ->middleware('permission:admin.school-management.academic-years.edit');


                    // Academic Periods routes
                    Route::resource('academic-periods', AcademicPeriodController::class)
                        ->only(['create', 'store'])
                        ->middleware('permission:admin.school-management.academic-periods.create');
                    Route::resource('academic-periods', AcademicPeriodController::class)
                        ->only(['index', 'show'])
                        ->middleware('permission:admin.school-management.academic-periods.view');
                    Route::resource('academic-periods', AcademicPeriodController::class)
                        ->only(['edit', 'update'])
                        ->middleware('permission:admin.school-management.academic-periods.edit');
                    Route::resource('academic-periods', AcademicPeriodController::class)
                        ->only(['destroy'])
                        ->middleware('permission:admin.school-management.academic-periods.delete');


                    // Programs routes
                    Route::get('programs/template', [ProgramController::class, 'template'])
                        ->name('programs.template');
                    Route::get('programs/export/{format}', [ProgramController::class, 'export'])
                        ->name('programs.export')
                        ->where('format', 'excel|csv');
                    Route::post('programs/preview', [ProgramController::class, 'preview'])
                        ->name('programs.preview');
                    Route::post('programs/confirm-import', [ProgramController::class, 'confirmImport'])
                        ->name('programs.confirm-import');
                    Route::resource('programs', ProgramController::class)
                        ->only(['create', 'store'])
                        ->middleware('permission:admin.school-management.programs.create');
                    Route::resource('programs', ProgramController::class)
                        ->only(['index', 'show'])
                        ->middleware('permission:admin.school-management.programs.view');
                    Route::resource('programs', ProgramController::class)
                        ->only(['edit', 'update'])
                        ->middleware('permission:admin.school-management.programs.edit');
                    Route::resource('programs', ProgramController::class)
                        ->only(['destroy'])
                        ->middleware('permission:admin.school-management.programs.delete');
                    Route::get('/programs/{faculty}/departments', [ProgramController::class, 'getDepartmentsByFaculty'])
                        ->name('programs.get-departments')
                        ->middleware('permission:admin.school-management.programs.view');



                    // Courses routes
                    Route::get('courses/template', [CourseController::class, 'template'])
                        ->name('courses.template');
                    Route::get('courses/export/{format}', [CourseController::class, 'export'])
                        ->name('courses.export')
                        ->where('format', 'excel|csv');
                    Route::post('courses/preview', [CourseController::class, 'preview'])
                        ->name('courses.preview');
                    Route::post('courses/confirm-import', [CourseController::class, 'confirmImport'])
                        ->name('courses.confirm-import');
                    Route::resource('courses', CourseController::class)
                        ->only(['create', 'store'])
                        ->middleware('permission:admin.school-management.courses.create');
                    Route::resource('courses', CourseController::class)
                        ->only(['index', 'show'])
                        ->middleware('permission:admin.school-management.courses.view');
                    Route::resource('courses', CourseController::class)
                        ->only(['edit', 'update'])
                        ->middleware('permission:admin.school-management.courses.edit');
                    Route::resource('courses', CourseController::class)
                        ->only(['destroy'])
                        ->middleware('permission:admin.school-management.courses.delete');
                    Route::get('/courses/api', [CourseController::class, 'apiIndex'])
                        ->name('courses.api-index')
                        ->middleware('permission:admin.school-management.courses.view');
                }
            );

            Route::prefix('academics')->name('academics.')->group(
                function () {
                    // Time Tables routes
                    Route::resource('time-tables', TimeTableController::class)
                        ->only(['create', 'store'])
                        ->middleware('permission:admin.academics.time-tables.create');
                    Route::resource('time-tables', TimeTableController::class)
                        ->only(['index', 'show'])
                        ->middleware('permission:admin.academics.time-tables.view');
                    Route::resource('time-tables', TimeTableController::class)
                        ->only(['edit', 'update'])
                        ->middleware('permission:admin.academics.time-tables.edit');
                    Route::resource('time-tables', TimeTableController::class)
                        ->only(['destroy'])
                        ->middleware('permission:admin.academics.time-tables.delete');

                    // Custom Time Tables routes
                    Route::get('/time-tables/generate', [TimeTableController::class, 'generateForm'])
                        ->name('time-tables.generate-form')
                        ->middleware('permission:admin.academics.time-tables.create');
                    Route::post('/time-tables/generate', [TimeTableController::class, 'generate'])
                        ->name('time-tables.generate')
                        ->middleware('permission:admin.academics.time-tables.create');
                    Route::post('/time-tables/bulk-assign', [TimeTableController::class, 'bulkAssign'])
                        ->name('time-tables.bulk-assign')
                        ->middleware('permission:admin.academics.time-tables.create');
                    Route::get('/time-tables/reports', [TimeTableController::class, 'report'])
                        ->name('time-tables.reports')
                        ->middleware('permission:admin.academics.time-tables.view');
                    Route::get('time-tables/export/{format}', [TimeTableController::class, 'export'])
                        ->name('time-tables.export')
                        ->where('format', 'excel|csv')
                        ->middleware('permission:admin.academics.time-tables.view');
                    Route::get('/api/time-tables/check-conflict', [TimeTableController::class, 'checkConflict'])
                        ->name('time-tables.check-conflicts-form')
                        ->middleware('permission:admin.academics.time-tables.view');
                }
            );

            Route::prefix('user-management')->name('user-management.')->group(
                function () {
                    // Roles routes
                    Route::resource('roles', RoleController::class);
                    // Route::resource('roles', RoleController::class)
                    //     ->only(['create', 'store'])
                    //     ->middleware('permission:admin.user-management.roles.create');
                    // Route::resource('roles', RoleController::class)
                    //     ->only(['edit', 'update'])
                    //     ->middleware('permission:admin.user-management.roles.edit');
                    // Route::resource('roles', RoleController::class)
                    //     ->only(['index', 'show'])
                    //     ->middleware('permission:admin.user-management.roles.view');
                    // Route::resource('roles', RoleController::class)
                    //     ->only(['destroy'])
                    //     ->middleware('permission:admin.user-management.roles.delete');

                    // Users routes
                    // Route::resource('users', UserController::class);
                    Route::resource('users', UserController::class);
                    //  Route::resource('users', UserController::class)
                    //     ->only(['create', 'store'])
                    //     ->middleware('permission:admin.user-management.users.create');
                    // Route::resource('users', UserController::class)
                    //     ->only(['index', 'show'])
                    //     ->middleware('permission:admin.user-management.users.view');
                    // Route::resource('users', UserController::class)
                    //     ->only(['edit', 'update'])
                    //     ->middleware('permission:admin.user-management.users.edit');
                    // Route::resource('users', UserController::class)
                    //     ->only(['destroy'])
                    //     ->middleware('permission:admin.user-management.users.delete');
                }
            );
        }
    );
});

require __DIR__ . '/settings.php';
require __DIR__ . '/auth.php';
