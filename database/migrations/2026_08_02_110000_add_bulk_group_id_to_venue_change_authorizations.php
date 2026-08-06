<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('venue_change_authorizations', function (Blueprint $table) {
            $table->uuid('bulk_group_id')->nullable()->after('id');
            $table->index('bulk_group_id', 'vca_bulk_group_idx');
        });
    }

    public function down(): void
    {
        Schema::table('venue_change_authorizations', function (Blueprint $table) {
            $table->dropIndex('vca_bulk_group_idx');
            $table->dropColumn('bulk_group_id');
        });
    }
};
