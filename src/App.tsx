import { useEffect, useState } from 'react';
import { initializeDatabase } from './database';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import Rentals from './components/Rentals';
import Customers from './components/Customers';
import logo from './assets/logo 1.png';

function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    initializeDatabase().catch(console.error);
  }, []);

  // Toggle Dark Mode Class on the root HTML element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  return (
    // Added dark mode background colors to the main wrapper
    <div className="flex h-screen w-full bg-dreamco-bg dark:bg-gray-950 transition-colors duration-300 font-sans">
      
      {/* SIDEBAR */}
      <aside className="w-64 h-full bg-white/70 dark:bg-gray-900/60 backdrop-blur-xl border-r border-gray-200 dark:border-gray-800 shadow-sm flex flex-col transition-colors duration-300">
        <div className="p-6 flex items-center justify-center border-b border-gray-100 dark:border-gray-800 min-h-[100px]">
          <img 
            src={logo} 
            alt="DreamCo Logo" 
            className={`h-16 w-auto object-contain transition-all ${isDarkMode ? 'brightness-200 grayscale' : ''}`} 
          />
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {['dashboard', 'inventory', 'rentals', 'customers'].map((page) => (
            <button 
              key={page}
              onClick={() => setActivePage(page)}
              className={`w-full text-left px-4 py-3.5 rounded-xl font-semibold transition-all ${
                activePage === page 
                  ? 'bg-gradient-to-r from-dreamco-blue to-blue-500 text-white shadow-md shadow-blue-500/20' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-dreamco-blue dark:hover:text-blue-400'
              }`}
            >
              {page === 'rentals' ? 'Rentals & Billing' : 
               page === 'customers' ? 'Customer Hub' : 
               page.charAt(0).toUpperCase() + page.slice(1)}
            </button>
          ))}
        </nav>

        {/* DARK MODE TOGGLE */}
        <div className="p-6 border-t border-gray-100 dark:border-gray-800">
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
          >
            {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </button>
        </div>
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