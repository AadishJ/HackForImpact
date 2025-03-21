"use client"

import { useEffect, useState } from 'react'
import type { LatLng } from 'leaflet'

interface LocationSelectorProps {
    onSourceChange: (location: LatLng | null) => void;
    onDestinationChange: (location: LatLng | null) => void;
}

export default function LocationSelector({ onSourceChange, onDestinationChange }: LocationSelectorProps) {
    const [L, setL] = useState<typeof import('leaflet')>()
    const [locations, setLocations] = useState<Record<string, LatLng>>({})
    const [source, setSource] = useState<string>('')
    const [destination, setDestination] = useState<string>('')
    const [customLocation, setCustomLocation] = useState<{ lat: string, lng: string }>({ lat: '', lng: '' })
    const [showCustom, setShowCustom] = useState(false)

    useEffect(() => {
        import('leaflet').then(L => {
            setL(L)
            setLocations({
                "Millennium Park": new L.LatLng(41.8826, -87.6226),
                "Navy Pier": new L.LatLng(41.8919, -87.6051),
                "Wrigley Field": new L.LatLng(41.9484, -87.6553),
                "The Art Institute": new L.LatLng(41.8796, -87.6237),
                "Willis Tower": new L.LatLng(41.8789, -87.6359),
                "The Field Museum": new L.LatLng(41.8663, -87.6168),
                "Lincoln Park Zoo": new L.LatLng(41.9201, -87.6337),
                "The Magnificent Mile": new L.LatLng(41.8915, -87.6247),
                "Shedd Aquarium": new L.LatLng(41.8676, -87.6140),
                "Adler Planetarium": new L.LatLng(41.8663, -87.6068),
                "Cloud Gate (The Bean)": new L.LatLng(41.8827, -87.6233),
                "Chicago Riverwalk": new L.LatLng(41.8879, -87.6270),
                "Grant Park": new L.LatLng(41.8772, -87.6188),
                "Buckingham Fountain": new L.LatLng(41.8758, -87.6189),
                "Museum of Science and Industry": new L.LatLng(41.7906, -87.5830),
                "United Center": new L.LatLng(41.8806, -87.6742),
                "Chicago Cultural Center": new L.LatLng(41.8838, -87.6246),
                "360 Chicago (John Hancock Center)": new L.LatLng(41.8988, -87.6229),
            })
        })
    }, [])

    const handleAddCustomLocation = () => {
        if (!L) return;

        const lat = parseFloat(customLocation.lat);
        const lng = parseFloat(customLocation.lng);

        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            alert("Please enter valid coordinates");
            return;
        }

        const newLocation = new L.LatLng(lat, lng);
        setLocations(prev => ({
            ...prev,
            [`Custom (${lat.toFixed(4)}, ${lng.toFixed(4)})`]: newLocation
        }));

        setCustomLocation({ lat: '', lng: '' });
        setShowCustom(false);
    };

    if (!L || !Object.keys(locations).length) {
        return <div className="p-4 bg-gray-100 rounded">Loading location data...</div>;
    }

    return (
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
            <h2 className="text-xl font-semibold mb-4">Select Locations</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label htmlFor="source" className="block mb-2 font-medium">Starting Point:</label>
                    <select
                        id="source"
                        value={source}
                        className="w-full p-2 border rounded"
                        onChange={(e) => {
                            const selectedLocation = e.target.value;
                            setSource(selectedLocation);
                            const location = selectedLocation ? locations[selectedLocation] : null;
                            onSourceChange(location);
                        }}
                    >
                        <option value="">Select a starting point</option>
                        {Object.keys(locations).sort().map((location) => (
                            <option key={location} value={location}>
                                {location}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label htmlFor="destination" className="block mb-2 font-medium">Destination:</label>
                    <select
                        id="destination"
                        value={destination}
                        className="w-full p-2 border rounded"
                        onChange={(e) => {
                            const selectedLocation = e.target.value;
                            setDestination(selectedLocation);
                            const location = selectedLocation ? locations[selectedLocation] : null;
                            onDestinationChange(location);
                        }}
                    >
                        <option value="">Select a destination</option>
                        {Object.keys(locations).sort().map((location) => (
                            <option key={location} value={location}>
                                {location}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="mt-4">
                <button
                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                    onClick={() => setShowCustom(!showCustom)}
                >
                    {showCustom ? '- Hide custom location' : '+ Add custom location'}
                </button>

                {showCustom && (
                    <div className="mt-3 p-3 border rounded bg-gray-50">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="custom-lat" className="block text-sm mb-1">Latitude:</label>
                                <input
                                    id="custom-lat"
                                    type="text"
                                    placeholder="41.8781"
                                    className="w-full p-2 border rounded"
                                    value={customLocation.lat}
                                    onChange={(e) => setCustomLocation(prev => ({ ...prev, lat: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label htmlFor="custom-lng" className="block text-sm mb-1">Longitude:</label>
                                <input
                                    id="custom-lng"
                                    type="text"
                                    placeholder="-87.6298"
                                    className="w-full p-2 border rounded"
                                    value={customLocation.lng}
                                    onChange={(e) => setCustomLocation(prev => ({ ...prev, lng: e.target.value }))}
                                />
                            </div>
                        </div>
                        <button
                            className="mt-3 px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                            onClick={handleAddCustomLocation}
                        >
                            Add Location
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}