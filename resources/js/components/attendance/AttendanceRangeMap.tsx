import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { Circle, GoogleMap, Marker, Polyline, useJsApiLoader } from '@react-google-maps/api';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type MapPoint = {
    lat: number;
    lng: number;
};

interface AttendanceRangeMapProps {
    /** Venue (geofence) centre. */
    venue: MapPoint;
    venueName?: string;
    /** Allowed check-in radius around the venue, in meters. */
    radiusMeters: number;
    /** Last known device position, when available. */
    device: MapPoint | null;
    /** Distance between the device and the venue, in meters. */
    distanceMeters: number | null;
    className?: string;
}

const VENUE_COLOR = '#4f46e5';
const VENUE_PIN_COLOR = '#16a34a';
const DEVICE_COLOR = '#2563eb';
const GAP_COLOR = '#ef4444';

const VENUE_PIN_PATH = 'M 12,2 C 8.13,2 5,5.13 5,9 c 0,5.25 7,13 7,13 s 7,-7.75 7,-13 c 0,-3.87 -3.13,-7 -7,-7 z';

export function formatDistanceLabel(meters: number): string {
    if (!Number.isFinite(meters)) {
        return '—';
    }

    return meters >= 1000 ? `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} km` : `${Math.round(meters)} m`;
}

function resolveApiKey(raw: unknown): string {
    const key = typeof raw === 'string' ? raw.trim() : '';

    // System settings mask secrets (e.g. "abcd…wxyz"), which cannot be used to load the map.
    return !key || key.includes('…') ? '' : key;
}

function mapsAlreadyLoaded(): boolean {
    return typeof window !== 'undefined' && Boolean(window.google?.maps);
}

/** Loads the Maps JS API when the host page has not already done so. */
function GoogleRangeMapLoader({ apiKey, ...rest }: { apiKey: string } & RangeMapViewProps) {
    const { isLoaded, loadError } = useJsApiLoader({ id: 'script-loader', googleMapsApiKey: apiKey });

    if (loadError) {
        return <SchematicRangeMap {...rest} note="Map tiles could not be loaded." />;
    }

    if (!isLoaded) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-slate-100 text-xs text-slate-500 dark:bg-slate-900">
                Loading map…
            </div>
        );
    }

    return <GoogleRangeMap {...rest} />;
}

type RangeMapViewProps = {
    venue: MapPoint;
    venueName?: string;
    radiusMeters: number;
    device: MapPoint | null;
};

/** Google Maps view: venue pin, geofence circle, device dot, and a dashed gap line. */
function GoogleRangeMap({ venue, venueName, radiusMeters, device }: RangeMapViewProps) {
    const mapRef = useRef<google.maps.Map | null>(null);
    const [ready, setReady] = useState(false);

    const fitToPoints = useCallback(
        (map: google.maps.Map) => {
            const bounds = new google.maps.LatLngBounds();
            const latPadding = radiusMeters / 111_320;
            const lngPadding = radiusMeters / (111_320 * Math.max(Math.cos((venue.lat * Math.PI) / 180), 0.01));

            bounds.extend({ lat: venue.lat + latPadding, lng: venue.lng + lngPadding });
            bounds.extend({ lat: venue.lat - latPadding, lng: venue.lng - lngPadding });

            if (device) {
                bounds.extend(device);
            }

            map.fitBounds(bounds, 24);
        },
        [device, radiusMeters, venue.lat, venue.lng],
    );

    const handleLoad = useCallback(
        (map: google.maps.Map) => {
            mapRef.current = map;
            setReady(true);
            fitToPoints(map);
        },
        [fitToPoints],
    );

    useEffect(() => {
        if (mapRef.current) {
            fitToPoints(mapRef.current);
        }
    }, [fitToPoints]);

    useEffect(() => {
        return () => {
            mapRef.current = null;
        };
    }, []);

    return (
        <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={device ?? venue}
            zoom={16}
            onLoad={handleLoad}
            options={{
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false,
                zoomControl: true,
                clickableIcons: false,
                maxZoom: 19,
                // Keeps one-finger scrolling on the dialog while still allowing pinch/two-finger pan.
                gestureHandling: 'cooperative',
            }}
        >
            {ready ? (
                <>
                    <Circle
                        center={venue}
                        radius={radiusMeters}
                        options={{
                            clickable: false,
                            fillColor: VENUE_COLOR,
                            fillOpacity: 0.14,
                            strokeColor: VENUE_COLOR,
                            strokeOpacity: 0.85,
                            strokeWeight: 2,
                        }}
                    />

                    {device ? (
                        <Polyline
                            path={[device, venue]}
                            options={{
                                clickable: false,
                                strokeOpacity: 0,
                                icons: [
                                    {
                                        icon: {
                                            path: 'M 0,-1 0,1',
                                            strokeColor: GAP_COLOR,
                                            strokeOpacity: 0.95,
                                            strokeWeight: 3,
                                            scale: 3,
                                        },
                                        offset: '0',
                                        repeat: '14px',
                                    },
                                ],
                            }}
                        />
                    ) : null}

                    <Marker
                        position={venue}
                        title={venueName ? `${venueName} (attendance venue)` : 'Attendance venue'}
                        zIndex={2}
                        icon={{
                            path: VENUE_PIN_PATH,
                            fillColor: VENUE_PIN_COLOR,
                            fillOpacity: 1,
                            strokeColor: '#ffffff',
                            strokeWeight: 1.5,
                            scale: 1.6,
                            anchor: new google.maps.Point(12, 22),
                        }}
                    />

                    {device ? (
                        <Marker
                            position={device}
                            title="Your device location"
                            zIndex={3}
                            icon={{
                                path: google.maps.SymbolPath.CIRCLE,
                                scale: 7,
                                fillColor: DEVICE_COLOR,
                                fillOpacity: 1,
                                strokeColor: '#ffffff',
                                strokeWeight: 2.5,
                            }}
                        />
                    ) : null}
                </>
            ) : null}
        </GoogleMap>
    );
}

/** Fallback used when no Google Maps key is configured: a to-scale diagram of both points. */
function SchematicRangeMap({ venue, venueName, radiusMeters, device, note }: RangeMapViewProps & { note?: string }) {
    const metersPerDegLat = 111_320;
    const metersPerDegLng = 111_320 * Math.max(Math.cos((venue.lat * Math.PI) / 180), 0.01);
    const east = device ? (device.lng - venue.lng) * metersPerDegLng : 0;
    const north = device ? (device.lat - venue.lat) * metersPerDegLat : 0;
    const gap = Math.hypot(east, north);

    const extent = Math.max(radiusMeters, gap, 1) * 1.25;
    const scale = 86 / extent;

    const venueX = 100;
    const venueY = 100;
    const deviceX = venueX + east * scale;
    const deviceY = venueY - north * scale;

    return (
        <div className="relative h-full w-full bg-slate-50 dark:bg-slate-900">
            <svg viewBox="0 0 200 200" className="h-full w-full" role="img" aria-label="Diagram showing your device position relative to the attendance venue">
                <defs>
                    <pattern id="attendance-range-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-slate-200 dark:text-slate-700" />
                    </pattern>
                </defs>
                <rect width="200" height="200" fill="url(#attendance-range-grid)" />

                <circle cx={venueX} cy={venueY} r={Math.max(radiusMeters * scale, 4)} fill={VENUE_COLOR} fillOpacity={0.14} stroke={VENUE_COLOR} strokeWidth={1.5} />

                {device ? (
                    <>
                        <line x1={deviceX} y1={deviceY} x2={venueX} y2={venueY} stroke={GAP_COLOR} strokeWidth={1.5} strokeDasharray="4 3" />
                        <circle cx={deviceX} cy={deviceY} r={9} fill={DEVICE_COLOR} fillOpacity={0.18} />
                        <circle cx={deviceX} cy={deviceY} r={4.5} fill={DEVICE_COLOR} stroke="#ffffff" strokeWidth={1.5} />
                    </>
                ) : null}

                <path
                    d={VENUE_PIN_PATH}
                    fill={VENUE_PIN_COLOR}
                    stroke="#ffffff"
                    strokeWidth={1}
                    transform={`translate(${venueX - 12}, ${venueY - 22})`}
                />
            </svg>

            <p className="absolute inset-x-2 bottom-1.5 text-center text-[10px] leading-tight text-slate-500 dark:text-slate-400">
                {note ?? 'Approximate to-scale view'}
                {venueName ? ` · ${venueName}` : ''}
            </p>
        </div>
    );
}

export default function AttendanceRangeMap({
    venue,
    venueName,
    radiusMeters,
    device,
    distanceMeters,
    className,
}: AttendanceRangeMapProps) {
    const page = usePage<SharedData>();
    const systemSettings = (page.props as SharedData & {
        system_settings?: Record<string, Record<string, { value?: string | number | boolean }>>;
    }).system_settings;

    const apiKey = useMemo(
        () => resolveApiKey(systemSettings?.map?.google_maps_api_key?.value) || resolveApiKey(import.meta.env.VITE_GOOGLE_MAPS_API_KEY),
        [systemSettings],
    );

    // The host page may already have loaded the Maps script (e.g. the attendance map);
    // reuse it instead of injecting a second copy.
    const [preloaded] = useState(mapsAlreadyLoaded);

    const gap = distanceMeters ?? null;
    const overshoot = gap != null ? Math.max(gap - radiusMeters, 0) : null;
    const view = { venue, venueName, radiusMeters, device };

    return (
        <div className={className}>
            <div className="relative h-56 w-full overflow-hidden rounded-lg border border-amber-200 bg-slate-100 dark:border-amber-900 dark:bg-slate-900 sm:h-72">
                {preloaded ? (
                    <GoogleRangeMap {...view} />
                ) : apiKey ? (
                    <GoogleRangeMapLoader apiKey={apiKey} {...view} />
                ) : (
                    <SchematicRangeMap {...view} />
                )}

                {gap != null ? (
                    <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-white/95 px-2 py-1 text-[11px] font-semibold leading-tight text-slate-800 shadow-sm ring-1 ring-black/5 dark:bg-slate-900/95 dark:text-slate-100">
                        {formatDistanceLabel(gap)} from venue
                        {overshoot != null && overshoot > 0 ? (
                            <span className="block font-normal text-slate-500 dark:text-slate-400">
                                {formatDistanceLabel(overshoot)} outside the {formatDistanceLabel(radiusMeters)} range
                            </span>
                        ) : null}
                    </div>
                ) : null}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-amber-900 dark:text-amber-100">
                <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full border-2 border-white ring-1 ring-black/10" style={{ backgroundColor: DEVICE_COLOR }} />
                    Your device
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: VENUE_PIN_COLOR }} />
                    {venueName || 'Attendance venue'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full border-2" style={{ borderColor: VENUE_COLOR, backgroundColor: `${VENUE_COLOR}22` }} />
                    Allowed range ({formatDistanceLabel(radiusMeters)})
                </span>
            </div>
        </div>
    );
}
