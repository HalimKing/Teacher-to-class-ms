<!doctype html>
<html>

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Timetable</title>
    <style>
        body {
            font-family: DejaVu Sans, Arial, Helvetica, sans-serif;
            font-size: 12px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
        }

        th,
        td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }

        th {
            background: #f3f4f6;
            font-weight: 700;
        }

        .header {
            text-align: center;
            margin-bottom: 12px;
        }
    </style>
</head>

<body>
    <div class="header">
        <h2>My Timetable</h2>
        <p>{{ now()->toDayDateTimeString() }}</p>
    </div>

    <table>
        <thead>
            <tr>
                <th>Day</th>
                <th>Start</th>
                <th>End</th>
                <th>Course Code</th>
                <th>Course Name</th>
                <th>Program</th>
                <th>Classroom</th>
                <th>Academic Year</th>
            </tr>
        </thead>
        <tbody>
            @foreach($timeTables as $t)
            <tr>
                <td>{{ $t->day }}</td>
                <td>{{ $t->start_time }}</td>
                <td>{{ $t->end_time }}</td>
                <td>{{ $t->course->course_code ?? '' }}</td>
                <td>{{ $t->course->name ?? '' }}</td>
                <td>{{ optional($t->course->program)->name ?? '' }}</td>
                <td>{{ $t->classRoom->name ?? '' }}</td>
                <td>{{ $t->academicYear->name ?? '' }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>
</body>

</html>