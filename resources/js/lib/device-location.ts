import { MAX_ACCEPTABLE_ACCURACY_METERS, MAX_FIX_AGE_MS } from '@/lib/geo';

export type DeviceFix = {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
};

export type LocationFailureCode = 'unsupported' | 'denied' | 'unavailable' | 'timeout' | 'poor_accuracy' | 'cancelled';

const GOOD_ACCURACY_METERS = 30;
const QUICK_ACCEPT_MS = 4000;
const SAMPLE_WINDOW_MS = 12000;

export class LocationRequestError extends Error {
    code: LocationFailureCode;

    fix: DeviceFix | null;

    constructor(code: LocationFailureCode, message: string, fix: DeviceFix | null = null) {
        super(message);
        this.name = 'LocationRequestError';
        this.code = code;
        this.fix = fix;
    }
}

let generation = 0;
let activeWatch: number | null = null;
let pendingReject: ((error: LocationRequestError) => void) | null = null;

export function cancelDeviceLocation(): void {
    generation += 1;
    if (activeWatch != null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(activeWatch);
        activeWatch = null;
    }
    const rejectPending = pendingReject;
    pendingReject = null;
    rejectPending?.(new LocationRequestError('cancelled', 'Location request was replaced.'));
}

function messageFor(code: LocationFailureCode): string {
    switch (code) {
        case 'unsupported':
            return 'This browser does not support location services.';
        case 'denied':
            return 'Location permission denied. Allow location access for this site, then try again.';
        case 'unavailable':
            return 'Location services are unavailable. Turn on GPS or location services and try again.';
        case 'timeout':
            return 'Location request timed out. Move to an area with a clearer GPS signal and try again.';
        case 'poor_accuracy':
            return 'Location accuracy is too low. Please enable GPS/location services, move to an area with a clearer GPS signal, and try again.';
        default:
            return 'Location could not be determined. Please try again.';
    }
}

/**
 * Collects a fresh high-accuracy fix and keeps the most precise sample.
 * A coarse network position cannot replace a better GPS sample, and an older
 * request cannot overwrite a newer one.
 */
export function acquireFreshDeviceLocation(): Promise<DeviceFix> {
    cancelDeviceLocation();
    const requestId = generation;

    return new Promise((resolve, reject) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            reject(new LocationRequestError('unsupported', messageFor('unsupported')));
            return;
        }

        let best: DeviceFix | null = null;
        let settled = false;
        let quickTimer = 0;
        let windowTimer = 0;

        const cleanup = () => {
            window.clearTimeout(quickTimer);
            window.clearTimeout(windowTimer);
            if (activeWatch != null) {
                navigator.geolocation.clearWatch(activeWatch);
                activeWatch = null;
            }
            if (pendingReject) {
                pendingReject = null;
            }
        };

        pendingReject = (error) => {
            if (settled) {
                return;
            }
            settled = true;
            window.clearTimeout(quickTimer);
            window.clearTimeout(windowTimer);
            activeWatch = null;
            reject(error);
        };

        const finish = (handler: () => void) => {
            if (settled || requestId !== generation) {
                return;
            }
            settled = true;
            cleanup();
            handler();
        };

        const acceptBest = () => {
            if (best && best.accuracy <= MAX_ACCEPTABLE_ACCURACY_METERS) {
                finish(() => resolve(best as DeviceFix));
                return;
            }
            finish(() => reject(new LocationRequestError('poor_accuracy', messageFor('poor_accuracy'), best)));
        };

        const consider = (position: GeolocationPosition) => {
            if (settled || requestId !== generation) {
                return;
            }

            const age = Date.now() - position.timestamp;
            const { latitude, longitude, accuracy } = position.coords;
            if (age > MAX_FIX_AGE_MS || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(accuracy) || accuracy <= 0) {
                return;
            }

            const fix: DeviceFix = {
                latitude,
                longitude,
                accuracy,
                timestamp: position.timestamp,
            };

            if (!best || fix.accuracy < best.accuracy) {
                best = fix;
            }

            if (best.accuracy <= GOOD_ACCURACY_METERS) {
                finish(() => resolve(best as DeviceFix));
            }
        };

        quickTimer = window.setTimeout(() => {
            if (best && best.accuracy <= MAX_ACCEPTABLE_ACCURACY_METERS) {
                finish(() => resolve(best as DeviceFix));
            }
        }, QUICK_ACCEPT_MS);

        windowTimer = window.setTimeout(acceptBest, SAMPLE_WINDOW_MS);

        activeWatch = navigator.geolocation.watchPosition(consider, (error) => {
            if (best && best.accuracy <= MAX_ACCEPTABLE_ACCURACY_METERS) {
                finish(() => resolve(best as DeviceFix));
                return;
            }

            const code: LocationFailureCode =
                error.code === error.PERMISSION_DENIED ? 'denied' : error.code === error.TIMEOUT ? 'timeout' : 'unavailable';
            finish(() => reject(new LocationRequestError(code, messageFor(code), best)));
        }, {
            enableHighAccuracy: true,
            timeout: SAMPLE_WINDOW_MS,
            maximumAge: 0,
        });

        if (requestId !== generation) {
            cleanup();
        }
    });
}
