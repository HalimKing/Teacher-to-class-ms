/** Readings coarser than this are not reliable enough for attendance. */
export const MAX_ACCEPTABLE_ACCURACY_METERS = 100;

/** Ignore browser fixes older than this when a fresh reading was requested. */
export const MAX_FIX_AGE_MS = 30_000;

export type GeofenceStatus = 'verified' | 'out_of_range' | 'accuracy_too_low' | 'stale' | 'invalid';

export type GeofenceVerdict = {
    status: GeofenceStatus;
    distanceMeters: number | null;
    message: string;
};

const POOR_ACCURACY_MESSAGE =
    'Location accuracy is too low. Please enable GPS/location services, move to an area with a clearer GPS signal, and try again.';

/** Haversine distance in meters. */
export function distanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;

    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function formatOutOfRangeAttendanceMessage(distanceMeters: number, radiusMeters: number): string {
    return (
        'You are outside the permitted attendance location. Please move within the required range and try again. ' +
        `You are currently about ${Math.round(distanceMeters)}m away. Required range: ${Math.round(radiusMeters)}m.`
    );
}

export function formatLocationDiagnostics(distanceMeters: number, radiusMeters: number, accuracyMeters: number): string[] {
    return [
        `Distance from venue: ${Math.round(distanceMeters)} m`,
        `Allowed radius: ${Math.round(radiusMeters)} m`,
        `GPS accuracy: ±${Math.round(accuracyMeters)} m`,
    ];
}

/**
 * Accept a fix when the accuracy circle still reaches the venue.
 * A coarse reading is "accuracy too low", not "out of range".
 */
export function evaluateAttendanceLocation(input: {
    latitude: number;
    longitude: number;
    accuracy: number;
    capturedAt?: number | null;
    venueLatitude: number;
    venueLongitude: number;
    radiusMeters: number;
}): GeofenceVerdict {
    const { latitude, longitude, accuracy, capturedAt, venueLatitude, venueLongitude, radiusMeters } = input;

    if (![latitude, longitude, venueLatitude, venueLongitude, radiusMeters].every(Number.isFinite) || radiusMeters <= 0) {
        return { status: 'invalid', distanceMeters: null, message: 'Location could not be determined. Please try again.' };
    }

    if (capturedAt != null && Number.isFinite(capturedAt) && Date.now() - capturedAt > MAX_FIX_AGE_MS) {
        return { status: 'stale', distanceMeters: null, message: 'This location reading is too old. Please try again.' };
    }

    const distanceMeters = distanceInMeters(latitude, longitude, venueLatitude, venueLongitude);

    if (!Number.isFinite(accuracy) || accuracy <= 0 || accuracy > MAX_ACCEPTABLE_ACCURACY_METERS) {
        return { status: 'accuracy_too_low', distanceMeters, message: POOR_ACCURACY_MESSAGE };
    }

    if (distanceMeters - accuracy > radiusMeters) {
        return {
            status: 'out_of_range',
            distanceMeters,
            message: formatOutOfRangeAttendanceMessage(distanceMeters, radiusMeters),
        };
    }

    return { status: 'verified', distanceMeters, message: 'Location verified.' };
}
