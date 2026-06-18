import { AlertTriangle, Calendar, Clock, MapPin, User } from 'lucide-react';

export interface RescheduleBannerInfo {
    id?: number;
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
    rescheduled_from_badge?: string;
    summary?: string;
}

interface RescheduleSessionBannerProps {
    reschedule: RescheduleBannerInfo;
    variant: 'away' | 'active';
    compact?: boolean;
    showBlockedMessage?: boolean;
}

export function RescheduleSessionBanner({
    reschedule,
    variant,
    compact = false,
    showBlockedMessage = false,
}: RescheduleSessionBannerProps) {
    const isAway = variant === 'away';
    const borderClass = isAway ? 'border-amber-300 bg-amber-50' : 'border-sky-300 bg-sky-50';
    const titleClass = isAway ? 'text-amber-900' : 'text-sky-900';
    const textClass = isAway ? 'text-amber-800' : 'text-sky-800';

    return (
        <div className={`rounded-xl border p-3 ${borderClass} ${compact ? 'text-xs' : 'text-sm'}`}>
            <div className="flex items-start gap-2">
                <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${isAway ? 'text-amber-700' : 'text-sky-700'}`} />
                <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
                                isAway ? 'bg-amber-200 text-amber-900' : 'bg-sky-200 text-sky-900'
                            }`}
                        >
                            {isAway ? 'Rescheduled' : 'Rescheduled Session'}
                        </span>
                        {!isAway && reschedule.rescheduled_from_badge && (
                            <span className={`text-xs font-medium ${textClass}`}>{reschedule.rescheduled_from_badge}</span>
                        )}
                    </div>

                    <p className={`font-semibold ${titleClass}`}>
                        {isAway ? 'This session has been rescheduled.' : 'This is a rescheduled session.'}
                    </p>

                    <div className={`grid gap-2 ${compact ? '' : 'md:grid-cols-2'}`}>
                        <div className={`rounded-lg border border-white/60 bg-white/70 p-2 ${textClass}`}>
                            <p className="mb-1 text-[11px] font-bold tracking-wide uppercase opacity-80">Original Schedule</p>
                            <div className="space-y-1">
                                <p className="flex items-center gap-1.5">
                                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                                    {reschedule.original_date_display}
                                </p>
                                <p className="flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5 shrink-0" />
                                    {reschedule.original_start_time_display} – {reschedule.original_end_time_display}
                                </p>
                                <p className="flex items-center gap-1.5">
                                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                                    {reschedule.original_venue || 'Original venue'}
                                </p>
                            </div>
                        </div>

                        <div className={`rounded-lg border border-white/60 bg-white/70 p-2 ${textClass}`}>
                            <p className="mb-1 text-[11px] font-bold tracking-wide uppercase opacity-80">New Schedule</p>
                            <div className="space-y-1">
                                <p className="flex items-center gap-1.5">
                                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                                    {reschedule.new_date_display}
                                </p>
                                <p className="flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5 shrink-0" />
                                    {reschedule.new_start_time_display} – {reschedule.new_end_time_display}
                                </p>
                                <p className="flex items-center gap-1.5">
                                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                                    {reschedule.new_venue || 'New venue'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {reschedule.reason && (
                        <p className={textClass}>
                            <span className="font-medium">Reason:</span> {reschedule.reason}
                        </p>
                    )}

                    {reschedule.approved_by_name && (
                        <p className={`flex items-center gap-1.5 ${textClass}`}>
                            <User className="h-3.5 w-3.5 shrink-0" />
                            Approved by {reschedule.approved_by_name}
                            {reschedule.approved_at_display ? ` on ${reschedule.approved_at_display}` : ''}
                        </p>
                    )}

                    {showBlockedMessage && isAway && (
                        <p className={`font-medium ${textClass}`}>
                            Attendance is unavailable because this session has been rescheduled.
                        </p>
                    )}

                    {!isAway && reschedule.summary && !compact && (
                        <p className={`text-xs ${textClass}`}>{reschedule.summary}</p>
                    )}
                </div>
            </div>
        </div>
    );
}
