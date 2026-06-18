<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class FacultySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        //
        $data = [
            ['name' => 'Faculty of Science', 'description' => 'Faculty of Science'],
            ['name' => 'Faculty of Business', 'description' => 'Faculty of Business'],
            ['name' => 'Faculty of Engineering', 'description' => 'Faculty of Engineering'],
            ['name' => 'Faculty of Arts', 'description' => 'Faculty of Arts'],
            ['name' => 'Faculty of Law', 'description' => 'Faculty of Law'],
            ['name' => 'Faculty of Medicine', 'description' => 'Faculty of Medicine'],
            ['name' => 'Faculty of Pharmacy', 'description' => 'Faculty of Pharmacy'],
            ['name' => 'Faculty of Dentistry', 'description' => 'Faculty of Dentistry'],
            ['name' => 'Faculty of Nursing', 'description' => 'Faculty of Nursing'],
            ['name' => 'Faculty of Health Sciences', 'description' => 'Faculty of Health Sciences'],
            ['name' => 'Faculty of Social Sciences', 'description' => 'Faculty of Social Sciences'],
            ['name' => 'Faculty of Education', 'description' => 'Faculty of Education'],
            ['name' => 'Faculty of Agriculture', 'description' => 'Faculty of Agriculture'],
            ['name' => 'Faculty of Veterinary Medicine', 'description' => 'Faculty of Veterinary Medicine'],
            ['name' => 'Faculty of Technology', 'description' => 'Faculty of Technology'],
            ['name' => 'Faculty of Architecture', 'description' => 'Faculty of Architecture'],
            ['name' => 'Faculty of Planning', 'description' => 'Faculty of Planning'],
        ];
        \App\Models\Faculty::insert($data);
    }
}
