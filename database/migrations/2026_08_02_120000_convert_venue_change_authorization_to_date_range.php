<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if (!Schema::hasColumn('venue_change_authorizations', 'start_date')) {
            Schema::table('venue_change_authorizations', function (Blueprint $table) {
                $table->date('start_date')->nullable()->after('authorization_type');
                $table->date('end_date')->nullable()->after('start_date');
            });
        }

        if (Schema::hasColumn('venue_change_authorizations', 'authorization_date')) {
            DB::table('venue_change_authorizations')
                ->whereNull('start_date')
                ->update([
                    'start_date' => DB::raw('authorization_date'),
                    'end_date' => DB::raw('authorization_date'),
                ]);

            if ($driver === 'sqlite') {
                // SQLite cannot drop a column while indexes still reference it.
                Schema::table('venue_change_authorizations', function (Blueprint $table) {
                    if ($this->hasIndex('venue_change_authorizations', 'vca_staff_date_status_idx')) {
                        $table->dropIndex('vca_staff_date_status_idx');
                    }
                    if ($this->hasIndex('venue_change_authorizations', 'vca_timetable_date_idx')) {
                        $table->dropIndex('vca_timetable_date_idx');
                    }
                });
            } else {
                // MySQL may use the composite index for the staff_id FK — ensure a dedicated index first.
                if (!$this->hasIndex('venue_change_authorizations', 'vca_staff_id_idx')) {
                    Schema::table('venue_change_authorizations', function (Blueprint $table) {
                        $table->index('staff_id', 'vca_staff_id_idx');
                    });
                }

                Schema::table('venue_change_authorizations', function (Blueprint $table) {
                    if ($this->hasIndex('venue_change_authorizations', 'vca_staff_date_status_idx')) {
                        $table->dropIndex('vca_staff_date_status_idx');
                    }
                    if ($this->hasIndex('venue_change_authorizations', 'vca_timetable_date_idx')) {
                        $table->dropIndex('vca_timetable_date_idx');
                    }
                });
            }

            Schema::table('venue_change_authorizations', function (Blueprint $table) {
                $table->dropColumn('authorization_date');
            });
        }

        if (!$this->hasIndex('venue_change_authorizations', 'vca_staff_period_status_idx')) {
            Schema::table('venue_change_authorizations', function (Blueprint $table) {
                $table->index(['staff_id', 'start_date', 'end_date', 'status'], 'vca_staff_period_status_idx');
            });
        }

        if (!$this->hasIndex('venue_change_authorizations', 'vca_timetable_period_idx')) {
            Schema::table('venue_change_authorizations', function (Blueprint $table) {
                $table->index(['timetable_id', 'start_date', 'end_date'], 'vca_timetable_period_idx');
            });
        }
    }

    public function down(): void
    {
        if (!Schema::hasColumn('venue_change_authorizations', 'authorization_date')) {
            Schema::table('venue_change_authorizations', function (Blueprint $table) {
                $table->date('authorization_date')->nullable()->after('authorization_type');
            });
        }

        if (Schema::hasColumn('venue_change_authorizations', 'start_date')) {
            DB::table('venue_change_authorizations')
                ->whereNull('authorization_date')
                ->update([
                    'authorization_date' => DB::raw('start_date'),
                ]);
        }

        Schema::table('venue_change_authorizations', function (Blueprint $table) {
            if ($this->hasIndex('venue_change_authorizations', 'vca_staff_period_status_idx')) {
                $table->dropIndex('vca_staff_period_status_idx');
            }
            if ($this->hasIndex('venue_change_authorizations', 'vca_timetable_period_idx')) {
                $table->dropIndex('vca_timetable_period_idx');
            }
            if (Schema::hasColumn('venue_change_authorizations', 'start_date')) {
                $table->dropColumn(['start_date', 'end_date']);
            }
            $table->index(['staff_id', 'authorization_date', 'status'], 'vca_staff_date_status_idx');
            $table->index(['timetable_id', 'authorization_date'], 'vca_timetable_date_idx');
        });
    }

    private function hasIndex(string $table, string $index): bool
    {
        try {
            foreach (Schema::getConnection()->getSchemaBuilder()->getIndexes($table) as $info) {
                if (($info['name'] ?? null) === $index) {
                    return true;
                }
            }
        } catch (\Throwable) {
            return false;
        }

        return false;
    }
};
