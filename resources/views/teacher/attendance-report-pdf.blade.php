<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>My Attendance Report</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 9px; color: #111; }
        h1 { font-size: 16px; margin-bottom: 4px; }
        .meta { color: #555; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ccc; padding: 4px 5px; text-align: left; }
        th { background: #eee; }
    </style>
</head>
<body>
    <h1>My Attendance Report</h1>
    <div class="meta">
        Lecturer: {{ trim("{$teacher->title} {$teacher->first_name} {$teacher->last_name}") }} ({{ $teacher->employee_id }})<br>
        Generated at: {{ $generatedAt }}
    </div>
    <table>
        <thead>
            <tr>
                @if(!empty($rows))
                    @foreach(array_keys($rows[0]) as $heading)
                        <th>{{ $heading }}</th>
                    @endforeach
                @endif
            </tr>
        </thead>
        <tbody>
            @forelse($rows as $row)
                <tr>
                    @foreach($row as $value)
                        <td>{{ $value ?? '—' }}</td>
                    @endforeach
                </tr>
            @empty
                <tr><td colspan="14">No records found.</td></tr>
            @endforelse
        </tbody>
    </table>
</body>
</html>
