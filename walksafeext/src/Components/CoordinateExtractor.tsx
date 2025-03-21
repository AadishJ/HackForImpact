/**
 * Extracts coordinates from a Google Maps URL
 */

export const TRAVEL_MODES = {
    '0': 'car',
    '1': 'bike',
    '2': 'walking',
    '3': 'transit',
    '4': 'flight',
    '9': 'bike'
};

export const extractCoordinates = (url: string): {
    source: { lat: string; lng: string } | null;
    destination: { lat: string; lng: string } | null;
    center: { lat: string; lng: string } | null;
    zoom: string | null;
    travelMode: string | null;
} => {
    const result = {
        source: null as { lat: string; lng: string } | null,
        destination: null as { lat: string; lng: string } | null,
        center: null as { lat: string; lng: string } | null,
        zoom: null as string | null,
        travelMode: null as string | null

    };

    try {

        const travelModeMatch = url.match(/!3e([0-9])/);
        if (travelModeMatch && travelModeMatch[1]) {
            const modeCode = travelModeMatch[1];
            result.travelMode = TRAVEL_MODES[modeCode as keyof typeof TRAVEL_MODES] || 'unknown';
        }

        // For direct coordinates in the URL path (like /dir/lat,lng/destination)
        const directCoordinatesMatch = url.match(/\/dir\/(-?\d+\.\d+),(-?\d+\.\d+)\//);
        if (directCoordinatesMatch) {
            result.source = { lat: directCoordinatesMatch[1], lng: directCoordinatesMatch[2] };
        }
        // For viewport center and zoom
        const viewportMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+),(\d+[z])/);
        if (viewportMatch) {
            result.center = { lat: viewportMatch[1], lng: viewportMatch[2] };
            result.zoom = viewportMatch[3];
        }

        // For URLs with @lat,lng format (usually the viewport center, often destination in simple searches)
        const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (atMatch && !result.center) {
            result.center = { lat: atMatch[1], lng: atMatch[2] };
        }

        // For URLs with !3d{lat}!4d{lng} format (often more precise destination)
        const dataMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
        if (dataMatch) {
            result.destination = { lat: dataMatch[1], lng: dataMatch[2] };
        }

        // For directions URLs, try to find source and destination
        if (url.includes('/dir/')) {
            // Extract source coordinates from other patterns
            const sourceMatch = url.match(/!1d(-?\d+\.\d+)!2d(-?\d+\.\d+)/);
            if (sourceMatch && !result.source) {
                result.source = { lng: sourceMatch[1], lat: sourceMatch[2] };
            }

            // Look for destination coordinates in the URL path
            const destinationCoords = url.match(/\/@(-?\d+\.\d+),(-?\d+\.\d+)/);
            if (destinationCoords && !result.destination) {
                result.destination = { lat: destinationCoords[1], lng: destinationCoords[2] };
            }

            // Extract destination from 2d and 1d patterns that often appear for destinations
            const destMatch = url.match(/2d(-?\d+\.\d+)!1d(-?\d+\.\d+)/);
            if (destMatch && !result.destination) {
                result.destination = { lng: destMatch[1], lat: destMatch[2] };
            }
        }

        // For URLs with explicit lat and lng parameters
        if (url.includes('lat=') && url.includes('lng=')) {
            const urlObj = new URL(url);
            const lat = urlObj.searchParams.get('lat');
            const lng = urlObj.searchParams.get('lng');
            if (lat && lng) {
                // If we have no destination yet, set it
                if (!result.destination) {
                    result.destination = { lat, lng };
                }
                // If we have no source yet, and this seems different from destination, set it as source
                else if (!result.source &&
                    (lat !== result.destination.lat || lng !== result.destination.lng)) {
                    result.source = { lat, lng };
                }
            }
        }

        // Look for the actual destination coordinates in the URL
        const destCoordMatch = url.match(/!2d(-?\d+\.\d+)!3d(-?\d+\.\d+)/);
        if (destCoordMatch && !result.destination) {
            result.destination = { lng: destCoordMatch[1], lat: destCoordMatch[2] };
        }

        return result;
    } catch (error) {
        console.error('Error extracting coordinates:', error);
        return {
            source: null,
            destination: null,
            center: null,
            zoom: null,
            travelMode: null
        };
    }
};

/**
 * Checks if the current environment is a Chrome extension
 */
export const isChromeExtension = (): boolean => {
    return typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.tabs;
};