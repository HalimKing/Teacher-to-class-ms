<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class LevelSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        //
        $data = [
            ['name' => '100'],
            ['name' => '200'],
            ['name' => '300'],
            ['name' => '400'],
            ['name' => '500'],
            ['name' => '600'],
            ['name' => '700'],
            ['name' => '800'],
            ['name' => 'PhD Year 1'],
            ['name' => 'PhD Year 2'],
            ['name' => 'PhD Year 3'],
            ['name' => 'PhD Year 4'],
        ];
        \App\Models\Level::insert($data);
    }
}
