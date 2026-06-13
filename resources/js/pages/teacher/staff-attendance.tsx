import AppLayout from '@/layouts/app-layout';
import FaceCaptureModal from '@/components/face/FaceCaptureModal';
import { type FaceCaptureResult } from '@/lib/face-recognition';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { Circle, GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import { CalendarCheck, CheckCircle, Loader2, MapPin, RefreshCw, ShieldCheck, UserCheck, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/teacher/dashboard',
    },
    {
        title: 'Staff Attendance',
        href: '/teacher/staff-attendance',
    },
];

const containerStyle = {
    width: '100%',
    height: '360px',
};

interface StaffMember {
    name: string;
    email: string;
    staff_type: string;
    faculty?: string | null;
    department?: string | null;
}

interface ScheduleTiming {
    early_checkin_minutes: number;
    checkout_grace_period_minutes: number;
    scheduled_start_time?: string | null;
    scheduled_start_time_display?: string | null;
    allowed_check_in_time?: string | null;
    allowed_check_in_time_display?: string | null;
    can_check_in_now: boolean;
    minutes_until_check_in_opens?: number | null;
    attendance_opens_message?: string | null;
    scheduled_end_time?: string | null;
    scheduled_end_time_display?: string | null;
    checkout_grace_deadline?: string | null;
    checkout_grace_deadline_display?: string | null;
    can_check_out_now?: boolean;
    is_within_checkout_grace?: boolean;
    is_after_checkout_grace?: boolean;
    checkout_opens_message?: string | null;
    checkout_grace_message?: string | null;
}

interface StaffSchedule {
    id: number;
    classroom: string | null;
    day: string;
    start_time: string;
    end_time: string;
    coordinates: {
        lat: number | null;
        lng: number | null;
    };
    radius: number;
    attendance_taken: boolean;
    attendance_status?: {
        id: number;
        check_in_time: string;
        check_out_time: string | null;
        status: 'checked_in' | 'completed';
        attendance_status: string;
        arrival_category?: string | null;
        minutes_early?: number | null;
        minutes_late?: number | null;
        location_match: boolean;
    } | null;
    is_completed: boolean;
    timing?: ScheduleTiming;
}

interface ApiResponse {
    success: boolean;
    message: string;
    data?: StaffSchedule[];
    attendance_id?: number;
    verification_token?: string | null;
}

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;

    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const createUserLocationIcon = () => ({
    path: 0,
    scale: 7,
    fillColor: '#3b82f6',
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
});

const csrfToken = () => (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';

async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
        ...options,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrfToken(),
            ...(options.headers || {}),
        },
    });

    const payload = await response.json();
    if (!response.ok) {
        throw new Error(payload.message || 'Request failed. Please try again.');
    }

    return payload;
}

export default function StaffAttendancePage({
    staffMember,
    assignedSchedules = [],
    todaySchedules = [],
    upcomingSchedules = [],
}: {
    staffMember: StaffMember;
    assignedSchedules?: StaffSchedule[];
    todaySchedules?: StaffSchedule[];
    upcomingSchedules?: StaffSchedule[];
}) {
    const { system_settings: systemSettings } = usePage().props as any;
    const [todaySchedulesState, setTodaySchedulesState] = useState<StaffSchedule[]>(todaySchedules);
    const [selectedSchedule, setSelectedSchedule] = useState<StaffSchedule | null>(todaySchedules[0] || null);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
    const [distance, setDistance] = useState<number | null>(null);
    const [isWithinRange, setIsWithinRange] = useState(false);
    const [isLoadingLocation, setIsLoadingLocation] = useState(false);
    const [isLoadingApi, setIsLoadingApi] = useState(false);
    const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [faceModalOpen, setFaceModalOpen] = useState(false);
    const [pendingAttendanceAction, setPendingAttendanceAction] = useState<'check-in' | 'check-out' | null>(null);

    const gpsEnforcementEnabled = Boolean(systemSettings?.attendance?.gps_enforcement_enabled?.value ?? true);
    const facialRecognitionEnabled = Boolean(systemSettings?.attendance?.facial_recognition_enabled?.value ?? false);
    const earlyCheckInMinutes = Number(systemSettings?.attendance?.administrator_early_checkin_minutes?.value ?? 30);
    const checkoutGracePeriodMinutes = Number(systemSettings?.attendance?.checkout_grace_period_minutes?.value ?? 30);
    const defaultLat = Number(systemSettings?.map?.default_campus_lat?.value ?? import.meta.env.VITE_DEFAULT_CAMPUS_LAT ?? 40.7128);
    const defaultLng = Number(systemSettings?.map?.default_campus_lng?.value ?? import.meta.env.VITE_DEFAULT_CAMPUS_LNG ?? -74.006);
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
    const activeSchedule = useMemo(
        () => todaySchedulesState.find((schedule) => schedule.attendance_status?.status === 'checked_in') || null,
        [todaySchedulesState],
    );
    const selectedTiming = selectedSchedule?.timing;
    const canCheckInNow = Boolean(selectedTiming?.can_check_in_now);
    const checkInBlockedReason = selectedSchedule && !selectedSchedule.is_completed && !activeSchedule && !canCheckInNow
        ? selectedTiming?.attendance_opens_message || `Attendance opens at ${selectedTiming?.allowed_check_in_time_display || 'your allowed time'}.`
        : null;
    const currentArrivalStatus = useMemo(() => {
        if (!selectedSchedule) {
            return null;
        }

        if (selectedSchedule.attendance_status?.arrival_category === 'early') {
            return `Checked in ${selectedSchedule.attendance_status.minutes_early ?? 0} minute(s) early`;
        }

        if (selectedSchedule.attendance_status?.arrival_category === 'late') {
            return `Checked in ${selectedSchedule.attendance_status.minutes_late ?? 0} minute(s) late`;
        }

        if (selectedSchedule.attendance_status?.arrival_category === 'on_time') {
            return 'Checked in on time';
        }

        if (canCheckInNow && selectedTiming?.scheduled_start_time_display) {
            const now = new Date();
            const [hours, minutes] = (selectedTiming.scheduled_start_time || selectedSchedule.start_time).split(':').map(Number);
            const scheduledStart = new Date(now);
            scheduledStart.setHours(hours, minutes, 0, 0);
            const minutesUntilStart = Math.max(0, Math.round((scheduledStart.getTime() - now.getTime()) / 60000));

            if (minutesUntilStart > 0) {
                return `You are checking in ${minutesUntilStart} minute(s) early`;
            }

            return 'You can check in now';
        }

        return checkInBlockedReason;
    }, [selectedSchedule, canCheckInNow, selectedTiming, checkInBlockedReason]);

    const canVerifyLocation =
        selectedSchedule?.coordinates?.lat !== null &&
        selectedSchedule?.coordinates?.lat !== undefined &&
        selectedSchedule?.coordinates?.lng !== null &&
        selectedSchedule?.coordinates?.lng !== undefined &&
        Number(selectedSchedule.radius) > 0;
    const selectedScheduleLocation = canVerifyLocation
        ? {
              lat: Number(selectedSchedule?.coordinates.lat),
              lng: Number(selectedSchedule?.coordinates.lng),
          }
        : null;
    const mapCenter = userLocation
        ? { lat: userLocation.lat, lng: userLocation.lng }
        : selectedScheduleLocation || { lat: defaultLat, lng: defaultLng };

    const fetchTodaySchedules = async (clearCurrentMessage = true) => {
        setIsLoadingSchedules(true);
        if (clearCurrentMessage) {
            setMessage(null);
        }
        try {
            const response = await requestJson<ApiResponse>('/teacher/staff-attendance/todays-schedules');
            const schedules = response.data || [];
            setTodaySchedulesState(schedules);
            const checkedIn = schedules.find((schedule) => schedule.attendance_status?.status === 'checked_in');
            setSelectedSchedule(checkedIn || schedules.find((schedule) => !schedule.is_completed) || schedules[0] || null);
        } catch (error) {
            setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load today schedules.' });
        } finally {
            setIsLoadingSchedules(false);
        }
    };

    const requestCurrentLocation = (): Promise<{ lat: number; lng: number; accuracy: number }> => {
        if (!navigator.geolocation) {
            const message = 'Geolocation is not supported by your browser.';
            setMessage({ type: 'error', text: message });
            return Promise.reject(new Error(message));
        }

        setIsLoadingLocation(true);
        setMessage(null);
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const location = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                    };
                    setUserLocation(location);
                    setIsLoadingLocation(false);
                    resolve(location);
                },
                (error) => {
                    const errorMessage =
                        error.code === error.PERMISSION_DENIED
                            ? 'Location permission denied. Please enable location access.'
                            : error.code === error.POSITION_UNAVAILABLE
                              ? 'Location information unavailable.'
                              : error.code === error.TIMEOUT
                                ? 'Location request timed out.'
                                : 'Unable to retrieve your location.';

                    setMessage({ type: 'error', text: errorMessage });
                    setIsLoadingLocation(false);
                    reject(new Error(errorMessage));
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
            );
        });
    };

    const getCurrentLocation = () => {
        requestCurrentLocation().catch(() => undefined);
    };

    useEffect(() => {
        fetchTodaySchedules();
    }, []);

    useEffect(() => {
        const interval = window.setInterval(() => {
            fetchTodaySchedules(false);
        }, 60000);

        return () => window.clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!message) {
            return;
        }

        const options = {
            position: 'top-right' as const,
            theme: 'dark' as const,
            autoClose: 5000,
        };

        if (message.type === 'success') {
            toast.success(message.text, options);
        } else {
            toast.error(message.text, options);
        }
    }, [message?.type, message?.text]);

    useEffect(() => {
        if (!userLocation || !selectedSchedule || !canVerifyLocation) {
            setDistance(null);
            setIsWithinRange(false);
            return;
        }

        const nextDistance = calculateDistance(
            userLocation.lat,
            userLocation.lng,
            Number(selectedSchedule.coordinates.lat),
            Number(selectedSchedule.coordinates.lng),
        );
        setDistance(nextDistance);
        setIsWithinRange(nextDistance <= Number(selectedSchedule.radius));
    }, [userLocation, selectedSchedule, canVerifyLocation]);

    const submitCheckIn = async (checkInData: Record<string, any>) => {
        const response = await requestJson<ApiResponse>('/teacher/staff-attendance/check-in', {
            method: 'POST',
            body: JSON.stringify(checkInData),
        });

        setMessage({ type: 'success', text: response.message || 'Staff check-in successful.' });
        await fetchTodaySchedules(false);
    };

    const submitCheckOut = async (checkOutData: Record<string, any>) => {
        const response = await requestJson<ApiResponse>('/teacher/staff-attendance/check-out', {
            method: 'POST',
            body: JSON.stringify(checkOutData),
        });

        setMessage({ type: 'success', text: response.message || 'Staff check-out successful.' });
        await fetchTodaySchedules(false);
    };

    const getVerifiedLocationPayload = async (schedule: StaffSchedule) => {
        const location = await requestCurrentLocation();
        const scheduleCanVerifyLocation =
            schedule.coordinates?.lat !== null &&
            schedule.coordinates?.lat !== undefined &&
            schedule.coordinates?.lng !== null &&
            schedule.coordinates?.lng !== undefined &&
            Number(schedule.radius) > 0;

        if (!scheduleCanVerifyLocation) {
            if (gpsEnforcementEnabled) {
                throw new Error('Cannot continue: no valid class room location is configured for this work period.');
            }

            return {
                coordinates: {
                    latitude: location.lat,
                    longitude: location.lng,
                    accuracy: location.accuracy,
                },
                distance: 0,
                within_range: true,
            };
        }

        const nextDistance = calculateDistance(
            location.lat,
            location.lng,
            Number(schedule.coordinates.lat),
            Number(schedule.coordinates.lng),
        );
        const nextWithinRange = nextDistance <= Number(schedule.radius);

        setDistance(nextDistance);
        setIsWithinRange(nextWithinRange);

        if (gpsEnforcementEnabled && !nextWithinRange) {
            throw new Error('Cannot continue: your current location is outside the allowed class room range.');
        }

        return {
            coordinates: {
                latitude: location.lat,
                longitude: location.lng,
                accuracy: location.accuracy,
            },
            distance: nextDistance,
            within_range: nextWithinRange,
        };
    };

    const handleCheckIn = async () => {
        if (!selectedSchedule) {
            setMessage({ type: 'error', text: 'Please select a work period first.' });
            return;
        }

        setIsLoadingApi(true);
        setMessage(null);
        try {
            if (facialRecognitionEnabled) {
                setPendingAttendanceAction('check-in');
                setFaceModalOpen(true);
            } else {
                const locationPayload = await getVerifiedLocationPayload(selectedSchedule);
                const checkInData = {
                    timetable_id: selectedSchedule.id,
                    check_in_time: new Date().toISOString(),
                    ...locationPayload,
                };
                await submitCheckIn(checkInData);
            }
        } catch (error) {
            setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to check in.' });
        } finally {
            setIsLoadingApi(false);
        }
    };

    const handleFaceVerified = async (result: FaceCaptureResult) => {
        if (!pendingAttendanceAction || !selectedSchedule) {
            setMessage({ type: 'error', text: 'No pending staff attendance request found.' });
            return;
        }

        setIsLoadingApi(true);
        setMessage(null);
        try {
            const verification = await requestJson<ApiResponse>('/teacher/staff-attendance/verify-face', {
                method: 'POST',
                body: JSON.stringify({
                    timetable_id: selectedSchedule.id,
                    face_descriptor: result.descriptor,
                    quality: result.quality,
                }),
            });

            if (!verification.success || !verification.verification_token) {
                throw new Error(verification.message || 'Face verification failed.');
            }

            const locationPayload = await getVerifiedLocationPayload(selectedSchedule);

            if (pendingAttendanceAction === 'check-in') {
                await submitCheckIn({
                    timetable_id: selectedSchedule.id,
                    check_in_time: new Date().toISOString(),
                    ...locationPayload,
                    face_verification_token: verification.verification_token,
                });
            } else {
                if (!activeSchedule?.attendance_status?.id) {
                    throw new Error('No active staff check-in found.');
                }

                await submitCheckOut({
                    attendance_id: activeSchedule.attendance_status.id,
                    check_out_time: new Date().toISOString(),
                    ...locationPayload,
                    face_verification_token: verification.verification_token,
                });
            }

            setPendingAttendanceAction(null);
            setFaceModalOpen(false);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Face verification failed. Please try again.';
            setMessage({ type: 'error', text: errorMessage });
            throw new Error(errorMessage);
        } finally {
            setIsLoadingApi(false);
        }
    };

    const handleCheckOut = async () => {
        if (!activeSchedule?.attendance_status?.id) {
            setMessage({ type: 'error', text: 'No active staff check-in found.' });
            return;
        }

        if (selectedSchedule?.id !== activeSchedule.id) {
            setSelectedSchedule(activeSchedule);
            setMessage({ type: 'error', text: 'Please keep the active checked-in schedule selected before checking out.' });
            return;
        }

        setIsLoadingApi(true);
        setMessage(null);
        try {
            if (facialRecognitionEnabled) {
                setPendingAttendanceAction('check-out');
                setFaceModalOpen(true);
            } else {
                const locationPayload = await getVerifiedLocationPayload(activeSchedule);
                await submitCheckOut({
                    attendance_id: activeSchedule.attendance_status.id,
                    check_out_time: new Date().toISOString(),
                    ...locationPayload,
                });
            }
        } catch (error) {
            setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to check out.' });
        } finally {
            setIsLoadingApi(false);
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Staff Attendance" />

            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-4 md:p-6">
                <div className="rounded-2xl border border-sidebar-border/70 bg-white p-6 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1 text-sm font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                <ShieldCheck className="h-4 w-4" />
                                Administrative Staff
                            </div>
                            <h1 className="text-2xl font-bold text-sidebar-foreground dark:text-sidebar-foreground">Staff Attendance</h1>
                            <p className="mt-2 max-w-2xl text-sm text-sidebar-foreground/70 dark:text-sidebar-foreground/70">
                                This area is reserved for administrator staff attendance. Lecturer class attendance features are hidden for your staff type.
                            </p>
                        </div>
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                            <UserCheck className="h-7 w-7" />
                        </div>
                    </div>
                </div>

                {message && (
                    <div
                        className={`rounded-xl border p-4 text-sm ${
                            message.type === 'success'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-red-200 bg-red-50 text-red-700'
                        }`}
                    >
                        {message.text}
                    </div>
                )}

                <div className="grid gap-6 lg:grid-cols-3">
                    <div className="rounded-xl border border-sidebar-border/70 bg-white p-5 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent lg:col-span-2">
                        <h2 className="mb-4 text-lg font-semibold text-sidebar-foreground dark:text-sidebar-foreground">Staff Profile</h2>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <InfoItem label="Name" value={staffMember.name} />
                            <InfoItem label="Email" value={staffMember.email} />
                            <InfoItem label="Staff Type" value={formatStaffType(staffMember.staff_type)} />
                            <InfoItem label="Faculty" value={staffMember.faculty || 'Not assigned'} />
                            <InfoItem label="Department" value={staffMember.department || 'Not assigned'} />
                        </div>
                    </div>

                    <div className="rounded-xl border border-sidebar-border/70 bg-white p-5 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                <CalendarCheck className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-sidebar-foreground dark:text-sidebar-foreground">Today</h2>
                                <p className="text-sm text-sidebar-foreground/60 dark:text-sidebar-foreground/60">{todaySchedulesState.length} work period(s)</p>
                            </div>
                        </div>
                        <ScheduleList
                            schedules={todaySchedulesState}
                            emptyText={isLoadingSchedules ? 'Loading today schedules...' : 'No work periods scheduled for today.'}
                            selectedScheduleId={selectedSchedule?.id}
                            onSelect={setSelectedSchedule}
                        />
                    </div>
                </div>

                <div className="rounded-xl border border-sidebar-border/70 bg-white p-5 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-sidebar-foreground dark:text-sidebar-foreground">Mark Staff Attendance</h2>
                            <p className="mt-1 text-sm text-sidebar-foreground/60 dark:text-sidebar-foreground/60">
                                Uses your current GPS location and the selected schedule&apos;s assigned class room geofence.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={getCurrentLocation}
                            disabled={isLoadingLocation || facialRecognitionEnabled}
                            className="inline-flex items-center justify-center rounded-lg border border-sidebar-border px-4 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent disabled:opacity-60"
                        >
                            {isLoadingLocation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            {facialRecognitionEnabled ? 'Location Captured After Face Verification' : 'Refresh Location'}
                        </button>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <LocationStatus
                            label="Scheduled Start Time"
                            value={selectedTiming?.scheduled_start_time_display || (selectedSchedule ? formatTime(selectedSchedule.start_time) : 'None')}
                        />
                        <LocationStatus
                            label="Allowed Check-In Time"
                            value={selectedTiming?.allowed_check_in_time_display || 'Not available'}
                        />
                        <LocationStatus label="Early Check-In Window" value={`${earlyCheckInMinutes} minute(s) before start`} />
                        <LocationStatus
                            label="Scheduled End Time"
                            value={selectedTiming?.scheduled_end_time_display || (selectedSchedule ? formatTime(selectedSchedule.end_time) : 'None')}
                        />
                        <LocationStatus
                            label="Check-Out Grace Period"
                            value={`${checkoutGracePeriodMinutes} minute(s) after end`}
                        />
                        <LocationStatus
                            label="Grace Deadline"
                            value={selectedTiming?.checkout_grace_deadline_display || 'Not available'}
                        />
                        <LocationStatus
                            label="Attendance Status"
                            value={currentArrivalStatus || 'Select a work period'}
                            ok={canCheckInNow || !!selectedSchedule?.attendance_status}
                        />
                    </div>

                    {selectedTiming?.checkout_grace_message && activeSchedule && (
                        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                            {selectedTiming.checkout_grace_message}
                        </div>
                    )}

                    {checkInBlockedReason && (
                        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                            {checkInBlockedReason}
                            {selectedTiming?.scheduled_start_time_display && (
                                <span className="block mt-1">
                                    Your shift starts at {selectedTiming.scheduled_start_time_display}.
                                </span>
                            )}
                        </div>
                    )}

                    <div className="mt-5 grid gap-4 md:grid-cols-3">
                        <LocationStatus label="Selected Schedule" value={selectedSchedule ? `${selectedSchedule.classroom || 'Class room'} (${formatTime(selectedSchedule.start_time)} - ${formatTime(selectedSchedule.end_time)})` : 'None'} />
                        <LocationStatus label="Distance" value={distance === null ? 'Unknown' : `${Math.round(distance)}m from class room`} />
                        <LocationStatus
                            label="GPS Status"
                            value={!gpsEnforcementEnabled ? 'GPS enforcement disabled' : isWithinRange ? 'Within allowed range' : 'Outside allowed range'}
                            ok={!gpsEnforcementEnabled || isWithinRange}
                        />
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={handleCheckIn}
                            disabled={isLoadingApi || !!activeSchedule || !selectedSchedule || selectedSchedule.is_completed || !canCheckInNow}
                            className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isLoadingApi ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                            {canCheckInNow ? 'Check In' : 'Check-In Not Open'}
                        </button>
                        <button
                            type="button"
                            onClick={handleCheckOut}
                            disabled={isLoadingApi || !activeSchedule}
                            className="inline-flex items-center rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isLoadingApi ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                            Check Out
                        </button>
                    </div>

                    <div className="mt-6 overflow-hidden rounded-xl border border-sidebar-border/70">
                        {apiKey ? (
                            <LoadScript googleMapsApiKey={apiKey}>
                                <GoogleMap
                                    mapContainerStyle={containerStyle}
                                    center={mapCenter}
                                    zoom={17}
                                    onLoad={() => setIsMapLoaded(true)}
                                    options={{
                                        streetViewControl: false,
                                        mapTypeControl: false,
                                        fullscreenControl: true,
                                    }}
                                >
                                    {isMapLoaded && selectedScheduleLocation && (
                                        <>
                                            <Marker
                                                position={selectedScheduleLocation}
                                                title={selectedSchedule?.classroom || 'Selected class room'}
                                            />
                                            <Circle
                                                center={selectedScheduleLocation}
                                                radius={Number(selectedSchedule?.radius || 0)}
                                                options={{
                                                    fillColor: isWithinRange ? '#10b981' : '#ef4444',
                                                    fillOpacity: 0.15,
                                                    strokeColor: isWithinRange ? '#10b981' : '#ef4444',
                                                    strokeOpacity: 0.8,
                                                    strokeWeight: 2,
                                                }}
                                            />
                                        </>
                                    )}
                                    {isMapLoaded && userLocation && (
                                        <Marker
                                            position={{ lat: userLocation.lat, lng: userLocation.lng }}
                                            title="Your current location"
                                            icon={createUserLocationIcon()}
                                        />
                                    )}
                                </GoogleMap>
                            </LoadScript>
                        ) : (
                            <div className="flex h-[360px] items-center justify-center bg-slate-50 p-6 text-center text-sm text-sidebar-foreground/60">
                                Google Maps API key is not configured. Location verification still works, but the map cannot be displayed.
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    <SchedulePanel title="Upcoming Schedules" schedules={upcomingSchedules} emptyText="No upcoming work periods." />
                    <SchedulePanel title="All Assigned Work Schedules" schedules={assignedSchedules} emptyText="No work schedules have been assigned." />
                </div>
            </div>
            <FaceCaptureModal
                open={faceModalOpen}
                onOpenChange={setFaceModalOpen}
                title="Facial Verification Required"
                description="Geolocation passed. Please verify your identity with a live face capture before staff attendance is submitted."
                captureLabel="Verify Face"
                onCapture={handleFaceVerified}
            />
            <ToastContainer />
        </AppLayout>
    );
}

function LocationStatus({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
    return (
        <div className="rounded-lg border border-sidebar-border/60 p-3 dark:border-sidebar-border">
            <p className="text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/50 dark:text-sidebar-foreground/50">{label}</p>
            <p className={`mt-1 flex items-center gap-2 font-medium ${ok === false ? 'text-red-600' : ok === true ? 'text-emerald-600' : 'text-sidebar-foreground dark:text-sidebar-foreground'}`}>
                {label === 'GPS Status' && <MapPin className="h-4 w-4" />}
                {value}
            </p>
        </div>
    );
}

function InfoItem({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/50 dark:text-sidebar-foreground/50">{label}</p>
            <p className="mt-1 font-medium text-sidebar-foreground dark:text-sidebar-foreground">{value}</p>
        </div>
    );
}

function formatStaffType(staffType: string) {
    return staffType
        .replace('_', ' ')
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function SchedulePanel({ title, schedules, emptyText }: { title: string; schedules: StaffSchedule[]; emptyText: string }) {
    return (
        <div className="rounded-xl border border-sidebar-border/70 bg-white p-5 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
            <h2 className="mb-4 text-lg font-semibold text-sidebar-foreground dark:text-sidebar-foreground">{title}</h2>
            <ScheduleList schedules={schedules} emptyText={emptyText} />
        </div>
    );
}

function ScheduleList({
    schedules,
    emptyText,
    selectedScheduleId,
    onSelect,
}: {
    schedules: StaffSchedule[];
    emptyText: string;
    selectedScheduleId?: number;
    onSelect?: (schedule: StaffSchedule) => void;
}) {
    if (schedules.length === 0) {
        return <p className="text-sm text-sidebar-foreground/60 dark:text-sidebar-foreground/60">{emptyText}</p>;
    }

    return (
        <div className="space-y-3">
            {schedules.map((schedule) => (
                <button
                    type="button"
                    key={schedule.id}
                    onClick={() => onSelect?.(schedule)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors dark:border-sidebar-border ${
                        selectedScheduleId === schedule.id
                            ? 'border-purple-300 bg-purple-50 dark:bg-purple-900/20'
                            : 'border-sidebar-border/60 hover:bg-sidebar-accent/40'
                    }`}
                >
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="font-medium text-sidebar-foreground dark:text-sidebar-foreground">{schedule.day}</p>
                            <p className="text-sm text-sidebar-foreground/60 dark:text-sidebar-foreground/60">{schedule.classroom || 'No class room assigned'}</p>
                            {schedule.attendance_status && (
                                <p className="mt-1 text-xs font-medium text-emerald-600">
                                    In: {formatTime(schedule.attendance_status.check_in_time)} • Out:{' '}
                                    {schedule.attendance_status.check_out_time ? formatTime(schedule.attendance_status.check_out_time) : '--'}
                                    {schedule.attendance_status.arrival_category === 'early' && schedule.attendance_status.minutes_early
                                        ? ` • ${schedule.attendance_status.minutes_early}m early`
                                        : ''}
                                </p>
                            )}
                            {!schedule.attendance_status && schedule.timing?.attendance_opens_message && (
                                <p className="mt-1 text-xs text-amber-600">{schedule.timing.attendance_opens_message}</p>
                            )}
                        </div>
                        <div className="text-right text-sm font-medium text-sidebar-foreground/80 dark:text-sidebar-foreground/80">
                            {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                            {schedule.is_completed && <p className="text-xs text-emerald-600">Completed</p>}
                        </div>
                    </div>
                </button>
            ))}
        </div>
    );
}

function formatTime(time: string) {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
}
