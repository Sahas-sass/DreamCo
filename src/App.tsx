import { useEffect } from 'react';
import { initializeDatabase } from './database';

function App() {
  useEffect(() => {
    // This runs once when the app opens to ensure the DB is ready
    initializeDatabase().catch(console.error);
  }, []);

  return (
    <div className="flex h-screen w-full bg-dreamco-bg font-sans">
      
      {/* SIDEBAR - Featuring a subtle glassmorphism blur effect */}
      <aside className="w-64 h-full bg-white/70 backdrop-blur-md border-r border-gray-200 shadow-sm flex flex-col">
        <div className="p-6 flex items-center justify-center border-b border-gray-100">
          {/* You can drop the actual logo.png image here later */}
          <h1 className="text-2xl font-bold text-dreamco-blue tracking-tight">
            DreamCo
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <a href="#" className="block px-4 py-3 rounded-lg bg-dreamco-blue text-white font-medium shadow-md transition-all hover:bg-blue-600">
            Dashboard
          </a>
          <a href="#" className="block px-4 py-3 rounded-lg text-gray-600 font-medium transition-all hover:bg-gray-100 hover:text-dreamco-blue">
            Inventory
          </a>
          <a href="#" className="block px-4 py-3 rounded-lg text-gray-600 font-medium transition-all hover:bg-gray-100 hover:text-dreamco-blue">
            Rentals & Billing
          </a>
          <a href="#" className="block px-4 py-3 rounded-lg text-gray-600 font-medium transition-all hover:bg-gray-100 hover:text-dreamco-blue">
            Customers
          </a>
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="mb-8">
          <h2 className="text-3xl font-semibold text-dreamco-dark">Overview</h2>
          <p className="text-gray-500 mt-1">Check the current status of your equipment and rentals.</p>
        </header>

        {/* Dashboard Placeholder Cards */}
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
            <span className="text-gray-500 text-sm font-medium">Active Rentals</span>
            <span className="text-3xl font-bold text-dreamco-blue mt-2">14</span>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
            <span className="text-gray-500 text-sm font-medium">Items in Maintenance</span>
            <span className="text-3xl font-bold text-orange-500 mt-2">3</span>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
            <span className="text-gray-500 text-sm font-medium">Monthly Revenue</span>
            <span className="text-3xl font-bold text-green-600 mt-2">$4,250</span>
          </div>
        </div>
      </main>

    </div>
  );
}

export default App;