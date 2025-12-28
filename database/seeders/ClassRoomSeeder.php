<?php

namespace Database\Seeders;

use Database\Factories\ClassRoomFactory;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class ClassRoomSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        //
        ClassRoomFactory::new()->count(10)->create();
    }
}
