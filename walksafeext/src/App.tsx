const App = () => {
  return (
    <div className="w-[320px] min-h-[400px] font-sans p-4 bg-gray-50 text-gray-800">
      {/* Header */}
      <header className="text-center mb-5 pb-3 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-green-700 m-0">WalkSafe</h1>
        <p className="text-xs text-gray-500 mt-1">Your personal walking safety companion</p>
      </header>

      {/* Safety Status */}
      <section className="bg-green-50 rounded-lg p-3 mb-5">
        <div className="flex items-center text-green-700 font-medium">
          <span className="mr-2 text-lg">✓</span>
          <span>Current Area: Safe</span>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="mb-5">
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

      {/* Safety Tips */}
      <section className="bg-white rounded-lg p-3 mb-5">
        <h2 className="text-base font-semibold mb-2 text-gray-700">Safety Tips</h2>
        <ul className="text-xs pl-5 list-disc">
          <li className="mb-1.5">Stay in well-lit areas at night</li>
          <li className="mb-1.5">Keep your phone charged and accessible</li>
          <li className="mb-1.5">Share your location with trusted contacts</li>
          <li className="mb-1.5">Be aware of your surroundings</li>
        </ul>
      </section>

      {/* Footer */}
      <footer className="flex justify-between items-center mt-5 pt-3 border-t border-gray-200">
        <button className="text-xs text-gray-500 hover:underline">Settings</button>
        <div className="text-[10px] text-gray-400">v1.0</div>
      </footer>
    </div>
  );
};

export default App;