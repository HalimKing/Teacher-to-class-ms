<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Administrator Attendance Report</title>
    <style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 24px; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        .meta { color: #555; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
        th { background: #f5f5f5; }
        @media print { .no-print { display: none; } }
    </style>
</head>
<body>
    <div class="no-print" style="margin-bottom: 16px;">
        <button onclick="window.print()">Print Report</button>
    </div>
    <h1>Administrator Attendance Report</h1>
    <div class="meta">Generated at: {{ $generatedAt }}</div>
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
                <tr><td colspan="12">No records found for the selected filters.</td></tr>
            @endforelse
        </tbody>
    </table>
</body>
</html>
