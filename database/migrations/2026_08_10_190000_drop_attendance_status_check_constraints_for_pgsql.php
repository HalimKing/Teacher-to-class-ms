<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * 2026_06_17_160000_extend_teacher_attendance_status_enum and
 * 2026_08_02_100300_add_excused_absence_to_staff_attendances now convert
 * status/attendance_status to plain string columns (no DB-level enum/CHECK
 * enforcement) instead of the old MySQL-only ENUM MODIFY statements.
 *
 * On a fresh install this is a no-op on Postgres — those columns never had
 * a CHECK constraint there. But this deployment already ran
 * 2026_07_29_100000_fix_attendance_status_check_constraints_for_pgsql,
 * which added CHECK constraints as a stand-in fix before the upstream
 * migrations were corrected. Since Laravel tracks migrations by filename,
 * the rewritten upstream migrations won't re-run here and that stand-in
 * CHECK constraint is now stale — notably it doesn't allow
 * 'excused_absence', which AttendanceExplanationService now writes.
 *
 * Drop those CHECK constraints so this deployment matches what the
 * corrected migrations produce on a fresh Postgres install: plain,
 * unconstrained string columns.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('ALTER TABLE teacher_attendances DROP CONSTRAINT IF EXISTS teacher_attendances_status_check');
        DB::statement('ALTER TABLE staff_attendances DROP CONSTRAINT IF EXISTS staff_attendances_attendance_status_check');
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement(
            "ALTER TABLE teacher_attendances ADD CONSTRAINT teacher_attendances_status_check
                CHECK (status IN ('pending', 'present', 'absent', 'completed', 'incomplete', 'late', 'early_leave', 'overtime'))"
        );
        DB::statement(
            "ALTER TABLE staff_attendances ADD CONSTRAINT staff_attendances_attendance_status_check
                CHECK (attendance_status IN ('pending', 'checked_in', 'completed', 'late', 'early_leave', 'overtime', 'incomplete', 'absent', 'excused_absence'))"
        );
    }
};
