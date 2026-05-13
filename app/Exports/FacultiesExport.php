<?php

namespace App\Exports;

use App\Models\Faculty;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;

class FacultiesExport implements FromCollection, WithHeadings
{
    public function collection()
    {
        return Faculty::all()->map(function ($faculty) {
            return [
                'id' => $faculty->id,
                'name' => $faculty->name,
                'description' => $faculty->description,
                'created_at' => optional($faculty->created_at)->toDateTimeString(),
                'updated_at' => optional($faculty->updated_at)->toDateTimeString(),
            ];
        });
    }

    public function headings(): array
    {
        return [
            'ID',
            'Name',
            'Description',
            'Created At',
            'Updated At',
        ];
    }
}
