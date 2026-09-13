<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('teachers', function (Blueprint $table) {
            $table->string('leadership_role')->nullable()->after('employment_status');
            $table->unsignedBigInteger('leadership_faculty_id')->nullable()->after('leadership_role');
            $table->unsignedBigInteger('leadership_department_id')->nullable()->after('leadership_faculty_id');

            $table->foreign('leadership_faculty_id')
                ->references('id')
                ->on('faculties')
                ->nullOnDelete();

            $table->foreign('leadership_department_id')
                ->references('id')
                ->on('departments')
                ->nullOnDelete();

            $table->index('leadership_role');
        });
    }

    public function down(): void
    {
        Schema::table('teachers', function (Blueprint $table) {
            $table->dropForeign(['leadership_faculty_id']);
            $table->dropForeign(['leadership_department_id']);
            $table->dropIndex(['leadership_role']);
            $table->dropColumn([
                'leadership_role',
                'leadership_faculty_id',
                'leadership_department_id',
            ]);
        });
    }
};
