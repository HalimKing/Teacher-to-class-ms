import AppLayout from '@/layouts/app-layout';
import { RescheduleSessionBanner } from '@/components/attendance/RescheduleSessionBanner';
import FaceCaptureModal from '@/components/face/FaceCaptureModal';
import { type FaceCaptureResult } from '@/lib/face-recognition';
import { buildFaceVerificationPayload, getApiErrorMessage, teacherJsonRequest } from '@/lib/teacher-api';
import { getBooleanSetting } from '@/lib/system-settings';
import { BreadcrumbItem } from '@/types';
import { usePage } from '@inertiajs/react';
import { Circle, GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import { CheckCircle, Clock, Loader2, Map as MapIcon, MapPin, RefreshCw, XCircle, AlertTriangle, CalendarClock } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

// Types (keep as before)
interface RescheduleInfo {
    id: number;
    reason?: string | null;
    note?: string | null;
    approved_by_name?: string | null;
    approved_at_display?: string | null;
    original_date_display?: string;
    original_start_time_display?: string;
    original_end_time_display?: string;
    original_venue?: string | null;
    new_date_display?: string;
    new_start_time_display?: string;
    new_end_time_display?: string;
    new_venue?: string | null;
    venue_changed?: boolean;
    time_changed?: boolean;
    rescheduled_from_badge?: string;
    summary?: string;
}

interface ClassLocation {
    timetable_id: number;
    id: number;
    name: string;
    building: string;
    room: string;
    start_time: string;
    end_time: string;
    original_start_time?: string;
    original_end_time?: string;
    coordinates: {
        lat: number;
        lng: number;
    };
    radius: number;
    attendance_taken: boolean;
    attendance_state?: 'normal' | 'rescheduled_away' | 'rescheduled_active' | 'missed';
    can_take_attendance?: boolean;
    attendance_blocked_message?: string | null;
    rescheduled_session_id?: number | null;
    reschedule?: RescheduleInfo | null;
    is_missed?: boolean;
    attendance_status?: {
        id: number;
        check_in_time: string | null;
        check_out_time: string | null;
        status: 'completed' | 'checked_in' | 'present' | 'absent';
        location_match: boolean;
    };
    is_completed: boolean;
    timing?: {
        early_checkin_minutes: number;
        checkout_grace_period_minutes: number;
        scheduled_start_time_display?: string | null;
        allowed_check_in_time_display?: string | null;
        can_check_in_now?: boolean;
        attendance_opens_message?: string | null;
        scheduled_end_time_display?: string | null;
        checkout_grace_deadline_display?: string | null;
        can_check_out_now?: boolean;
        is_within_checkout_grace?: boolean;
        is_after_checkout_grace?: boolean;
        checkout_grace_message?: string | null;
    };
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
    verification_token?: string | null;
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

// Updated helper functions with grace period
const getMinutesFromTime = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

const isBeforeAllowedCheckIn = (classStartTime: string, earlyCheckInMinutes: number): boolean => {
    const currentTime = new Date().getHours() * 60 + new Date().getMinutes();
    return currentTime < getMinutesFromTime(classStartTime) - earlyCheckInMinutes;
};

const isBeforeClassStart = (classStartTime: string): boolean => {
    const currentTime = new Date().getHours() * 60 + new Date().getMinutes();
    return currentTime < getMinutesFromTime(classStartTime);
};

const isClassEnded = (classEndTime: string): boolean => {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [hours, minutes, seconds = '00'] = classEndTime.split(':').map(Number);
    const classEndTimeInMinutes = hours * 60 + minutes;

    return currentTime > classEndTimeInMinutes;
};

// Check if class has ended with grace period (30 minutes after end time)
const isAfterCheckoutDeadline = (classEndTime: string, checkoutGraceMinutes: number): boolean => {
    const currentTime = new Date().getHours() * 60 + new Date().getMinutes();
    return currentTime > getMinutesFromTime(classEndTime) + checkoutGraceMinutes;
};

const isCheckoutAllowed = (classEndTime: string, checkoutGraceMinutes: number): boolean => {
    const currentTime = new Date().getHours() * 60 + new Date().getMinutes();
    const classEndTimeInMinutes = getMinutesFromTime(classEndTime);
    return currentTime >= classEndTimeInMinutes && currentTime <= classEndTimeInMinutes + checkoutGraceMinutes;
};

const isCheckoutOpen = (classEndTime: string): boolean => {
    const currentTime = new Date().getHours() * 60 + new Date().getMinutes();
    return currentTime >= getMinutesFromTime(classEndTime);
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
const getTimeUntilCheckoutDeadline = (classEndTime: string, checkoutGraceMinutes: number): string => {
    const currentTime = new Date().getHours() * 60 + new Date().getMinutes();
    const checkoutDeadlineInMinutes = getMinutesFromTime(classEndTime) + checkoutGraceMinutes;
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
    const { system_settings: systemSettings, facialRecognitionEnabled: facialRecognitionEnabledProp } = usePage().props as any;
    const [lateCheckInTime, setLateCheckInTime] = useState(systemSettings.attendance.late_check_in_minutes.value as any);
    const teacherEarlyCheckInMinutes = Number(systemSettings?.attendance?.teacher_early_checkin_minutes?.value ?? 30);
    const checkoutGracePeriodMinutes = Number(systemSettings?.attendance?.checkout_grace_period_minutes?.value ?? 30);

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
    const [faceModalOpen, setFaceModalOpen] = useState(false);
    const [pendingAttendanceAction, setPendingAttendanceAction] = useState<'check-in' | 'check-out' | null>(null);
    const [timeValidation, setTimeValidation] = useState<{
        isBeforeStart: boolean;
        isAfterEnd: boolean;
        isActive: boolean;
        isCheckoutAllowed: boolean;
        isAfterCheckoutDeadline: boolean;
        isCheckoutOpen: boolean;
        canCheckInNow: boolean;
        timeUntilStart: string;
        timeUntilCheckoutDeadline: string;
    }>({
        isBeforeStart: false,
        isAfterEnd: false,
        isActive: false,
        isCheckoutAllowed: false,
        isAfterCheckoutDeadline: false,
        isCheckoutOpen: false,
        canCheckInNow: false,
        timeUntilStart: '',
        timeUntilCheckoutDeadline: '',
    });

    const apiKey = (systemSettings?.map?.google_maps_api_key?.value as string) || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
    const facialRecognitionEnabled =
        typeof facialRecognitionEnabledProp === 'boolean'
            ? facialRecognitionEnabledProp
            : getBooleanSetting(systemSettings?.attendance, 'facial_recognition_enabled');

    const fetchTodaysClasses = async () => {
        setIsLoadingClasses(true);
        setApiError(null);
        try {
            const response = await teacherJsonRequest<ApiResponse>('/teacher/attendance/todays-classes');

            if (response.success && response.data) {
                const classesData = response.data;
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

                    const firstNonCompleted = classesData.find(
                        (cls: ClassLocation) => !cls.is_completed && !cls.is_missed && cls.can_take_attendance !== false,
                    );
                    if (firstNonCompleted) {
                        setSelectedClass(firstNonCompleted);
                    } else if (classesData.length > 0) {
                        setSelectedClass(classesData[0]);
                    }
                }
            } else {
                setApiError(response.message || "Failed to fetch today's classes");
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
                isCheckoutOpen: false,
                canCheckInNow: false,
                timeUntilStart: '',
                timeUntilCheckoutDeadline: '',
            });
            return;
        }

        const timing = classData.timing;
        const isBeforeStart = timing?.can_check_in_now === false
            ? !timing.can_check_in_now
            : isBeforeAllowedCheckIn(classData.start_time, teacherEarlyCheckInMinutes);
        const isAfterEnd = isClassEnded(classData.end_time);
        const isActive = isClassActive(classData.start_time, classData.end_time);
        const isCheckoutAllowedNow = timing?.is_within_checkout_grace ?? isCheckoutAllowed(classData.end_time, checkoutGracePeriodMinutes);
        const isAfterCheckoutDeadlineNow = timing?.is_after_checkout_grace ?? isAfterCheckoutDeadline(classData.end_time, checkoutGracePeriodMinutes);
        const isCheckoutOpenNow = timing?.can_check_out_now ?? isCheckoutOpen(classData.end_time);
        const canCheckInNow = timing?.can_check_in_now ?? !isBeforeAllowedCheckIn(classData.start_time, teacherEarlyCheckInMinutes);
        const timeUntilStart = isBeforeStart ? getTimeUntilClassStart(classData.start_time) : '';
        const timeUntilCheckoutDeadline =
            isAfterEnd && !isAfterCheckoutDeadlineNow ? getTimeUntilCheckoutDeadline(classData.end_time, checkoutGracePeriodMinutes) : '';

        setTimeValidation({
            isBeforeStart,
            isAfterEnd,
            isActive,
            isCheckoutAllowed: isCheckoutAllowedNow,
            isAfterCheckoutDeadline: isAfterCheckoutDeadlineNow,
            isCheckoutOpen: isCheckoutOpenNow,
            canCheckInNow,
            timeUntilStart,
            timeUntilCheckoutDeadline,
        });
    }, [teacherEarlyCheckInMinutes, checkoutGracePeriodMinutes]);

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

    const requestCurrentLocation = (): Promise<{ lat: number; lng: number; accuracy: number }> => {
        if (!navigator.geolocation) {
            const message = 'Geolocation is not supported by your browser';
            setLocationError(message);
            return Promise.reject(new Error(message));
        }

        setIsLoadingLocation(true);
        setLocationError(null);

        return new Promise((resolve, reject) => {
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
                    resolve(loc);
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
                    reject(new Error(errorMessage));
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
            );
        });
    };

    const getCurrentLocation = () => {
        requestCurrentLocation().catch(() => undefined);
    };

    const handleClassSelect = (timetableId: string) => {
        const cls = todaysClasses.find((c) => c.timetable_id === Number(timetableId));
        if (cls) {
            if (cls.is_completed) {
                setApiError('Attendance already completed for this session');
                return;
            }

            if (cls.is_missed || cls.can_take_attendance === false) {
                setSelectedClass(cls);
                setApiError(
                    cls.attendance_blocked_message ||
                        (cls.is_missed
                            ? 'This session was marked as missed. Attendance is no longer available.'
                            : 'Attendance is unavailable because this session has been rescheduled.'),
                );
                return;
            }

            if (checkedInClass && checkedInClass.timetable_id !== cls.timetable_id) {
                setApiError(`Please check out from ${checkedInClass.name} first`);
                return;
            }

            setSelectedClass(cls);
            setApiError(null);
            updateTimeValidation(cls);

            if (!userLocation) {
                setMapCenter(cls.coordinates);
            }
        }
    };

    const submitCheckIn = async (checkInData: Record<string, any>) => {
        const response = await teacherJsonRequest<ApiResponse>('/teacher/attendance/check-in', {
            method: 'POST',
            body: JSON.stringify(checkInData),
        });

        if (response.success) {
            const now = new Date();
            const time = now.toLocaleTimeString();
            setCheckInTime(time);
            setCurrentStatus('checked_in');
            setCheckedInClass(selectedClass);
            setActiveAttendanceId(response.attendance_id || Date.now());
            setApiSuccess('Successfully checked in!');

            if (selectedClass && userLocation) {
                setAttendanceRecords((prev) => [
                    {
                        id: response.attendance_id || Date.now(),
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
            }

            fetchAttendanceRecords();
            fetchTodaysClasses();
        } else {
            setApiError(response.message || 'Failed to check in');
        }
    };

    const getVerifiedLocationPayload = async (targetClass: ClassLocation) => {
        const loc = await requestCurrentLocation();
        const nextDistance = calculateDistance(loc.lat, loc.lng, targetClass.coordinates.lat, targetClass.coordinates.lng);
        const nextWithinRange = nextDistance <= targetClass.radius;

        setDistance(nextDistance);
        setIsWithinRange(nextWithinRange);

        if (gpsEnforcementEnabled && !nextWithinRange) {
            throw new Error('Cannot continue: Location is out of range');
        }

        return {
            coordinates: {
                latitude: loc.lat,
                longitude: loc.lng,
                accuracy: loc.accuracy,
            },
            distance: nextDistance,
            within_range: nextWithinRange,
        };
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

        if (selectedClass.is_missed || selectedClass.can_take_attendance === false) {
            setApiError(
                selectedClass.attendance_blocked_message ||
                    (selectedClass.is_missed
                        ? 'This session was marked as missed. Attendance is no longer available.'
                        : 'Attendance is unavailable because this session has been rescheduled.'),
            );
            return;
        }

        if (!timeValidation.canCheckInNow) {
            setApiError(
                selectedClass.timing?.attendance_opens_message ||
                    `Cannot check in yet. Attendance opens at ${selectedClass.timing?.allowed_check_in_time_display || to12Hour(selectedClass.start_time)}.`,
            );
            return;
        }

        setIsLoadingApi(true);
        setApiError(null);
        setApiSuccess(null);

        try {
            if (facialRecognitionEnabled) {
                setPendingAttendanceAction('check-in');
                setFaceModalOpen(true);
            } else {
                const locationPayload = await getVerifiedLocationPayload(selectedClass);
                const now = new Date();
                const checkInData = {
                    timetable_id: selectedClass.timetable_id,
                    course_id: selectedClass.id,
                    course_name: selectedClass.name,
                    class_room: selectedClass.building,
                    check_in_time: now.toISOString(),
                    ...locationPayload,
                    status: 'present',
                    location_match: true,
                };
                await submitCheckIn(checkInData);
            }
        } catch (error: any) {
            console.error('Check-in error:', error);
            setApiError(getApiErrorMessage(error, 'Network error: Unable to check in. Please try again.'));
        } finally {
            setIsLoadingApi(false);
        }
    };

    const submitCheckOut = async (checkOutData: Record<string, any>) => {
        const response = await teacherJsonRequest<ApiResponse>('/teacher/attendance/check-out', {
            method: 'POST',
            body: JSON.stringify(checkOutData),
        });

        if (response.success) {
            const time = new Date().toLocaleTimeString();
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

            if (selectedClass) {
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
            }
        } else {
            setApiError(response.message || 'Failed to check out');
        }
    };

    const handleFaceVerified = async (result: FaceCaptureResult) => {
        if (!pendingAttendanceAction || !selectedClass) {
            setApiError('No pending attendance request found.');
            return;
        }

        setIsLoadingApi(true);
        setApiError(null);
        setApiSuccess(null);

        try {
            const verification = await teacherJsonRequest<ApiResponse>('/teacher/attendance/verify-face', {
                method: 'POST',
                body: JSON.stringify(
                    buildFaceVerificationPayload(selectedClass.timetable_id, result.descriptor, result.quality),
                ),
            });

            if (!verification.success || !verification.verification_token) {
                throw new Error(verification.message || 'Face verification failed.');
            }

            const locationPayload = await getVerifiedLocationPayload(selectedClass);
            const facePayload = {
                face_descriptor: result.descriptor,
                face_verification_token: verification.verification_token,
            };

            if (pendingAttendanceAction === 'check-in') {
                const now = new Date();
                await submitCheckIn({
                    timetable_id: selectedClass.timetable_id,
                    course_id: selectedClass.id,
                    course_name: selectedClass.name,
                    class_room: selectedClass.building,
                    check_in_time: now.toISOString(),
                    ...locationPayload,
                    status: 'present',
                    location_match: true,
                    ...facePayload,
                });
            } else {
                if (!activeAttendanceId) {
                    throw new Error('No active attendance found for check-out.');
                }

                await submitCheckOut({
                    attendance_id: activeAttendanceId,
                    check_out_time: new Date().toISOString(),
                    ...locationPayload,
                    status: 'present',
                    ...facePayload,
                });
            }

            setPendingAttendanceAction(null);
            setFaceModalOpen(false);
        } catch (error: any) {
            console.error('Face verification error:', error);
            const message = getApiErrorMessage(error, 'Face verification failed. Please try again.');
            setApiError(message);
            throw new Error(message);
        } finally {
            setIsLoadingApi(false);
        }
    };

    const handleCheckOut = async () => {
        // Check if selected class matches the checked-in class
        const isCorrectClassSelected = selectedClass && checkedInClass && selectedClass.timetable_id === checkedInClass.timetable_id;

        if (currentStatus !== 'checked_in' || !activeAttendanceId || !isCorrectClassSelected) {
            setApiError('Cannot check out: Please select the same class you checked in for');
            return;
        }

        if (selectedClass?.is_completed) {
            setApiError('Attendance already completed for this session');
            return;
        }

        setIsLoadingApi(true);
        setApiError(null);
        setApiSuccess(null);

        try {
            if (facialRecognitionEnabled) {
                setPendingAttendanceAction('check-out');
                setFaceModalOpen(true);
            } else {
                const locationPayload = await getVerifiedLocationPayload(selectedClass);
                await submitCheckOut({
                    attendance_id: activeAttendanceId,
                    check_out_time: new Date().toISOString(),
                    ...locationPayload,
                    status: 'present',
                });
            }
        } catch (error: any) {
            console.error('Check-out error:', error);
            setApiError(getApiErrorMessage(error, 'Network error: Unable to check out. Please try again.'));
        } finally {
            setIsLoadingApi(false);
        }
    };

    const fetchAttendanceRecords = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const response = await teacherJsonRequest<ApiResponse>(`/teacher/attendance/history?date=${today}`);

            if (response.success && response.data) {
                const records = response.data.map((record: any) => ({
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

    const isSelectedClassCheckedIn = selectedClass && checkedInClass && selectedClass.timetable_id === checkedInClass.timetable_id;

    // Check if check-in should be disabled
    const gpsEnforcementEnabled = Boolean(systemSettings?.attendance?.gps_enforcement_enabled?.value ?? true);

    const isCheckInDisabled =
        currentStatus !== 'not_checked_in' ||
        isLoadingApi ||
        !selectedClass ||
        selectedClass.is_completed ||
        selectedClass.is_missed ||
        selectedClass.attendance_status?.status === 'absent' ||
        selectedClass.can_take_attendance === false ||
        !timeValidation.canCheckInNow ||
        (!selectedClass.attendance_status && (selectedClass.timing?.is_after_checkout_grace ?? false));

    const isCheckOutDisabled =
        currentStatus !== 'checked_in' ||
        isLoadingApi ||
        !isSelectedClassCheckedIn ||
        selectedClass?.is_completed ||
        selectedClass?.is_missed ||
        selectedClass?.can_take_attendance === false;

    const getCheckInButtonText = () => {
        if (isLoadingApi && currentStatus === 'not_checked_in') return 'Processing...';
        if (selectedClass?.is_missed || selectedClass?.attendance_status?.status === 'absent') return 'Missed';
        if (
            !selectedClass?.attendance_status &&
            (selectedClass?.timing?.is_after_checkout_grace || timeValidation.isAfterCheckoutDeadline)
        ) {
            return 'Missed';
        }
        if (selectedClass?.can_take_attendance === false) return 'Rescheduled';
        if (selectedClass?.is_completed) return 'Completed';
        if (!timeValidation.canCheckInNow) return 'Check-In Not Open';
        return 'Check In';
    };

    const getCheckOutButtonText = () => {
        if (isLoadingApi && currentStatus === 'checked_in') return 'Processing...';
        if (selectedClass?.is_missed) return 'Missed';
        if (selectedClass?.can_take_attendance === false) return 'Rescheduled';
        if (selectedClass?.is_completed) return 'Completed';
        if (timeValidation.isAfterCheckoutDeadline) return 'Check Out (Overtime)';
        if (!timeValidation.isAfterEnd) return 'Check Out (Early Leave)';
        return 'Check Out';
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
                                {selectedClass && checkedInClass.timetable_id !== selectedClass.timetable_id && (
                                    <p className="text-sm text-amber-600">Select this class above to check out</p>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                        <div className="space-y-6 lg:col-span-7">
                            {selectedClass?.is_missed && (
                                <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
                                    <div className="flex items-start gap-2">
                                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
                                        <div>
                                            <p className="font-semibold">Session Missed</p>
                                            <p className="mt-1">
                                                {selectedClass.attendance_blocked_message ||
                                                    'This session was marked as missed. Attendance is no longer available.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedClass?.reschedule &&
                                (selectedClass.attendance_state === 'rescheduled_away' ||
                                    selectedClass.attendance_state === 'rescheduled_active') && (
                                    <RescheduleSessionBanner
                                        reschedule={selectedClass.reschedule}
                                        variant={selectedClass.attendance_state === 'rescheduled_away' ? 'away' : 'active'}
                                        showBlockedMessage={selectedClass.can_take_attendance === false}
                                    />
                                )}

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
                                                const isSelected = selectedClass?.timetable_id === c.timetable_id;
                                                const isCheckedIn = checkedInClass?.timetable_id === c.timetable_id && currentStatus === 'checked_in';
                                                const isCompleted = c.is_completed;
                                                const isRescheduledAway = c.attendance_state === 'rescheduled_away';
                                                const isRescheduledActive = c.attendance_state === 'rescheduled_active';
                                                const isMissed = c.is_missed || c.attendance_status?.status === 'absent';
                                                const hasAttendance = c.attendance_taken;
                                                const isOtherCheckedIn =
                                                    checkedInClass && checkedInClass.timetable_id !== c.timetable_id && currentStatus === 'checked_in';
                                                const isClassBeforeStart = isBeforeAllowedCheckIn(c.start_time, teacherEarlyCheckInMinutes);
                                                const classHasEnded = isClassEnded(c.end_time);
                                                const isClassActiveNow = isClassActive(c.start_time, c.end_time);
                                                const isAfterCheckoutDeadlineNow = isAfterCheckoutDeadline(c.end_time, checkoutGracePeriodMinutes);
                                                const checkoutAllowed = isCheckoutAllowed(c.end_time, checkoutGracePeriodMinutes);

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
                                                } else if (isRescheduledAway) {
                                                    bgColor = 'bg-amber-50';
                                                    borderColor = 'border-amber-300';
                                                    textColor = 'text-amber-900';
                                                    cursorStyle = 'cursor-not-allowed';
                                                    hoverStyle = '';
                                                } else if (isMissed) {
                                                    bgColor = 'bg-red-50';
                                                    borderColor = 'border-red-300';
                                                    textColor = 'text-red-900';
                                                    cursorStyle = 'cursor-not-allowed';
                                                    hoverStyle = '';
                                                } else if (isRescheduledActive) {
                                                    bgColor = isSelected ? 'bg-sky-50' : 'bg-sky-50/70';
                                                    borderColor = isSelected ? 'border-sky-500' : 'border-sky-300';
                                                    textColor = 'text-sky-900';
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
                                                        key={c.timetable_id}
                                                        onClick={() => handleClassSelect(c.timetable_id.toString())}
                                                        disabled={
                                                            isCompleted ||
                                                            isOtherCheckedIn ||
                                                            isAfterCheckoutDeadlineNow ||
                                                            isRescheduledAway ||
                                                            isMissed
                                                        }
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
                                                                {isRescheduledAway && (
                                                                    <div className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5">
                                                                        <AlertTriangle size={12} className="text-amber-700" />
                                                                        <span className="text-[10px] font-bold text-amber-800">RESCHEDULED</span>
                                                                    </div>
                                                                )}
                                                                {isMissed && (
                                                                    <div className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5">
                                                                        <XCircle size={12} className="text-red-700" />
                                                                        <span className="text-[10px] font-bold text-red-800">MISSED</span>
                                                                    </div>
                                                                )}
                                                                {isRescheduledActive && (
                                                                    <div
                                                                        className="flex max-w-[140px] items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5"
                                                                        title={c.reschedule?.rescheduled_from_badge}
                                                                    >
                                                                        <CalendarClock size={12} className="text-sky-700" />
                                                                        <span className="truncate text-[10px] font-bold text-sky-800">
                                                                            RESCHEDULED
                                                                        </span>
                                                                    </div>
                                                                )}
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
                                                                    !isClassBeforeStart &&
                                                                    !isRescheduledAway &&
                                                                    !isMissed &&
                                                                    c.can_take_attendance !== false && <CheckCircle size={14} className="text-green-600" />}
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

                                                        {c.reschedule && (isRescheduledAway || isRescheduledActive) && (
                                                            <div className="mt-2">
                                                                <RescheduleSessionBanner
                                                                    reschedule={c.reschedule}
                                                                    variant={isRescheduledAway ? 'away' : 'active'}
                                                                    compact
                                                                    showBlockedMessage={isRescheduledAway}
                                                                />
                                                            </div>
                                                        )}

                                                        {isMissed && (
                                                            <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800">
                                                                This session was marked as missed. Attendance is no longer available.
                                                            </div>
                                                        )}

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
                                                            !isClassBeforeStart &&
                                                            !isRescheduledAway &&
                                                            !isMissed &&
                                                            c.can_take_attendance !== false && (
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
                                            {!timeValidation.canCheckInNow && selectedClass.can_take_attendance !== false && (
                                                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                                                    <div className="flex items-center gap-2">
                                                        <Clock size={16} className="text-blue-600" />
                                                        <div>
                                                            <p className="text-sm font-medium text-blue-700">
                                                                {selectedClass.timing?.attendance_opens_message ||
                                                                    `Attendance opens at ${selectedClass.timing?.allowed_check_in_time_display || to12Hour(selectedClass.start_time)}`}
                                                            </p>
                                                            <p className="text-xs text-blue-600">
                                                                Class starts at {selectedClass.timing?.scheduled_start_time_display || to12Hour(selectedClass.start_time)} • Early window: {teacherEarlyCheckInMinutes} minutes
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {timeValidation.canCheckInNow && !timeValidation.isAfterEnd && (
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

                                            {currentStatus === 'checked_in' && isSelectedClassCheckedIn && !timeValidation.isAfterEnd && (
                                                <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
                                                    <div className="flex items-center gap-2">
                                                        <CheckCircle size={16} className="text-sky-600" />
                                                        <div>
                                                            <p className="text-sm font-medium text-sky-700">You can check out anytime</p>
                                                            <p className="text-xs text-sky-600">
                                                                Class ends at {selectedClass.timing?.scheduled_end_time_display || to12Hour(selectedClass.end_time)}. Early departure will be recorded as early leave.
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
                                                                Class ended at {selectedClass.timing?.scheduled_end_time_display || to12Hour(selectedClass.end_time)} • Grace period: {checkoutGracePeriodMinutes} minutes
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {timeValidation.isAfterCheckoutDeadline && (
                                                <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                                                    <div className="flex items-center gap-2">
                                                        <Clock size={16} className="text-orange-600" />
                                                        <div>
                                                            <p className="text-sm font-medium text-orange-700">Check-out will be recorded as overtime</p>
                                                            <p className="text-xs text-orange-600">
                                                                Grace period ended at {selectedClass.timing?.checkout_grace_deadline_display || 'the configured deadline'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    <button
                                        onClick={getCurrentLocation}
                                        disabled={
                                            isLoadingLocation ||
                                            facialRecognitionEnabled ||
                                            selectedClass?.can_take_attendance === false
                                        }
                                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50"
                                    >
                                        {isLoadingLocation ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                                        {facialRecognitionEnabled ? 'Location Captured After Face Verification' : 'Refresh My Location'}
                                    </button>

                                    {locationError && (
                                        <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600">{locationError}</div>
                                    )}

                                    {distance !== null &&
                                        selectedClass &&
                                        !selectedClass.is_completed &&
                                        selectedClass.can_take_attendance !== false && (
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
            <FaceCaptureModal
                open={faceModalOpen}
                onOpenChange={setFaceModalOpen}
                title="Facial Verification Required"
                description="Please verify your identity with a live face capture before attendance is submitted."
                captureLabel="Verify Face"
                onCapture={handleFaceVerified}
            />
        </AppLayout>
    );
}
