import { useState, useEffect } from 'react';
import { loadDatabase } from '../database';

interface DashboardStats {
  activeRentals: number;
  maintenanceItems: number;
  monthlyRevenue: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    activeRentals: 0,
    maintenanceItems: 0,
    monthlyRevenue: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const db = await loadDatabase();
        
        // 1. Get Active Rentals (Invoices with 'Issued' status)
        const activeResult = await db.select<{ count: number }[]>(
          "SELECT COUNT(*) as count FROM rentals WHERE status = 'Issued'"
        );
        
        // 2. Get Items in Maintenance
        const maintResult = await db.select<{ count: number }[]>(
          "SELECT COUNT(*) as count FROM equipment WHERE status = 'Maintenance'"
        );

        // 3. Get Current Month's Revenue
        const today = new Date();
        const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`; // e.g., "2026-07"
        
        const revResult = await db.select<{ total: number | null }[]>(
          "SELECT SUM(total_amount) as total FROM rentals WHERE status = 'Completed' AND return_date LIKE $1",
          [`${currentMonth}%`]
        );

        setStats({
          activeRentals: activeResult[0]?.count || 0,
          maintenanceItems: maintResult[0]?.count || 0,
          monthlyRevenue: revResult[0]?.total || 0
        });

      } catch (error) {
        console.error("Failed to load dashboard stats:", error);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="animate-fade-in">
      <header className="mb-8">
        <h2 className="text-3xl font-semibold text-dreamco-dark">Overview</h2>
        <p className="text-gray-500 mt-1">Check the current status of your equipment and rentals.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center transition-transform hover:-translate-y-1">
          <span className="text-gray-500 text-sm font-medium">Active Rentals</span>
          <span className="text-4xl font-bold text-dreamco-blue mt-2">{stats.activeRentals}</span>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center transition-transform hover:-translate-y-1">
          <span className="text-gray-500 text-sm font-medium">Items in Maintenance</span>
          <span className="text-4xl font-bold text-orange-500 mt-2">{stats.maintenanceItems}</span>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center transition-transform hover:-translate-y-1">
          <span className="text-gray-500 text-sm font-medium">Monthly Revenue</span>
          <span className="text-4xl font-bold text-green-600 mt-2">
            Rs. {stats.monthlyRevenue.toLocaleString('en-LK')}
          </span>
        </div>
      </div>
    </div>
  );
}