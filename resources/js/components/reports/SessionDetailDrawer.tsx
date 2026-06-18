import { StatusBadge } from '@/components/reports/shared';
import { Loader2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface SessionRecord {
    id: number;
    course?: string;
    classroom?: string | null;
    date?: string;
    check_in_time?: string | null;
    check_out_time?: string | null;
    working_hours?: string | null;
    attendance_status?: string;
    arrival_category_label?: string;
    minutes_early?: number | null;
    minutes_late?: number | null;
    departure_category_label?: string;
    minutes_overtime?: number | null;
    geolocation_status?: string;
    face_verification_status?: string;
    face_match_score?: number | null;
    attendance_source?: string;
    auto_generated?: boolean;
    auto_absence_reason?: string | null;
    reschedule?: {
        summary?: string;
        original_date_display?: string;
        original_start_time_display?: string;
        original_end_time_display?: string;
        original_venue?: string | null;
        new_date_display?: string;
        new_start_time_display?: string;
        new_end_time_display?: string;
        new_venue?: string | null;
        note?: string | null;
    } | null;
}

interface TimelineEvent {
    label: string;
    time?: string | null;
    detail?: string | null;
}

interface VerificationAttempt {
    id: number;
    score?: number | null;
    result?: string;
    failure_reason?: string | null;
    created_at?: string;
}

interface SessionDetailDrawerProps {
    recordId: number | null;
    onClose: () => void;
}

export function SessionDetailDrawer({ recordId, onClose }: SessionDetailDrawerProps) {
    const [data, setData] = useState<{
        record: SessionRecord;
        timeline: TimelineEvent[];
        verification_attempts: VerificationAttempt[];
    } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!recordId) {
            setData(null);
            return;
        }

        const fetchDetail = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch(`/teacher/reports/records/${recordId}`, {
                    headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                    credentials: 'same-origin',
                });
                const payload = await response.json();
                if (!response.ok || !payload.success) {
                    throw new Error(payload.message || 'Failed to load session details');
                }
                setData(payload.data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load session details');
            } finally {
                setIsLoading(false);
            }
        };

        fetchDetail();
    }, [recordId]);

    if (!recordId) {
        return null;
    }

    const record = data?.record;

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
            <div
                className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl dark:bg-sidebar-accent"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-sidebar-border/50 bg-white px-5 py-4 dark:bg-sidebar-accent">
                    <div>
                        <h2 className="text-lg font-semibold text-sidebar-foreground">Session Details</h2>
                        <p className="text-sm text-sidebar-foreground/60">{record?.course ?? 'Loading...'}</p>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-2 hover:bg-sidebar-accent">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="space-y-6 p-5">
                    {isLoading && (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                        </div>
                    )}

                    {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

                    {record && !isLoading && (
                        <>
                            <section className="rounded-xl border border-sidebar-border/50 p-4">
                                <h3 className="mb-3 text-sm font-semibold text-sidebar-foreground">Overview</h3>
                                <dl className="grid grid-cols-2 gap-3 text-sm">
                                    <div><dt className="text-sidebar-foreground/60">Date</dt><dd className="font-medium">{record.date}</dd></div>
                                    <div><dt className="text-sidebar-foreground/60">Status</dt><dd><StatusBadge status={record.attendance_status ?? 'pending'} /></dd></div>
                                    <div><dt className="text-sidebar-foreground/60">Class</dt><dd className="font-medium">{record.classroom ?? '—'}</dd></div>
                                    <div><dt className="text-sidebar-foreground/60">Working Hours</dt><dd className="font-medium">{record.working_hours ?? '—'}</dd></div>
                                    <div><dt className="text-sidebar-foreground/60">Check-In</dt><dd className="font-medium">{record.check_in_time ?? '—'}</dd></div>
                                    <div><dt className="text-sidebar-foreground/60">Check-Out</dt><dd className="font-medium">{record.check_out_time ?? '—'}</dd></div>
                                </dl>
                            </section>

                            {record.reschedule && (
                                <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                                    <h3 className="mb-2 text-sm font-semibold text-amber-900 dark:text-amber-300">Rescheduled Session</h3>
                                    <p className="text-sm text-amber-900/80 dark:text-amber-200/80">{record.reschedule.summary}</p>
                                    <div className="mt-3 space-y-2 text-sm">
                                        <p><span className="font-medium">Original:</span> {record.reschedule.original_date_display}, {record.reschedule.original_start_time_display} – {record.reschedule.original_end_time_display}, {record.reschedule.original_venue ?? '—'}</p>
                                        <p><span className="font-medium">New:</span> {record.reschedule.new_date_display}, {record.reschedule.new_start_time_display} – {record.reschedule.new_end_time_display}, {record.reschedule.new_venue ?? '—'}</p>
                                    </div>
                                </section>
                            )}

                            <section className="rounded-xl border border-sidebar-border/50 p-4">
                                <h3 className="mb-3 text-sm font-semibold text-sidebar-foreground">Verification</h3>
                                <dl className="grid grid-cols-2 gap-3 text-sm">
                                    <div><dt className="text-sidebar-foreground/60">Face</dt><dd className="font-medium">{record.face_verification_status}</dd></div>
                                    <div><dt className="text-sidebar-foreground/60">Score</dt><dd className="font-medium">{record.face_match_score ?? '—'}</dd></div>
                                    <div><dt className="text-sidebar-foreground/60">Geolocation</dt><dd className="font-medium">{record.geolocation_status}</dd></div>
                                    <div><dt className="text-sidebar-foreground/60">Source</dt><dd className="font-medium">{record.attendance_source}</dd></div>
                                    <div><dt className="text-sidebar-foreground/60">Arrival</dt><dd className="font-medium">{record.arrival_category_label ?? '—'}</dd></div>
                                    <div><dt className="text-sidebar-foreground/60">Departure</dt><dd className="font-medium">{record.departure_category_label ?? '—'}</dd></div>
                                </dl>
                                {record.auto_generated && (
                                    <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
                                        {record.auto_absence_reason ?? 'System-generated absence'}
                                    </p>
                                )}
                            </section>

                            {data?.timeline && data.timeline.length > 0 && (
                                <section className="rounded-xl border border-sidebar-border/50 p-4">
                                    <h3 className="mb-3 text-sm font-semibold text-sidebar-foreground">Timeline</h3>
                                    <div className="space-y-3">
                                        {data.timeline.map((event, index) => (
                                            <div key={index} className="flex gap-3">
                                                <div className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
                                                <div>
                                                    <p className="text-sm font-medium text-sidebar-foreground">{event.label}</p>
                                                    {event.time && <p className="text-xs text-sidebar-foreground/60">{event.time}</p>}
                                                    {event.detail && <p className="text-xs text-sidebar-foreground/70">{event.detail}</p>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {data?.verification_attempts && data.verification_attempts.length > 0 && (
                                <section className="rounded-xl border border-sidebar-border/50 p-4">
                                    <h3 className="mb-3 text-sm font-semibold text-sidebar-foreground">Face Verification Attempts</h3>
                                    <div className="space-y-2">
                                        {data.verification_attempts.map((attempt) => (
                                            <div key={attempt.id} className="rounded-lg border border-sidebar-border/40 p-3 text-sm">
                                                <div className="font-medium">{attempt.result ?? 'Attempt'}</div>
                                                <div className="text-sidebar-foreground/60">{attempt.created_at}</div>
                                                {attempt.failure_reason && <div className="text-red-600">{attempt.failure_reason}</div>}
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
