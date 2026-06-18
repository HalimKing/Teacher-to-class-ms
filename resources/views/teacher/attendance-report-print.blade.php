<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>My Attendance Report</title>
    <style>
        body { font-family: system-ui, sans-serif; font-size: 12px; color: #111; margin: 24px; }
        h1 { font-size: 22px; margin-bottom: 4px; }
        .meta { color: #555; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
        th { background: #f5f5f5; }
        @media print { body { margin: 0; } }
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
    <script>window.onload = () => window.print();</script>
</body>
</html>
