import { useEffect, useState } from 'react';
import { initializeDatabase } from './database';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import Rentals from './components/Rentals';
import Customers from './components/Customers';

function App() {
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
            Customer Hub
          </button>
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-8 overflow-y-auto">
        {activePage === 'dashboard' && <Dashboard />}
        {activePage === 'inventory' && <Inventory />}
        {activePage === 'rentals' && <Rentals />}
        {activePage === 'customers' && <Customers />}
      </main>
    </div>
  );
}

export default App;