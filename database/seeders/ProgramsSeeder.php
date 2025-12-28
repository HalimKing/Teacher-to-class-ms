<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class ProgramsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        //
        $data = [
            ['name' => 'Computer Science', 'department_id' => 1, 'faculty_id' => 1],
            ['name' => 'Business Administration', 'department_id' => 2, 'faculty_id' => 2],
            ['name' => 'Mechanical Engineering', 'department_id' => 3, 'faculty_id' => 3],
        ];
        \App\Models\Program::insert($data);
    }
}
