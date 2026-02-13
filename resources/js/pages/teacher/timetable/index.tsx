import AppLayout from '@/layouts/app-layout';
import { Head, usePage } from '@inertiajs/react';
import GetAppIcon from '@mui/icons-material/GetApp';
import PrintIcon from '@mui/icons-material/Print';
import {
    Box,
    Button,
    Grid,
    InputAdornment,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import { Calendar, Clock, Download, Search as SearchIcon, Users } from 'lucide-react';
import { useState } from 'react';

interface TimeTableItem {
    id: number;
    day: string;
    start_time: string;
    end_time: string;
    course?: { name: string; course_code?: string };
    program?: { name: string };
    classroom?: { name: string };
    academic_year?: { name: string };
}

export default function TeacherTimeTableIndex() {
    const { props } = usePage();
    const timeTables: TimeTableItem[] = props.timeTables || [];
    const [query, setQuery] = useState('');

    // Derived stats
    const totalSessions = timeTables.length;
    const totalCourses = Array.from(new Set(timeTables.map((t) => t.course?.name).filter(Boolean))).length;
    const totalMinutes = timeTables.reduce((sum, t) => {
        const [sh, sm] = t.start_time.split(':').map(Number);
        const [eh, em] = t.end_time.split(':').map(Number);
        const start = sh * 60 + sm;
        const end = eh * 60 + em;
        return sum + Math.max(0, end - start);
    }, 0);
    const totalHours = (totalMinutes / 60).toFixed(1);

    const exportCsvUrl = route('teacher.timetable.export') + '?format=csv';
    const printUrl = route('teacher.timetable.print') + '?format=print';

    return (
        <AppLayout breadcrumbs={[{ title: 'My Timetable', href: '/teacher/timetable' }]}>
            <Head title="My Timetable" />
            <Box sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 2, md: 4 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                    <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                            My Timetable
                        </Typography>
                        <Typography variant="h4" sx={{ fontWeight: 700 }}>
                            My Timetable
                        </Typography>
                    </Box>
                    <Box>
                        <Button variant="contained" size="small" startIcon={<GetAppIcon />} href={exportCsvUrl} sx={{ mr: 1 }}>
                            CSV
                        </Button>
                        <Button variant="outlined" size="small" startIcon={<PrintIcon />} href={printUrl} target="_blank">
                            Print
                        </Button>
                    </Box>
                </Box>

                {/* Summary cards */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={6} md={3}>
                        <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{ bgcolor: '#eff6ff', p: 1.5, borderRadius: 1 }}>
                                <Calendar size={20} />
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Total Sessions
                                </Typography>
                                <Typography variant="h6">{totalSessions}</Typography>
                            </Box>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{ bgcolor: '#ecfdf5', p: 1.5, borderRadius: 1 }}>
                                <Users size={20} />
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Total Courses
                                </Typography>
                                <Typography variant="h6">{totalCourses}</Typography>
                            </Box>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{ bgcolor: '#fff7ed', p: 1.5, borderRadius: 1 }}>
                                <Clock size={20} />
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Total Hours
                                </Typography>
                                <Typography variant="h6">{totalHours} hrs</Typography>
                            </Box>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{ bgcolor: '#fef3c7', p: 1.5, borderRadius: 1 }}>
                                <Download size={20} />
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Actions
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                    Use header actions to download or print
                                </Typography>
                            </Box>
                        </Paper>
                    </Grid>
                </Grid>

                {/* Filters / Search */}
                <Paper sx={{ p: 2, mb: 3 }}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                size="small"
                                placeholder="Search by course or classroom"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon size={16} />
                                        </InputAdornment>
                                    ),
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6} sx={{ textAlign: { xs: 'center', md: 'right' } }}>
                            <Typography variant="caption" color="text.secondary">
                                Showing {timeTables.length} items
                            </Typography>
                        </Grid>
                    </Grid>
                </Paper>

                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 700 }}>Day</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Start</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>End</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Course</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Program</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Classroom</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Academic Year</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {timeTables
                                .filter((t) => {
                                    if (!query) return true;
                                    const q = query.toLowerCase();
                                    return (t.course?.name || '').toLowerCase().includes(q) || (t.classroom?.name || '').toLowerCase().includes(q);
                                })
                                .map((t) => (
                                    <TableRow key={t.id} hover>
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
        </AppLayout>
    );
}
