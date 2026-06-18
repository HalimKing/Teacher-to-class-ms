import AppLayout from '@/layouts/app-layout';
import FaceCaptureModal from '@/components/face/FaceCaptureModal';
import { buildFaceVerificationPayload } from '@/lib/teacher-api';
import { type FaceCaptureResult } from '@/lib/face-recognition';
import { getBooleanSetting } from '@/lib/system-settings';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { Circle, GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import {
    CalendarCheck,
    CheckCircle,
    Clock,
    Loader2,
    LogIn,
    LogOut,
    MapPin,
    ShieldCheck,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/teacher/dashboard' },
    { title: 'Staff Attendance', href: '/teacher/staff-attendance' },
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
        throw new Error(payload.message || 'Something went wrong. Please try again.');
    }

    return payload;
}

function formatTime(time: string) {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
}

export default function StaffAttendancePage({
    todaySchedules = [],
    facialRecognitionEnabled: facialRecognitionEnabledProp,
}: {
    todaySchedules?: StaffSchedule[];
    facialRecognitionEnabled?: boolean;
}) {
    const { system_settings: systemSettings } = usePage().props as {
        system_settings?: {
            attendance?: {
                gps_enforcement_enabled?: { value?: boolean };
                facial_recognition_enabled?: { value?: boolean };
            };
            map?: {
                default_campus_lat?: { value?: number };
                default_campus_lng?: { value?: number };
            };
        };
    };

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

    const selectedTiming = selectedSchedule?.timing;
    const canCheckInNow = Boolean(selectedTiming?.can_check_in_now);
    const canCheckOutNow = Boolean(selectedTiming?.can_check_out_now);
    const todayLabel = new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });

    const sessionStatus = useMemo(() => {
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
        selectedSchedule?.coordinates?.lat != null &&
        selectedSchedule?.coordinates?.lng != null &&
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

    const fetchTodaySchedules = async (clearMessage = true) => {
        setIsLoadingSchedules(true);
        if (clearMessage) {
            setMessage(null);
        }

        try {
            const response = await requestJson<ApiResponse>('/teacher/staff-attendance/todays-schedules');
            const schedules = response.data || [];
            setTodaySchedulesState(schedules);
            const checkedIn = schedules.find((schedule) => schedule.attendance_status?.status === 'checked_in');
            setSelectedSchedule(checkedIn || schedules.find((schedule) => !schedule.is_completed) || schedules[0] || null);
        } catch (error) {
            setMessage({
                type: 'error',
                text: error instanceof Error ? error.message : 'Unable to load today’s shifts.',
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
        const interval = window.setInterval(() => fetchTodaySchedules(false), 60000);
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
        const scheduleCanVerifyLocation =
            schedule.coordinates?.lat != null &&
            schedule.coordinates?.lng != null &&
            Number(schedule.radius) > 0;

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
            throw new Error('You are too far from your work location. Move closer and try again.');
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
            setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Check-in failed.' });
        } finally {
            setIsLoadingApi(false);
        }
    };

    const handleCheckOut = async () => {
        if (!activeSchedule?.attendance_status?.id) {
            setMessage({ type: 'error', text: 'You are not checked in yet.' });
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
            setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Check-out failed.' });
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
                body: JSON.stringify(
                    buildFaceVerificationPayload(selectedSchedule.id, result.descriptor, result.quality),
                ),
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
            const errorMessage = error instanceof Error ? error.message : 'Face verification failed.';
            setMessage({ type: 'error', text: errorMessage });
            throw new Error(errorMessage);
        } finally {
            setIsLoadingApi(false);
        }
    };

    const showCheckIn =
        !activeSchedule && selectedSchedule && !selectedSchedule.is_completed && canCheckInNow;
    const showCheckOut = !!activeSchedule && canCheckOutNow;
    const showWaitingForCheckout = !!activeSchedule && !canCheckOutNow;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Staff Attendance" />

            <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 md:p-6">
                <header className="space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-sm font-medium text-violet-800 dark:bg-violet-900/30 dark:text-violet-200">
                        <ShieldCheck className="size-4" />
                        Staff Attendance
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-sidebar-foreground md:text-3xl">
                        Mark your attendance
                    </h1>
                    <p className="text-sm text-sidebar-foreground/70">{todayLabel}</p>
                </header>

                {message && (
                    <div
                        role="alert"
                        className={`rounded-xl border px-4 py-3 text-sm ${
                            message.type === 'success'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : 'border-red-200 bg-red-50 text-red-800'
                        }`}
                    >
                        {message.text}
                    </div>
                )}

                <section
                    className={`rounded-2xl border p-5 shadow-sm ${
                        sessionStatus.tone === 'active'
                            ? 'border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/20'
                            : sessionStatus.tone === 'done'
                              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20'
                              : sessionStatus.tone === 'waiting'
                                ? 'border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20'
                                : 'border-sidebar-border/70 bg-white dark:border-sidebar-border dark:bg-sidebar-accent'
                    }`}
                >
                    <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-white/80 p-2.5 shadow-sm dark:bg-sidebar-accent">
                            {sessionStatus.tone === 'done' ? (
                                <CheckCircle className="size-6 text-emerald-600" />
                            ) : sessionStatus.tone === 'active' ? (
                                <LogIn className="size-6 text-blue-600" />
                            ) : (
                                <Clock className="size-6 text-violet-600" />
                            )}
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-sidebar-foreground">{sessionStatus.label}</h2>
                            <p className="mt-1 text-sm text-sidebar-foreground/70">{sessionStatus.description}</p>
                        </div>
                    </div>
                </section>

                <section className="rounded-2xl border border-sidebar-border/70 bg-white p-5 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                    <div className="mb-4 flex items-center gap-2">
                        <CalendarCheck className="size-5 text-violet-600" />
                        <h2 className="text-lg font-semibold text-sidebar-foreground">Today&apos;s shift</h2>
                    </div>

                    {isLoadingSchedules ? (
                        <div className="flex items-center gap-2 py-8 text-sm text-sidebar-foreground/60">
                            <Loader2 className="size-4 animate-spin" />
                            Loading today&apos;s shift...
                        </div>
                    ) : todaySchedulesState.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-sidebar-border/70 px-4 py-8 text-center text-sm text-sidebar-foreground/60">
                            No shift is scheduled for you today.
                        </p>
                    ) : todaySchedulesState.length === 1 ? (
                        <ShiftCard schedule={todaySchedulesState[0]} selected isCheckedIn={activeSchedule?.id === todaySchedulesState[0].id} />
                    ) : (
                        <div className="space-y-3">
                            <p className="text-sm text-sidebar-foreground/60">Tap the shift you are working now.</p>
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

                {selectedSchedule && (
                    <section className="rounded-2xl border border-sidebar-border/70 bg-white p-5 shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                        <h2 className="mb-4 text-lg font-semibold text-sidebar-foreground">Shift details</h2>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <DetailItem
                                icon={Clock}
                                label="Work hours"
                                value={`${formatTime(selectedSchedule.start_time)} – ${formatTime(selectedSchedule.end_time)}`}
                            />
                            <DetailItem
                                icon={MapPin}
                                label="Work location"
                                value={selectedSchedule.classroom || 'Not assigned'}
                            />
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
                    </section>
                )}

                <section className="space-y-3">
                    {showCheckIn && (
                        <button
                            type="button"
                            onClick={handleCheckIn}
                            disabled={isLoadingApi}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-4 text-base font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
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
                            onClick={handleCheckOut}
                            disabled={isLoadingApi}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 py-4 text-base font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isLoadingApi ? <Loader2 className="size-5 animate-spin" /> : <LogOut className="size-5" />}
                            Check Out
                        </button>
                    )}

                    {selectedSchedule?.is_completed && !activeSchedule && (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-center text-sm font-medium text-emerald-800">
                            Attendance for this shift is complete. Have a great day.
                        </div>
                    )}
                </section>

                {selectedSchedule && apiKey && (
                    <section className="overflow-hidden rounded-2xl border border-sidebar-border/70 bg-white shadow-sm dark:border-sidebar-border dark:bg-sidebar-accent">
                        <div className="border-b border-sidebar-border/50 px-4 py-3">
                            <p className="text-sm font-medium text-sidebar-foreground">Location map</p>
                            <p className="text-xs text-sidebar-foreground/60">Blue dot = you · Pin = work location</p>
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
                                        <Marker position={selectedScheduleLocation} title={selectedSchedule.classroom || 'Work location'} />
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
                    </section>
                )}

                <p className="text-center text-xs text-sidebar-foreground/50">
                    Your location is checked automatically when you check in or check out.
                    {facialRecognitionEnabled ? ' Face verification may also be required.' : ''}
                </p>
            </div>

            <FaceCaptureModal
                open={faceModalOpen}
                onOpenChange={setFaceModalOpen}
                title="Verify your face"
                description="Look at the camera to confirm it is you before attendance is saved."
                captureLabel="Verify and continue"
                onCapture={handleFaceVerified}
            />
        </AppLayout>
    );
}

function ShiftCard({
    schedule,
    selected,
    isCheckedIn,
}: {
    schedule: StaffSchedule;
    selected?: boolean;
    isCheckedIn?: boolean;
}) {
    return (
        <div
            className={`rounded-xl border p-4 transition-colors ${
                selected
                    ? 'border-violet-400 bg-violet-50 ring-1 ring-violet-400 dark:border-violet-700 dark:bg-violet-950/20'
                    : 'border-sidebar-border/70 bg-slate-50 dark:border-sidebar-border dark:bg-sidebar-accent/50'
            }`}
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="font-semibold text-sidebar-foreground">{schedule.classroom || 'Work location not set'}</p>
                    <p className="mt-1 text-sm text-sidebar-foreground/70">
                        {formatTime(schedule.start_time)} – {formatTime(schedule.end_time)}
                    </p>
                </div>
                {isCheckedIn ? (
                    <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">Checked in</span>
                ) : schedule.is_completed ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">Done</span>
                ) : selected ? (
                    <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">Selected</span>
                ) : null}
            </div>
        </div>
    );
}

function DetailItem({
    icon: Icon,
    label,
    value,
    highlight,
}: {
    icon: typeof Clock;
    label: string;
    value: string;
    highlight?: boolean;
}) {
    return (
        <div className="rounded-xl border border-sidebar-border/50 bg-slate-50 p-4 dark:border-sidebar-border dark:bg-sidebar-accent/40">
            <div className="flex items-start gap-3">
                <Icon className={`mt-0.5 size-4 shrink-0 ${highlight === true ? 'text-emerald-600' : highlight === false ? 'text-red-600' : 'text-sidebar-foreground/50'}`} />
                <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-sidebar-foreground/50">{label}</p>
                    <p
                        className={`mt-1 text-sm font-medium ${
                            highlight === true ? 'text-emerald-700' : highlight === false ? 'text-red-700' : 'text-sidebar-foreground'
                        }`}
                    >
                        {value}
                    </p>
                </div>
            </div>
        </div>
    );
}
