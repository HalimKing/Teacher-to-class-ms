import AppLayout from '@/layouts/app-layout';
import FilterListIcon from '@mui/icons-material/FilterList';
import GetAppIcon from '@mui/icons-material/GetApp';
import {
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Grid,
    MenuItem,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
    alpha,
    useTheme,
    useMediaQuery,
    IconButton,
    Collapse,
    Chip,
    Divider,
    Stack,
} from '@mui/material';
import axios from 'axios';
import { 
    BarChart3, 
    PieChart, 
    TrendingUp, 
    Users, 
    Calendar, 
    BookOpen, 
    GraduationCap, 
    School,
    ChevronDown,
    ChevronUp,
    FilterX,
    Download,
    RefreshCw,
    X,
    Search,
} from 'lucide-react';
import qs from 'qs';
import { useState, useEffect } from 'react';

interface AttendanceRecord {
    id: number;
    teacher?: { first_name: string; last_name: string };
    course?: { name: string };
    classroom?: { name: string };
    date: string;
    check_in_time: string;
    check_out_time: string;
    status: 'late' | 'completed' | 'absent';
}

interface TeacherAttendanceRecordsAdminProps {
    faculties: Array<{ id: number; name: string }>;
    departments: Array<{ id: number; name: string }>;
    programs: Array<{ id: number; name: string }>;
    levels: Array<{ id: number; name: string }>;
    academicYears: Array<{ id: number; name: string }>;
}

interface Analytics {
    totalRecords: number;
    completedCount: number;
    lateCount: number;
    absentCount: number;
    completionRate: number;
    lateRate: number;
    absentRate: number;
}

export default function TeacherAttendanceRecordsAdmin({
    faculties,
    departments,
    programs,
    levels,
    academicYears,
}: TeacherAttendanceRecordsAdminProps) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
    const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
    
    const [filters, setFilters] = useState({
        faculty_id: '',
        department_id: '',
        program_id: '',
        level_id: '',
        academic_year_id: '',
        date: '',
    });
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [filterApplied, setFilterApplied] = useState(false);
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
    const [analytics, setAnalytics] = useState<Analytics>({
        totalRecords: 0,
        completedCount: 0,
        lateCount: 0,
        absentCount: 0,
        completionRate: 0,
        lateRate: 0,
        absentRate: 0,
    });

    // Check if any filter has a value
    const hasActiveFilters = Object.values(filters).some(value => value !== '');
    
    // Get active filters count
    const activeFiltersCount = Object.values(filters).filter(value => value !== '').length;

    // Calculate analytics from records
    const calculateAnalytics = (data: AttendanceRecord[]) => {
        const total = data.length;
        if (total === 0) {
            setAnalytics({
                totalRecords: 0,
                completedCount: 0,
                lateCount: 0,
                absentCount: 0,
                completionRate: 0,
                lateRate: 0,
                absentRate: 0,
            });
            return;
        }

        const completed = data.filter((r) => r.status === 'completed').length;
        const late = data.filter((r) => r.status === 'late').length;
        const absent = data.filter((r) => r.status === 'absent').length;

        setAnalytics({
            totalRecords: total,
            completedCount: completed,
            lateCount: late,
            absentCount: absent,
            completionRate: Math.round((completed / total) * 100),
            lateRate: Math.round((late / total) * 100),
            absentRate: Math.round((absent / total) * 100),
        });

        logAnalyticsEvent('records_filtered', {
            total,
            completed,
            late,
            absent,
            filters: Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')),
        });
    };

    const logAnalyticsEvent = (eventName: string, eventData: Record<string, any>) => {
        axios
            .post('/api/analytics', {
                event: eventName,
                data: eventData,
                timestamp: new Date().toISOString(),
                page: 'admin_attendance',
            })
            .catch(() => {
                // Silently fail
            });
    };

    const handleFilter = async () => {
        setLoading(true);
        setFilterApplied(true);
        if (isMobile) {
            setShowMobileFilters(false);
        }
        try {
            const { data } = await axios.post('/admin/attendance/filter', filters);
            const recordsData = data.records.data || [];
            setRecords(recordsData);
            calculateAnalytics(recordsData);
            logAnalyticsEvent('filter_applied', { filters });
        } catch (error) {
            console.error('Error fetching attendance records:', error);
            logAnalyticsEvent('filter_error', { error: String(error) });
            setRecords([]);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        setLoading(true);
        try {
            const params = qs.stringify(filters, { skipNulls: true, skipEmptyStrings: true });
            logAnalyticsEvent('export_initiated', {
                recordCount: records.length,
                filters,
            });
            window.open(`/admin/attendance/export?${params}`);
        } catch (error) {
            console.error('Error exporting records:', error);
            logAnalyticsEvent('export_error', { error: String(error) });
        } finally {
            setLoading(false);
        }
    };

    const handleClearFilters = () => {
        setFilters({
            faculty_id: '',
            department_id: '',
            program_id: '',
            level_id: '',
            academic_year_id: '',
            date: '',
        });
        setRecords([]);
        setFilterApplied(false);
    };

    const toggleRowExpand = (id: number) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    // Analytics Card Component - Responsive
    const AnalyticsCard = ({
        title,
        value,
        icon: Icon,
        color,
        subtext,
    }: {
        title: string;
        value: number | string;
        icon: React.ElementType;
        color: string;
        subtext?: string;
    }) => (
        <Card
            sx={{
                borderLeft: { xs: 'none', sm: `4px solid ${color}` },
                borderTop: { xs: `4px solid ${color}`, sm: 'none' },
                height: '100%',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                    transform: { xs: 'none', md: 'translateY(-2px)' },
                    boxShadow: { md: theme.shadows[4] },
                },
            }}
        >
            <CardContent sx={{ p: { xs: 1.5, sm: 2, md: 2.5 } }}>
                <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    flexDirection: { xs: 'row', sm: 'column', md: 'row' },
                    gap: { xs: 1, sm: 1.5, md: 2 }
                }}>
                    <Box sx={{ width: '100%' }}>
                        <Typography 
                            color="text.secondary" 
                            gutterBottom 
                            variant={isMobile ? 'caption' : 'body2'}
                            sx={{ 
                                fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.875rem' },
                                fontWeight: 500
                            }}
                        >
                            {title}
                        </Typography>
                        <Typography 
                            variant={isMobile ? 'h6' : 'h5'} 
                            component="div" 
                            sx={{ 
                                fontWeight: 600,
                                fontSize: { xs: '1.1rem', sm: '1.25rem', md: '1.5rem' }
                            }}
                        >
                            {value}
                        </Typography>
                        {subtext && (
                            <Typography 
                                variant="caption" 
                                color="text.secondary" 
                                sx={{ 
                                    mt: 0.5, 
                                    display: 'block',
                                    fontSize: { xs: '0.6rem', sm: '0.7rem', md: '0.75rem' }
                                }}
                            >
                                {subtext}
                            </Typography>
                        )}
                    </Box>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: { xs: 32, sm: 40, md: 48 },
                            height: { xs: 32, sm: 40, md: 48 },
                            borderRadius: 2,
                            bgcolor: alpha(color, 0.08),
                            flexShrink: 0,
                        }}
                    >
                        <Icon size={isMobile ? 18 : 24} color={color} />
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );

    // Mobile Filter Summary Component
    const FilterSummary = () => {
        if (!hasActiveFilters) return null;
        
        return (
            <Box sx={{ mb: 2, display: { xs: 'block', sm: 'none' } }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    Active Filters ({activeFiltersCount})
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {filters.faculty_id && (
                        <Chip 
                            label={`Faculty: ${faculties.find(f => f.id === Number(filters.faculty_id))?.name || ''}`}
                            size="small"
                            onDelete={() => setFilters(f => ({ ...f, faculty_id: '' }))}
                        />
                    )}
                    {filters.department_id && (
                        <Chip 
                            label={`Dept: ${departments.find(d => d.id === Number(filters.department_id))?.name || ''}`}
                            size="small"
                            onDelete={() => setFilters(f => ({ ...f, department_id: '' }))}
                        />
                    )}
                    {filters.date && (
                        <Chip 
                            label={`Date: ${filters.date}`}
                            size="small"
                            onDelete={() => setFilters(f => ({ ...f, date: '' }))}
                        />
                    )}
                    {activeFiltersCount > 3 && (
                        <Chip 
                            label={`+${activeFiltersCount - 3} more`}
                            size="small"
                        />
                    )}
                </Box>
            </Box>
        );
    };

    // Mobile Record Card Component
    const MobileRecordCard = ({ record }: { record: AttendanceRecord }) => {
        const isExpanded = expandedRows.has(record.id);
        
        return (
            <Card sx={{ mb: 2, borderRadius: 2 }}>
                <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <School size={16} color={theme.palette.primary.main} />
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                {record.teacher?.first_name} {record.teacher?.last_name}
                            </Typography>
                        </Box>
                        <Box
                            sx={{
                                px: 1,
                                py: 0.5,
                                borderRadius: 1.5,
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                textTransform: 'capitalize',
                                backgroundColor:
                                    record.status === 'late' 
                                        ? alpha(theme.palette.warning.main, 0.12)
                                        : record.status === 'completed' 
                                        ? alpha(theme.palette.success.main, 0.12)
                                        : alpha(theme.palette.grey[500], 0.12),
                                color: 
                                    record.status === 'late' 
                                        ? theme.palette.warning.dark
                                        : record.status === 'completed' 
                                        ? theme.palette.success.dark
                                        : theme.palette.text.secondary,
                            }}
                        >
                            {record.status}
                        </Box>
                    </Box>
                    
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <BookOpen size={14} color={theme.palette.text.secondary} />
                            <Typography variant="caption" color="text.secondary">
                                {record.course?.name || 'N/A'}
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Calendar size={14} color={theme.palette.text.secondary} />
                            <Typography variant="caption" color="text.secondary">
                                {record.date}
                            </Typography>
                        </Box>
                    </Box>
                    
                    <Collapse in={isExpanded}>
                        <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                            <Grid container spacing={1.5}>
                                <Grid item xs={6}>
                                    <Typography variant="caption" color="text.secondary" display="block">
                                        Classroom
                                    </Typography>
                                    <Typography variant="body2">
                                        {record.classroom?.name || 'N/A'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={6}>
                                    <Typography variant="caption" color="text.secondary" display="block">
                                        Check In
                                    </Typography>
                                    <Typography variant="body2">
                                        {record.check_in_time || '—'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={6}>
                                    <Typography variant="caption" color="text.secondary" display="block">
                                        Check Out
                                    </Typography>
                                    <Typography variant="body2">
                                        {record.check_out_time || '—'}
                                    </Typography>
                                </Grid>
                            </Grid>
                        </Box>
                    </Collapse>
                    
                    <Button
                        fullWidth
                        size="small"
                        onClick={() => toggleRowExpand(record.id)}
                        sx={{ mt: 1 }}
                    >
                        {isExpanded ? 'Show Less' : 'Show More'}
                    </Button>
                </CardContent>
            </Card>
        );
    };

    // Empty State Component - Responsive
    const EmptyState = () => (
        <Box
            sx={{
                py: { xs: 6, sm: 8 },
                px: { xs: 2, sm: 3 },
                textAlign: 'center',
                bgcolor: 'background.paper',
                borderRadius: 2,
            }}
        >
            <Box sx={{ mb: { xs: 2, sm: 3 } }}>
                <Calendar 
                    size={isMobile ? 36 : 48} 
                    style={{ opacity: 0.3, color: theme.palette.text.secondary }} 
                />
            </Box>
            <Typography 
                variant={isMobile ? 'subtitle1' : 'h6'} 
                color="text.primary" 
                gutterBottom 
                sx={{ fontWeight: 500 }}
            >
                {filterApplied ? 'No Records Found' : 'Start Filtering'}
            </Typography>
            <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{ 
                    maxWidth: 400, 
                    mx: 'auto', 
                    mb: { xs: 2, sm: 3 },
                    px: { xs: 2, sm: 0 }
                }}
            >
                {filterApplied
                    ? 'No attendance records match your selected filters. Try adjusting your criteria.'
                    : 'Apply filters to view teacher attendance records and analytics.'}
            </Typography>
            {hasActiveFilters && filterApplied && (
                <Button 
                    variant="outlined" 
                    onClick={handleClearFilters} 
                    size={isMobile ? 'small' : 'medium'}
                    startIcon={<RefreshCw size={16} />}
                >
                    Clear All Filters
                </Button>
            )}
        </Box>
    );

    return (
        <AppLayout breadcrumbs={[{ title: 'Teacher Attendance', href: '/admin/attendance' }]}>
            <Box sx={{ 
                p: { xs: 1.5, sm: 2, md: 3 }, 
                maxWidth: '1400px', 
                mx: 'auto' 
            }}>
                {/* Header */}
                <Box sx={{ 
                    display: 'flex', 
                    flexDirection: { xs: 'column', sm: 'row' },
                    justifyContent: 'space-between', 
                    alignItems: { xs: 'flex-start', sm: 'center' }, 
                    mb: { xs: 2, sm: 3 },
                    gap: { xs: 1.5, sm: 2 }
                }}>
                    <Typography 
                        variant={isMobile ? 'h5' : 'h4'} 
                        sx={{ 
                            fontWeight: 600, 
                            color: 'text.primary',
                            fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2rem' }
                        }}
                    >
                        Teacher Attendance
                    </Typography>
                    {records.length > 0 && (
                        <Typography 
                            variant="body2" 
                            color="text.secondary"
                            sx={{ 
                                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                                bgcolor: alpha(theme.palette.primary.main, 0.04),
                                px: 1.5,
                                py: 0.5,
                                borderRadius: 2
                                
                            }}
                        >
                            {records.length} {records.length === 1 ? 'record' : 'records'}
                        </Typography>
                    )}
                </Box>

                {/* Mobile Filter Toggle */}
                {isMobile && (
                    <Box sx={{ mb: 2 }}>
                        <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<FilterListIcon />}
                            endIcon={showMobileFilters ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            onClick={() => setShowMobileFilters(!showMobileFilters)}
                            sx={{ 
                                justifyContent: 'space-between',
                                borderColor: hasActiveFilters ? theme.palette.primary.main : 'divider',
                                color: hasActiveFilters ? theme.palette.primary.main : 'text.primary',
                            }}
                        >
                            <span>
                                Filters {hasActiveFilters && `(${activeFiltersCount})`}
                            </span>
                        </Button>
                    </Box>
                )}

                {/* Analytics Section - Responsive Grid */}
                {records.length > 0 && (
                    <Grid 
                        container 
                        spacing={{ xs: 1.5, sm: 2, md: 3 }} 
                        sx={{ mb: { xs: 2, sm: 3, md: 4 } }}
                    >
                        <Grid item xs={6} sm={6} md={3}>
                            <AnalyticsCard 
                                title="Total Records" 
                                value={analytics.totalRecords} 
                                icon={BarChart3} 
                                color="#3b82f6" 
                                
                            />
                        </Grid>
                        <Grid item xs={6} sm={6} md={3}>
                            <AnalyticsCard
                                title="Completed"
                                value={analytics.completedCount}
                                icon={TrendingUp}
                                color="#10b981"
                                subtext={`${analytics.completionRate}%`}
                            />
                        </Grid>
                        <Grid item xs={6} sm={6} md={3}>
                            <AnalyticsCard
                                title="Late"
                                value={analytics.lateCount}
                                icon={Users}
                                color="#f59e0b"
                                subtext={`${analytics.lateRate}%`}
                            />
                        </Grid>
                        <Grid item xs={6} sm={6} md={3}>
                            <AnalyticsCard
                                title="Absent"
                                value={analytics.absentCount}
                                icon={PieChart}
                                color="#ef4444"
                                subtext={`${analytics.absentRate}%`}
                            />
                        </Grid>
                    </Grid>
                )}

                {/* Filter Summary for Mobile */}
                {isMobile && <FilterSummary />}

                {/* Filters Section - Responsive */}
                <Collapse in={!isMobile || showMobileFilters}>
                    <Paper sx={{ 
                        p: { xs: 2, sm: 2.5, md: 3 }, 
                        mb: { xs: 2, sm: 3, md: 4 },
                        borderRadius: { xs: 2, sm: 2, md: 1 }
                    }}>
                        <Box sx={{ 
                            display: 'flex', 
                            flexDirection: { xs: 'column', sm: 'row' },
                            justifyContent: 'space-between', 
                            alignItems: { xs: 'flex-start', sm: 'center' }, 
                            mb: { xs: 2, sm: 2.5, md: 3 },
                            gap: { xs: 1.5, sm: 2 }
                        }}>
                            <Typography 
                                variant={isMobile ? 'subtitle1' : 'h6'} 
                                sx={{ 
                                    fontWeight: 500,
                                    fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' }
                                }}
                            >
                                Filter Records
                            </Typography>
                            {hasActiveFilters && (
                                <Button 
                                    variant="text" 
                                    color="primary" 
                                    onClick={handleClearFilters}
                                    size={isMobile ? 'small' : 'medium'}
                                    startIcon={<FilterX size={isMobile ? 14 : 16} />}
                                    sx={{ 
                                        textTransform: 'none',
                                        fontSize: { xs: '0.75rem', sm: '0.875rem' }
                                    }}
                                >
                                    Clear all
                                </Button>
                            )}
                        </Box>
                        
                        <Grid container spacing={{ xs: 1.5, sm: 2 }}>
                            <Grid item xs={12} sm={6} md={4} lg={2}>
                                <TextField
                                    select
                                    fullWidth
                                    label="Faculty"
                                    value={filters.faculty_id}
                                    onChange={(e) => setFilters((f) => ({ ...f, faculty_id: e.target.value }))}
                                    size={isMobile ? 'small' : 'small'}
                                    sx={{ minWidth: '100%' }}
                                >
                                    <MenuItem value="">All Faculties</MenuItem>
                                    {faculties.map((f) => (
                                        <MenuItem key={f.id} value={f.id}>
                                            {f.name}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Grid>

                            <Grid item xs={12} sm={6} md={4} lg={2}>
                                <TextField
                                    select
                                    fullWidth
                                    label="Department"
                                    value={filters.department_id}
                                    onChange={(e) => setFilters((f) => ({ ...f, department_id: e.target.value }))}
                                    size={isMobile ? 'small' : 'small'}
                                    disabled={!filters.faculty_id}
                                    sx={{ minWidth: '100%' }}
                                >
                                    <MenuItem value="">All Departments</MenuItem>
                                    {departments.map((d) => (
                                        <MenuItem key={d.id} value={d.id}>
                                            {d.name}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Grid>

                            <Grid item xs={12} sm={6} md={4} lg={2}>
                                <TextField
                                    select
                                    fullWidth
                                    label="Program"
                                    value={filters.program_id}
                                    onChange={(e) => setFilters((f) => ({ ...f, program_id: e.target.value }))}
                                    size={isMobile ? 'small' : 'small'}
                                    disabled={!filters.department_id}
                                    sx={{ minWidth: '100%' }}
                                >
                                    <MenuItem value="">All Programs</MenuItem>
                                    {programs.map((p) => (
                                        <MenuItem key={p.id} value={p.id}>
                                            {p.name}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Grid>

                            <Grid item xs={12} sm={6} md={4} lg={2}>
                                <TextField
                                    select
                                    fullWidth
                                    label="Level"
                                    value={filters.level_id}
                                    onChange={(e) => setFilters((f) => ({ ...f, level_id: e.target.value }))}
                                    size={isMobile ? 'small' : 'small'}
                                    sx={{ minWidth: '100%' }}
                                >
                                    <MenuItem value="">All Levels</MenuItem>
                                    {levels.map((l) => (
                                        <MenuItem key={l.id} value={l.id}>
                                            {l.name}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Grid>

                            <Grid item xs={12} sm={6} md={4} lg={2}>
                                <TextField
                                    select
                                    fullWidth
                                    label="Academic Year"
                                    value={filters.academic_year_id}
                                    onChange={(e) => setFilters((f) => ({ ...f, academic_year_id: e.target.value }))}
                                    size={isMobile ? 'small' : 'small'}
                                    sx={{ minWidth: '100%' }}
                                >
                                    <MenuItem value="">All Academic Years</MenuItem>
                                    {academicYears.map((a) => (
                                        <MenuItem key={a.id} value={a.id}>
                                            {a.name}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Grid>

                            <Grid item xs={12} sm={6} md={4} lg={2}>
                                <TextField
                                    type="date"
                                    fullWidth
                                    label="Date"
                                    InputLabelProps={{ shrink: true }}
                                    value={filters.date}
                                    onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))}
                                    size={isMobile ? 'small' : 'small'}
                                    sx={{ minWidth: '100%' }}
                                />
                            </Grid>
                        </Grid>

                        <Box sx={{ 
                            display: 'flex', 
                            flexDirection: { xs: 'column', sm: 'row' },
                            gap: { xs: 1.5, sm: 2 }, 
                            mt: { xs: 2, sm: 2.5, md: 3 },
                            justifyContent: 'flex-start'
                        }}>
                            <Button
                                variant="contained"
                                startIcon={loading ? <CircularProgress size={isMobile ? 16 : 20} color="inherit" /> : <FilterListIcon />}
                                onClick={handleFilter}
                                disabled={loading}
                                fullWidth={isMobile}
                                sx={{ 
                                    px: { xs: 2, sm: 3, md: 4 }, 
                                    py: { xs: 1, sm: 1, md: 1 },
                                    fontSize: { xs: '0.75rem', sm: '0.875rem', md: '0.875rem' }
                                }}
                            >
                                {loading ? 'Filtering...' : 'Apply Filters'}
                            </Button>
                            <Button
                                variant="outlined"
                                color="success"
                                startIcon={<Download size={isMobile ? 16 : 18} />}
                                onClick={handleExport}
                                disabled={loading || records.length === 0}
                                fullWidth={isMobile}
                                sx={{ 
                                    px: { xs: 2, sm: 3, md: 4 }, 
                                    py: { xs: 1, sm: 1, md: 1 },
                                    fontSize: { xs: '0.75rem', sm: '0.875rem', md: '0.875rem' }
                                }}
                            >
                                Export
                            </Button>
                        </Box>
                    </Paper>
                </Collapse>

                {/* Records Section - Responsive */}
                <Paper sx={{ 
                    overflow: 'hidden',
                    borderRadius: { xs: 2, sm: 2, md: 1 }
                }}>
                    {loading ? (
                        <Box sx={{ 
                            display: 'flex', 
                            justifyContent: 'center', 
                            alignItems: 'center', 
                            py: { xs: 6, sm: 8, md: 10 } 
                        }}>
                            <CircularProgress size={isMobile ? 32 : 40} />
                        </Box>
                    ) : records.length === 0 ? (
                        <EmptyState />
                    ) : (
                        <>
                            {/* Desktop/Tablet View - Table */}
                            {!isMobile ? (
                                <TableContainer sx={{ 
                                    maxHeight: { sm: 'calc(100vh - 450px)', md: 'calc(100vh - 400px)' }, 
                                    overflowX: 'auto' 
                                }}>
                                    <Table stickyHeader size={isTablet ? 'small' : 'medium'}>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{ 
                                                    fontWeight: 600, 
                                                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                                                    fontSize: { sm: '0.75rem', md: '0.875rem' },
                                                    py: { sm: 1, md: 1.5 }
                                                }}>
                                                    Teacher
                                                </TableCell>
                                                <TableCell sx={{ 
                                                    fontWeight: 600, 
                                                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                                                    fontSize: { sm: '0.75rem', md: '0.875rem' },
                                                    py: { sm: 1, md: 1.5 }
                                                }}>
                                                    Course
                                                </TableCell>
                                                <TableCell sx={{ 
                                                    fontWeight: 600, 
                                                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                                                    fontSize: { sm: '0.75rem', md: '0.875rem' },
                                                    py: { sm: 1, md: 1.5 },
                                                    display: { sm: 'none', md: 'table-cell' }
                                                }}>
                                                    Classroom
                                                </TableCell>
                                                <TableCell sx={{ 
                                                    fontWeight: 600, 
                                                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                                                    fontSize: { sm: '0.75rem', md: '0.875rem' },
                                                    py: { sm: 1, md: 1.5 }
                                                }}>
                                                    Date
                                                </TableCell>
                                                <TableCell sx={{ 
                                                    fontWeight: 600, 
                                                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                                                    fontSize: { sm: '0.75rem', md: '0.875rem' },
                                                    py: { sm: 1, md: 1.5 },
                                                    display: { sm: 'none', md: 'table-cell' }
                                                }}>
                                                    Check In
                                                </TableCell>
                                                <TableCell sx={{ 
                                                    fontWeight: 600, 
                                                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                                                    fontSize: { sm: '0.75rem', md: '0.875rem' },
                                                    py: { sm: 1, md: 1.5 },
                                                    display: { sm: 'none', md: 'table-cell' }
                                                }}>
                                                    Check Out
                                                </TableCell>
                                                <TableCell sx={{ 
                                                    fontWeight: 600, 
                                                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                                                    fontSize: { sm: '0.75rem', md: '0.875rem' },
                                                    py: { sm: 1, md: 1.5 }
                                                }}>
                                                    Status
                                                </TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {records.map((rec, i) => (
                                                <TableRow 
                                                    key={rec.id || i} 
                                                    hover
                                                    sx={{ 
                                                        '&:last-child td, &:last-child th': { border: 0 },
                                                        transition: 'background-color 0.2s'
                                                    }}
                                                >
                                                    <TableCell sx={{ 
                                                        fontSize: { sm: '0.75rem', md: '0.875rem' },
                                                        py: { sm: 1, md: 1.5 }
                                                    }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                            <School size={isTablet ? 14 : 16} color={theme.palette.primary.main} />
                                                            {rec.teacher?.first_name} {rec.teacher?.last_name}
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell sx={{ 
                                                        fontSize: { sm: '0.75rem', md: '0.875rem' },
                                                        py: { sm: 1, md: 1.5 }
                                                    }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                            <BookOpen size={isTablet ? 14 : 16} color={theme.palette.success.main} />
                                                            {rec.course?.name || 'N/A'}
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell sx={{ 
                                                        fontSize: { sm: '0.75rem', md: '0.875rem' },
                                                        py: { sm: 1, md: 1.5 },
                                                        display: { sm: 'none', md: 'table-cell' }
                                                    }}>
                                                        {rec.classroom?.name || 'N/A'}
                                                    </TableCell>
                                                    <TableCell sx={{ 
                                                        fontSize: { sm: '0.75rem', md: '0.875rem' },
                                                        py: { sm: 1, md: 1.5 }
                                                    }}>
                                                        {rec.date}
                                                    </TableCell>
                                                    <TableCell sx={{ 
                                                        fontSize: { sm: '0.75rem', md: '0.875rem' },
                                                        py: { sm: 1, md: 1.5 },
                                                        display: { sm: 'none', md: 'table-cell' }
                                                    }}>
                                                        {rec.check_in_time || '—'}
                                                    </TableCell>
                                                    <TableCell sx={{ 
                                                        fontSize: { sm: '0.75rem', md: '0.875rem' },
                                                        py: { sm: 1, md: 1.5 },
                                                        display: { sm: 'none', md: 'table-cell' }
                                                    }}>
                                                        {rec.check_out_time || '—'}
                                                    </TableCell>
                                                    <TableCell sx={{ 
                                                        py: { sm: 1, md: 1.5 }
                                                    }}>
                                                        <Box
                                                            component="span"
                                                            sx={{
                                                                display: 'inline-block',
                                                                px: { sm: 1, md: 1.5 },
                                                                py: { sm: 0.25, md: 0.5 },
                                                                borderRadius: 1.5,
                                                                fontSize: { sm: '0.65rem', md: '0.75rem' },
                                                                fontWeight: 600,
                                                                textTransform: 'capitalize',
                                                                backgroundColor:
                                                                    rec.status === 'late' 
                                                                        ? alpha(theme.palette.warning.main, 0.12)
                                                                        : rec.status === 'completed' 
                                                                        ? alpha(theme.palette.success.main, 0.12)
                                                                        : alpha(theme.palette.grey[500], 0.12),
                                                                color: 
                                                                    rec.status === 'late' 
                                                                        ? theme.palette.warning.dark
                                                                        : rec.status === 'completed' 
                                                                        ? theme.palette.success.dark
                                                                        : theme.palette.text.secondary,
                                                            }}
                                                        >
                                                            {rec.status}
                                                        </Box>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            ) : (
                                // Mobile View - Cards
                                <Box sx={{ p: 2 }}>
                                    {records.map((record) => (
                                        <MobileRecordCard key={record.id} record={record} />
                                    ))}
                                </Box>
                            )}
                        </>
                    )}
                </Paper>
            </Box>
        </AppLayout>
    );
}