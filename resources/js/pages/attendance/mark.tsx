import FaceCaptureModal from '@/components/face/FaceCaptureModal';
import { RescheduleSessionBanner, type RescheduleBannerInfo } from '@/components/attendance/RescheduleSessionBanner';
import { buildFaceVerificationPayload } from '@/lib/teacher-api';
import { type FaceCaptureResult } from '@/lib/face-recognition';
import { getBooleanSetting } from '@/lib/system-settings';
import AttendancePortalLayout from '@/layouts/attendance-portal-layout';
import { Head, Link, usePage } from '@inertiajs/react';
import { AlertTriangle, ArrowLeft, Clock, Loader2, LogIn, LogOut, MapPin } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface SessionTiming {
    can_check_in_now?: boolean;
    can_check_out_now?: boolean;
    attendance_opens_message?: string | null;
    checkout_opens_message?: string | null;
    allowed_check_in_time_display?: string | null;
    scheduled_start_time_display?: string | null;
    scheduled_end_time_display?: string | null;
}

interface PortalSession {
    id: number;
    timetable_id: number;
    course_id?: number;
    name?: string;
    code?: string;
    classroom?: string | null;
    building?: string;
    room?: string;
    start_time: string;
    end_time: string;
    coordinates?: { lat: number | null; lng: number | null };
    radius?: number;
    is_completed?: boolean;
    can_take_attendance?: boolean;
    attendance_blocked_message?: string | null;
    attendance_state?: string;
    reschedule?: RescheduleBannerInfo | null;
    attendance_status?: {
        id: number;
        check_in_time: string;
        check_out_time: string | null;
        status: string;
    } | null;
    timing?: SessionTiming;
}

interface ApiResponse {
    success: boolean;
    message: string;
    data?: PortalSession[];
    verification_token?: string | null;
}

interface MarkPageProps {
    staffType: string;
    roleLabel: string;
    facialRecognitionEnabled?: boolean;
}

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

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export default function AttendancePortalMarkPage({
    staffType,
    roleLabel,
    facialRecognitionEnabled: facialRecognitionEnabledProp,
}: MarkPageProps) {
    const isLecturer = staffType === 'lecturer';
    const { system_settings: systemSettings } = usePage().props as {
        system_settings?: {
            attendance?: {
                gps_enforcement_enabled?: { value?: boolean };
                facial_recognition_enabled?: { value?: boolean };
            };
        };
    };

    const gpsEnforcementEnabled = getBooleanSetting(systemSettings?.attendance, 'gps_enforcement_enabled', true);
    const facialRecognitionEnabled =
        typeof facialRecognitionEnabledProp === 'boolean'
            ? facialRecognitionEnabledProp
            : getBooleanSetting(systemSettings?.attendance, 'facial_recognition_enabled');

    const [sessions, setSessions] = useState<PortalSession[]>([]);
    const [selected, setSelected] = useState<PortalSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [faceModalOpen, setFaceModalOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<'check-in' | 'check-out' | null>(null);

    const endpoints = useMemo(
        () =>
            isLecturer
                ? {
                      list: '/teacher/attendance/todays-classes',
                      checkIn: '/teacher/attendance/check-in',
                      checkOut: '/teacher/attendance/check-out',
                      verifyFace: '/teacher/attendance/verify-face',
                  }
                : {
                      list: '/teacher/staff-attendance/todays-schedules',
                      checkIn: '/teacher/staff-attendance/check-in',
                      checkOut: '/teacher/staff-attendance/check-out',
                      verifyFace: '/teacher/staff-attendance/verify-face',
                  },
        [isLecturer],
    );

    const activeSession = useMemo(
        () => sessions.find((session) => session.attendance_status?.status === 'checked_in') || null,
        [sessions],
    );

    const normalizeSessions = (items: PortalSession[]): PortalSession[] =>
        items.map((item) => {
            if (isLecturer) {
                return {
                    ...item,
                    timetable_id: item.timetable_id ?? item.id,
                    course_id: item.id,
                    name: item.name ?? item.classroom ?? 'Class',
                };
            }

            return {
                ...item,
                timetable_id: item.id,
                name: item.classroom ?? 'Shift',
            };
        });

    const sessionKey = (session: PortalSession) => session.timetable_id;

    const loadSessions = async () => {
        setLoading(true);
        try {
            const response = await requestJson<ApiResponse>(endpoints.list);
            const normalized = normalizeSessions(response.data || []);
            setSessions(normalized);
            const checkedIn = normalized.find((session) => session.attendance_status?.status === 'checked_in');
            setSelected(checkedIn || normalized.find((session) => !session.is_completed) || normalized[0] || null);
        } catch (error) {
            setMessage({
                type: 'error',
                text: error instanceof Error ? error.message : 'Unable to load today’s sessions.',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSessions();
    }, [endpoints.list]);

    const getLocationPayload = async (session: PortalSession) => {
        const location = await new Promise<{ lat: number; lng: number; accuracy: number }>((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Location is not available on this device.'));
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (position) =>
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                    }),
                () => reject(new Error('Please allow location access to mark attendance.')),
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
            );
        });

        const lat = session.coordinates?.lat;
        const lng = session.coordinates?.lng;
        const radius = Number(session.radius ?? 0);

        if (lat == null || lng == null || radius <= 0) {
            if (gpsEnforcementEnabled) {
                throw new Error('This session does not have a valid work location configured.');
            }
            return {
                coordinates: { latitude: location.lat, longitude: location.lng, accuracy: location.accuracy },
                distance: 0,
                within_range: true,
            };
        }

        const distance = calculateDistance(location.lat, location.lng, Number(lat), Number(lng));
        const within_range = distance <= radius;

        if (gpsEnforcementEnabled && !within_range) {
            throw new Error(`You are too far from the work location (${Math.round(distance)}m away).`);
        }

        return {
            coordinates: { latitude: location.lat, longitude: location.lng, accuracy: location.accuracy },
            distance,
            within_range,
        };
    };

    const submitCheckIn = async (payload: Record<string, unknown>) => {
        const response = await requestJson<ApiResponse>(endpoints.checkIn, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        setMessage({ type: 'success', text: response.message || 'Check-in recorded.' });
        await loadSessions();
    };

    const submitCheckOut = async (payload: Record<string, unknown>) => {
        const response = await requestJson<ApiResponse>(endpoints.checkOut, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        setMessage({ type: 'success', text: response.message || 'Check-out recorded.' });
        await loadSessions();
    };

    const handleCheckIn = async () => {
        if (!selected) {
            setMessage({ type: 'error', text: 'Please choose a session first.' });
            return;
        }
        if (selected.can_take_attendance === false) {
            setMessage({
                type: 'error',
                text: selected.attendance_blocked_message || 'Attendance is not available for this session.',
            });
            return;
        }
        if (!selected.timing?.can_check_in_now) {
            setMessage({
                type: 'error',
                text: selected.timing?.attendance_opens_message || 'Check-in is not open yet.',
            });
            return;
        }

        setSubmitting(true);
        setMessage(null);
        try {
            if (facialRecognitionEnabled) {
                setPendingAction('check-in');
                setFaceModalOpen(true);
            } else {
                const locationPayload = await getLocationPayload(selected);
                if (isLecturer) {
                    await submitCheckIn({
                        timetable_id: selected.timetable_id,
                        course_id: selected.course_id,
                        course_name: selected.name,
                        class_room: selected.classroom ?? selected.building,
                        check_in_time: new Date().toISOString(),
                        ...locationPayload,
                    });
                } else {
                    await submitCheckIn({
                        timetable_id: selected.timetable_id,
                        check_in_time: new Date().toISOString(),
                        ...locationPayload,
                    });
                }
            }
        } catch (error) {
            setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Check-in failed.' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleCheckOut = async () => {
        if (!activeSession?.attendance_status?.id) {
            setMessage({ type: 'error', text: 'You are not checked in yet.' });
            return;
        }

        setSubmitting(true);
        setMessage(null);
        try {
            if (facialRecognitionEnabled) {
                setPendingAction('check-out');
                setFaceModalOpen(true);
            } else {
                const locationPayload = await getLocationPayload(activeSession);
                await submitCheckOut({
                    attendance_id: activeSession.attendance_status.id,
                    check_out_time: new Date().toISOString(),
                    ...locationPayload,
                });
            }
        } catch (error) {
            setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Check-out failed.' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleFaceVerified = async (result: FaceCaptureResult) => {
        const session = pendingAction === 'check-out' && activeSession ? activeSession : selected;
        if (!session || !pendingAction) {
            throw new Error('Please try again.');
        }

        setSubmitting(true);
        try {
            const verification = await requestJson<ApiResponse>(endpoints.verifyFace, {
                method: 'POST',
                body: JSON.stringify(
                    buildFaceVerificationPayload(session.timetable_id, result.descriptor, result.quality),
                ),
            });

            if (!verification.success || !verification.verification_token) {
                throw new Error(verification.message || 'Face verification failed.');
            }

            const locationPayload = await getLocationPayload(session);
            const facePayload = {
                face_descriptor: result.descriptor,
                face_verification_token: verification.verification_token,
            };

            if (pendingAction === 'check-in') {
                if (isLecturer) {
                    await submitCheckIn({
                        timetable_id: session.timetable_id,
                        course_id: session.course_id,
                        course_name: session.name,
                        class_room: session.classroom ?? session.building,
                        check_in_time: new Date().toISOString(),
                        ...locationPayload,
                        ...facePayload,
                    });
                } else {
                    await submitCheckIn({
                        timetable_id: session.timetable_id,
                        check_in_time: new Date().toISOString(),
                        ...locationPayload,
                        ...facePayload,
                    });
                }
            } else {
                await submitCheckOut({
                    attendance_id: activeSession!.attendance_status!.id,
                    check_out_time: new Date().toISOString(),
                    ...locationPayload,
                    ...facePayload,
                });
            }

            setPendingAction(null);
            setFaceModalOpen(false);
        } finally {
            setSubmitting(false);
        }
    };

    const canCheckIn =
        !activeSession &&
        selected &&
        !selected.is_completed &&
        selected.can_take_attendance !== false &&
        Boolean(selected.timing?.can_check_in_now);

    const canCheckOut = !!activeSession && Boolean(activeSession.timing?.can_check_out_now);

    return (
        <AttendancePortalLayout>
            <Head title="Mark Attendance" />

            <div className="space-y-5">
                <Link
                    href={route('attendance.portal')}
                    className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300"
                >
                    <ArrowLeft className="size-4" />
                    Back to portal
                </Link>

                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Mark attendance</h1>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{roleLabel} · Today only</p>
                </div>

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

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                        {isLecturer ? 'Today’s classes' : 'Today’s shift'}
                    </h2>

                    {loading ? (
                        <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
                            <Loader2 className="size-4 animate-spin" />
                            Loading...
                        </div>
                    ) : sessions.length === 0 ? (
                        <p className="py-8 text-center text-sm text-slate-500">
                            Nothing scheduled for you today.
                        </p>
                    ) : sessions.length === 1 ? (
                        <SessionCard session={sessions[0]} selected active={activeSession ? sessionKey(activeSession) === sessionKey(sessions[0]) : false} />
                    ) : (
                        <div className="mt-4 space-y-3">
                            {sessions.map((session) => (
                                <button
                                    key={sessionKey(session)}
                                    type="button"
                                    onClick={() => setSelected(session)}
                                    disabled={!!activeSession && sessionKey(activeSession) !== sessionKey(session)}
                                    className="w-full text-left disabled:opacity-60"
                                >
                                    <SessionCard
                                        session={session}
                                        selected={selected ? sessionKey(selected) === sessionKey(session) : false}
                                        active={activeSession ? sessionKey(activeSession) === sessionKey(session) : false}
                                    />
                                </button>
                            ))}
                        </div>
                    )}
                </section>

                {selected?.attendance_state === 'rescheduled_away' && selected.reschedule && (
                    <RescheduleSessionBanner reschedule={selected.reschedule} variant="away" showBlockedMessage />
                )}

                {selected?.attendance_state === 'rescheduled_active' && selected.reschedule && (
                    <RescheduleSessionBanner reschedule={selected.reschedule} variant="active" compact />
                )}

                {selected?.attendance_state === 'rescheduled_away' && !selected.reschedule && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        <div className="flex gap-2">
                            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                            <p>{selected.attendance_blocked_message || 'This session has been rescheduled. Attendance is not available here.'}</p>
                        </div>
                    </div>
                )}

                {selected && (
                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <Info label="Time" value={`${formatTime(selected.start_time)} – ${formatTime(selected.end_time)}`} icon={Clock} />
                            <Info
                                label="Location"
                                value={selected.classroom || selected.building || 'Not set'}
                                icon={MapPin}
                            />
                        </div>
                    </section>
                )}

                <section className="space-y-3">
                    {canCheckIn && (
                        <button
                            type="button"
                            onClick={handleCheckIn}
                            disabled={submitting}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-4 text-lg font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                            {submitting ? <Loader2 className="size-5 animate-spin" /> : <LogIn className="size-5" />}
                            Check In
                        </button>
                    )}

                    {activeSession && !canCheckOut && (
                        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-center text-sm text-blue-800">
                            {activeSession.timing?.checkout_opens_message ||
                                `Check-out opens at ${formatTime(activeSession.end_time)}.`}
                        </div>
                    )}

                    {canCheckOut && (
                        <button
                            type="button"
                            onClick={handleCheckOut}
                            disabled={submitting}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 py-4 text-lg font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                        >
                            {submitting ? <Loader2 className="size-5 animate-spin" /> : <LogOut className="size-5" />}
                            Check Out
                        </button>
                    )}

                    {selected?.is_completed && !activeSession && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-800">
                            Attendance complete for this session.
                        </div>
                    )}
                </section>
            </div>

            <FaceCaptureModal
                open={faceModalOpen}
                onOpenChange={setFaceModalOpen}
                title="Verify your face"
                description="Confirm your identity to save attendance."
                captureLabel="Verify and continue"
                onCapture={handleFaceVerified}
            />
        </AttendancePortalLayout>
    );
}

function SessionCard({
    session,
    selected,
    active,
}: {
    session: PortalSession;
    selected?: boolean;
    active?: boolean;
}) {
    return (
        <div
            className={`rounded-xl border p-4 ${
                selected
                    ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/20'
                    : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50'
            }`}
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                        {session.name || session.classroom || 'Session'}
                    </p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        {formatTime(session.start_time)} – {formatTime(session.end_time)}
                    </p>
                </div>
                {active ? (
                    <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">Checked in</span>
                ) : session.is_completed ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">Done</span>
                ) : session.attendance_state === 'rescheduled_away' ? (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Rescheduled</span>
                ) : null}
            </div>
        </div>
    );
}

function Info({
    label,
    value,
    icon: Icon,
}: {
    label: string;
    value: string;
    icon: typeof Clock;
}) {
    return (
        <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
            <Icon className="mt-0.5 size-4 text-slate-500" />
            <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{value}</p>
            </div>
        </div>
    );
}
