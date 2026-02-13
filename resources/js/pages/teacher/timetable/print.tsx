import { Head, usePage } from '@inertiajs/react';
import { Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useEffect } from 'react';

export default function TeacherTimeTablePrint() {
    const { props } = usePage();
    const timeTables = props.timeTables || [];

    useEffect(() => {
        // Trigger print once page loads
        setTimeout(() => window.print(), 500);
    }, []);

    return (
        <Box sx={{ p: 2 }}>
            <Head title="My Timetable - Print" />
            <Typography variant="h5" sx={{ mb: 2, textAlign: 'center' }}>
                My Timetable
            </Typography>
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Day</TableCell>
                            <TableCell>Start</TableCell>
                            <TableCell>End</TableCell>
                            <TableCell>Course</TableCell>
                            <TableCell>Program</TableCell>
                            <TableCell>Classroom</TableCell>
                            <TableCell>Academic Year</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {timeTables.map((t: any) => (
                            <TableRow key={t.id}>
                                <TableCell>{t.day}</TableCell>
                                <TableCell>{t.start_time}</TableCell>
                                <TableCell>{t.end_time}</TableCell>
                                <TableCell>{t.course?.name}</TableCell>
                                <TableCell>{t.program?.name}</TableCell>
                                <TableCell>{t.classroom?.name}</TableCell>
                                <TableCell>{t.academic_year?.name}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}
