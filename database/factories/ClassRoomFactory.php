<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\ClassRoom>
 */
class ClassRoomFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => $this->faker->unique()->word() . ' Class',
            'capacity' => $this->faker->numberBetween(20, 200),
            'latitude' => null,
            'longitude' => null,
            'radius_meters' => 50,
            'is_active' => true,
        ];
    }
}
