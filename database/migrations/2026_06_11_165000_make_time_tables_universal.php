<?php

use App\Models\Teacher;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('time_tables', function (Blueprint $table) {
            if (!Schema::hasColumn('time_tables', 'teacher_id')) {
                $table->unsignedBigInteger('teacher_id')->nullable()->after('class_room_id');
                $table->foreign('teacher_id')->references('id')->on('teachers')->nullOnDelete();
            }

            if (!Schema::hasColumn('time_tables', 'staff_type')) {
                $table->enum('staff_type', Teacher::STAFF_TYPES)->default(Teacher::STAFF_TYPE_LECTURER)->after('teacher_id');
            }

            if (!Schema::hasColumn('time_tables', 'day_of_week')) {
                $table->string('day_of_week')->nullable()->after('day');
            }
        });

        DB::table('time_tables')
            ->whereNull('teacher_id')
            ->whereNotNull('course_id')
            ->orderBy('id')
            ->chunkById(100, function ($timeTables) {
                foreach ($timeTables as $timeTable) {
                    $teacherId = DB::table('courses')->where('id', $timeTable->course_id)->value('teacher_id');
                    if ($teacherId) {
                        DB::table('time_tables')->where('id', $timeTable->id)->update(['teacher_id' => $teacherId]);
                    }
                }
            });

        DB::table('time_tables')
            ->whereNull('day_of_week')
            ->update(['day_of_week' => DB::raw('day')]);

        Schema::table('time_tables', function (Blueprint $table) {
            $table->unsignedBigInteger('course_id')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('time_tables', function (Blueprint $table) {
            $table->dropForeign(['teacher_id']);
            $table->dropColumn(['teacher_id', 'staff_type', 'day_of_week']);
            $table->unsignedBigInteger('course_id')->nullable(false)->change();
        });
    }
};
