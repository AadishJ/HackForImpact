import { useState, useEffect, lazy, Suspense } from 'react';
import { extractCoordinates, isChromeExtension } from './Components/CoordinateExtractor';
import type { RouteData } from './Components/Map';
import axios from 'axios';

// Lazy load the Map component to avoid issues with Leaflet
const Map = lazy(() => import('./Components/Map'));

const App = () => {
  const [currentUrl, setCurrentUrl] = useState<string>('Loading URL...');
  const [sourceCoords, setSourceCoords] = useState<{ lat: string; lng: string } | null>(null);
  const [destCoords, setDestCoords] = useState<{ lat: string; lng: string } | null>(null);
  const [travelMode, setTravelMode] = useState<string>('walking');
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [expandedRouteIndex, setExpandedRouteIndex] = useState<number | null>(null);
  const [safetyLoading, setSafetyLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    // Function to get the current tab URL using Chrome Extension API
    const getCurrentTabUrl = () => {
      // Check if we're in a Chrome extension context
      if (isChromeExtension()) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs && tabs[0] && tabs[0].url) {
            const url = tabs[0].url;
            setCurrentUrl(url);

            // Check if it's a Google Maps URL
            if (url.includes('google.com/maps')) {
              const { source, destination, travelMode: extractedMode } = extractCoordinates(url);
              setSourceCoords(source);
              setDestCoords(destination);
              if (extractedMode) {
                setTravelMode(extractedMode);
              }
            } else {
              setSourceCoords(null);
              setDestCoords(null);
            }
          } else {
            setCurrentUrl('No URL found');
          }
        });
      } else {
        setCurrentUrl('Not running in extension context');

        // For development/testing - parse a sample Maps URL
        const testUrl = "https://www.google.com/maps/dir/Grant+Park,+Chicago,+IL,+USA/Navy+Pier,+600+E+Grand+Ave,+Chicago,+IL+60611,+United+States/@41.8830054,-87.62325,15z/data=!3m1!4b1!4m13!4m12!1m5!1m1!1s0x880e2c9fabc8820f:0xe897c144f1557e1d!2m2!1d-87.6208061!2d41.8741516!1m5!1m1!1s0x880e2b4d91f12edb:0xd0acdb96b088a4dc!2m2!1d-87.6050944!2d41.8918633?entry=ttu&g_ep=EgoyMDI1MDMxOS4xIKXMDSoASAFQAw%3D%3D";
        setCurrentUrl(testUrl);

        const { source, destination, travelMode: extractedMode } = extractCoordinates(testUrl);
        setSourceCoords(source);
        setDestCoords(destination);
        if (extractedMode) {
          setTravelMode(extractedMode);
        }

        console.warn('This application is designed to run as a Chrome extension. Using test URL for development.');
      }
    };

    getCurrentTabUrl();
  }, []);

  // Handle when routes are found
  const handleRoutesFound = async (foundRoutes: RouteData[]) => {
    if (foundRoutes.length > 0) {
      setSafetyLoading(true);
      setApiError(null);

      try {
        // Prepare route points for the API
        const routePointsForApi = foundRoutes.map(route =>
          route.points.map(point => ({
            lat: point.lat,
            lng: point.lng
          }))
        );

        console.log('Sending routes to safety API...');

        // Call safety API
        const response = await axios.post('http://localhost:5000/classify_route', routePointsForApi);
        const safetyScores = response.data;
        console.log('Safety scores:', safetyScores);

        // Update routes with safety scores
        const routesWithSafety = foundRoutes.map((route, index) => {
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

          const normalizedScore = Math.max(0, Math.min(100, 100 - (score / 9 * 100))) / 100;

          return {
            ...route,
            rawSafetyScore: score,          // Keep the original score
            safetyScore: normalizedScore,   // Use the normalized score for display
            safetyStatus
          };
        });

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

        // Set the first (safest) route as expanded by default
        if (routesWithLabels.length > 0) {
          setExpandedRouteIndex(0);
        }

      } catch (error) {
        console.error('Error fetching safety data:', error);
        setApiError('Failed to assess route safety. Using routes without safety data.');
        setRoutes(foundRoutes);

        // Still set first route as expanded even if safety data failed
        if (foundRoutes.length > 0) {
          setExpandedRouteIndex(0);
        }
      } finally {
        setSafetyLoading(false);
      }
    } else {
      setRoutes([]);
      setExpandedRouteIndex(null);
    }
  };

  // Toggle waypoint details visibility
  const toggleWaypointDetails = (index: number) => {
    setExpandedRouteIndex(expandedRouteIndex === index ? null : index);
  };

  // Loading fallback for Map component
  const mapLoadingFallback = (
    <div className="w-full rounded overflow-hidden border border-gray-200 flex items-center justify-center bg-gray-100" style={{ height: "250px" }}>
      <div className="text-center">
        <svg className="animate-spin h-8 w-8 text-blue-500 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-sm text-gray-600">Loading map...</p>
      </div>
    </div>
  );

  return (
    <div className="w-[360px] min-h-[500px] font-sans p-4 bg-gray-50 text-gray-800">
      {/* Header */}
      <header className="text-center mb-4 pb-3 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-green-700 m-0">WalkSafe</h1>
        <p className="text-xs text-gray-500 mt-1">Your personal walking safety companion</p>
      </header>

      {/* Route Display */}
      {sourceCoords && destCoords && (
        <section className="bg-blue-50 rounded-lg p-3 mb-4">
          <h2 className="text-base font-semibold mb-2 text-gray-700">Your Route</h2>

          {/* Map Component with Suspense for lazy loading */}
          <Suspense fallback={mapLoadingFallback}>
            <Map
              sourceCoords={sourceCoords}
              destCoords={destCoords}
              travelMode={travelMode}
              onRoutesFound={handleRoutesFound}
            />
          </Suspense>

          {/* Route Information */}
          {routes.length > 0 && (
            <div className="mt-3">
              <h3 className="text-sm font-semibold mb-2">Suggested Routes ({routes.length})</h3>

              {routes[0]?.safetyScore !== undefined && (
                <div className="mb-3 p-2 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-green-800 text-[10px]">
                    Routes are ordered by safety score, with the safest route first.
                  </p>
                </div>
              )}

              {safetyLoading && (
                <div className="text-center py-2 mb-3">
                  <p className="text-xs flex items-center justify-center">
                    <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Analyzing route safety...
                  </p>
                </div>
              )}

              {apiError && (
                <div className="bg-red-50 border-l-4 border-red-500 p-2 mb-3 text-xs">
                  <p className="text-red-700">{apiError}</p>
                </div>
              )}

              {routes.map((route, index) => (
                <div
                  key={index}
                  className={`bg-white rounded overflow-hidden shadow-sm mb-3 border ${index === 0 ? 'ring-1 ring-green-300' : ''}`}
                  style={{ borderLeftColor: route.color, borderLeftWidth: '4px' }}
                >
                  <div className="p-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <h3 className="text-xs font-medium">{route.name}</h3>
                        {route.safetyLabel && (
                          <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded-full ${route.safetyLabel === 'Safest Option' ? 'bg-green-100 text-green-800' :
                              route.safetyLabel === 'Equally Safe' ? 'bg-blue-100 text-blue-800' :
                                route.safetyLabel === 'Safer Alternative' ? 'bg-cyan-100 text-cyan-800' :
                                  'bg-amber-100 text-amber-800'
                            }`}>
                            {route.safetyLabel}
                          </span>
                        )}
                      </div>

                      {route.safetyStatus && (
                        <div className={`flex items-center text-xs font-medium ${route.safetyStatus === 'safe' ? 'text-green-600' :
                            route.safetyStatus === 'moderate' ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                          <span className="mr-1 text-xs">
                            {route.safetyStatus === 'safe' ? '✓' :
                              route.safetyStatus === 'moderate' ? '⚠️' : '⛔'}
                          </span>
                          <span>
                            {route.safetyStatus === 'safe' ? 'Safe' :
                              route.safetyStatus === 'moderate' ? 'Moderate' : 'Caution'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-gray-500">Distance</p>
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
                        <p className="text-gray-500">Estimated Time</p>
                        <p className="font-medium">
                          {route.summary
                            ? `${Math.floor(route.summary.totalTime / 60)} mins`
                            : 'Varies'
                          }
                        </p>
                      </div>
                    </div>

                    {route.safetyScore !== undefined && (
                      <div className="mt-2">
                        <p className="text-[10px] text-gray-500 mb-1">Safety Score</p>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div
                            className={`h-2 rounded-full ${route.safetyStatus === 'safe' ? 'bg-green-500' :
                              route.safetyStatus === 'moderate' ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                            style={{ width: `${(route.safetyScore * 100).toFixed(0)}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-[9px] mt-0.5">
                          <span>{(route.safetyScore * 100).toFixed(0)}% safe</span>
                        </div>
                      </div>
                    )}

                    <div className="mt-2">
                      <button
                        onClick={() => toggleWaypointDetails(index)}
                        className="text-blue-500 hover:text-blue-700 text-[10px] py-1"
                      >
                        {expandedRouteIndex === index ? 'Hide waypoints' : 'View waypoints'}
                      </button>

                      {/* Waypoint details section */}
                      {expandedRouteIndex === index && route.points && route.points.length > 0 && (
                        <div className="mt-1">
                          <div className="flex justify-between items-center mb-1">
                            <p className="text-gray-500 text-[10px]">Waypoints ({route.points.length})</p>
                            <p className="text-gray-500 text-[10px]">Showing every 10th point</p>
                          </div>
                          <div className="bg-gray-50 p-2 rounded max-h-32 overflow-auto">
                            <pre className="text-[9px] whitespace-pre-wrap break-all">
                              {JSON.stringify(
                                route.points.map((point, i) =>
                                  i % 10 === 0 ? {
                                    idx: i,
                                    lat: point.lat.toFixed(5),
                                    lng: point.lng.toFixed(5)
                                  } : null
                                ).filter(Boolean),
                                null, 2
                              )}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {/* Rest of your component remains the same */}
      {/* Debug Info */}
      <section className="bg-gray-100 rounded-lg p-2 mb-3">
        <details>
          {/* <summary className="text-xs font-medium text-gray-600 cursor-pointer">Current URL (debug)</summary> */}
          <p className="text-xs text-gray-600 mt-1 break-all">{currentUrl}</p>
        </details>
      </section>

      {/* Location Details */}
      <section className="bg-yellow-50 rounded-lg p-3 mb-4">
        <h2 className="text-base font-semibold mb-2 text-gray-700">Location Details</h2>
        <div className="text-xs text-gray-800">
          {sourceCoords && (
            <div className="mb-2">
              <p className="font-medium">Starting Point:</p>
              <p><strong>Latitude:</strong> {sourceCoords.lat}</p>
              <p><strong>Longitude:</strong> {sourceCoords.lng}</p>
            </div>
          )}

          {destCoords && (
            <div className="mb-2">
              <p className="font-medium">Destination:</p>
              <p><strong>Latitude:</strong> {destCoords.lat}</p>
              <p><strong>Longitude:</strong> {destCoords.lng}</p>
            </div>
          )}

          {travelMode && (
            <div className="mb-2">
              <p className="font-medium">Travel Mode:</p>
              <p className="capitalize">{travelMode}</p>
            </div>
          )}

          {!sourceCoords && !destCoords && (
            <p>No coordinates found in current URL</p>
          )}
        </div>
      </section>

      {/* Safety Status */}
      <section className="bg-green-50 rounded-lg p-3 mb-4">
        <div className="flex items-center text-green-700 font-medium">
          <span className="mr-2 text-lg">✓</span>
          <span>Route Safety: Good</span>
        </div>
        <p className="text-xs text-gray-600 mt-1">This route passes through well-lit and populated areas.</p>
      </section>

      {/* Quick Actions */}
      <section className="mb-4">
        <h2 className="text-base font-semibold mb-3 text-gray-700">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          <button className="flex flex-col items-center justify-center bg-white border border-red-400 text-red-500 rounded-lg p-3 text-xs hover:bg-gray-50 transition-transform hover:-translate-y-0.5">
            <span className="text-2xl mb-2">🚨</span>
            Emergency Contact
          </button>
          <button className="flex flex-col items-center justify-center bg-white border border-blue-400 text-blue-600 rounded-lg p-3 text-xs hover:bg-gray-50 transition-transform hover:-translate-y-0.5">
            <span className="text-2xl mb-2">🧭</span>
            Safe Directions
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200">
        <button className="text-xs text-gray-500 hover:underline">Settings</button>
        <div className="text-[10px] text-gray-400">v1.0</div>
      </footer>
    </div>
  );
};

export default App;