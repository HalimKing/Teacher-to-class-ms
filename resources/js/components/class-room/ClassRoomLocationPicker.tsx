import { Button } from '@/components/ui/button';
import { type SharedData } from '@/types';
import { Circle, GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import { usePage } from '@inertiajs/react';
import { Crosshair, MapPin } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

const mapContainerStyle = {
    width: '100%',
    height: '360px',
};

interface ClassRoomLocationPickerProps {
    latitude: number | null;
    longitude: number | null;
    radiusMeters?: number | null;
    onChange: (latitude: number, longitude: number) => void;
}

export default function ClassRoomLocationPicker({
    latitude,
    longitude,
    radiusMeters = null,
    onChange,
}: ClassRoomLocationPickerProps) {
    const { system_settings: systemSettings } = usePage<SharedData>().props as SharedData & {
        system_settings?: Record<string, Record<string, { value?: string | number | boolean }>>;
    };

    const defaultLat = Number(systemSettings?.map?.default_campus_lat?.value ?? import.meta.env.VITE_DEFAULT_CAMPUS_LAT ?? 40.7128);
    const defaultLng = Number(systemSettings?.map?.default_campus_lng?.value ?? import.meta.env.VITE_DEFAULT_CAMPUS_LNG ?? -74.006);
    const apiKey =
        (systemSettings?.map?.google_maps_api_key?.value as string) ||
        import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
        '';

    const [isMapLoaded, setIsMapLoaded] = useState(false);
    const [locating, setLocating] = useState(false);

    const selectedPosition = useMemo(() => {
        if (latitude !== null && longitude !== null && !Number.isNaN(latitude) && !Number.isNaN(longitude)) {
            return { lat: Number(latitude), lng: Number(longitude) };
        }

        return null;
    }, [latitude, longitude]);

    const mapCenter = selectedPosition ?? { lat: defaultLat, lng: defaultLng };

    const handleMapClick = useCallback(
        (event: google.maps.MapMouseEvent) => {
            if (!event.latLng) {
                return;
            }

            onChange(Number(event.latLng.lat().toFixed(7)), Number(event.latLng.lng().toFixed(7)));
        },
        [onChange],
    );

    const handleMarkerDragEnd = useCallback(
        (event: google.maps.MapMouseEvent) => {
            if (!event.latLng) {
                return;
            }

            onChange(Number(event.latLng.lat().toFixed(7)), Number(event.latLng.lng().toFixed(7)));
        },
        [onChange],
    );

    const handleUseCurrentLocation = () => {
        if (!navigator.geolocation) {
            return;
        }

        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                onChange(
                    Number(position.coords.latitude.toFixed(7)),
                    Number(position.coords.longitude.toFixed(7)),
                );
                setLocating(false);
            },
            () => setLocating(false),
            { enableHighAccuracy: true, timeout: 10000 },
        );
    };

    if (!apiKey || String(apiKey).includes('…')) {
        return (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-900/40">
                <MapPin className="mx-auto mb-2 size-8 text-slate-400" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Google Maps is not configured</p>
                <p className="mt-1 text-sm text-slate-500">
                    Add a Google Maps API key in System Settings or set <code className="text-xs">VITE_GOOGLE_MAPS_API_KEY</code> to pick a location on the map.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Pick location on map</p>
                    <p className="text-sm text-slate-500">Click the map or drag the marker to fill latitude and longitude automatically.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleUseCurrentLocation} disabled={locating}>
                    <Crosshair className="size-4" />
                    {locating ? 'Locating...' : 'Use My Location'}
                </Button>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                <LoadScript googleMapsApiKey={apiKey}>
                    <GoogleMap
                        mapContainerStyle={mapContainerStyle}
                        center={mapCenter}
                        zoom={selectedPosition ? 18 : 15}
                        onClick={handleMapClick}
                        onLoad={() => setIsMapLoaded(true)}
                        options={{
                            streetViewControl: false,
                            mapTypeControl: true,
                            fullscreenControl: true,
                        }}
                    >
                        {isMapLoaded && selectedPosition && (
                            <>
                                <Marker
                                    position={selectedPosition}
                                    draggable
                                    onDragEnd={handleMarkerDragEnd}
                                    title="Class room location"
                                />
                                {radiusMeters && radiusMeters > 0 && (
                                    <Circle
                                        center={selectedPosition}
                                        radius={Number(radiusMeters)}
                                        options={{
                                            fillColor: '#6366f1',
                                            fillOpacity: 0.15,
                                            strokeColor: '#6366f1',
                                            strokeOpacity: 0.8,
                                            strokeWeight: 2,
                                        }}
                                    />
                                )}
                            </>
                        )}
                    </GoogleMap>
                </LoadScript>
            </div>

            {selectedPosition && (
                <p className="text-sm text-slate-600 dark:text-slate-300">
                    Selected: {selectedPosition.lat.toFixed(6)}, {selectedPosition.lng.toFixed(6)}
                    {radiusMeters ? ` · Radius: ${radiusMeters}m` : ''}
                </p>
            )}
        </div>
    );
}
