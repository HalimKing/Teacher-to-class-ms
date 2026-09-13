<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('teacher_attendances', function (Blueprint $table) {
            $table->boolean('self_reported')->default(false)->after('auto_absence_reason');
            $table->text('self_reported_reason')->nullable()->after('self_reported');
            $table->text('self_reported_notes')->nullable()->after('self_reported_reason');
            $table->timestamp('self_reported_at')->nullable()->after('self_reported_notes');
        });

        Schema::table('staff_attendances', function (Blueprint $table) {
            $table->boolean('self_reported')->default(false)->after('auto_absence_reason');
            $table->text('self_reported_reason')->nullable()->after('self_reported');
            $table->text('self_reported_notes')->nullable()->after('self_reported_reason');
            $table->timestamp('self_reported_at')->nullable()->after('self_reported_notes');
        });
    }

    public function down(): void
    {
        Schema::table('teacher_attendances', function (Blueprint $table) {
            $table->dropColumn(['self_reported', 'self_reported_reason', 'self_reported_notes', 'self_reported_at']);
        });

        Schema::table('staff_attendances', function (Blueprint $table) {
            $table->dropColumn(['self_reported', 'self_reported_reason', 'self_reported_notes', 'self_reported_at']);
        });
    }
};
