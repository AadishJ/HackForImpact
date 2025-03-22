/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

// Define route colors and styles
const PRIMARY_ROUTE_COLOR = '#6FA1EC';


const TRAVEL_MODE_COLORS = {
    'walking': '#22c55e', // Green
    'car': '#ef4444',     // Red
    'bike': '#3b82f6',    // Blue
    'transit': '#f59e0b', // Amber
    'flight': '#6366f1',  // Indigo
    'train': '#8b5cf6',   // Purple
    'unknown': '#71717a'  // Gray
};

// Helper function to create color variations for alternative routes
function generateAltColor(baseColor: string, index: number): string {
    const hex = baseColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Alternate between lighter and darker variants
    let factor;
    if (index % 2 === 0) {
        factor = 1 - (0.15 * (Math.floor(index / 2) + 1));  // Darker
    } else {
        factor = 1 + (0.15 * (Math.floor(index / 2) + 1));  // Lighter
    }

    const newR = Math.min(255, Math.max(0, Math.round(r * factor)));
    const newG = Math.min(255, Math.max(0, Math.round(g * factor)));
    const newB = Math.min(255, Math.max(0, Math.round(b * factor)));

    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

// Define the route data interface
export interface RouteData {
    points: any[];
    name: string;
    color: string;
    isAlternative: boolean;
    travelMode?: string;
    summary?: {
        totalDistance: number;
        totalTime: number;
    };
    safetyScore?: number;
    safetyLabel?: string;
    safetyStatus?: string;
}

interface MapProps {
    sourceCoords: { lat: string; lng: string } | null;
    destCoords: { lat: string; lng: string } | null;
    travelMode?: string;
    onRoutesFound: (routes: RouteData[]) => void;
    className?: string;
    height?: string;
}

const Map = ({
    sourceCoords,
    destCoords,
    travelMode = 'walking',
    onRoutesFound,
    className = "",
    height = "250px"
}: MapProps) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [routes, setRoutes] = useState<RouteData[]>([]);
    const requestCompletedRef = useRef<boolean>(false);
    const markerRefsRef = useRef<any[]>([]);

    // Calculate number of alternative routes to try
    const ROUTE_VARIANTS = 2; // Reduced to 2 for better performance
    const [pendingRoutes, setPendingRoutes] = useState(ROUTE_VARIANTS + 1); // Base route + variants

    // Initialize map and fetch routes
    useEffect(() => {
        // If we don't have source and destination coordinates, or the container isn't ready, exit
        if (!sourceCoords || !destCoords || !mapContainerRef.current) return;

        let isMounted = true;

        const initializeMap = async () => {
            try {
                console.log("Initializing map...");
                setIsLoading(true);
                requestCompletedRef.current = false;
                setPendingRoutes(ROUTE_VARIANTS + 1);
                setRoutes([]);

                // Import Leaflet
                const leafletModule = await import('leaflet');
                const L = leafletModule.default;

                // Fix Leaflet's icon paths using type assertion to avoid TypeScript errors
                delete (L.Icon.Default.prototype as any)._getIconUrl;
                L.Icon.Default.mergeOptions({
                    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
                    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
                    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
                });

                // Parse coordinates as floats
                const sourceLat = parseFloat(sourceCoords.lat);
                const sourceLng = parseFloat(sourceCoords.lng);
                const destLat = parseFloat(destCoords.lat);
                const destLng = parseFloat(destCoords.lng);

                // Create source and destination LatLng objects
                const sourceLatLng = L.latLng(sourceLat, sourceLng);
                const destLatLng = L.latLng(destLat, destLng);

                // Clean up any existing map
                if (mapInstanceRef.current) {
                    mapInstanceRef.current.remove();
                    mapInstanceRef.current = null;
                }

                // Center map between source and destination
                const centerLat = (sourceLat + destLat) / 2;
                const centerLng = (sourceLng + destLng) / 2;

                // Only try to create the map if the container is still mounted
                if (!mapContainerRef.current || !isMounted) return;

                try {
                    // Create map
                    mapInstanceRef.current = L.map(mapContainerRef.current).setView([centerLat, centerLng], 12);

                    // Add the tile layer (map background)
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    }).addTo(mapInstanceRef.current);

                    // Force a resize to ensure the map renders correctly
                    setTimeout(() => {
                        if (mapInstanceRef.current && isMounted) {
                            mapInstanceRef.current.invalidateSize();
                        }
                    }, 100);

                    try {
                        // Clear any existing markers first
                        markerRefsRef.current.forEach(marker => {
                            if (mapInstanceRef.current) {
                                marker.remove();
                            }
                        });
                        markerRefsRef.current = [];

                        // Create and store new markers
                        const sourceMarker = L.marker([sourceLat, sourceLng])
                            .addTo(mapInstanceRef.current)
                            .bindPopup('<strong>Start</strong>');

                        const destMarker = L.marker([destLat, destLng])
                            .addTo(mapInstanceRef.current)
                            .bindPopup('<strong>Destination</strong>');

                        // Store references to the markers for later cleanup
                        markerRefsRef.current = [sourceMarker, destMarker];

                        // Fit bounds to show both markers
                        const bounds = L.latLngBounds(
                            [sourceLat, sourceLng],
                            [destLat, destLng]
                        );
                        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
                    } catch (e) {
                        console.error("Error creating markers:", e);
                    }
                } catch (e) {
                    console.error("Error creating map:", e);
                    // Continue with route calculations even if map fails
                }

                // Get the appropriate routing profile based on travel mode
                const getRoutingProfile = (mode: string): string => {
                    switch (mode) {
                        case 'car': return 'car';
                        case 'bike': return 'bike';
                        case 'walking': return 'foot';
                        case 'train':
                        case 'transit':
                            return 'foot'; // Default to foot for public transit (OSRM limitation)
                        default: return 'foot';
                    }
                };

                const routingProfile = getRoutingProfile(travelMode);
                const routeColor = TRAVEL_MODE_COLORS[travelMode as keyof typeof TRAVEL_MODE_COLORS] || PRIMARY_ROUTE_COLOR;

                // Create a simplified route finder using fetch directly
                const getOSRMRoute = async (waypoints: any[], profile: string, variant: number) => {
                    try {
                        // Construct coordinates string for OSRM
                        const coords = waypoints.map(wp => `${wp.lng},${wp.lat}`).join(';');

                        // Create OSRM API URL
                        const url = `https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=full&geometries=geojson`;

                        console.log(`Fetching route from OSRM: ${url}`);
                        const response = await fetch(url);
                        if (!response.ok) {
                            throw new Error(`OSRM API responded with status: ${response.status}`);
                        }

                        const data = await response.json();

                        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
                            throw new Error('No route found');
                        }

                        const route = data.routes[0];

                        // Convert GeoJSON coordinates to LatLng points
                        const coordinates = route.geometry.coordinates.map((coord: [number, number]) => {
                            return { lat: coord[1], lng: coord[0] };
                        });

                        // Create route summary
                        const summary = {
                            totalDistance: route.distance, // in meters
                            totalTime: route.duration // in seconds
                        };

                        // Determine if this is the main route or an alternative
                        const isAlt = variant > 0;
                        const modeName = travelMode.charAt(0).toUpperCase() + travelMode.slice(1);
                        const routeName = isAlt
                            ? `Alternative ${modeName} Route ${variant}`
                            : `${modeName} Route`;

                        // Determine color based on variant
                        const routeColorFinal = isAlt
                            ? generateAltColor(routeColor, variant)
                            : routeColor;

                        // Draw the route on the map if the map instance exists
                        if (mapInstanceRef.current && isMounted) {
                            try {
                                const routePoints = coordinates.map((coord: any) => [coord.lat, coord.lng]);
                                L.polyline(routePoints, { color: routeColorFinal, weight: 5, opacity: 0.7 }).addTo(mapInstanceRef.current);
                            } catch (e) {
                                console.error("Error drawing route on map:", e);
                            }
                        }

                        // Create route data object
                        const routeData: RouteData = {
                            points: coordinates,
                            name: routeName,
                            color: routeColorFinal,
                            isAlternative: isAlt,
                            travelMode,
                            summary
                        };

                        return routeData;
                    } catch (error) {
                        console.error('Error fetching route:', error);
                        return null;
                    }
                };

                // Generate main route and alternatives - directly generate routes without setupMapAndGenerateRoutes function
                const generateAllRoutes = async () => {
                    try {
                        // Main route (direct)
                        const mainRoute = await getOSRMRoute([sourceLatLng, destLatLng], routingProfile, 0);
                        if (mainRoute && isMounted) {
                            setRoutes(prev => [...prev, mainRoute]);
                        }

                        // Calculate midpoint for alternatives
                        const midLat = (sourceLat + destLat) / 2;
                        const midLng = (sourceLng + destLng) / 2;

                        // Define detour points for alternatives
                        const detourPoints = [
                            // North-east of midpoint
                            L.latLng(midLat + 0.005, midLng + 0.005),
                            // South-west of midpoint
                            L.latLng(midLat - 0.005, midLng - 0.005),
                        ];

                        // Generate alternative routes
                        for (let i = 0; i < detourPoints.length; i++) {
                            if (!isMounted) break;

                            const altRoute = await getOSRMRoute(
                                [sourceLatLng, detourPoints[i], destLatLng],
                                routingProfile,
                                i + 1
                            );

                            if (altRoute && isMounted) {
                                setRoutes(prev => [...prev, altRoute]);
                            }
                        }

                        // Signal that we're done loading routes
                        if (isMounted) {
                            setPendingRoutes(0);
                            setIsLoading(false);
                        }
                    } catch (error) {
                        console.error('Error generating routes:', error);
                        if (isMounted) {
                            setIsLoading(false);
                            setPendingRoutes(0);
                        }
                    }
                };

                // Start generating routes
                generateAllRoutes();
            } catch (error) {
                console.error('Error initializing map:', error);
                if (isMounted) {
                    setIsLoading(false);
                    setPendingRoutes(0);
                }
            }
        };

        initializeMap();

        // Cleanup function
        return () => {
            isMounted = false;
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, [sourceCoords, destCoords, travelMode]);

    // When all routes have been found, pass them to the parent component
    useEffect(() => {
        if (routes.length > 0 && pendingRoutes === 0 && !requestCompletedRef.current) {
            console.log("All routes calculated. Sending to parent component:", routes);
            requestCompletedRef.current = true;

            // Sort routes: main route first, then alternatives
            const sortedRoutes = [...routes].sort((a, b) => {
                if (a.isAlternative === b.isAlternative) return 0;
                return a.isAlternative ? 1 : -1;
            });

            onRoutesFound(sortedRoutes);
        }
    }, [routes, pendingRoutes, onRoutesFound]);

    // Force map to resize when container dimensions change
    useEffect(() => {
        const observer = new ResizeObserver(() => {
            if (mapInstanceRef.current) {
                console.log("Map container resized, invalidating map size");
                setTimeout(() => {
                    if (mapInstanceRef.current) {
                        mapInstanceRef.current.invalidateSize();
                    }
                }, 100);
            }
        });

        if (mapContainerRef.current) {
            observer.observe(mapContainerRef.current);
        }

        return () => {
            observer.disconnect();
        };
    }, []);

    return (
        <div className={`relative ${className}`}>
            <div
                ref={mapContainerRef}
                className="w-full rounded overflow-hidden border border-gray-200"
                style={{ height: height, background: '#f0f0f0' }}
            >
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-70 z-10">
                        <div className="text-center">
                            <svg className="animate-spin h-8 w-8 text-blue-500 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p className="text-sm text-gray-600">Calculating routes...</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Map;