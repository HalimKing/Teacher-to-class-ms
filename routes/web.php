<?php

use App\Http\Controllers\Admin\SchoolManagement\AcademicPeriodController;
use App\Http\Controllers\Admin\SchoolManagement\AcademicYearController;
use App\Http\Controllers\Admin\SchoolManagement\ClassRoomController;
use App\Http\Controllers\Admin\SchoolManagement\CourseController;
use App\Http\Controllers\Admin\SchoolManagement\DepartmentController;
use App\Http\Controllers\Admin\SchoolManagement\FacultyController;
use App\Http\Controllers\Admin\SchoolManagement\ProgramController;
use App\Http\Controllers\Admin\SchoolManagement\TimeTableController;
use App\Http\Controllers\Admin\TeacherController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\Teacher\DashboardController;
use App\Http\Controllers\TeacherAttendanceController;
use App\Http\Controllers\TeacherCoursesController;
use App\Http\Controllers\UserController;
use App\Models\AcademicPeriod;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');



Route::get('api/faculties/{faculty}/departments', [DepartmentController::class, 'getByFaculty']);

// teachers middleware group
Route::middleware('auth:teacher')->group(function () {


    Route::prefix('teacher/attendance')->group(function () {
        Route::get('/todays-classes', [TeacherAttendanceController::class, 'getTodaysClasses']);
        Route::post('/check-in', [TeacherAttendanceController::class, 'checkIn']);
        Route::post('/check-out', [TeacherAttendanceController::class, 'checkOut']);
        Route::get('/history', [TeacherAttendanceController::class, 'getAttendanceHistory']);
        Route::get('/by-timetable/{timetableId}', [TeacherAttendanceController::class, 'getAttendanceByTimetable']);
        Route::get('/', [TeacherAttendanceController::class, 'index'])->name('teacher.attendance');
    });

    // Route::post('/teacher/attendance/check-in', [TeacherAttendanceController::class, 'checkIn'])->name('teacher.attendance.check-in');
    // Route::post('/teacher/attendance/check-out', [TeacherAttendanceController::class, 'checkOut'])->name('teacher.attendance.check-out');
    // Route::get('/teacher/attendance/history', [TeacherAttendanceController::class, 'getAttendanceHistory'])->name('teacher.attendance.history');

    Route::get('/teacher/dashboard', [DashboardController::class, 'index'])->name('teacher.dashboard');

    Route::get('/teacher/attendance', [TeacherAttendanceController::class, 'index'])->name('teacher.attendance');
    //  Route::get('/by-timetable/{timetableId}', [TeacherAttendanceController::class, 'getAttendanceByTimetable']);
    //   Route::get('/todays-classes', [TeacherAttendanceController::class, 'getTodaysClasses']);

    Route::get('/teacher/records', function () {
        return Inertia::render('teacher/attendance-records');
    })->name('teacher.records');

    Route::get('/teacher/reports', function () {
        return Inertia::render('teacher/attendance-report');
    })->name('teacher.reports');

    Route::get('/teacher/my-courses', [TeacherCoursesController::class, 'index'])
        ->name('teacher.my-courses');
});

Route::middleware(['auth:web', 'verified'])->group(function () {

    

    Route::prefix('admin')->name('admin.')->group(function () {

        Route::get('dashboard', function () {
            return Inertia::render('dashboard');
        })->name('dashboard');
        
        Route::get('teachers/password-management', [TeacherController::class, 'passwordManagement'])
        ->name('teachers.password-management')
        ->middleware('permission:admin.teachers.password-management');
            
        Route::post('teachers/{teacher}/reset-password', [TeacherController::class, 'resetPassword'])
        ->name('teachers.reset-password');
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
        Route::prefix('school-management')->name('school-management.')->group(function () {

            Route::resource('faculties', FacultyController::class);
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


            // Class Rooms routes
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

          
        });

        Route::prefix('academics')->name('academics.')->group(function () {
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
            Route::get('time-tables/export/{format}', [TimeTableController::class, 'export'])
                ->name('time-tables.export')
                ->where('format', 'excel|csv')
                ->middleware('permission:admin.academics.time-tables.view');
            Route::get('/api/time-tables/check-conflict', [TimeTableController::class, 'checkConflict'])
                ->name('time-tables.check-conflicts-form')
                ->middleware('permission:admin.academics.time-tables.view');
        });

        Route::prefix('user-management')->name('user-management.')->group(function () {
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
        });
    });


});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
