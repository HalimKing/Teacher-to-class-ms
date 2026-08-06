<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('staff_attendances', function (Blueprint $table) {
            $table->foreignId('venue_change_authorization_id')
                ->nullable()
                ->after('classroom_id')
                ->constrained('venue_change_authorizations')
                ->nullOnDelete();
            $table->boolean('authorized_venue_used')->default(false)->after('venue_change_authorization_id');
            $table->string('exception_category')->nullable()->after('auto_absence_reason');
            // normal | authorized_venue_change | excused_absence | unexcused_absence
            // | authorized_early_departure | unauthorized_early_departure
        });

        Schema::table('teacher_attendances', function (Blueprint $table) {
            $table->string('exception_category')->nullable()->after('auto_absence_reason');
        });
    }

    public function down(): void
    {
        Schema::table('staff_attendances', function (Blueprint $table) {
            $table->dropConstrainedForeignId('venue_change_authorization_id');
            $table->dropColumn(['authorized_venue_used', 'exception_category']);
        });

        Schema::table('teacher_attendances', function (Blueprint $table) {
            $table->dropColumn('exception_category');
        });
    }
};
