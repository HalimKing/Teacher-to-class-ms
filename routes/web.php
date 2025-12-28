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
use App\Models\AcademicPeriod;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');



Route::get('api/faculties/{faculty}/departments', [DepartmentController::class, 'getByFaculty']);

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');

    Route::prefix('admin')->name('admin.')->group(function () {
        Route::resource('teachers', TeacherController::class);
        Route::prefix('school-management')->name('school-management.')->group(function () {
            Route::resource('faculties', FacultyController::class);
            Route::resource('departments', DepartmentController::class);
            Route::resource('class-rooms', ClassRoomController::class);
            Route::resource('academic-years', AcademicYearController::class);
            Route::patch('/academic-years/{academicYear}/toggle-status', [AcademicYearController::class, 'toggleStatus'])
            ->name('academic-years.toggle-status');
            Route::resource('academic-periods', AcademicPeriodController::class);
            Route::resource('programs', ProgramController::class);
             Route::get('/programs/{faculty}/departments', [ProgramController::class, 'getDepartmentsByFaculty'])
             ->name('programs.get-departments');
            Route::resource('courses',CourseController::class);
            Route::get('/courses/api', [CourseController::class, 'apiIndex'])->name('courses.api-index');

          
        });

        Route::prefix('academics')->name('academics.')->group(function () {
            Route::resource('time-tables', TimeTableController::class);
            Route::get('/time-tables/generate', [TimeTableController::class, 'generateForm'])->name('time-tables.generate-form');
            Route::post('/time-tables/generate', [TimeTableController::class, 'generate'])->name('time-tables.generate');
            Route::get('time-tables/export/{format}', [TimeTableController::class, 'export'])
            ->name('time-tables.export')
            ->where('format', 'excel|csv');;
            Route::get('/api/time-tables/check-conflict', [TimeTableController::class, 'checkConflict'])->name('time-tables.check-conflicts-form');
        });
    });


});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
