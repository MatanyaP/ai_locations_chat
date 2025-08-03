'use client';

import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { Icon, LatLngExpression, DivIcon } from 'leaflet';
import { LocationResponse } from '@/types/api';
import { useState, useMemo, useEffect } from 'react';
import 'leaflet/dist/leaflet.css';

interface LocationItem {
    latitude: number;
    longitude: number;
    timestamp: string;
    person?: string;
    altitude: number;
    speed_mps: number;
    horizontal_accuracy_meters: number;
}

interface ClusterItem {
    locations: LocationItem[];
    center: LatLngExpression;
    person: string;
}


const getPersonColor = (person?: string): string => {
    if (!person) return '#6B7280'; // Gray for unknown

    const match = person.match(/person(\d+)/);
    const personIndex = match ? parseInt(match[1]) - 1 : 0;

    const colors = [
        '#3B82F6',
        '#EF4444',
        '#10B981',
        '#F59E0B',
        '#8B5CF6',
        '#EC4899',
        '#06B6D4',
        '#84CC16',
        '#F97316',
        '#6366F1',
    ];

    return colors[personIndex % colors.length];
};

const personIcon = (person: string, customColor?: string, size: 'small' | 'medium' | 'large' = 'medium', isLatest = false) => {
    const color = customColor || getPersonColor(person);
    const sizes = {
        small: { width: 20, height: 20, anchor: [10, 20] },
        medium: { width: 28, height: 28, anchor: [14, 28] },
        large: { width: 36, height: 36, anchor: [18, 36] }
    };
    const sizeConfig = sizes[size];

    const initial = person.replace('person', 'P');
    const pulseClass = isLatest ? 'pulse-marker' : '';

    return new Icon({
        iconUrl: `data:image/svg+xml;base64,${btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="${sizeConfig.width}" height="${sizeConfig.height}" class="${pulseClass}">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        <text x="12" y="10" text-anchor="middle" fill="white" font-size="8" font-weight="bold">${initial}</text>
      </svg>
    `)}`,
        iconSize: [sizeConfig.width, sizeConfig.height],
        iconAnchor: sizeConfig.anchor as [number, number],
        popupAnchor: [0, -sizeConfig.height],
    });
};

const createClusterIcon = (count: number, color: string) => {
    return new DivIcon({
        html: `
      <div class="custom-cluster-icon" style="
        background-color: ${color};
        border: 3px solid white;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        color: white;
        font-size: 14px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      ">
        ${count}
      </div>
    `,
        className: 'custom-cluster-icon',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
    });
};

const clusterLocations = (locations: LocationItem[], distanceThreshold = 50): ClusterItem[] => {
    const clusters: ClusterItem[] = [];
    const processed = new Set<number>();

    locations.forEach((location, index) => {
        if (processed.has(index)) return;

        const cluster: ClusterItem = {
            locations: [location],
            center: [location.latitude, location.longitude] as LatLngExpression,
            person: location.person || 'unknown'
        };

        // Find nearby locations for the same person
        locations.forEach((otherLocation, otherIndex) => {
            if (otherIndex === index || processed.has(otherIndex)) return;
            if ((otherLocation.person || 'unknown') !== cluster.person) return;

            const distance = Math.sqrt(
                Math.pow((location.latitude - otherLocation.latitude) * 111000, 2) + // approximate conversion from degrees to meters
                Math.pow((location.longitude - otherLocation.longitude) * 111000, 2)
            );

            if (distance <= distanceThreshold) {
                cluster.locations.push(otherLocation);
                processed.add(otherIndex);
            }
        });

        processed.add(index);
        clusters.push(cluster);
    });

    return clusters;
};

const createArrowIcon = (color: string, rotation: number) => {
    return new DivIcon({
        html: `
      <div style="transform: rotate(${rotation}deg); color: ${color}; font-size: 16px; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">
        ▲
      </div>
    `,
        className: 'custom-arrow-icon',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
    });
};

// measure the clockwise angle from true north to the point
const calculateBearing = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;

    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);

    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
};

const getMidpoint = (lat1: number, lng1: number, lat2: number, lng2: number): [number, number] => {
    return [(lat1 + lat2) / 2, (lng1 + lng2) / 2];
};

interface MapProps {
    locations: LocationResponse | null;
}

export default function Map({ locations }: MapProps) {
    // Default center on Tel Aviv
    const defaultCenter: LatLngExpression = [32.0853, 34.7818];
    const defaultZoom = 13;

    const [showPaths, setShowPaths] = useState(true);
    const [showArrows, setShowArrows] = useState(true);
    const [showClusters, setShowClusters] = useState(true);
    const [visiblePersons, setVisiblePersons] = useState<Set<string>>(new Set());

    const getMapBounds = () => {
        if (!locations?.locations?.length) {
            return { center: defaultCenter, zoom: defaultZoom };
        }

        const coords = locations.locations.map(loc => [loc.latitude, loc.longitude] as LatLngExpression);

        if (coords.length === 1) {
            return { center: coords[0], zoom: 15 };
        }

        const lats = coords.map(coord => (coord as [number, number])[0]);
        const lngs = coords.map(coord => (coord as [number, number])[1]);

        const center: LatLngExpression = [
            (Math.min(...lats) + Math.max(...lats)) / 2,
            (Math.min(...lngs) + Math.max(...lngs)) / 2,
        ];

        return { center, zoom: 14 };
    };

    const { center, zoom } = getMapBounds();

    const getPersonColorFromResponse = (person?: string): string => {
        if (locations?.person_colors && person && locations.person_colors[person]) {
            return locations.person_colors[person];
        }
        return getPersonColor(person);
    };

    const locationsByPerson = useMemo(() => {
        return locations?.locations?.reduce((acc, location) => {
            const person = location.person || locations?.person || 'unknown';
            if (!acc[person]) {
                acc[person] = [];
            }
            acc[person].push(location);
            return acc;
        }, {} as Record<string, typeof locations.locations>) || {};
    }, [locations]);

    useEffect(() => {
        const persons = new Set(Object.keys(locationsByPerson));
        setVisiblePersons(persons);
    }, [locationsByPerson]);

    const clustersByPerson = useMemo(() => {
        const result: Record<string, ClusterItem[]> = {};
        Object.entries(locationsByPerson).forEach(([person, locs]) => {
            // Always create clusters, visibility will be handled in rendering
            result[person] = showClusters ? clusterLocations(locs) : locs.map(loc => ({
                locations: [loc],
                center: [loc.latitude, loc.longitude] as LatLngExpression,
                person
            }));
        });
        return result;
    }, [locationsByPerson, showClusters]);

    const getMarkerSize = (timestamp: string, allTimestamps: string[]) => {
        if (allTimestamps.length <= 1) return 'medium';

        const sortedTimes = [...allTimestamps].sort();
        const index = sortedTimes.indexOf(timestamp);
        const ratio = index / (sortedTimes.length - 1);

        if (ratio < 0.3) return 'small';
        if (ratio > 0.8) return 'large';
        return 'medium';
    };

    const allTimestamps = useMemo(() => {
        return locations?.locations?.map(loc => loc.timestamp) || [];
    }, [locations]);

    const latestTimestamp = useMemo(() => {
        if (!allTimestamps.length) return null;
        return allTimestamps.reduce((latest, current) =>
            new Date(current) > new Date(latest) ? current : latest
        );
    }, [allTimestamps]);

    const pathsByPerson = Object.entries(locationsByPerson).reduce((acc, [person, locs]) => {
        if (visiblePersons.has(person)) {
            acc[person] = locs.map(loc => [loc.latitude, loc.longitude] as LatLngExpression);
        }
        return acc;
    }, {} as Record<string, LatLngExpression[]>);

    const togglePersonVisibility = (person: string) => {
        const newVisible = new Set(visiblePersons);
        if (newVisible.has(person)) {
            newVisible.delete(person);
        } else {
            newVisible.add(person);
        }
        setVisiblePersons(newVisible);
    };

    return (
        <MapContainer
            center={center}
            zoom={zoom}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {Object.entries(clustersByPerson).map(([person, clusters]) =>
                visiblePersons.has(person) && clusters.map((cluster, clusterIndex) => {
                    const color = getPersonColorFromResponse(person);

                    if (cluster.locations.length === 1) {
                        const location = cluster.locations[0];
                        const markerSize = getMarkerSize(location.timestamp, allTimestamps);
                        const isLatest = location.timestamp === latestTimestamp;

                        return (
                            <Marker
                                key={`${location.timestamp}-${person}-${clusterIndex}`}
                                position={[location.latitude, location.longitude]}
                                icon={personIcon(person, color, markerSize, isLatest)}
                            >
                                <Popup>
                                    <div className="p-2 min-w-[200px]">
                                        <div className="font-semibold text-lg mb-2" style={{ color: getPersonColorFromResponse(person) }}>
                                            {person}
                                        </div>
                                        <div className="space-y-1 text-sm">
                                            <div><strong>Time (UTC):</strong> {new Date(location.timestamp).toISOString().replace('T', ' ').replace('Z', ' UTC')}</div>
                                            <div><strong>Coordinates:</strong> {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</div>
                                            <div><strong>Altitude:</strong> {location.altitude}m</div>
                                            <div><strong>Speed:</strong> {location.speed_mps.toFixed(1)} m/s</div>
                                            <div><strong>Accuracy:</strong> ±{location.horizontal_accuracy_meters}m</div>
                                            {isLatest && <div className="text-green-600 font-semibold">📍 Latest Position</div>}
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        );
                    } else {
                        return (
                            <Marker
                                key={`cluster-${person}-${clusterIndex}`}
                                position={cluster.center}
                                icon={createClusterIcon(cluster.locations.length, color)}
                            >
                                <Popup>
                                    <div className="p-2 min-w-[250px]">
                                        <div className="font-semibold text-lg mb-2" style={{ color: getPersonColorFromResponse(person) }}>
                                            {person} - {cluster.locations.length} locations
                                        </div>
                                        <div className="space-y-2 text-sm max-h-48 overflow-y-auto">
                                            {cluster.locations.map((location: LocationItem, locIndex: number) => (
                                                <div key={locIndex} className="border-b border-gray-200 pb-1 last:border-b-0">
                                                    <div><strong>Time:</strong> {new Date(location.timestamp).toLocaleString()}</div>
                                                    <div><strong>Coords:</strong> {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        );
                    }
                })
            )}

            {showPaths && Object.entries(pathsByPerson).map(([person, coordinates]) =>
                visiblePersons.has(person) && coordinates.length > 1 && (
                    <Polyline
                        key={`path-${person}`}
                        positions={coordinates}
                        color={getPersonColorFromResponse(person)}
                        weight={3}
                        opacity={0.7}
                    />
                )
            )}

            {showArrows && Object.entries(pathsByPerson).map(([person, coordinates]) =>
                visiblePersons.has(person) && coordinates.length > 1 && coordinates.slice(0, -1).map((coord, index) => {
                    const nextCoord = coordinates[index + 1];
                    const [lat1, lng1] = coord as [number, number];
                    const [lat2, lng2] = nextCoord as [number, number];

                    const bearing = calculateBearing(lat1, lng1, lat2, lng2);
                    const midpoint = getMidpoint(lat1, lng1, lat2, lng2);

                    return (
                        <Marker
                            key={`arrow-${person}-${index}`}
                            position={midpoint}
                            icon={createArrowIcon(getPersonColorFromResponse(person), bearing)}
                        />
                    );
                })
            )}

            {(locations?.persons || Object.keys(locationsByPerson).length > 0) && (
                <div className="map-controls" style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    zIndex: 1000,
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    padding: '12px',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    minWidth: '200px',
                    maxWidth: '280px',
                    backdropFilter: 'blur(10px)',
                    color: '#374151'
                }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px', color: '#111827' }}>Map Controls</div>

                    <div style={{ marginBottom: '10px', fontSize: '11px', color: '#374151' }}>
                        <label style={{ display: 'flex', alignItems: 'center', marginBottom: '4px', cursor: 'pointer', color: '#374151' }}>
                            <input
                                type="checkbox"
                                checked={showPaths}
                                onChange={(e) => setShowPaths(e.target.checked)}
                                style={{ marginRight: '6px' }}
                            />
                            <span style={{ color: '#374151' }}>Show Paths</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', marginBottom: '4px', cursor: 'pointer', color: '#374151' }}>
                            <input
                                type="checkbox"
                                checked={showArrows}
                                onChange={(e) => setShowArrows(e.target.checked)}
                                style={{ marginRight: '6px' }}
                            />
                            <span style={{ color: '#374151' }}>Show Direction Arrows</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', marginBottom: '4px', cursor: 'pointer', color: '#374151' }}>
                            <input
                                type="checkbox"
                                checked={showClusters}
                                onChange={(e) => setShowClusters(e.target.checked)}
                                style={{ marginRight: '6px' }}
                            />
                            <span style={{ color: '#374151' }}>Group Nearby Points</span>
                        </label>
                    </div>

                    <div style={{ fontWeight: 'bold', marginBottom: '6px', fontSize: '12px', color: '#111827' }}>People ({Object.keys(locationsByPerson).length})</div>
                    {Object.entries(locationsByPerson).map(([person, locs]) => (
                        <div key={person} className="person-toggle" style={{
                            display: 'flex',
                            alignItems: 'center',
                            marginBottom: '4px',
                            fontSize: '11px',
                            padding: '4px 6px',
                            borderRadius: '4px',
                            backgroundColor: visiblePersons.has(person) ? 'rgba(59, 130, 246, 0.1)' : '#f3f4f6',
                            cursor: 'pointer',
                            opacity: visiblePersons.has(person) ? 1 : 0.6,
                            transition: 'all 0.2s ease'
                        }}
                            onClick={() => togglePersonVisibility(person)}
                        >
                            <div
                                style={{
                                    width: '12px',
                                    height: '12px',
                                    backgroundColor: getPersonColorFromResponse(person),
                                    marginRight: '6px',
                                    borderRadius: '50%',
                                    border: visiblePersons.has(person) ? 'none' : '2px solid #9ca3af'
                                }}
                            />
                            <span style={{ flex: 1, color: '#374151' }}>{person}</span>
                            <span style={{ color: '#6b7280', fontSize: '10px' }}>({locs.length})</span>
                        </div>
                    ))}

                    {Object.keys(locationsByPerson).length > 1 && (
                        <div style={{ marginTop: '8px', fontSize: '10px', color: '#6b7280', borderTop: '1px solid #e5e7eb', paddingTop: '6px' }}>
                            💡 Click person names to toggle visibility
                        </div>
                    )}
                </div>
            )}
        </MapContainer>
    );
}
