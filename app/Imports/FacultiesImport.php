<?php

namespace App\Imports;

use App\Models\Faculty;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class FacultiesImport implements ToModel, WithHeadingRow
{
    /**
     * @param array $row
     *
     * @return \Illuminate\Database\Eloquent\Model|null
     */
    public function model(array $row)
    {
        // Normalize heading keys to lowercase to tolerate different capitalization
        $normalized = [];
        foreach ($row as $key => $value) {
            $normalized[strtolower(trim($key))] = $value;
        }

        // Expecting headings: name, description
        if (empty($normalized['name'])) {
            return null;
        }

        return Faculty::updateOrCreate(
            ['name' => $normalized['name']],
            ['description' => $normalized['description'] ?? null]
        );
    }
}
