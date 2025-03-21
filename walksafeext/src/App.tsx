// In App.tsx, use React's lazy and Suspense for dynamic component loading
import { useState, useEffect, lazy, Suspense } from 'react';
import { extractCoordinates, isChromeExtension } from './Components/CoordinateExtractor';
import type { RouteData } from './Components/Map';

// Lazy load the Map component to avoid issues with Leaflet
const Map = lazy(() => import('./Components/Map'));

const App = () => {
  const [currentUrl, setCurrentUrl] = useState<string>('Loading URL...');
  const [sourceCoords, setSourceCoords] = useState<{ lat: string; lng: string } | null>(null);
  const [destCoords, setDestCoords] = useState<{ lat: string; lng: string } | null>(null);
  const [travelMode, setTravelMode] = useState<string>('walking');
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [expandedRouteIndex, setExpandedRouteIndex] = useState<number | null>(null);

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
        const testUrl = "https://www.google.com/maps/dir/28.5451017,77.2731306/Mayur+Vihar-1,+Mayur+Vihar+Phase+1+Metro+Station,+Pocket+4,+Mayur+Vihar,+New+Delhi,+Delhi/@28.5794104,77.2321523,13z/data=!3m1!4b1!4m10!4m9!1m1!4e1!1m5!1m1!1s0x390ce49f001c646d:0x399d3398b609d940!2m2!1d77.289608!2d28.6042259!3e2?entry=ttu&g_ep=EgoyMDI1MDMxOS4xIKXMDSoJLDEwMjExNjM5SAFQAw%3D%3D";
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
  const handleRoutesFound = (foundRoutes: RouteData[]) => {
    setRoutes(foundRoutes);
    console.log('Found routes:', foundRoutes);
    // Set the first route as expanded by default
    if (foundRoutes.length > 0) {
      setExpandedRouteIndex(0);
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
              <h3 className="text-sm font-semibold mb-2">Available Routes:</h3>
              {routes.map((route, index) => (
                <div
                  key={index}
                  className="bg-white rounded p-2 mb-2 border-l-4 text-xs"
                  style={{ borderLeftColor: route.color }}
                >
                  <div className="flex justify-between items-center">
                    <p className="font-medium">{route.name}</p>
                    <button
                      onClick={() => toggleWaypointDetails(index)}
                      className="text-blue-500 hover:text-blue-700 text-[10px]"
                    >
                      {expandedRouteIndex === index ? 'Hide details' : 'View details'}
                    </button>
                  </div>

                  {route.summary && (
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div>
                        <span className="text-gray-500">Distance:</span>{' '}
                        {(route.summary.totalDistance / 1000).toFixed(2)} km
                      </div>
                      <div>
                        <span className="text-gray-500">Time:</span>{' '}
                        {Math.floor(route.summary.totalTime / 60)} mins
                      </div>
                    </div>
                  )}

                  {/* Waypoint details section */}
                  {expandedRouteIndex === index && route.points && route.points.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
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
              ))}
            </div>
          )}
        </section>
      )}

      {/* Rest of your component remains the same */}
      {/* Debug Info */}
      <section className="bg-gray-100 rounded-lg p-2 mb-3">
        <details>
          <summary className="text-xs font-medium text-gray-600 cursor-pointer">Current URL (debug)</summary>
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