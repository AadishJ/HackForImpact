"use client"

import dynamic from 'next/dynamic'
import { useState } from "react"
import type { LatLng } from 'leaflet'
import axios from 'axios'
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react'

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
  safetyScore?: number;
  safetyStatus?: 'safe' | 'moderate' | 'unsafe';
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
  const [safetyLoading, setSafetyLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const handleRoutesFound = async (newRoutes: RouteData[]) => {
    setLoading(false);

    if (newRoutes.length > 0) {
      setSafetyLoading(true);
      setApiError(null);

      try {
        // Prepare route points for the API
        const routePointsForApi = newRoutes.map(route =>
          route.points.map(point => ({
            lat: point.lat,
            lng: point.lng
          }))
        );

        // Call safety API
        const response = await axios.post('http://localhost:5000/classify_route', routePointsForApi);
        const safetyScores = response.data;
        console.log('Safety scores:', safetyScores);
        // Update routes with safety scores
        const routesWithSafety = newRoutes.map((route, index) => {
          const score = typeof safetyScores === 'number'
            ? safetyScores
            : (Array.isArray(safetyScores) ? safetyScores[index] || 0 : 0);

          let safetyStatus: 'safe' | 'moderate' | 'unsafe';

          // Since scores are normally near 0 (very safe) and 9 is unsafe:
          // We'll define appropriate thresholds for your data
          if (score <= 0.3) {
            safetyStatus = 'safe';
          } else if (score <= 1.0) {
            safetyStatus = 'moderate';
          } else {
            safetyStatus = 'unsafe';
          }

          // Calculate a normalized score for display purposes (0-100%)
          // Where 0 = 100% safe and 9 = 0% safe
          const normalizedScore = Math.max(0, Math.min(100, 100 - (score / 9 * 100))) / 100;

          return {
            ...route,
            rawSafetyScore: score,          // Keep the original score
            safetyScore: normalizedScore,   // Use the normalized score for display
            safetyStatus
          };
        });

       // In your handleRoutesFound function, after sorting routes:

// Sort routes by raw safety score (lowest/safest first since 0 is safest)
const sortedRoutes = [...routesWithSafety].sort((a, b) =>
  (a.rawSafetyScore || 0) - (b.rawSafetyScore || 0)
);

// Add relative safety labels
let prevScore = -1;
const routesWithLabels = sortedRoutes.map((route, index) => {
  let relativeLabel = '';
  const score = route.rawSafetyScore || 0;
  
  if (index === 0) {
    // First route is safest, unless tied
    if (sortedRoutes.length > 1 && Math.abs(score - (sortedRoutes[1].rawSafetyScore || 0)) < 0.001) {
      relativeLabel = 'Equally Safe';
    } else {
      relativeLabel = 'Safest Option';
    }
  } else if (index === sortedRoutes.length - 1) {
    // Last route is least safe, unless tied with previous
    if (Math.abs(score - prevScore) < 0.001) {
      relativeLabel = 'Equally Safe';
    } else {
      relativeLabel = 'Least Safe Option';
    }
  } else {
    // Middle routes
    if (Math.abs(score - prevScore) < 0.001) {
      relativeLabel = 'Equally Safe';
    } else if (Math.abs(score - (sortedRoutes[index + 1].rawSafetyScore || 0)) < 0.001) {
      relativeLabel = 'Equally Safe';
    } else {
      relativeLabel = 'Safer Alternative';
    }
  }
  
  prevScore = score;
  
  return {
    ...route,
    safetyLabel: relativeLabel
  };
});

setRoutes(routesWithLabels);

        setRoutes(sortedRoutes);
      } catch (error) {
        console.error('Error fetching safety data:', error);
        setApiError('Failed to assess route safety. Using routes without safety data.');
        setRoutes(newRoutes);
      } finally {
        setSafetyLoading(false);
      }
    } else {
      setRoutes([]);
    }
  };

  const handleLocationChange = (type: 'source' | 'destination', location: LatLng | null) => {
    if (type === 'source') {
      setSource(location);
    } else {
      setDestination(location);
    }

    // Reset routes when locations change
    setRoutes([]);
    setApiError(null);

    // Set loading state if both locations are set
    if ((type === 'source' && location && destination) ||
      (type === 'destination' && location && source)) {
      setLoading(true);
    }
  };

  // Get color based on safety status
  const getSafetyColor = (status?: 'safe' | 'moderate' | 'unsafe') => {
    switch (status) {
      case 'safe': return 'text-green-600';
      case 'moderate': return 'text-yellow-500';
      case 'unsafe': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  // Get icon based on safety status
  const getSafetyIcon = (status?: 'safe' | 'moderate' | 'unsafe') => {
    switch (status) {
      case 'safe': return <ShieldCheck className="mr-1" size={18} />;
      case 'moderate': return <Shield className="mr-1" size={18} />;
      case 'unsafe': return <ShieldAlert className="mr-1" size={18} />;
      default: return null;
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">WalkSafe Route Planner</h1>

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

        {safetyLoading && (
          <div className="text-center py-4 bg-blue-50 rounded-md p-3">
            <p className="font-medium flex items-center justify-center">
              <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Analyzing route safety...
            </p>
          </div>
        )}

        {apiError && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
            <p className="text-red-700">{apiError}</p>
          </div>
        )}

        {!loading && !safetyLoading && routes.length > 0 && (
          <>
            <h2 className="text-2xl font-semibold mb-4">Suggested Routes ({routes.length})</h2>

            {routes[0]?.safetyScore !== undefined && (
              <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-green-800 font-medium">
                  Routes are ordered by safety score, with the safest route first.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {routes.map((route, index) => (
                <div
                  key={index}
                  className={`border rounded-lg overflow-hidden shadow-sm ${index === 0 ? 'ring-2 ring-green-300' : ''}`}
                  style={{ borderLeftColor: route.color, borderLeftWidth: '6px' }}
                >
                  <div className="p-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium">{route.name}</h3>

                      {route.safetyScore !== undefined && (
                        <div className={`flex items-center font-medium ${getSafetyColor(route.safetyStatus)}`}>
                          {getSafetyIcon(route.safetyStatus)}
                          <span>
                            {route.safetyStatus === 'safe' ? 'Safe' :
                              route.safetyStatus === 'moderate' ? 'Moderate' : 'Caution'}
                          </span>
                        </div>
                      )}
                    </div>

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

                    {route.safetyScore !== undefined && (
                      <div className="mt-3">
                        <p className="text-sm text-gray-500">Safety Score</p>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                          <div
                            className={`h-2.5 rounded-full ${route.safetyStatus === 'safe' ? 'bg-green-500' :
                              route.safetyStatus === 'moderate' ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                            style={{ width: `${(route.safetyScore * 100).toFixed(0)}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-xs mt-1">
                          <span>{(route.safetyScore * 100).toFixed(0)}% safe</span>
                        </div>
                      </div>
                    )}

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

        {!loading && !safetyLoading && routes.length === 0 && source && destination && (
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
              setSafetyLoading(false);
              setApiError(null);
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