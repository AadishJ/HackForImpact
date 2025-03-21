"use client"

import { MapContainer, Marker, Popup, TileLayer, useMap, Polyline } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import "leaflet-defaulticon-compatibility"
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css"
import "leaflet-routing-machine/dist/leaflet-routing-machine.css"
import L from "leaflet"
import "leaflet-routing-machine"
import { useEffect, useRef, useState } from "react"

const DEFAULT_POSITION: [number, number] = [41.8781, -87.6298]
const DEFAULT_ZOOM = 12

// Enhanced route options
const ROUTE_OPTIONS = [
    {
        name: 'Walking Route',
        profile: 'foot',
        color: '#6FA1EC',
        options: { alternatives: true }
    },
    {
        name: 'Driving Route',
        profile: 'car',
        color: '#EC6F6F',
        options: { alternatives: true }
    },
    {
        name: 'Cycling Route',
        profile: 'bike',
        color: '#6FEC8E',
        options: { alternatives: true }
    }
];

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

interface RouteData {
    points: L.LatLng[];
    name: string;
    color: string;
    routeType: string;
    isAlternative: boolean;
    summary?: {
        totalDistance: number;
        totalTime: number;
    };
}

interface RoutingMachineProps {
    source: L.LatLng;
    destination: L.LatLng;
    onRoutesFound: (routes: RouteData[]) => void;
}

function RoutingMachine({ source, destination, onRoutesFound }: RoutingMachineProps) {
    const map = useMap();
    const routingControlsRef = useRef<L.Routing.Control[]>([]);
    const [routes, setRoutes] = useState<RouteData[]>([]);
    const requestCompletedRef = useRef<boolean>(false);

    // Calculate number of routing controls we'll create
    // For each route type, we create 4 controls with different via points
    const totalRoutingControls = ROUTE_OPTIONS.length * 4;
    const [pendingRoutes, setPendingRoutes] = useState(totalRoutingControls);

    useEffect(() => {
        if (!map) return;
        requestCompletedRef.current = false;

        // Clean up previous routing controls
        routingControlsRef.current.forEach(control => {
            if (control) map.removeControl(control);
        });
        routingControlsRef.current = [];
        setRoutes([]);
        setPendingRoutes(totalRoutingControls);

        // For each route type, create multiple routing controls with different waypoints
        ROUTE_OPTIONS.forEach((routeOption) => {
            try {
                // Create the base (direct) route
                createRoutingControl(routeOption, [source, destination], 0);

                // Calculate midpoint between source and destination
                const midLat = (source.lat + destination.lat) / 2;
                const midLng = (source.lng + destination.lng) / 2;

                // Create alternative routes by adding via points in different directions
                // North of midpoint
                const northPoint = new L.LatLng(midLat + 0.003, midLng);
                createRoutingControl(routeOption, [source, northPoint, destination], 1);

                // East of midpoint
                const eastPoint = new L.LatLng(midLat, midLng + 0.004);
                createRoutingControl(routeOption, [source, eastPoint, destination], 2);

                // South of midpoint
                const southPoint = new L.LatLng(midLat - 0.003, midLng);
                createRoutingControl(routeOption, [source, southPoint, destination], 3);
            } catch (error) {
                console.error(`Error setting up routing for ${routeOption.name}:`, error);
                setPendingRoutes(prev => prev - 4); // Decrement by 4 since we create 4 controls per route type
            }
        });

        // Set fit bounds to include both source and destination
        const bounds = L.latLngBounds([source, destination]);
        map.fitBounds(bounds, { padding: [50, 50] });

        return () => {
            routingControlsRef.current.forEach(control => {
                if (control) {
                    try {
                        map.removeControl(control);
                    } catch (e) {
                        console.error("Error removing routing control:", e);
                    }
                }
            });
        };
    }, [map, source, destination]); // eslint-disable-line react-hooks/exhaustive-deps

    // Helper function to create a routing control
    function createRoutingControl(
        routeOption: typeof ROUTE_OPTIONS[0],
        waypoints: L.LatLng[],
        variantIndex: number
    ) {
        const routingControl = L.Routing.control({
            waypoints: waypoints,
            routeWhileDragging: false,
            showAlternatives: false, // We'll manually handle alternatives
            lineOptions: {
                styles: [{
                    color: variantIndex === 0 ? routeOption.color : generateAltColor(routeOption.color, variantIndex),
                    weight: variantIndex === 0 ? 5 : 4,
                    opacity: variantIndex === 0 ? 0.8 : 0.6
                }],
                extendToWaypoints: true,
                missingRouteTolerance: 0
            },
            show: false,
            addWaypoints: false,
            fitSelectedRoutes: false,
            plan: L.Routing.plan(waypoints, {
                createMarker: () => false, // Don't create additional markers
                waypointNameFallback: (latLng: L.LatLng) => {
                    // Simple naming for waypoints
                    if (latLng.equals(source)) {
                        return 'Start';
                    } else if (latLng.equals(destination)) {
                        return 'Destination';
                    } else {
                        return 'Via';
                    }
                }
            }),
            router: new L.Routing.OSRMv1({
                serviceUrl: 'https://router.project-osrm.org/route/v1',
                profile: routeOption.profile,
                useHints: false,
                suppressDemoServerWarning: true
            })
        });

        routingControl.on('routesfound', (e: L.Routing.RoutingResultEvent) => {
            if (e.routes && e.routes.length > 0) {
                // Only use the first route from each control (since we've created multiple controls)
                const route = e.routes[0];

                // Create route data object
                const isAlternative = variantIndex > 0;
                const routeName = isAlternative ?
                    `${routeOption.name} (Alternative ${variantIndex})` :
                    routeOption.name;

                const routeColor = isAlternative ?
                    generateAltColor(routeOption.color, variantIndex) :
                    routeOption.color;

                const newRoute: RouteData = {
                    points: route.coordinates || [],
                    name: routeName,
                    color: routeColor,
                    routeType: routeOption.profile,
                    isAlternative: isAlternative,
                    summary: route.summary ? {
                        totalDistance: route.summary.totalDistance,
                        totalTime: route.summary.totalTime
                    } : undefined
                };

                setRoutes(prevRoutes => [...prevRoutes, newRoute]);
                setPendingRoutes(prev => prev - 1);
            } else {
                setPendingRoutes(prev => prev - 1);
            }
        });

        routingControl.on('routingerror', () => {
            console.log(`Route finding error for ${routeOption.name} variant ${variantIndex}`);
            setPendingRoutes(prev => prev - 1);
        });

        routingControl.addTo(map);
        routingControlsRef.current.push(routingControl);
    }

    // When all routes have been found, pass them to the parent component
    useEffect(() => {
        if (pendingRoutes === 0 && !requestCompletedRef.current) {
            requestCompletedRef.current = true;
            onRoutesFound(routes);
        }
    }, [routes, pendingRoutes, onRoutesFound]);

    return (
        <>
            {routes.map((route, index) => (
                <Polyline
                    key={index}
                    positions={route.points}
                    color={route.color}
                    weight={route.isAlternative ? 4 : 5}
                    opacity={route.isAlternative ? 0.6 : 0.8}
                    dashArray={route.isAlternative ? "5, 5" : ""} // Dashed lines for alternatives
                >
                    <Popup>
                        <strong>{route.name}</strong>
                        {route.summary && (
                            <>
                                <br />
                                Distance: {(route.summary.totalDistance / 1000).toFixed(2)} km
                                <br />
                                Time: {Math.floor(route.summary.totalTime / 60)} mins
                            </>
                        )}
                    </Popup>
                </Polyline>
            ))}
        </>
    );
}

interface MapProps {
    source: L.LatLng | null;
    destination: L.LatLng | null;
    onRoutesFound: (routes: RouteData[]) => void;
}

export default function Map({ source, destination, onRoutesFound }: MapProps) {
    return (
        <div style={{ height: "500px", width: "100%" }}>
            <MapContainer
                center={DEFAULT_POSITION}
                zoom={DEFAULT_ZOOM}
                scrollWheelZoom={true}
                style={{ height: "100%", width: "100%" }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {source && (
                    <Marker position={source}>
                        <Popup>
                            <strong>Start</strong>
                            <br />
                            {source.lat.toFixed(5)}, {source.lng.toFixed(5)}
                        </Popup>
                    </Marker>
                )}
                {destination && (
                    <Marker position={destination}>
                        <Popup>
                            <strong>Destination</strong>
                            <br />
                            {destination.lat.toFixed(5)}, {destination.lng.toFixed(5)}
                        </Popup>
                    </Marker>
                )}
                {source && destination && (
                    <RoutingMachine
                        source={source}
                        destination={destination}
                        onRoutesFound={onRoutesFound}
                    />
                )}
            </MapContainer>
        </div>
    );
}