import { useState } from 'react';

interface UserReviewProps {
    route?: {
        name: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        points: any[];
    };
    onClose?: () => void;
    onSubmit?: (data: ReviewData) => void;
}

export interface ReviewData {
    crimeType: string;
    comments: string;
    routeName?: string;
    timestamp: string;
    location?: {
        lat: number;
        lng: number;
    };
}

const crimeTypes = [
    "No crime or incident (safe experience)",
    "Theft/Robbery",
    "Assault",
    "Harassment",
    "Suspicious activity",
    "Poor lighting/visibility",
    "Vandalism",
    "Public intoxication",
    "Drug-related activity",
    "Other safety concern"
];

const UserReview: React.FC<UserReviewProps> = ({ route, onClose, onSubmit }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [crimeType, setCrimeType] = useState(crimeTypes[0]);
    const [comments, setComments] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    const openModal = () => setIsOpen(true);
    const closeModal = () => {
        setIsOpen(false);
        if (onClose) onClose();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!comments.trim()) {
            setError('Please provide some comments about your experience');
            return;
        }

        const reviewData: ReviewData = {
            crimeType,
            comments,
            routeName: route?.name,
            timestamp: new Date().toISOString(),
            location: route?.points.length ? {
                lat: route.points[Math.floor(route.points.length / 2)].lat,
                lng: route.points[Math.floor(route.points.length / 2)].lng,
            } : undefined
        };

        // Submit the review data
        if (onSubmit) {
            onSubmit(reviewData);
        }

        console.log('Review submitted:', reviewData);
        setSubmitted(true);

        // Auto-close after submission
        setTimeout(() => {
            closeModal();
            // Reset form after closing
            setCrimeType(crimeTypes[0]);
            setComments('');
            setSubmitted(false);
            setError('');
        }, 2000);
    };

    return (
        <>
            <button
                onClick={openModal}
                className="flex items-center justify-center bg-white border border-orange-400 text-orange-500 rounded-lg p-3 text-xs hover:bg-orange-50 transition-transform hover:-translate-y-0.5 w-full"
            >
                <span className="text-lg mr-1">⭐</span>
                Share Your Experience
            </button>

            {isOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
                        <div className="bg-blue-500 p-4 text-white">
                            <h2 className="text-lg font-semibold">Share Your Route Experience</h2>
                            <p className="text-sm opacity-90">Your feedback helps keep others safe</p>
                        </div>

                        {submitted ? (
                            <div className="p-6 text-center">
                                <div className="text-green-500 text-5xl mb-3">✓</div>
                                <h3 className="text-lg font-medium mb-2">Thank You!</h3>
                                <p className="text-gray-600">Your feedback has been submitted successfully.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="p-6">
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Did you experience any safety issues?
                                    </label>
                                    <select
                                        value={crimeType}
                                        onChange={(e) => setCrimeType(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        {crimeTypes.map((type, index) => (
                                            <option key={index} value={type}>
                                                {type}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Additional Comments
                                    </label>
                                    <textarea
                                        value={comments}
                                        onChange={(e) => setComments(e.target.value)}
                                        rows={4}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Please share your experience with this route..."
                                    ></textarea>
                                    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                                </div>

                                <div className="text-xs text-gray-500 mb-4">
                                    Your feedback helps us improve route safety recommendations for all users.
                                </div>

                                <div className="flex justify-end space-x-2">
                                    <button
                                        type="button"
                                        onClick={closeModal}
                                        className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-blue-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700"
                                    >
                                        Submit Review
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default UserReview;