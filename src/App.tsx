import { useEffect, useState } from 'react';
import { initializeDatabase } from './database';
import Inventory from './components/Inventory'; // Import the new component
import Rentals from './components/Rentals';
import Customers from './components/Customers';

function App() {
  // Track which page the user is currently viewing
  const [activePage, setActivePage] = useState('dashboard');

  useEffect(() => {
    initializeDatabase().catch(console.error);
  }, []);

  return (
    <div className="flex h-screen w-full bg-dreamco-bg font-sans">
      
      {/* SIDEBAR */}
      <aside className="w-64 h-full bg-white/70 backdrop-blur-md border-r border-gray-200 shadow-sm flex flex-col">
        <div className="p-6 flex items-center justify-center border-b border-gray-100">
          <h1 className="text-2xl font-bold text-dreamco-blue tracking-tight">DreamCo</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActivePage('dashboard')}
            className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-all ${activePage === 'dashboard' ? 'bg-dreamco-blue text-white shadow-md' : 'text-gray-600 hover:bg-gray-100 hover:text-dreamco-blue'}`}
          >
            Dashboard
          </button>
          <button 
            onClick={() => setActivePage('inventory')}
            className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-all ${activePage === 'inventory' ? 'bg-dreamco-blue text-white shadow-md' : 'text-gray-600 hover:bg-gray-100 hover:text-dreamco-blue'}`}
          >
            Inventory
          </button>
          <button 
            onClick={() => setActivePage('rentals')}
            className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-all ${activePage === 'rentals' ? 'bg-dreamco-blue text-white shadow-md' : 'text-gray-600 hover:bg-gray-100 hover:text-dreamco-blue'}`}
          >
            Rentals & Billing
          </button>
          <button 
            onClick={() => setActivePage('customers')}
            className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-all ${activePage === 'customers' ? 'bg-dreamco-blue text-white shadow-md' : 'text-gray-600 hover:bg-gray-100 hover:text-dreamco-blue'}`}
          >
            Customers
          </button>
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-8 overflow-y-auto">
        {/* Conditional Rendering based on activePage state */}
        {activePage === 'dashboard' && (
          <div className="animate-fade-in">
            <header className="mb-8">
              <h2 className="text-3xl font-semibold text-dreamco-dark">Overview</h2>
              <p className="text-gray-500 mt-1">Check the current status of your equipment and rentals.</p>
            </header>

            <div className="grid grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
                <span className="text-gray-500 text-sm font-medium">Active Rentals</span>
                <span className="text-3xl font-bold text-dreamco-blue mt-2">0</span>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
                <span className="text-gray-500 text-sm font-medium">Items in Maintenance</span>
                <span className="text-3xl font-bold text-orange-500 mt-2">0</span>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
                <span className="text-gray-500 text-sm font-medium">Monthly Revenue</span>
                <span className="text-3xl font-bold text-green-600 mt-2">$0</span>
              </div>
            </div>
          </div>
        )}

        {activePage === 'inventory' && <Inventory />}
        {activePage === 'rentals' && <Rentals />}
        {activePage === 'customers' && <Customers />}
      </main>
    </div>
  );
}

export default App;