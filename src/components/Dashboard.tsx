import { useState, useEffect } from 'react';
import { loadDatabase } from '../database';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardStats { activeRentals: number; maintenanceItems: number; monthlyRevenue: number; totalCustomers: number; }
interface RevenueData { name: string; total: number; }
interface TopItem { name: string; rents: number; }
interface RecentInvoice { invoice_number: string; customer_name: string; total_amount: number; status: string; date: string; }
interface InventoryStats { total: number; available: number; rented: number; maintenance: number; }

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({ activeRentals: 0, maintenanceItems: 0, monthlyRevenue: 0, totalCustomers: 0 });
  const [revenueTrend, setRevenueTrend] = useState<RevenueData[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<RecentInvoice[]>([]);
  const [invStats, setInvStats] = useState<InventoryStats>({ total: 0, available: 0, rented: 0, maintenance: 0 });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const db = await loadDatabase();
        
        const activeResult = await db.select<{ count: number }[]>("SELECT COUNT(*) as count FROM rentals WHERE status = 'Issued'");
        const maintResult = await db.select<{ count: number }[]>("SELECT COUNT(*) as count FROM equipment WHERE status = 'Maintenance'");
        const custResult = await db.select<{ count: number }[]>("SELECT COUNT(*) as count FROM customers");
        
        const today = new Date();
        const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const revResult = await db.select<{ total: number | null }[]>("SELECT SUM(total_amount) as total FROM rentals WHERE status = 'Completed' AND return_date LIKE $1", [`${currentMonthStr}%`]);

        setStats({
          activeRentals: activeResult[0]?.count || 0,
          maintenanceItems: maintResult[0]?.count || 0,
          totalCustomers: custResult[0]?.count || 0,
          monthlyRevenue: revResult[0]?.total || 0
        });

        const trendData: RevenueData[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const monthName = d.toLocaleString('default', { month: 'short' });
          const monthRev = await db.select<{ total: number | null }[]>("SELECT SUM(total_amount) as total FROM rentals WHERE status = 'Completed' AND return_date LIKE $1", [`${monthStr}%`]);
          trendData.push({ name: monthName, total: monthRev[0]?.total || 0 });
        }
        setRevenueTrend(trendData);

        const topItemsResult = await db.select<TopItem[]>(`SELECT e.name, COUNT(ri.id) as rents FROM rental_items ri JOIN equipment e ON ri.equipment_id = e.id GROUP BY e.id ORDER BY rents DESC LIMIT 5`);
        setTopItems(topItemsResult);

        const recentResult = await db.select<RecentInvoice[]>(`SELECT r.invoice_number, c.name as customer_name, r.total_amount, r.status, r.start_date as date FROM rentals r JOIN customers c ON r.customer_id = c.id ORDER BY r.id DESC LIMIT 5`);
        setRecentInvoices(recentResult);

        const eqStats = await db.select<{ status: string, count: number }[]>("SELECT status, COUNT(*) as count FROM equipment GROUP BY status");
        let t = 0, a = 0, r = 0, m = 0;
        eqStats.forEach(stat => {
          t += stat.count;
          if (stat.status === 'Available') a = stat.count;
          if (stat.status === 'Rented') r = stat.count;
          if (stat.status === 'Maintenance') m = stat.count;
        });
        setInvStats({ total: t, available: a, rented: r, maintenance: m });

      } catch (error) { console.error("Failed to load dashboard data:", error); }
    };
    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <header>
        <h2 className="text-3xl font-semibold text-dreamco-dark dark:text-white transition-colors">Business Overview</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1 transition-colors">Real-time metrics, revenue trends, and operational insights.</p>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-lg p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 transition-colors">
          <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">Active Rentals</span>
          <div className="text-4xl font-bold text-dreamco-blue mt-2">{stats.activeRentals}</div>
        </div>
        <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-lg p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 transition-colors">
          <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">Total Customers</span>
          <div className="text-4xl font-bold text-indigo-500 mt-2">{stats.totalCustomers}</div>
        </div>
        <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-lg p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 transition-colors">
          <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">Maintenance Alerts</span>
          <div className="text-4xl font-bold text-orange-500 mt-2">{stats.maintenanceItems}</div>
        </div>
        <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-lg p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 transition-colors">
          <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">This Month's Revenue</span>
          <div className="text-3xl font-bold text-green-600 mt-2">Rs. {stats.monthlyRevenue.toLocaleString('en-LK')}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white/80 dark:bg-gray-900/60 backdrop-blur-lg p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col transition-colors">
          <h3 className="text-lg font-semibold text-dreamco-dark dark:text-white mb-6">6-Month Revenue Trend (LKR)</h3>
          <div className="flex-1 min-h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} tickFormatter={(value) => `Rs.${value}`} />
                <Tooltip cursor={{ fill: '#374151', opacity: 0.1 }} contentStyle={{ borderRadius: '12px', border: 'none', background: 'rgba(255,255,255,0.9)' }} formatter={(value: any) => [`Rs. ${Number(value).toLocaleString('en-LK')}`, 'Revenue']} />
                <Bar dataKey="total" fill="#1273B9" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-lg p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col transition-colors">
            <h3 className="text-lg font-semibold text-dreamco-dark dark:text-white mb-4">Inventory Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center"><span className="text-gray-600 dark:text-gray-400 font-medium">Available</span><span className="font-bold text-green-600">{invStats.available}</span></div>
              <div className="flex justify-between items-center"><span className="text-gray-600 dark:text-gray-400 font-medium">Rented Out</span><span className="font-bold text-blue-600">{invStats.rented}</span></div>
              <div className="flex justify-between items-center"><span className="text-gray-600 dark:text-gray-400 font-medium">In Maintenance</span><span className="font-bold text-orange-500">{invStats.maintenance}</span></div>
              <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center mt-2">
                <span className="font-semibold text-gray-800 dark:text-gray-200">Total Fleet</span><span className="font-bold text-dreamco-dark dark:text-white text-lg">{invStats.total}</span>
              </div>
            </div>
          </div>
          <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-lg p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col flex-1 transition-colors">
            <h3 className="text-lg font-semibold text-dreamco-dark dark:text-white mb-4">Top Performing Tools</h3>
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {topItems.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-dreamco-blue/10 text-dreamco-blue flex items-center justify-center font-bold text-sm">{idx + 1}</div>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{item.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">{item.rents} Rents</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}