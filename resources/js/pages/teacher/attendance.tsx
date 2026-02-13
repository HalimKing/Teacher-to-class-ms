import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { usePage } from '@inertiajs/react';
import { Circle, GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import axios from 'axios';
import { CheckCircle, Clock, Loader2, Map as MapIcon, MapPin, RefreshCw, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

// Types (keep as before)
interface ClassLocation {
    timetable_id: number;
    id: number;
    name: string;
    building: string;
    room: string;
    start_time: string;
    end_time: string;
    coordinates: {
        lat: number;
        lng: number;
    };
    radius: number;
    attendance_taken: boolean;
    attendance_status?: {
        id: number;
        check_in_time: string;
        check_out_time: string | null;
        status: 'completed' | 'checked_in' | 'present';
        location_match: boolean;
    };
    is_completed: boolean;
}

interface AttendanceRecord {
    id: number;
    timetable_id: number;
    course_id: number;
    date: string;
    check_in: string | null;
    check_out: string | null;
    status: 'present' | 'absent' | 'late' | 'early_departure' | 'pending';
    location_match: boolean;
    coordinates?: {
        lat: number;
        lng: number;
    };
    is_completed?: boolean;
}

interface ApiResponse {
    success: boolean;
    message: string;
    data?: any;
    attendance_id?: number;
}

// Utilities (keep as before)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;

    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const containerStyle = {
    width: '100%',
    height: '400px',
};

const createUserLocationIcon = () => ({
    path: 0,
    scale: 7,
    fillColor: '#3b82f6',
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
});

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/',
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    },
);

// Updated helper functions with grace period
const isBeforeClassStart = (classStartTime: string): boolean => {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes(); // Convert to minutes

    const [hours, minutes, seconds = '00'] = classStartTime.split(':').map(Number);
    const classStartTimeInMinutes = hours * 60 + minutes;

    return currentTime < classStartTimeInMinutes;
};

const isClassEnded = (classEndTime: string): boolean => {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [hours, minutes, seconds = '00'] = classEndTime.split(':').map(Number);
    const classEndTimeInMinutes = hours * 60 + minutes;

    return currentTime > classEndTimeInMinutes;
};

// Check if class has ended with grace period (30 minutes after end time)
const isAfterCheckoutDeadline = (classEndTime: string): boolean => {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [hours, minutes, seconds = '00'] = classEndTime.split(':').map(Number);
    const checkoutDeadlineInMinutes = hours * 60 + minutes + 30; // 30 minutes grace period

    return currentTime > checkoutDeadlineInMinutes;
};

// Check if check-out is allowed (within 30 minutes after class ends)
const isCheckoutAllowed = (classEndTime: string): boolean => {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [hours, minutes, seconds = '00'] = classEndTime.split(':').map(Number);
    const classEndTimeInMinutes = hours * 60 + minutes;
    const checkoutDeadlineInMinutes = classEndTimeInMinutes + 30;

    // Check-out is allowed if class has ended but within 30 minutes grace period
    return currentTime >= classEndTimeInMinutes && currentTime <= checkoutDeadlineInMinutes;
};

const isClassActive = (classStartTime: string, classEndTime: string): boolean => {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHours, startMinutes] = classStartTime.split(':').map(Number);
    const [endHours, endMinutes] = classEndTime.split(':').map(Number);

    const classStartTimeInMinutes = startHours * 60 + startMinutes;
    const classEndTimeInMinutes = endHours * 60 + endMinutes;

    return currentTime >= classStartTimeInMinutes && currentTime <= classEndTimeInMinutes;
};

function to12Hour(time24: string) {
    let [hours, minutes] = time24.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

const getTimeUntilClassStart = (classStartTime: string): string => {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [hours, minutes, seconds = '00'] = classStartTime.split(':').map(Number);
    const classStartTimeInMinutes = hours * 60 + minutes;

    const diffMins = classStartTimeInMinutes - currentTime;

    if (diffMins < 60) {
        return `${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
    } else {
        const diffHours = Math.floor(diffMins / 60);
        const remainingMins = diffMins % 60;
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''}${remainingMins > 0 ? ` ${remainingMins} minute${remainingMins !== 1 ? 's' : ''}` : ''}`;
    }
};

// Get time remaining until checkout deadline
const getTimeUntilCheckoutDeadline = (classEndTime: any, lateCheckInTime: any): string => {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [hours, minutes, seconds = '00'] = classEndTime.split(':').map(Number);
    const checkoutDeadlineInMinutes = hours * 60 + minutes + lateCheckInTime;

    const diffMins = checkoutDeadlineInMinutes - currentTime;

    if (diffMins <= 0) {
        return '0 minutes';
    } else if (diffMins < 60) {
        return `${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
    } else {
        const diffHours = Math.floor(diffMins / 60);
        const remainingMins = diffMins % 60;
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''}${remainingMins > 0 ? ` ${remainingMins} minute${remainingMins !== 1 ? 's' : ''}` : ''}`;
    }
};

export default function AttendancePage() {
    const [todaysClasses, setTodaysClasses] = useState<ClassLocation[]>([]);
    const [selectedClass, setSelectedClass] = useState<ClassLocation | null>(null);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
    const [distance, setDistance] = useState<number | null>(null);
    const [isWithinRange, setIsWithinRange] = useState(false);
    const [isLoadingLocation, setIsLoadingLocation] = useState(false);
    const [locationError, setLocationError] = useState<string | null>(null);
    const { system_settings: systemSettings } = usePage().props as any;
    const [lateCheckInTime, setLateCheckInTime] = useState(systemSettings.attendance.late_check_in_minutes.value as any);

    

    const defaultLat = Number(systemSettings?.map?.default_campus_lat?.value ?? import.meta.env.VITE_DEFAULT_CAMPUS_LAT ?? 40.7128);
    const defaultLng = Number(systemSettings?.map?.default_campus_lng?.value ?? import.meta.env.VITE_DEFAULT_CAMPUS_LNG ?? -74.006);

    const [mapCenter, setMapCenter] = useState({ lat: defaultLat, lng: defaultLng });
    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const [isLoadingApi, setIsLoadingApi] = useState(false);
    const [isLoadingClasses, setIsLoadingClasses] = useState(true);
    const [apiError, setApiError] = useState<string | null>(null);
    const [apiSuccess, setApiSuccess] = useState<string | null>(null);
    const [currentStatus, setCurrentStatus] = useState<'not_checked_in' | 'checked_in' | 'checked_out'>('not_checked_in');
    const [checkedInClass, setCheckedInClass] = useState<ClassLocation | null>(null);
    const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
    const [checkInTime, setCheckInTime] = useState<string | null>(null);
    const [activeAttendanceId, setActiveAttendanceId] = useState<number | null>(null);
    const [timeValidation, setTimeValidation] = useState<{
        isBeforeStart: boolean;
        isAfterEnd: boolean;
        isActive: boolean;
        isCheckoutAllowed: boolean;
        isAfterCheckoutDeadline: boolean;
        timeUntilStart: string;
        timeUntilCheckoutDeadline: string;
    }>({
        isBeforeStart: false,
        isAfterEnd: false,
        isActive: false,
        isCheckoutAllowed: false,
        isAfterCheckoutDeadline: false,
        timeUntilStart: '',
        timeUntilCheckoutDeadline: '',
    });

    const apiKey = (systemSettings?.map?.google_maps_api_key?.value as string) || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

    const fetchTodaysClasses = async () => {
        setIsLoadingClasses(true);
        setApiError(null);
        try {
            const response = await api.get<ApiResponse>('/teacher/attendance/todays-classes');

            if (response.data.success && response.data.data) {
                const classesData = response.data.data;
                setTodaysClasses(classesData);

                let foundActiveCheckIn = false;

                const checkedInClass = classesData.find((cls: ClassLocation) => cls.attendance_status?.status === 'checked_in');

                if (checkedInClass) {
                    foundActiveCheckIn = true;
                    setSelectedClass(checkedInClass);
                    setCheckedInClass(checkedInClass);
                    setCurrentStatus('checked_in');
                    if (checkedInClass.attendance_status?.check_in_time) {
                        setCheckInTime(checkedInClass.attendance_status.check_in_time);
                    }
                    if (checkedInClass.attendance_status?.id) {
                        setActiveAttendanceId(checkedInClass.attendance_status.id);
                    }
                } else {
                    setCurrentStatus('not_checked_in');
                    setCheckedInClass(null);
                    setActiveAttendanceId(null);
                    setCheckInTime(null);

                    const firstNonCompleted = classesData.find((cls: ClassLocation) => !cls.is_completed);
                    if (firstNonCompleted) {
                        setSelectedClass(firstNonCompleted);
                    } else if (classesData.length > 0) {
                        setSelectedClass(classesData[0]);
                    }
                }
            } else {
                setApiError(response.data.message || "Failed to fetch today's classes");
            }
        } catch (error: any) {
            console.error("Error fetching today's classes:", error);
            setApiError("Unable to load today's classes. Please try again.");
        } finally {
            setIsLoadingClasses(false);
        }
    };

    const updateTimeValidation = useCallback((classData: ClassLocation | null) => {
        if (!classData) {
            setTimeValidation({
                isBeforeStart: false,
                isAfterEnd: false,
                isActive: false,
                isCheckoutAllowed: false,
                isAfterCheckoutDeadline: false,
                timeUntilStart: '',
                timeUntilCheckoutDeadline: '',
            });
            return;
        }

        const isBeforeStart = isBeforeClassStart(classData.start_time);
        const isAfterEnd = isClassEnded(classData.end_time);
        const isActive = isClassActive(classData.start_time, classData.end_time);
        const isCheckoutAllowedNow = isCheckoutAllowed(classData.end_time);
        const isAfterCheckoutDeadlineNow = isAfterCheckoutDeadline(classData.end_time);
        const timeUntilStart = isBeforeStart ? getTimeUntilClassStart(classData.start_time) : '';
        const timeUntilCheckoutDeadline = isAfterEnd && !isAfterCheckoutDeadlineNow ? getTimeUntilCheckoutDeadline(classData.end_time, lateCheckInTime) : '';

        setTimeValidation({
            isBeforeStart,
            isAfterEnd,
            isActive,
            isCheckoutAllowed: isCheckoutAllowedNow,
            isAfterCheckoutDeadline: isAfterCheckoutDeadlineNow,
            timeUntilStart,
            timeUntilCheckoutDeadline,
        });
    }, []);

    const validatePresence = useCallback((userLoc: { lat: number; lng: number }, targetClass: ClassLocation) => {
        const d = calculateDistance(userLoc.lat, userLoc.lng, targetClass.coordinates.lat, targetClass.coordinates.lng);
        setDistance(d);
        setIsWithinRange(d <= targetClass.radius);
    }, []);

    useEffect(() => {
        if (userLocation && selectedClass && !selectedClass.is_completed) {
            validatePresence(userLocation, selectedClass);
        } else {
            setDistance(null);
            setIsWithinRange(false);
        }

        updateTimeValidation(selectedClass);
    }, [userLocation, selectedClass, validatePresence, updateTimeValidation]);

    useEffect(() => {
        getCurrentLocation();
        fetchTodaysClasses();
        fetchAttendanceRecords();
    }, []);

    useEffect(() => {
        if (todaysClasses.length > 0) {
            const checkedInClass = todaysClasses.find((cls) => cls.attendance_status?.status === 'checked_in');

            if (checkedInClass) {
                setSelectedClass(checkedInClass);
                setCheckedInClass(checkedInClass);
                setCurrentStatus('checked_in');

                const attendanceRecord = attendanceRecords.find((record) => record.timetable_id === checkedInClass.timetable_id);

                if (attendanceRecord) {
                    setActiveAttendanceId(attendanceRecord.id);
                    setCheckInTime(attendanceRecord.check_in);
                }
            }

            const completedClasses = todaysClasses.filter((cls) => cls.is_completed);
            if (completedClasses.length > 0) {
                if (!selectedClass && completedClasses[0]) {
                    setSelectedClass(completedClasses[0]);
                }
            }
        }
    }, [todaysClasses, attendanceRecords]);

    const getCurrentLocation = () => {
        if (!navigator.geolocation) {
            setLocationError('Geolocation is not supported by your browser');
            return;
        }

        setIsLoadingLocation(true);
        setLocationError(null);

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const loc = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                };
                setUserLocation(loc);
                setMapCenter({ lat: loc.lat, lng: loc.lng });
                setIsLoadingLocation(false);
            },
            (error) => {
                setIsLoadingLocation(false);
                let errorMessage = 'Unable to retrieve your location';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Location permission denied. Please enable location access.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Location information unavailable.';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Location request timed out.';
                        break;
                }
                setLocationError(errorMessage);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
        );
    };

    const handleClassSelect = (clsId: string) => {
        const cls = todaysClasses.find((c) => c.id === Number(clsId));
        if (cls) {
            if (cls.is_completed) {
                setApiError('Attendance already completed for this session');
                return;
            }

            if (checkedInClass && checkedInClass.id !== cls.id) {
                setApiError(`Please check out from ${checkedInClass.name} first`);
                return;
            }

            setSelectedClass(cls);
            updateTimeValidation(cls);

            if (!userLocation) {
                setMapCenter(cls.coordinates);
            }
        }
    };

    const handleCheckIn = async () => {
        if (!selectedClass) {
            setApiError('Please select a class first');
            return;
        }

        if (selectedClass.is_completed) {
            setApiError('Attendance already completed for this session');
            return;
        }

        if (!timeValidation.isActive) {
            if (timeValidation.isBeforeStart) {
                setApiError(`Cannot check in yet. Class starts in ${timeValidation.timeUntilStart}`);
                return;
            }

            if (timeValidation.isAfterEnd) {
                setApiError('This class has already ended. Cannot check in.');
                return;
            }

            setApiError('Class is not currently active. Check the class schedule.');
            return;
        }

        if (!isWithinRange || !userLocation) {
            setApiError('Cannot check in: Location is out of range');
            return;
        }

        setIsLoadingApi(true);
        setApiError(null);
        setApiSuccess(null);

        try {
            const now = new Date();
            const checkInData = {
                timetable_id: selectedClass.timetable_id,
                course_id: selectedClass.id,
                course_name: selectedClass.name,
                class_room: selectedClass.building,
                check_in_time: now.toISOString(),
                coordinates: {
                    latitude: userLocation.lat,
                    longitude: userLocation.lng,
                    accuracy: userLocation.accuracy,
                },
                distance: distance,
                within_range: isWithinRange,
                status: 'present',
                location_match: true,
            };

            console.log('Late_chek in time: ', lateCheckInTime);
            

            const response = await api.post<ApiResponse>('/teacher/attendance/check-in', checkInData);

            if (response.status === 200) {
                const time = now.toLocaleTimeString();
                setCheckInTime(time);
                setCurrentStatus('checked_in');
                setCheckedInClass(selectedClass);
                setActiveAttendanceId(response.data.attendance_id || Date.now());
                setApiSuccess('Successfully checked in!');

                setAttendanceRecords((prev) => [
                    {
                        id: response.data.attendance_id || Date.now(),
                        timetable_id: selectedClass.timetable_id,
                        course_id: selectedClass.id,
                        date: now.toLocaleDateString(),
                        check_in: time,
                        check_out: null,
                        status: 'pending',
                        location_match: true,
                        coordinates: userLocation,
                    },
                    ...prev,
                ]);

                fetchAttendanceRecords();
                fetchTodaysClasses();
            } else {
                setApiError(response.data.message || 'Failed to check in');
            }
        } catch (error: any) {
            console.error('Check-in error:', error);
            setApiError(error.response?.data?.message || 'Network error: Unable to check in. Please try again.');
        } finally {
            setIsLoadingApi(false);
        }
    };

    const handleCheckOut = async () => {
        // Check if selected class matches the checked-in class
        const isCorrectClassSelected = selectedClass && checkedInClass && selectedClass.id === checkedInClass.id;

        if (currentStatus !== 'checked_in' || !activeAttendanceId || !userLocation || !isCorrectClassSelected) {
            setApiError('Cannot check out: Please select the same class you checked in for');
            return;
        }

        if (selectedClass?.is_completed) {
            setApiError('Attendance already completed for this session');
            return;
        }

        // Check if check-out is allowed (class has ended but within grace period)
        if (!timeValidation.isCheckoutAllowed && !timeValidation.isAfterCheckoutDeadline) {
            setApiError('Check-out is only allowed after class ends. Please wait until the class is over.');
            return;
        }

        // Check if check-out deadline has passed
        if (timeValidation.isAfterCheckoutDeadline) {
            setApiError('Check-out deadline has passed. Please contact administration.');
            return;
        }

        setIsLoadingApi(true);
        setApiError(null);
        setApiSuccess(null);

        try {
            const now = new Date();
            const checkOutData = {
                attendance_id: activeAttendanceId,
                check_out_time: now.toISOString(),
                coordinates: {
                    latitude: userLocation.lat,
                    longitude: userLocation.lng,
                    accuracy: userLocation.accuracy,
                },
                status: 'present',
                distance: distance,
                within_range: isWithinRange,
            };

            const response = await api.post<ApiResponse>('/teacher/attendance/check-out', checkOutData);

            if (response.data.success) {
                const time = now.toLocaleTimeString();
                setCurrentStatus('checked_out');
                setCheckedInClass(null);
                setActiveAttendanceId(null);
                setCheckInTime(null);
                setApiSuccess('Successfully checked out!');

                setAttendanceRecords((prev) => {
                    const updated = [...prev];
                    if (updated.length > 0) {
                        updated[0] = {
                            ...updated[0],
                            check_out: time,
                            status: 'present',
                            is_completed: true,
                        };
                    }
                    return updated;
                });

                await fetchAttendanceRecords();
                await fetchTodaysClasses();

                const updatedClasses = [...todaysClasses];
                const classIndex = updatedClasses.findIndex((cls) => cls.id === selectedClass.id);

                if (classIndex !== -1) {
                    updatedClasses[classIndex] = {
                        ...updatedClasses[classIndex],
                        is_completed: true,
                        attendance_taken: true,
                        attendance_status: {
                            id: activeAttendanceId || 0,
                            check_in_time: checkInTime || '',
                            check_out_time: time,
                            status: 'completed',
                            location_match: true,
                        },
                    };

                    setTodaysClasses(updatedClasses);

                    const nextClass = updatedClasses.find((cls) => !cls.is_completed);
                    if (nextClass) {
                        setSelectedClass(nextClass);
                        updateTimeValidation(nextClass);
                    } else if (updatedClasses.length > 0) {
                        setSelectedClass(updatedClasses[0]);
                        updateTimeValidation(updatedClasses[0]);
                    }
                }
            } else {
                setApiError(response.data.message || 'Failed to check out');
            }
        } catch (error: any) {
            console.error('Check-out error:', error);
            setApiError(error.response?.data?.message || 'Network error: Unable to check out. Please try again.');
        } finally {
            setIsLoadingApi(false);
        }
    };

    const fetchAttendanceRecords = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const response = await api.get<ApiResponse>(`/teacher/attendance/history?date=${today}`);

            if (response.status === 200) {
                const records = response.data.data.map((record: any) => ({
                    id: record.id,
                    timetable_id: record.timetable_id,
                    course_id: record.course_id,
                    date: new Date(record.date).toLocaleDateString(),
                    check_in: record.check_in_time,
                    check_out: record.check_out_time,
                    status: record.status || 'present',
                    location_match: record.location_match || true,
                    is_completed: record.is_completed || record.check_out_time !== null,
                    coordinates: record.coordinates || undefined,
                }));

                setAttendanceRecords(records);

                const activeRecord = records.find((r: AttendanceRecord) => r.check_in && !r.check_out);
                if (activeRecord) {
                    setCurrentStatus('checked_in');
                    setActiveAttendanceId(activeRecord.id);
                    setCheckInTime(activeRecord.check_in);

                    const checkedInClass = todaysClasses.find((c) => c.id === activeRecord.course_id && c.timetable_id === activeRecord.timetable_id);
                    if (checkedInClass) {
                        setCheckedInClass(checkedInClass);
                        setSelectedClass(checkedInClass);
                        updateTimeValidation(checkedInClass);
                    }
                } else {
                    if (currentStatus === 'checked_in') {
                        setCurrentStatus('not_checked_in');
                        setCheckedInClass(null);
                        setActiveAttendanceId(null);
                        setCheckInTime(null);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching attendance records:', error);
        }
    };

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: 'Dashboard',
            href: '/teacher/dashboard',
        },
        {
            title: 'Attendance',
            href: '/attendance',
        },
    ];

    const handleMapLoad = () => {
        setIsMapLoaded(true);
    };

    useEffect(() => {
        if (apiSuccess || apiError) {
            const timer = setTimeout(() => {
                setApiSuccess(null);
                setApiError(null);
            }, 5000);

            return () => clearTimeout(timer);
        }
    }, [apiSuccess, apiError]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (selectedClass && !selectedClass.is_completed) {
                updateTimeValidation(selectedClass);
            }
        }, 60000);

        return () => clearInterval(interval);
    }, [selectedClass, updateTimeValidation]);

    const isSelectedClassCheckedIn = selectedClass && checkedInClass && selectedClass.id === checkedInClass.id;

    // Check if check-in should be disabled
    const gpsEnforcementEnabled = Boolean(systemSettings?.attendance?.gps_enforcement_enabled?.value ?? true);

    const isCheckInDisabled =
        (gpsEnforcementEnabled ? !isWithinRange : false) ||
        currentStatus !== 'not_checked_in' ||
        isLoadingApi ||
        !selectedClass ||
        selectedClass.is_completed ||
        !timeValidation.isActive;

    // Check if check-out should be disabled
    const isCheckOutDisabled =
        currentStatus !== 'checked_in' ||
        isLoadingApi ||
        !isSelectedClassCheckedIn ||
        selectedClass?.is_completed ||
        !timeValidation.isCheckoutAllowed ||
        timeValidation.isAfterCheckoutDeadline;

    const getCheckInButtonText = () => {
        if (isLoadingApi && currentStatus === 'not_checked_in') return 'Processing...';
        if (selectedClass?.is_completed) return 'Completed';
        if (timeValidation.isBeforeStart) return 'Too Early';
        if (timeValidation.isAfterEnd) return 'Class Ended';
        if (!timeValidation.isActive) return 'Class Not Active';
        return 'Check In';
    };

    // Get check-out button text based on state
    const getCheckOutButtonText = () => {
        if (isLoadingApi && currentStatus === 'checked_in') return 'Processing...';
        if (selectedClass?.is_completed) return 'Completed';
        if (timeValidation.isAfterCheckoutDeadline) return 'Deadline Passed';
        if (!timeValidation.isCheckoutAllowed && !timeValidation.isAfterEnd) return 'Wait for End';
        if (timeValidation.isCheckoutAllowed) return 'Check Out';
        return 'Select Class';
    };

    if (isLoadingClasses) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <div className="flex min-h-screen items-center justify-center">
                    <div className="text-center">
                        <Loader2 className="mx-auto h-12 w-12 animate-spin text-blue-600" />
                        <p className="mt-4 text-gray-600">Loading today's classes...</p>
                    </div>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="min-h-screen bg-slate-50 p-4 font-sans md:p-8">
                <div className="mx-auto max-w-6xl">
                    <header className="mb-8">
                        <h1 className="text-3xl font-bold text-slate-900">Attendance Portal</h1>
                        <p className="text-slate-500">Verify your location to check in for your classes.</p>
                    </header>

                    {apiSuccess && (
                        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">
                            <div className="flex items-center">
                                <CheckCircle className="mr-2 h-5 w-5" />
                                <span className="font-medium">{apiSuccess}</span>
                            </div>
                        </div>
                    )}

                    {apiError && (
                        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
                            <div className="flex items-center">
                                <XCircle className="mr-2 h-5 w-5" />
                                <span className="font-medium">{apiError}</span>
                            </div>
                        </div>
                    )}

                    {checkedInClass && currentStatus === 'checked_in' && (
                        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <CheckCircle className="mr-2 h-5 w-5 text-blue-600" />
                                    <div>
                                        <p className="font-medium text-blue-700">
                                            Checked in to <span className="font-bold">{checkedInClass.name}</span>
                                        </p>
                                        <p className="text-sm text-blue-600">
                                            {checkedInClass.building} • {checkedInClass.room} • Checked in at {checkInTime}
                                        </p>
                                    </div>
                                </div>
                                {selectedClass && checkedInClass.id !== selectedClass.id && (
                                    <p className="text-sm text-amber-600">Select this class above to check out</p>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                        <div className="space-y-6 lg:col-span-7">
                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                {apiKey ? (
                                    <LoadScript googleMapsApiKey={apiKey}>
                                        <GoogleMap mapContainerStyle={containerStyle} center={mapCenter} zoom={17} onLoad={handleMapLoad}>
                                            {userLocation && <Marker position={userLocation} title="Your Location" icon={createUserLocationIcon()} />}

                                            {selectedClass && !selectedClass.is_completed && (
                                                <>
                                                    <Marker position={selectedClass.coordinates} title={selectedClass.name} />
                                                    <Circle
                                                        center={selectedClass.coordinates}
                                                        radius={selectedClass.radius}
                                                        options={{
                                                            fillColor: isWithinRange ? '#22c55e' : '#ef4444',
                                                            fillOpacity: 0.15,
                                                            strokeColor: isWithinRange ? '#22c55e' : '#ef4444',
                                                            strokeWeight: 1,
                                                        }}
                                                    />
                                                </>
                                            )}
                                        </GoogleMap>
                                    </LoadScript>
                                ) : (
                                    <div className="flex h-[400px] flex-col items-center justify-center bg-slate-100 p-6 text-center text-slate-400">
                                        <MapIcon size={48} className="mb-4 opacity-20" />
                                        <p className="font-medium text-slate-600">Map Preview Unavailable</p>
                                        <p className="max-w-xs text-sm">Please provide a Google Maps API Key to enable the live tracking features.</p>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
                                    <div className={`rounded-lg p-3 ${userLocation ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'}`}>
                                        <MapPin size={24} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">GPS Signal</p>
                                        <p className="font-medium text-slate-900">{userLocation ? 'Active' : 'Searching...'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
                                    <div
                                        className={`rounded-lg p-3 ${selectedClass?.is_completed ? 'bg-emerald-50 text-emerald-600' : isWithinRange ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}
                                    >
                                        {selectedClass?.is_completed ? (
                                            <CheckCircle size={24} />
                                        ) : isWithinRange ? (
                                            <CheckCircle size={24} />
                                        ) : (
                                            <XCircle size={24} />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Status</p>
                                        <p className="font-medium text-slate-900">
                                            {selectedClass?.is_completed ? 'Completed' : isWithinRange ? 'In Range' : 'Out of Range'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6 lg:col-span-5">
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                <h3 className="mb-4 text-lg font-semibold text-slate-900">Class Verification</h3>

                                <div className="space-y-4">
                                    <div>
                                        <div className="mb-3 flex items-center justify-between">
                                            <label className="block text-sm font-semibold text-slate-700">Select Current Session</label>
                                            <span className="text-xs text-slate-500">
                                                {todaysClasses.filter((c) => c.is_completed).length} of {todaysClasses.length} completed
                                            </span>
                                        </div>
                                        <div className="custom-scrollbar grid max-h-[320px] grid-cols-2 gap-3 overflow-y-auto pr-1 max-sm:grid-cols-1">
                                            {todaysClasses.map((c) => {
                                                const isSelected = selectedClass?.id === c.id;
                                                const isCheckedIn = checkedInClass?.id === c.id && currentStatus === 'checked_in';
                                                const isCompleted = c.is_completed;
                                                const hasAttendance = c.attendance_taken;
                                                const isOtherCheckedIn =
                                                    checkedInClass && checkedInClass.id !== c.id && currentStatus === 'checked_in';
                                                const isClassBeforeStart = isBeforeClassStart(c.start_time);
                                                const classHasEnded = isClassEnded(c.end_time);
                                                const isClassActiveNow = isClassActive(c.start_time, c.end_time);
                                                const isAfterCheckoutDeadlineNow = isAfterCheckoutDeadline(c.end_time);
                                                const checkoutAllowed = isCheckoutAllowed(c.end_time);

                                                let bgColor = 'bg-white';
                                                let borderColor = 'border-slate-200';
                                                let textColor = 'text-slate-800';
                                                let cursorStyle = 'cursor-pointer';
                                                let hoverStyle = 'hover:border-blue-300 hover:bg-slate-50';

                                                if (isCompleted) {
                                                    bgColor = 'bg-emerald-50';
                                                    borderColor = 'border-emerald-200';
                                                    textColor = 'text-emerald-800';
                                                    cursorStyle = 'cursor-default';
                                                    hoverStyle = '';
                                                } else if (isSelected) {
                                                    if (isCheckedIn) {
                                                        bgColor = 'bg-blue-50';
                                                        borderColor = 'border-blue-500';
                                                        textColor = 'text-blue-700';
                                                    } else {
                                                        bgColor = 'bg-blue-50';
                                                        borderColor = 'border-blue-500';
                                                        textColor = 'text-blue-700';
                                                    }
                                                } else if (isOtherCheckedIn) {
                                                    bgColor = 'bg-slate-50';
                                                    borderColor = 'border-slate-100';
                                                    textColor = 'text-slate-400';
                                                    cursorStyle = 'cursor-not-allowed';
                                                    hoverStyle = '';
                                                } else if (hasAttendance && !isCompleted) {
                                                    bgColor = 'bg-amber-50';
                                                    borderColor = 'border-amber-200';
                                                    textColor = 'text-amber-800';
                                                } else if (isAfterCheckoutDeadlineNow) {
                                                    bgColor = 'bg-slate-100';
                                                    borderColor = 'border-slate-200';
                                                    textColor = 'text-slate-400';
                                                    cursorStyle = 'cursor-not-allowed';
                                                    hoverStyle = '';
                                                } else if (classHasEnded && !checkoutAllowed) {
                                                    bgColor = 'bg-slate-100';
                                                    borderColor = 'border-slate-200';
                                                    textColor = 'text-slate-400';
                                                    cursorStyle = 'cursor-not-allowed';
                                                    hoverStyle = '';
                                                } else if (isClassBeforeStart) {
                                                    bgColor = 'bg-blue-50';
                                                    borderColor = 'border-blue-200';
                                                    textColor = 'text-blue-700';
                                                } else if (checkoutAllowed) {
                                                    bgColor = 'bg-amber-50';
                                                    borderColor = 'border-amber-200';
                                                    textColor = 'text-amber-800';
                                                }

                                                return (
                                                    <button
                                                        key={c.id}
                                                        onClick={() => handleClassSelect(c.id.toString())}
                                                        disabled={isCompleted || isOtherCheckedIn || isAfterCheckoutDeadlineNow}
                                                        className={`rounded-xl border p-3 text-left transition-all duration-200 ${bgColor} ${borderColor} ${cursorStyle} ${hoverStyle} ${
                                                            isSelected ? 'ring-1 ring-blue-500' : ''
                                                        }`}
                                                    >
                                                        <div className="flex items-start justify-between">
                                                            <h4 className={`text-sm font-bold ${textColor}`}>
                                                                {c.name
                                                                    .toLowerCase()
                                                                    .split(' ')
                                                                    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                                                                    .join(' ')}
                                                            </h4>
                                                            <div className="flex items-center gap-1">
                                                                {isCompleted && (
                                                                    <div className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5">
                                                                        <CheckCircle size={12} className="text-emerald-600" />
                                                                        <span className="text-[10px] font-bold text-emerald-700">DONE</span>
                                                                    </div>
                                                                )}
                                                                {isCheckedIn && <CheckCircle size={14} className="text-blue-600" />}
                                                                {isSelected && !isCheckedIn && !isCompleted && (
                                                                    <CheckCircle size={14} className="text-blue-600" />
                                                                )}
                                                                {hasAttendance && !isCompleted && !isCheckedIn && (
                                                                    <Clock size={14} className="text-amber-600" />
                                                                )}
                                                                {isClassBeforeStart && !isCompleted && <Clock size={14} className="text-blue-600" />}
                                                                {isAfterCheckoutDeadlineNow && !isCompleted && (
                                                                    <XCircle size={14} className="text-red-500" />
                                                                )}
                                                                {checkoutAllowed && !isCompleted && !isCheckedIn && !isClassBeforeStart && (
                                                                    <Clock size={14} className="text-amber-600" />
                                                                )}
                                                                {isClassActiveNow &&
                                                                    !isCompleted &&
                                                                    !isCheckedIn &&
                                                                    !checkoutAllowed &&
                                                                    !isClassBeforeStart && <CheckCircle size={14} className="text-green-600" />}
                                                            </div>
                                                        </div>

                                                        <div className="mt-2 space-y-1">
                                                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                                <MapPin size={12} />
                                                                <span>
                                                                    {c.building} • {c.room}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                                <Clock size={12} />
                                                                <span>
                                                                    {to12Hour(c.start_time)} - {to12Hour(c.end_time)}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {isCompleted && c.attendance_status && (
                                                            <div className="mt-2">
                                                                <div className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                                                                    <CheckCircle size={12} />
                                                                    <span>Attendance Completed</span>
                                                                </div>
                                                                <div className="mt-1 text-[10px] text-emerald-500">
                                                                    In: {c.attendance_status.check_in_time} • Out:{' '}
                                                                    {c.attendance_status.check_out_time || '--'}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {isCheckedIn && (
                                                            <div className="mt-2 text-xs font-medium text-blue-600">✓ Currently checked in</div>
                                                        )}

                                                        {hasAttendance && !isCompleted && !isCheckedIn && (
                                                            <div className="mt-2 text-xs font-medium text-amber-600">
                                                                ⚠ Attendance started but not completed
                                                            </div>
                                                        )}

                                                        {isClassBeforeStart && !isCompleted && !isCheckedIn && (
                                                            <div className="mt-2 text-xs font-medium text-blue-600">
                                                                ⏰ Starts in {getTimeUntilClassStart(c.start_time)}
                                                            </div>
                                                        )}

                                                        {checkoutAllowed && !isCompleted && (
                                                            <div className="mt-2 text-xs font-medium text-amber-600">
                                                                ⏰ Check-out available for {getTimeUntilCheckoutDeadline(c.end_time, lateCheckInTime)}
                                                            </div>
                                                        )}

                                                        {isAfterCheckoutDeadlineNow && !isCompleted && (
                                                            <div className="mt-2 text-xs font-medium text-red-600">❌ Check-out deadline passed</div>
                                                        )}

                                                        {isClassActiveNow &&
                                                            !isCompleted &&
                                                            !isCheckedIn &&
                                                            !checkoutAllowed &&
                                                            !isClassBeforeStart && (
                                                                <div className="mt-2 text-xs font-medium text-green-600">
                                                                    ✅ Class is currently active
                                                                </div>
                                                            )}

                                                        {isOtherCheckedIn && (
                                                            <div className="mt-2 text-xs font-medium text-amber-600">
                                                                Check out of current session first
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {todaysClasses.some((c) => c.is_completed) && (
                                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle size={16} className="text-emerald-600" />
                                                    <span className="text-sm font-medium text-emerald-700">
                                                        {todaysClasses.filter((c) => c.is_completed).length} session(s) completed
                                                    </span>
                                                </div>
                                                <span className="text-xs text-emerald-600">These sessions are locked</span>
                                            </div>
                                        </div>
                                    )}

                                    {selectedClass && !selectedClass.is_completed && (
                                        <>
                                            {timeValidation.isBeforeStart && (
                                                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                                                    <div className="flex items-center gap-2">
                                                        <Clock size={16} className="text-blue-600" />
                                                        <div>
                                                            <p className="text-sm font-medium text-blue-700">
                                                                Class starts in {timeValidation.timeUntilStart}
                                                            </p>
                                                            <p className="text-xs text-blue-600">
                                                                Check-in will be available at {to12Hour(selectedClass.start_time)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {timeValidation.isActive && !timeValidation.isBeforeStart && !timeValidation.isAfterEnd && (
                                                <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                                                    <div className="flex items-center gap-2">
                                                        <CheckCircle size={16} className="text-green-600" />
                                                        <div>
                                                            <p className="text-sm font-medium text-green-700">Class is currently in session</p>
                                                            <p className="text-xs text-green-600">
                                                                Check-in available until {to12Hour(selectedClass.end_time)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {timeValidation.isCheckoutAllowed && (
                                                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                                                    <div className="flex items-center gap-2">
                                                        <Clock size={16} className="text-amber-600" />
                                                        <div>
                                                            <p className="text-sm font-medium text-amber-700">
                                                                Check-out available for {timeValidation.timeUntilCheckoutDeadline}
                                                            </p>
                                                            <p className="text-xs text-amber-600">
                                                                Class ended at {to12Hour(selectedClass.end_time)} • {`Grace period: ${lateCheckInTime} minutes`}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {timeValidation.isAfterCheckoutDeadline && (
                                                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                                                    <div className="flex items-center gap-2">
                                                        <XCircle size={16} className="text-red-600" />
                                                        <div>
                                                            <p className="text-sm font-medium text-red-700">Check-out deadline has passed</p>
                                                            <p className="text-xs text-red-600">Please contact administration for assistance</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    <button
                                        onClick={getCurrentLocation}
                                        disabled={isLoadingLocation}
                                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50"
                                    >
                                        {isLoadingLocation ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                                        Refresh My Location
                                    </button>

                                    {locationError && (
                                        <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600">{locationError}</div>
                                    )}

                                    {distance !== null && selectedClass && !selectedClass.is_completed && (
                                        <div
                                            className={`rounded-xl border p-4 ${isWithinRange ? 'border-green-100 bg-green-50' : 'border-amber-100 bg-amber-50'}`}
                                        >
                                            <div className="mb-1 flex items-center justify-between">
                                                <span className="text-sm font-medium text-slate-600">Distance to {selectedClass.room}</span>
                                                <span className={`text-sm font-bold ${isWithinRange ? 'text-green-600' : 'text-amber-600'}`}>
                                                    {distance.toFixed(1)}m
                                                </span>
                                            </div>
                                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                                                <div
                                                    className={`h-full transition-all duration-500 ${isWithinRange ? 'bg-green-500' : 'bg-amber-500'}`}
                                                    style={{ width: `${Math.min(100, (distance / selectedClass.radius) * 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    )}

                                    {selectedClass?.is_completed && (
                                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                                            <div className="flex items-center gap-3">
                                                <CheckCircle size={24} className="text-emerald-600" />
                                                <div>
                                                    <p className="font-medium text-emerald-700">Attendance Completed</p>
                                                    <p className="text-sm text-emerald-600">
                                                        This session has been completed. You cannot check in/out.
                                                    </p>
                                                    {selectedClass.attendance_status && (
                                                        <p className="mt-1 text-xs text-emerald-500">
                                                            Checked in at {selectedClass.attendance_status.check_in_time} • Checked out at{' '}
                                                            {selectedClass.attendance_status.check_out_time}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-3 pt-2">
                                        <button
                                            disabled={isCheckInDisabled}
                                            onClick={handleCheckIn}
                                            className={`flex flex-col items-center gap-1 rounded-xl px-4 py-3 font-bold text-white shadow-sm transition-all ${
                                                !isCheckInDisabled
                                                    ? 'bg-blue-600 hover:bg-blue-700'
                                                    : 'cursor-not-allowed bg-slate-200 text-slate-400'
                                            }`}
                                        >
                                            {isLoadingApi && currentStatus === 'not_checked_in' ? (
                                                <Loader2 size={20} className="animate-spin" />
                                            ) : (
                                                <CheckCircle size={20} />
                                            )}
                                            <span>{getCheckInButtonText()}</span>
                                        </button>

                                        <button
                                            disabled={isCheckOutDisabled}
                                            onClick={handleCheckOut}
                                            className={`flex flex-col items-center gap-1 rounded-xl px-4 py-3 font-bold text-white shadow-sm transition-all ${
                                                !isCheckOutDisabled
                                                    ? 'bg-slate-800 hover:bg-slate-900'
                                                    : 'cursor-not-allowed bg-slate-200 text-slate-400'
                                            }`}
                                        >
                                            {isLoadingApi && currentStatus === 'checked_in' ? (
                                                <Loader2 size={20} className="animate-spin" />
                                            ) : (
                                                <XCircle size={20} />
                                            )}
                                            <span>{getCheckOutButtonText()}</span>
                                        </button>
                                    </div>

                                    {currentStatus === 'checked_in' && !isSelectedClassCheckedIn && selectedClass && (
                                        <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-700">
                                            <p className="font-medium">Select "{checkedInClass?.name}" to check out</p>
                                            <p className="mt-1 text-xs">You can only check out from the class you checked in to.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                <h3 className="mb-4 text-lg font-semibold text-slate-900">Recent Logs</h3>
                                <div className="space-y-3">
                                    {attendanceRecords.length === 0 ? (
                                        <div className="py-8 text-center text-slate-400">
                                            <Clock size={32} className="mx-auto mb-2 opacity-20" />
                                            <p className="text-sm">No records found for today.</p>
                                        </div>
                                    ) : (
                                        attendanceRecords.map((record) => {
                                            const classInfo = todaysClasses.find(
                                                (c) => c.id === record.course_id && c.timetable_id === record.timetable_id,
                                            );

                                            return (
                                                <div
                                                    key={record.id}
                                                    className={`flex items-center justify-between rounded-lg border p-3 ${
                                                        record.is_completed ? 'border-emerald-100 bg-emerald-50' : 'border-slate-100 bg-slate-50'
                                                    }`}
                                                >
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-800">{classInfo?.name || 'Unknown Class'}</p>
                                                        <p className="text-xs text-slate-500">
                                                            In: {record.check_in} • Out: {record.check_out || '--'}
                                                        </p>
                                                        <p className="text-xs text-slate-400">{record.date}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span
                                                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-tight uppercase ${
                                                                record.is_completed
                                                                    ? 'bg-emerald-100 text-emerald-700'
                                                                    : record.status === 'present'
                                                                      ? 'bg-green-100 text-green-700'
                                                                      : record.status === 'late'
                                                                        ? 'bg-yellow-100 text-yellow-700'
                                                                        : record.status === 'absent'
                                                                          ? 'bg-red-100 text-red-700'
                                                                          : 'bg-blue-100 text-blue-700'
                                                            }`}
                                                        >
                                                            {record.status}
                                                        </span>
                                                        <div className="mt-1 flex items-center justify-end gap-1">
                                                            {record.is_completed ? (
                                                                <CheckCircle size={10} className="text-emerald-500" />
                                                            ) : record.location_match ? (
                                                                <CheckCircle size={10} className="text-green-500" />
                                                            ) : (
                                                                <XCircle size={10} className="text-red-500" />
                                                            )}
                                                            <p className="text-[10px] text-slate-400">
                                                                {record.is_completed
                                                                    ? 'Completed'
                                                                    : record.location_match
                                                                      ? 'Verified GPS'
                                                                      : 'GPS Mismatch'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
