"use client"

import dynamic from 'next/dynamic'
import { useState } from "react"
import type { LatLng } from 'leaflet'

// Dynamically import components to avoid server-side rendering issues with Leaflet
const Map = dynamic(
  () => import('./Components/Map'),
  { ssr: false, loading: () => <div className="h-96 w-full flex items-center justify-center bg-gray-100">Loading map...</div> }
)

const LocationSelector = dynamic(
  () => import('./Components/Selector'),
  { ssr: false, loading: () => <div className="p-4 bg-gray-100">Loading location selector...</div> }
)

interface RouteData {
  points: LatLng[];
  name: string;
  color: string;
  summary?: {
    totalDistance: number;
    totalTime: number;
  };
}

export default function MyPage() {
  const [source, setSource] = useState<LatLng | null>(null);
  const [destination, setDestination] = useState<LatLng | null>(null);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [loading, setLoading] = useState(false);

  const handleRoutesFound = (newRoutes: RouteData[]) => {
    setRoutes(newRoutes);
    setLoading(false);
  };

  const handleLocationChange = (type: 'source' | 'destination', location: LatLng | null) => {
    if (type === 'source') {
      setSource(location);
    } else {
      setDestination(location);
    }

    // Reset routes when locations change
    setRoutes([]);

    // Set loading state if both locations are set
    if ((type === 'source' && location && destination) ||
      (type === 'destination' && location && source)) {
      setLoading(true);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Chicago Multi-Route Planner</h1>

      <LocationSelector
        onSourceChange={(location) => handleLocationChange('source', location)}
        onDestinationChange={(location) => handleLocationChange('destination', location)}
      />

      <div className="mb-6">
        <Map
          source={source}
          destination={destination}
          onRoutesFound={handleRoutesFound}
        />
      </div>

      <div className="mt-6">
        {loading && (
          <div className="text-center py-4">
            <p className="font-medium">Calculating routes...</p>
          </div>
        )}

        {!loading && routes.length > 0 && (
          <>
            <h2 className="text-2xl font-semibold mb-4">Available Routes ({routes.length})</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {routes.map((route, index) => (
                <div
                  key={index}
                  className="border rounded-lg overflow-hidden shadow-sm"
                  style={{ borderLeftColor: route.color, borderLeftWidth: '6px' }}
                >
                  <div className="p-4">
                    <h3 className="text-lg font-medium">{route.name}</h3>

                    <div className="mt-2 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Distance</p>
                        <p className="font-medium">
                          {route.summary
                            ? `${(route.summary.totalDistance / 1000).toFixed(2)} km`
                            : `~${(route.points.reduce((acc, point, idx) => {
                              if (idx === 0) return 0;
                              const prevPoint = route.points[idx - 1];
                              return acc + prevPoint.distanceTo(point);
                            }, 0) / 1000).toFixed(2)} km`
                          }
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-gray-500">Estimated Time</p>
                        <p className="font-medium">
                          {route.summary
                            ? `${Math.floor(route.summary.totalTime / 60)} mins`
                            : 'Varies'
                          }
                        </p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <details>
                        <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800">
                          View waypoints ({route.points.length})
                        </summary>
                        <div className="mt-2">
                          <pre className="text-xs bg-gray-50 p-2 rounded max-h-48 overflow-auto">
                            {JSON.stringify(route.points.map((point, i) =>
                              i % 10 === 0 ? { // Only show every 10th point to save space
                                idx: i,
                                lat: point.lat.toFixed(5),
                                lng: point.lng.toFixed(5)
                              } : null
                            ).filter(Boolean), null, 2)}
                          </pre>
                        </div>
                      </details>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && routes.length === 0 && source && destination && (
          <div className="text-center py-6">
            <p className="text-lg">No routes found. Please try different locations.</p>
          </div>
        )}
      </div>

      {(source || destination) && (
        <div className="mt-6">
          <button
            onClick={() => {
              setSource(null);
              setDestination(null);
              setRoutes([]);
              setLoading(false);
            }}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Reset All
          </button>
        </div>
      )}
    </div>
  )
}