<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class AcademicPeriodSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        //
        $data = [
            ['name' => 'First Trimester'],
            ['name' => 'Second Trimester'],
            ['name' => 'Third Trimester'],
        ];
        \App\Models\AcademicPeriod::insert($data);
    }
}
