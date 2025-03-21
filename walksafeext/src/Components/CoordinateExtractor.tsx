/**
 * Extracts coordinates from a Google Maps URL
 */

export const TRAVEL_MODES = {
    '0': 'car',
    '1': 'bike',
    '2': 'walking',
    '3': 'transit',
    '4': 'flight',
    '9': 'train'
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
        console.log("Processing URL:", url);

        // First, extract travel mode - this is very reliable
        const travelModeMatch = url.match(/!3e([0-9])/);
        if (travelModeMatch && travelModeMatch[1]) {
            const modeCode = travelModeMatch[1];
            result.travelMode = TRAVEL_MODES[modeCode as keyof typeof TRAVEL_MODES] || 'unknown';
            console.log("Found travel mode:", result.travelMode);
        }

        // Extract named locations and their coordinates
        // This handles the structure of URLs with place names and coordinates
        const locationRegex = /1m5!1m1!1s[^!]+!2m2!1d(-?\d+\.\d+)!2d(-?\d+\.\d+)/g;
        const locations: Array<{ lng: string; lat: string }> = [];

        let match;
        while ((match = locationRegex.exec(url)) !== null) {
            locations.push({
                // Note: Google sometimes switches the order of lat/lng in their URL format
                lng: match[1],
                lat: match[2]
            });
            console.log("Found location:", match[1], match[2]);
        }

        // If we found exactly two locations, they're likely source and destination
        if (locations.length === 2) {
            result.source = { lat: locations[0].lat, lng: locations[0].lng };
            result.destination = { lat: locations[1].lat, lng: locations[1].lng };
            console.log("Assigned two locations as source and destination");
        }

        // For direct coordinates in the URL path (like /dir/lat,lng/destination)
        const directCoordinatesMatch = url.match(/\/dir\/(-?\d+\.\d+),(-?\d+\.\d+)\//);
        if (directCoordinatesMatch) {
            result.source = { lat: directCoordinatesMatch[1], lng: directCoordinatesMatch[2] };
            console.log("Found direct source coordinates in URL path");
        }

        // For viewport center and zoom
        const viewportMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+),(\d+[z])/);
        if (viewportMatch) {
            result.center = { lat: viewportMatch[1], lng: viewportMatch[2] };
            result.zoom = viewportMatch[3];
            console.log("Found viewport center and zoom");
        }

        // For URLs with @lat,lng format (usually the viewport center)
        const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (atMatch && !result.center) {
            result.center = { lat: atMatch[1], lng: atMatch[2] };
            console.log("Found @lat,lng format for center");
        }

        // For URLs with !3d{lat}!4d{lng} format (often more precise destination)
        const dataMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
        if (dataMatch) {
            // Only override if we don't have more precise location from named places
            if (!result.destination) {
                result.destination = { lat: dataMatch[1], lng: dataMatch[2] };
                console.log("Found !3d!4d format for destination");
            }
        }

        // For directions URLs, try to find source and destination
        if (url.includes('/dir/')) {
            // Extract source coordinates from other patterns
            const sourceMatch = url.match(/!1d(-?\d+\.\d+)!2d(-?\d+\.\d+)/);
            if (sourceMatch && !result.source) {
                result.source = { lng: sourceMatch[1], lat: sourceMatch[2] };
                console.log("Found !1d!2d format for source");
            }

            // Look for destination coordinates in the URL path
            const destinationCoords = url.match(/\/@(-?\d+\.\d+),(-?\d+\.\d+)/);
            if (destinationCoords && !result.destination) {
                result.destination = { lat: destinationCoords[1], lng: destinationCoords[2] };
                console.log("Found @lat,lng format for destination");
            }

            // Extract destination from 2d and 1d patterns that often appear for destinations
            const destMatch = url.match(/2d(-?\d+\.\d+)!1d(-?\d+\.\d+)/);
            if (destMatch && !result.destination) {
                result.destination = { lng: destMatch[1], lat: destMatch[2] };
                console.log("Found 2d!1d format for destination");
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
                    console.log("Found lat= lng= params for destination");
                }
                // If we have no source yet, and this seems different from destination, set it as source
                else if (!result.source &&
                    (lat !== result.destination.lat || lng !== result.destination.lng)) {
                    result.source = { lat, lng };
                    console.log("Found lat= lng= params for source");
                }
            }
        }

        // Look for the actual destination coordinates in the URL
        const destCoordMatch = url.match(/!2d(-?\d+\.\d+)!3d(-?\d+\.\d+)/);
        if (destCoordMatch && !result.destination) {
            result.destination = { lng: destCoordMatch[1], lat: destCoordMatch[2] };
            console.log("Found !2d!3d format for destination");
        }

        // If we have a center but no destination, use center as destination
        if (!result.destination && result.center) {
            result.destination = result.center;
            console.log("Using center as destination");
        }

        // If we haven't been able to find both source and destination, look for place IDs
        if (!result.source || !result.destination) {
            // Parse for place/destination descriptions
            const placeRegex = /1m5!1m1!1s([^!]+)!2m2!1d(-?\d+\.\d+)!2d(-?\d+\.\d+)/g;
            const places: Array<{ id: string; lng: string; lat: string }> = [];

            let placeMatch;
            while ((placeMatch = placeRegex.exec(url)) !== null) {
                places.push({
                    id: placeMatch[1],
                    lng: placeMatch[2],
                    lat: placeMatch[3]
                });
                console.log("Found place with ID:", placeMatch[1]);
            }

            // First location is typically source, second is destination
            if (places.length >= 1 && !result.source) {
                result.source = { lat: places[0].lat, lng: places[0].lng };
                console.log("Using first place as source");
            }

            if (places.length >= 2 && !result.destination) {
                result.destination = { lat: places[1].lat, lng: places[1].lng };
                console.log("Using second place as destination");
            }
        }

        // If we couldn't find travel mode, default to 'walking' for safety-focused app
        if (!result.travelMode) {
            result.travelMode = 'walking';
            console.log("Defaulting to walking mode");
        }

        console.log("Final extracted results:", result);
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