import FaceCaptureModal from '@/components/face/FaceCaptureModal';
import AppLayout from '@/layouts/app-layout';
import { ATTENDANCE_LOCK_MESSAGE } from '@/lib/attendance-lock';
import { type FaceCaptureResult } from '@/lib/face-recognition';
import { formatOutOfRangeAttendanceMessage } from '@/lib/geo';
import { apiJsonRequest, getApiErrorMessage } from '@/lib/http';
import { getBooleanSetting } from '@/lib/system-settings';
import { buildFaceVerificationPayload } from '@/lib/teacher-api';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Circle, GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import { AlertTriangle, CalendarCheck, Clock, Loader2, LogIn, LogOut, MapPin, ShieldCheck, Sparkles, UserMinus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Bounce, toast } from 'react-toastify';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/teacher/dashboard' },
    { title: 'Take Attendance', href: '/teacher/staff-attendance' },
];

const mapContainerStyle = {
    width: '100%',
    height: '280px',
};

interface ScheduleTiming {
    scheduled_start_time_display?: string | null;
    allowed_check_in_time_display?: string | null;
    can_check_in_now: boolean;
    attendance_opens_message?: string | null;
    scheduled_end_time_display?: string | null;
    can_check_out_now?: boolean;
    checkout_opens_message?: string | null;
}

interface VenueAuthorization {
    id: number;
    authorization_type: string;
    authorized_venue?: string | null;
    original_venue?: string | null;
    reason?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    period_label?: string | null;
}

interface StaffSchedule {
    id: number;
    classroom: string | null;
    original_classroom?: string | null;
    day: string;
    start_time: string;
    end_time: string;
    coordinates: {
        lat: number | null;
        lng: number | null;
    };
    radius: number;
    venue_authorization?: VenueAuthorization | null;
    attendance_taken: boolean;
    attendance_status?: {
        id: number;
        check_in_time: string | null;
        check_out_time: string | null;
        status: 'checked_in' | 'completed' | 'absent';
        attendance_status: string;
        arrival_category?: string | null;
        minutes_early?: number | null;
        minutes_late?: number | null;
        location_match: boolean;
        exception_category?: string | null;
        self_reported?: boolean;
    } | null;
    is_completed: boolean;
    is_missed?: boolean;
    can_take_attendance?: boolean;
    can_self_report_absence?: boolean;
    self_reported?: boolean;
    attendance_blocked_message?: string | null;
    attendance_state?: string | null;
    needs_explanation?: boolean;
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

async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
    return apiJsonRequest<T>(url, options);
}

function formatTime(time: string) {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
}

function isScheduleMissed(schedule: StaffSchedule | null): boolean {
    return Boolean(
        schedule?.is_missed ||
            schedule?.attendance_state === 'missed' ||
            schedule?.attendance_status?.status === 'absent' ||
            schedule?.can_take_attendance === false,
    );
}

export default function StaffAttendancePage({
    todaySchedules = [],
    facialRecognitionEnabled: facialRecognitionEnabledProp,
}: {
    todaySchedules?: StaffSchedule[];
    facialRecognitionEnabled?: boolean;
}) {
    const { system_settings: systemSettings, flash } = usePage().props as {
        system_settings?: {
            attendance?: {
                gps_enforcement_enabled?: { value?: boolean };
                facial_recognition_enabled?: { value?: boolean };
                administrator_venue_change_requests_enabled?: { value?: boolean };
            };
            map?: {
                default_campus_lat?: { value?: number };
                default_campus_lng?: { value?: number };
            };
        };
        flash?: { success?: string; error?: string };
    };

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success, { theme: 'dark', transition: Bounce });
        }
        if (flash?.error) {
            toast.error(flash.error, { theme: 'dark', transition: Bounce });
        }
    }, [flash?.success, flash?.error]);

    const [todaySchedulesState, setTodaySchedulesState] = useState<StaffSchedule[]>(todaySchedules);
    const [selectedSchedule, setSelectedSchedule] = useState<StaffSchedule | null>(todaySchedules[0] || null);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
    const [distance, setDistance] = useState<number | null>(null);
    const [isWithinRange, setIsWithinRange] = useState(false);
    const [isLoadingApi, setIsLoadingApi] = useState(false);
    const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [faceModalOpen, setFaceModalOpen] = useState(false);
    const [pendingAttendanceAction, setPendingAttendanceAction] = useState<'check-in' | 'check-out' | null>(null);

    const gpsEnforcementEnabled = getBooleanSetting(systemSettings?.attendance, 'gps_enforcement_enabled', true);
    const venueChangeRequestsEnabled = getBooleanSetting(systemSettings?.attendance, 'administrator_venue_change_requests_enabled', true);
    const facialRecognitionEnabled =
        typeof facialRecognitionEnabledProp === 'boolean'
            ? facialRecognitionEnabledProp
            : getBooleanSetting(systemSettings?.attendance, 'facial_recognition_enabled');
    const defaultLat = Number(systemSettings?.map?.default_campus_lat?.value ?? import.meta.env.VITE_DEFAULT_CAMPUS_LAT ?? 40.7128);
    const defaultLng = Number(systemSettings?.map?.default_campus_lng?.value ?? import.meta.env.VITE_DEFAULT_CAMPUS_LNG ?? -74.006);
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

    const activeSchedule = useMemo(
        () => todaySchedulesState.find((schedule) => schedule.attendance_status?.status === 'checked_in') || null,
        [todaySchedulesState],
    );

    const verificationSchedule = pendingAttendanceAction === 'check-out' && activeSchedule ? activeSchedule : selectedSchedule;
    const faceLocationGate =
        verificationSchedule?.coordinates?.lat != null && verificationSchedule?.coordinates?.lng != null && Number(verificationSchedule.radius) > 0
            ? {
                  latitude: Number(verificationSchedule.coordinates.lat),
                  longitude: Number(verificationSchedule.coordinates.lng),
                  radiusMeters: Number(verificationSchedule.radius),
                  venueName: verificationSchedule.classroom || undefined,
              }
            : null;

    const selectedTiming = selectedSchedule?.timing;
    const canCheckInNow = Boolean(selectedTiming?.can_check_in_now);
    const canCheckOutNow = Boolean(selectedTiming?.can_check_out_now);
    const todayLabel = new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });

    const sessionStatus = useMemo(() => {
        if (isScheduleMissed(selectedSchedule)) {
            return {
                label: 'Absent',
                description: selectedSchedule?.attendance_blocked_message || ATTENDANCE_LOCK_MESSAGE,
                tone: 'missed' as const,
            };
        }

        if (activeSchedule) {
            return {
                label: 'You are checked in',
                description: `Started at ${formatTime(activeSchedule.attendance_status?.check_in_time || '')}`,
                tone: 'active' as const,
            };
        }

        if (selectedSchedule?.is_completed) {
            return {
                label: 'Attendance complete',
                description: 'You have finished attendance for this shift today.',
                tone: 'done' as const,
            };
        }

        if (selectedSchedule && !canCheckInNow) {
            return {
                label: 'Not open yet',
                description:
                    selectedTiming?.attendance_opens_message ||
                    `You can check in from ${selectedTiming?.allowed_check_in_time_display || 'your scheduled time'}.`,
                tone: 'waiting' as const,
            };
        }

        return {
            label: 'Ready to check in',
            description: 'Select your shift below, then tap Check In when you arrive.',
            tone: 'ready' as const,
        };
    }, [activeSchedule, selectedSchedule, canCheckInNow, selectedTiming]);

    const canVerifyLocation =
        selectedSchedule?.coordinates?.lat != null && selectedSchedule?.coordinates?.lng != null && Number(selectedSchedule.radius) > 0;

    const selectedScheduleLocation = canVerifyLocation
        ? {
              lat: Number(selectedSchedule?.coordinates.lat),
              lng: Number(selectedSchedule?.coordinates.lng),
          }
        : null;

    const mapCenter = userLocation
        ? { lat: userLocation.lat, lng: userLocation.lng }
        : selectedScheduleLocation || { lat: defaultLat, lng: defaultLng };

    const fetchTodaySchedules = async (clearMessage = true) => {
        setIsLoadingSchedules(true);
        if (clearMessage) {
            setMessage(null);
        }

        try {
            const response = await requestJson<ApiResponse>('/teacher/staff-attendance/todays-schedules');
            const schedules = response.data || [];
            setTodaySchedulesState(schedules);
            setSelectedSchedule((current) => {
                const stillSelected = current ? schedules.find((schedule) => schedule.id === current.id) : undefined;
                if (stillSelected) {
                    return stillSelected;
                }

                const checkedIn = schedules.find((schedule) => schedule.attendance_status?.status === 'checked_in');
                return checkedIn || schedules.find((schedule) => !schedule.is_completed && !isScheduleMissed(schedule)) || schedules[0] || null;
            });
        } catch (error) {
            setMessage({
                type: 'error',
                text: getApiErrorMessage(error, 'Unable to load today’s shifts.'),
            });
        } finally {
            setIsLoadingSchedules(false);
        }
    };

    const requestCurrentLocation = (): Promise<{ lat: number; lng: number; accuracy: number }> => {
        if (!navigator.geolocation) {
            const errorText = 'Location is not available on this device.';
            setMessage({ type: 'error', text: errorText });
            return Promise.reject(new Error(errorText));
        }

        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const location = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                    };
                    setUserLocation(location);
                    resolve(location);
                },
                (error) => {
                    const errorText =
                        error.code === error.PERMISSION_DENIED
                            ? 'Please allow location access in your browser to mark attendance.'
                            : 'We could not find your location. Please try again.';

                    setMessage({ type: 'error', text: errorText });
                    reject(new Error(errorText));
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
            );
        });
    };

    useEffect(() => {
        fetchTodaySchedules();
    }, []);

    useEffect(() => {
        const interval = window.setInterval(() => fetchTodaySchedules(false), 30000);
        return () => window.clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!userLocation || !selectedSchedule || !canVerifyLocation) {
            setDistance(null);
            setIsWithinRange(!gpsEnforcementEnabled);
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
    }, [userLocation, selectedSchedule, canVerifyLocation, gpsEnforcementEnabled]);

    const getVerifiedLocationPayload = async (schedule: StaffSchedule) => {
        const location = await requestCurrentLocation();
        const scheduleCanVerifyLocation = schedule.coordinates?.lat != null && schedule.coordinates?.lng != null && Number(schedule.radius) > 0;

        if (!scheduleCanVerifyLocation) {
            if (gpsEnforcementEnabled) {
                throw new Error('This shift does not have a valid work location set up.');
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

        const nextDistance = calculateDistance(location.lat, location.lng, Number(schedule.coordinates.lat), Number(schedule.coordinates.lng));
        const nextWithinRange = nextDistance <= Number(schedule.radius);

        setDistance(nextDistance);
        setIsWithinRange(nextWithinRange);

        if (gpsEnforcementEnabled && !nextWithinRange) {
            throw new Error(formatOutOfRangeAttendanceMessage(nextDistance, Number(schedule.radius)));
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

    const submitCheckIn = async (checkInData: Record<string, unknown>) => {
        const response = await requestJson<ApiResponse>('/teacher/staff-attendance/check-in', {
            method: 'POST',
            body: JSON.stringify(checkInData),
        });

        setMessage({ type: 'success', text: response.message || 'Check-in recorded successfully.' });
        await fetchTodaySchedules(false);
    };

    const submitCheckOut = async (checkOutData: Record<string, unknown>) => {
        const response = await requestJson<ApiResponse>('/teacher/staff-attendance/check-out', {
            method: 'POST',
            body: JSON.stringify(checkOutData),
        });

        setMessage({ type: 'success', text: response.message || 'Check-out recorded successfully.' });
        await fetchTodaySchedules(false);
    };

    const handleCheckIn = async () => {
        if (!selectedSchedule) {
            setMessage({ type: 'error', text: 'Please choose a shift first.' });
            return;
        }

        if (isScheduleMissed(selectedSchedule)) {
            setMessage({
                type: 'error',
                text: selectedSchedule.attendance_blocked_message || ATTENDANCE_LOCK_MESSAGE,
            });
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
                await submitCheckIn({
                    timetable_id: selectedSchedule.id,
                    check_in_time: new Date().toISOString(),
                    ...locationPayload,
                });
            }
        } catch (error) {
            setMessage({ type: 'error', text: getApiErrorMessage(error, 'Check-in failed.') });
        } finally {
            setIsLoadingApi(false);
        }
    };

    const handleCheckOut = async () => {
        if (!activeSchedule?.attendance_status?.id) {
            setMessage({ type: 'error', text: 'You are not checked in yet.' });
            return;
        }

        if (isScheduleMissed(activeSchedule)) {
            setMessage({
                type: 'error',
                text: activeSchedule.attendance_blocked_message || ATTENDANCE_LOCK_MESSAGE,
            });
            return;
        }

        if (selectedSchedule?.id !== activeSchedule.id) {
            setSelectedSchedule(activeSchedule);
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
            setMessage({ type: 'error', text: getApiErrorMessage(error, 'Check-out failed.') });
        } finally {
            setIsLoadingApi(false);
        }
    };

    const handleFaceVerified = async (result: FaceCaptureResult) => {
        if (!pendingAttendanceAction || !selectedSchedule) {
            setMessage({ type: 'error', text: 'Please try again.' });
            return;
        }

        setIsLoadingApi(true);
        setMessage(null);

        try {
            const verification = await requestJson<ApiResponse>('/teacher/staff-attendance/verify-face', {
                method: 'POST',
                body: JSON.stringify(buildFaceVerificationPayload(selectedSchedule.id, result.descriptor, result.quality)),
            });

            if (!verification.success || !verification.verification_token) {
                throw new Error(verification.message || 'Face verification failed.');
            }

            const scheduleForAction = pendingAttendanceAction === 'check-out' && activeSchedule ? activeSchedule : selectedSchedule;
            const locationPayload = await getVerifiedLocationPayload(scheduleForAction);
            const facePayload = {
                face_descriptor: result.descriptor,
                face_verification_token: verification.verification_token,
            };

            if (pendingAttendanceAction === 'check-in') {
                await submitCheckIn({
                    timetable_id: selectedSchedule.id,
                    check_in_time: new Date().toISOString(),
                    ...locationPayload,
                    ...facePayload,
                });
            } else {
                if (!activeSchedule?.attendance_status?.id) {
                    throw new Error('You are not checked in yet.');
                }

                await submitCheckOut({
                    attendance_id: activeSchedule.attendance_status.id,
                    check_out_time: new Date().toISOString(),
                    ...locationPayload,
                    ...facePayload,
                });
            }

            setPendingAttendanceAction(null);
            setFaceModalOpen(false);
        } catch (error) {
            const errorMessage = getApiErrorMessage(error, 'Face verification failed.');
            setMessage({ type: 'error', text: errorMessage });
            throw new Error(errorMessage);
        } finally {
            setIsLoadingApi(false);
        }
    };

    const showCheckIn = Boolean(
        !activeSchedule && selectedSchedule && !selectedSchedule.is_completed && !isScheduleMissed(selectedSchedule) && canCheckInNow,
    );
    const showCheckOut = !!activeSchedule && !isScheduleMissed(activeSchedule) && canCheckOutNow;
    const showWaitingForCheckout = !!activeSchedule && !isScheduleMissed(activeSchedule) && !canCheckOutNow;
    const hasAttendanceActions = Boolean(
        showCheckIn ||
            showCheckOut ||
            showWaitingForCheckout ||
            selectedSchedule?.can_self_report_absence ||
            selectedSchedule?.self_reported ||
            selectedSchedule?.attendance_status?.self_reported ||
            (selectedSchedule?.is_completed && !activeSchedule) ||
            (isScheduleMissed(selectedSchedule) && !activeSchedule),
    );

    const heroTone = {
        active: 'from-blue-600 via-indigo-600 to-slate-800',
        done: 'from-emerald-600 via-teal-600 to-slate-800',
        missed: 'from-rose-600 via-red-600 to-slate-800',
        waiting: 'from-amber-600 via-orange-600 to-slate-800',
        ready: 'from-violet-600 via-indigo-600 to-slate-800',
    }[sessionStatus.tone];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Take Attendance" />

            <div className="min-h-full bg-gradient-to-b from-violet-50/80 via-slate-50 to-slate-50 dark:from-violet-950/20 dark:via-background dark:to-background">
                <div
                    className={cn(
                        'mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-5 p-3 sm:p-4 md:p-6 lg:p-8 lg:pb-10',
                        hasAttendanceActions ? 'pb-28' : 'pb-6',
                    )}
                >
                    <section className="overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-sm shadow-violet-100/70 dark:border-violet-900/40 dark:bg-card dark:shadow-none">
                        <div className={cn('bg-gradient-to-r px-4 py-5 text-white sm:px-8 sm:py-6', heroTone)}>
                            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                                <div className="min-w-0">
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase ring-1 ring-white/20">
                                        <Sparkles className="size-3.5" />
                                        Take attendance
                                    </span>
                                    <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{sessionStatus.label}</h1>
                                    <p className="mt-2 max-w-2xl text-sm text-white/90">{sessionStatus.description}</p>
                                    <p className="mt-2 text-xs text-white/70">{todayLabel}</p>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[28rem]">
                                    <HeroStat label="Shifts" value={`${todaySchedulesState.length} today`} />
                                    <HeroStat label="Venue" value={selectedSchedule?.classroom || 'Not assigned'} />
                                    <HeroStat
                                        label="Hours"
                                        value={
                                            selectedSchedule
                                                ? `${formatTime(selectedSchedule.start_time)} – ${formatTime(selectedSchedule.end_time)}`
                                                : '—'
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    {message && (
                        <div
                            role="alert"
                            className={cn(
                                'rounded-2xl border px-4 py-3 text-sm',
                                message.type === 'success'
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100'
                                    : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-100',
                            )}
                        >
                            {message.text}
                        </div>
                    )}

                    <div className="grid gap-6 xl:grid-cols-12">
                        <div className="space-y-5 xl:col-span-7">
                            <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6 dark:border-sidebar-border dark:bg-card">
                                <div className="mb-4 flex items-center gap-2">
                                    <span className="flex size-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-200">
                                        <CalendarCheck className="size-5" />
                                    </span>
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900 dark:text-sidebar-foreground">Today&apos;s shift</h2>
                                        <p className="text-sm text-slate-500 dark:text-sidebar-foreground/60">
                                            {todaySchedulesState.length > 1
                                                ? 'Tap the shift you are working now.'
                                                : 'Your assigned work session for today.'}
                                        </p>
                                    </div>
                                </div>

                                {isLoadingSchedules ? (
                                    <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-sm text-slate-500 dark:border-sidebar-border">
                                        <Loader2 className="size-4 animate-spin" />
                                        Loading today&apos;s shift…
                                    </div>
                                ) : todaySchedulesState.length === 0 ? (
                                    <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500 dark:border-sidebar-border dark:text-sidebar-foreground/60">
                                        No shift is scheduled for you today.
                                    </p>
                                ) : todaySchedulesState.length === 1 ? (
                                    <ShiftCard
                                        schedule={todaySchedulesState[0]}
                                        selected
                                        isCheckedIn={activeSchedule?.id === todaySchedulesState[0].id}
                                    />
                                ) : (
                                    <div className="space-y-3">
                                        {todaySchedulesState.map((schedule) => (
                                            <button
                                                key={schedule.id}
                                                type="button"
                                                onClick={() => setSelectedSchedule(schedule)}
                                                disabled={!!activeSchedule && activeSchedule.id !== schedule.id}
                                                className="w-full text-left disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                <ShiftCard
                                                    schedule={schedule}
                                                    selected={selectedSchedule?.id === schedule.id}
                                                    isCheckedIn={activeSchedule?.id === schedule.id}
                                                />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </section>

                            {selectedSchedule?.venue_authorization && (
                                <section className="rounded-3xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-900 sm:px-5 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-100">
                                    <div className="flex items-start gap-3">
                                        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-sky-600" />
                                        <div>
                                            <p className="font-semibold">Authorized venue change</p>
                                            <p className="mt-1">
                                                You may mark attendance at{' '}
                                                <span className="font-medium">
                                                    {selectedSchedule.venue_authorization.authorized_venue || selectedSchedule.classroom}
                                                </span>
                                                {selectedSchedule.original_classroom ? ` instead of ${selectedSchedule.original_classroom}` : ''}
                                                {selectedSchedule.venue_authorization.period_label
                                                    ? ` from ${selectedSchedule.venue_authorization.period_label}`
                                                    : ''}
                                                .
                                            </p>
                                            {selectedSchedule.venue_authorization.reason && (
                                                <p className="mt-1 text-sky-800/80 dark:text-sky-200/80">
                                                    Reason: {selectedSchedule.venue_authorization.reason}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </section>
                            )}

                            {selectedSchedule?.needs_explanation && (
                                <section className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900 sm:px-5 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex items-start gap-3">
                                            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
                                            <div>
                                                <p className="font-semibold">Explanation required</p>
                                                <p className="mt-1">
                                                    This shift was marked absent or as an early departure. Submit a reason before the attendance
                                                    period closes.
                                                </p>
                                            </div>
                                        </div>
                                        <Link
                                            href="/teacher/attendance-explanations"
                                            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-2xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                                        >
                                            Submit explanation
                                        </Link>
                                    </div>
                                </section>
                            )}

                            {venueChangeRequestsEnabled && (
                                <section className="rounded-3xl border border-slate-200/80 bg-white px-4 py-4 text-sm shadow-sm sm:px-5 dark:border-sidebar-border dark:bg-card">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <p className="text-slate-600 dark:text-sidebar-foreground/70">
                                            Need to attend at a different venue? Submit a venue change request for approval.
                                        </p>
                                        <Link
                                            href="/teacher/venue-change-requests"
                                            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-sidebar-border dark:text-sidebar-foreground dark:hover:bg-sidebar-accent"
                                        >
                                            Venue change requests
                                        </Link>
                                    </div>
                                </section>
                            )}

                            {hasAttendanceActions && (
                                <section className="hidden space-y-3 lg:block">
                                    <AttendanceActions
                                        showCheckIn={showCheckIn}
                                        showCheckOut={showCheckOut}
                                        showWaitingForCheckout={showWaitingForCheckout}
                                        isLoadingApi={isLoadingApi}
                                        selectedSchedule={selectedSchedule}
                                        selectedTiming={selectedTiming}
                                        activeSchedule={activeSchedule}
                                        onCheckIn={handleCheckIn}
                                        onCheckOut={handleCheckOut}
                                    />
                                </section>
                            )}
                        </div>

                        <aside className="space-y-5 xl:col-span-5">
                            {selectedSchedule && (
                                <section className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6 xl:sticky xl:top-6 dark:border-sidebar-border dark:bg-card">
                                    <h2 className="text-lg font-semibold text-slate-900 dark:text-sidebar-foreground">Shift details</h2>
                                    <div className="mt-4 grid gap-3">
                                        <DetailItem
                                            icon={Clock}
                                            label="Work hours"
                                            value={`${formatTime(selectedSchedule.start_time)} – ${formatTime(selectedSchedule.end_time)}`}
                                        />
                                        <DetailItem icon={MapPin} label="Work location" value={selectedSchedule.classroom || 'Not assigned'} />
                                        {selectedSchedule.venue_authorization && selectedSchedule.original_classroom && (
                                            <DetailItem icon={MapPin} label="Originally assigned" value={selectedSchedule.original_classroom} />
                                        )}
                                        {gpsEnforcementEnabled && canVerifyLocation && (
                                            <DetailItem
                                                icon={MapPin}
                                                label="Your location"
                                                value={
                                                    distance === null
                                                        ? 'Checked when you tap Check In or Check Out'
                                                        : isWithinRange
                                                          ? `You are at the work location (${Math.round(distance)}m away)`
                                                          : `You are too far away (${Math.round(distance)}m)`
                                                }
                                                highlight={distance !== null ? isWithinRange : undefined}
                                            />
                                        )}
                                    </div>

                                    {apiKey && (
                                        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 dark:border-sidebar-border">
                                            <div className="border-b border-slate-200 px-4 py-3 dark:border-sidebar-border">
                                                <p className="text-sm font-medium text-slate-900 dark:text-sidebar-foreground">Location map</p>
                                                <p className="text-xs text-slate-500 dark:text-sidebar-foreground/60">
                                                    Blue dot = you · Pin = work location
                                                </p>
                                            </div>
                                            <LoadScript googleMapsApiKey={apiKey}>
                                                <GoogleMap
                                                    mapContainerStyle={mapContainerStyle}
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
                                                                title={selectedSchedule.classroom || 'Work location'}
                                                            />
                                                            <Circle
                                                                center={selectedScheduleLocation}
                                                                radius={Number(selectedSchedule.radius || 0)}
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
                                                            title="Your location"
                                                            icon={createUserLocationIcon()}
                                                        />
                                                    )}
                                                </GoogleMap>
                                            </LoadScript>
                                        </div>
                                    )}

                                    <p className="mt-4 text-center text-xs text-slate-500 dark:text-sidebar-foreground/55">
                                        Your location is checked automatically when you check in or check out.
                                        {facialRecognitionEnabled ? ' Face verification may also be required.' : ''}
                                    </p>
                                </section>
                            )}
                        </aside>
                    </div>
                </div>

                {hasAttendanceActions && (
                    <div className="fixed inset-x-0 bottom-0 z-20 max-h-[42vh] overflow-y-auto border-t border-slate-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden dark:border-sidebar-border dark:bg-background/95">
                        <AttendanceActions
                            showCheckIn={showCheckIn}
                            showCheckOut={showCheckOut}
                            showWaitingForCheckout={showWaitingForCheckout}
                            isLoadingApi={isLoadingApi}
                            selectedSchedule={selectedSchedule}
                            selectedTiming={selectedTiming}
                            activeSchedule={activeSchedule}
                            onCheckIn={handleCheckIn}
                            onCheckOut={handleCheckOut}
                        />
                    </div>
                )}
            </div>

            <FaceCaptureModal
                open={faceModalOpen}
                onOpenChange={setFaceModalOpen}
                title="Verify your face"
                description="Look at the camera to confirm it is you before attendance is saved."
                captureLabel="Verify and continue"
                requireLocation={gpsEnforcementEnabled}
                locationGate={faceLocationGate}
                onCapture={handleFaceVerified}
            />
        </AppLayout>
    );
}

function AttendanceActions({
    showCheckIn,
    showCheckOut,
    showWaitingForCheckout,
    isLoadingApi,
    selectedSchedule,
    selectedTiming,
    activeSchedule,
    onCheckIn,
    onCheckOut,
}: {
    showCheckIn: boolean;
    showCheckOut: boolean;
    showWaitingForCheckout: boolean;
    isLoadingApi: boolean;
    selectedSchedule: StaffSchedule | null;
    selectedTiming?: ScheduleTiming;
    activeSchedule: StaffSchedule | null;
    onCheckIn: () => void;
    onCheckOut: () => void;
}) {
    return (
        <div className="space-y-3">
            {showCheckIn && (
                <button
                    type="button"
                    onClick={onCheckIn}
                    disabled={isLoadingApi}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3.5 text-base font-semibold text-white shadow-sm shadow-emerald-600/20 transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isLoadingApi ? <Loader2 className="size-5 animate-spin" /> : <LogIn className="size-5" />}
                    Check In
                </button>
            )}

            {showWaitingForCheckout && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 text-center text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200">
                    {selectedTiming?.checkout_opens_message ||
                        `Check-out opens at ${selectedTiming?.scheduled_end_time_display || formatTime(selectedSchedule?.end_time || '')}.`}
                </div>
            )}

            {showCheckOut && (
                <button
                    type="button"
                    onClick={onCheckOut}
                    disabled={isLoadingApi}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 py-3.5 text-base font-semibold text-white shadow-sm shadow-violet-600/20 transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isLoadingApi ? <Loader2 className="size-5 animate-spin" /> : <LogOut className="size-5" />}
                    Check Out
                </button>
            )}

            {selectedSchedule?.can_self_report_absence && (
                <button
                    type="button"
                    onClick={() => router.visit(route('teacher.staff-attendance.mark-absent.create', selectedSchedule.id))}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 px-6 py-3.5 text-base font-semibold text-white shadow-sm shadow-rose-600/20 transition-colors hover:bg-rose-700"
                >
                    <UserMinus className="size-5" />
                    Mark Absent
                </button>
            )}

            {(selectedSchedule?.self_reported || selectedSchedule?.attendance_status?.self_reported) && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-center text-sm font-medium text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-100">
                    You marked yourself absent for this shift. Check-in and check-out are closed.
                </div>
            )}

            {selectedSchedule?.is_completed && !activeSchedule && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-center text-sm font-medium text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100">
                    Attendance for this shift is complete. Have a great day.
                </div>
            )}

            {isScheduleMissed(selectedSchedule) && !activeSchedule && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-center text-sm font-medium text-red-800 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-100">
                    {selectedSchedule?.attendance_blocked_message || ATTENDANCE_LOCK_MESSAGE}
                </div>
            )}
        </div>
    );
}

function HeroStat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15">
            <p className="text-[11px] font-medium tracking-wide text-white/70 uppercase">{label}</p>
            <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
        </div>
    );
}

function ShiftCard({ schedule, selected, isCheckedIn }: { schedule: StaffSchedule; selected?: boolean; isCheckedIn?: boolean }) {
    return (
        <div
            className={cn(
                'rounded-2xl border p-4 transition-colors',
                selected
                    ? 'border-violet-300 bg-violet-50 ring-2 ring-violet-200 dark:border-violet-700 dark:bg-violet-950/30 dark:ring-violet-900/60'
                    : 'border-slate-200 bg-slate-50 hover:border-violet-200 dark:border-sidebar-border dark:bg-sidebar-accent/50',
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-sidebar-foreground">{schedule.classroom || 'Work location not set'}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-sidebar-foreground/70">
                        {formatTime(schedule.start_time)} – {formatTime(schedule.end_time)}
                    </p>
                    {schedule.venue_authorization && (
                        <p className="mt-1 text-xs font-medium text-sky-700 dark:text-sky-300">Authorized venue change</p>
                    )}
                    {schedule.needs_explanation && <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">Explanation needed</p>}
                </div>
                {isCheckedIn ? (
                    <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-200">
                        Checked in
                    </span>
                ) : isScheduleMissed(schedule) ? (
                    <span className="shrink-0 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-200">
                        Absent
                    </span>
                ) : schedule.is_completed ? (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200">
                        Done
                    </span>
                ) : selected ? (
                    <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-950/50 dark:text-violet-200">
                        Selected
                    </span>
                ) : null}
            </div>
        </div>
    );
}

function DetailItem({ icon: Icon, label, value, highlight }: { icon: typeof Clock; label: string; value: string; highlight?: boolean }) {
    return (
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 dark:border-sidebar-border dark:bg-sidebar-accent/40">
            <div className="flex items-start gap-3">
                <span
                    className={cn(
                        'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl',
                        highlight === true
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40'
                            : highlight === false
                              ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40'
                              : 'bg-white text-slate-500 dark:bg-sidebar-accent dark:text-sidebar-foreground/50',
                    )}
                >
                    <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                    <p className="text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-sidebar-foreground/50">{label}</p>
                    <p
                        className={cn(
                            'mt-1 text-sm font-medium',
                            highlight === true
                                ? 'text-emerald-700 dark:text-emerald-300'
                                : highlight === false
                                  ? 'text-rose-700 dark:text-rose-300'
                                  : 'text-slate-900 dark:text-sidebar-foreground',
                        )}
                    >
                        {value}
                    </p>
                </div>
            </div>
        </div>
    );
}
