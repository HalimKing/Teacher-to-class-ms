<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * 2026_06_17_150000_add_auto_absence_fields_to_attendance_tables and
 * 2026_06_17_160000_extend_teacher_attendance_status_enum extend the
 * status/attendance_status enums via raw `MODIFY ... ENUM(...)` statements
 * guarded to run on MySQL only, so on Postgres the original (narrower)
 * CHECK constraints from the columns' creation migrations were never
 * widened. This left Postgres rejecting the newer status values ('late',
 * 'early_leave', 'overtime' on teacher_attendances.status; 'overtime',
 * 'incomplete', 'absent' on staff_attendances.attendance_status) that the
 * application already writes. This migration brings the Postgres CHECK
 * constraints up to parity with the MySQL enum definitions.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('ALTER TABLE teacher_attendances DROP CONSTRAINT IF EXISTS teacher_attendances_status_check');
        DB::statement(
            "ALTER TABLE teacher_attendances ADD CONSTRAINT teacher_attendances_status_check
                CHECK (status IN ('pending', 'present', 'absent', 'completed', 'incomplete', 'late', 'early_leave', 'overtime'))"
        );

        DB::statement('ALTER TABLE staff_attendances DROP CONSTRAINT IF EXISTS staff_attendances_attendance_status_check');
        DB::statement(
            "ALTER TABLE staff_attendances ADD CONSTRAINT staff_attendances_attendance_status_check
                CHECK (attendance_status IN ('pending', 'checked_in', 'completed', 'late', 'early_leave', 'overtime', 'incomplete', 'absent'))"
        );
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement("UPDATE teacher_attendances SET status = 'completed' WHERE status IN ('late', 'early_leave', 'overtime')");
        DB::statement('ALTER TABLE teacher_attendances DROP CONSTRAINT IF EXISTS teacher_attendances_status_check');
        DB::statement(
            "ALTER TABLE teacher_attendances ADD CONSTRAINT teacher_attendances_status_check
                CHECK (status IN ('pending', 'present', 'absent', 'completed', 'incomplete'))"
        );

        DB::statement("UPDATE staff_attendances SET attendance_status = 'completed' WHERE attendance_status IN ('overtime', 'incomplete', 'absent')");
        DB::statement('ALTER TABLE staff_attendances DROP CONSTRAINT IF EXISTS staff_attendances_attendance_status_check');
        DB::statement(
            "ALTER TABLE staff_attendances ADD CONSTRAINT staff_attendances_attendance_status_check
                CHECK (attendance_status IN ('pending', 'checked_in', 'completed', 'late', 'early_leave'))"
        );
    }
};
