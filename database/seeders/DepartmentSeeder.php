<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DepartmentSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        //
        $data = [
            ['name' => 'Department of Computer Science', 'faculty_id' => 1],
            ['name' => 'Department of Business Administration', 'faculty_id' => 2],
            ['name' => 'Department of Mechanical Engineering', 'faculty_id' => 3],
        ];
        \App\Models\Department::insert($data);
    }
}
