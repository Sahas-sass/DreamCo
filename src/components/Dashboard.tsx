import { useState, useEffect } from 'react';
import { loadDatabase } from '../database';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

interface DashboardStats {
  activeRentals: number;
  maintenanceItems: number;
  monthlyRevenue: number;
  totalCustomers: number;
}

interface RevenueData {
  name: string;
  total: number;
}

interface TopItem {
  name: string;
  rents: number;
}

interface RecentInvoice {
  invoice_number: string;
  customer_name: string;
  total_amount: number;
  status: string;
  date: string;
}

// NEW: Interface for the Inventory Summary
interface InventoryStats {
  total: number;
  available: number;
  rented: number;
  maintenance: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    activeRentals: 0,
    maintenanceItems: 0,
    monthlyRevenue: 0,
    totalCustomers: 0
  });

  const [revenueTrend, setRevenueTrend] = useState<RevenueData[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<RecentInvoice[]>([]);
  
  // NEW: State for Inventory Summary
  const [invStats, setInvStats] = useState<InventoryStats>({
    total: 0, available: 0, rented: 0, maintenance: 0
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const db = await loadDatabase();
        
        // 1. TOP STATS
        const activeResult = await db.select<{ count: number }[]>("SELECT COUNT(*) as count FROM rentals WHERE status = 'Issued'");
        const maintResult = await db.select<{ count: number }[]>("SELECT COUNT(*) as count FROM equipment WHERE status = 'Maintenance'");
        const custResult = await db.select<{ count: number }[]>("SELECT COUNT(*) as count FROM customers");
        
        const today = new Date();
        const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const revResult = await db.select<{ total: number | null }[]>(
          "SELECT SUM(total_amount) as total FROM rentals WHERE status = 'Completed' AND return_date LIKE $1",
          [`${currentMonthStr}%`]
        );

        setStats({
          activeRentals: activeResult[0]?.count || 0,
          maintenanceItems: maintResult[0]?.count || 0,
          totalCustomers: custResult[0]?.count || 0,
          monthlyRevenue: revResult[0]?.total || 0
        });

        // 2. 6-MONTH REVENUE TREND
        const trendData: RevenueData[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const monthName = d.toLocaleString('default', { month: 'short' });

          const monthRev = await db.select<{ total: number | null }[]>(
            "SELECT SUM(total_amount) as total FROM rentals WHERE status = 'Completed' AND return_date LIKE $1",
            [`${monthStr}%`]
          );
          trendData.push({
            name: monthName,
            total: monthRev[0]?.total || 0
          });
        }
        setRevenueTrend(trendData);

        // 3. TOP PERFORMING EQUIPMENT
        const topItemsResult = await db.select<TopItem[]>(`
          SELECT e.name, COUNT(ri.id) as rents 
          FROM rental_items ri 
          JOIN equipment e ON ri.equipment_id = e.id 
          GROUP BY e.id 
          ORDER BY rents DESC 
          LIMIT 5
        `);
        setTopItems(topItemsResult);

        // 4. RECENT TRANSACTIONS
        const recentResult = await db.select<RecentInvoice[]>(`
          SELECT r.invoice_number, c.name as customer_name, r.total_amount, r.status, r.start_date as date
          FROM rentals r
          JOIN customers c ON r.customer_id = c.id
          ORDER BY r.id DESC
          LIMIT 5
        `);
        setRecentInvoices(recentResult);

        // 5. NEW: INVENTORY BREAKDOWN
        const eqStats = await db.select<{ status: string, count: number }[]>("SELECT status, COUNT(*) as count FROM equipment GROUP BY status");
        let t = 0, a = 0, r = 0, m = 0;
        eqStats.forEach(stat => {
          t += stat.count;
          if (stat.status === 'Available') a = stat.count;
          if (stat.status === 'Rented') r = stat.count;
          if (stat.status === 'Maintenance') m = stat.count;
        });
        setInvStats({ total: t, available: a, rented: r, maintenance: m });

      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <header>
        <h2 className="text-3xl font-semibold text-dreamco-dark">Business Overview</h2>
        <p className="text-gray-500 mt-1">Real-time metrics, revenue trends, and operational insights.</p>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white/80 backdrop-blur-lg p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center transition-transform hover:-translate-y-1">
          <span className="text-gray-500 text-sm font-medium">Active Rentals</span>
          <span className="text-4xl font-bold text-dreamco-blue mt-2">{stats.activeRentals}</span>
        </div>
        <div className="bg-white/80 backdrop-blur-lg p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center transition-transform hover:-translate-y-1">
          <span className="text-gray-500 text-sm font-medium">Total Customers</span>
          <span className="text-4xl font-bold text-indigo-500 mt-2">{stats.totalCustomers}</span>
        </div>
        <div className="bg-white/80 backdrop-blur-lg p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center transition-transform hover:-translate-y-1">
          <span className="text-gray-500 text-sm font-medium">Maintenance Alerts</span>
          <span className="text-4xl font-bold text-orange-500 mt-2">{stats.maintenanceItems}</span>
        </div>
        <div className="bg-white/80 backdrop-blur-lg p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center transition-transform hover:-translate-y-1">
          <span className="text-gray-500 text-sm font-medium">This Month's Revenue</span>
          <span className="text-3xl font-bold text-green-600 mt-2">
            Rs. {stats.monthlyRevenue.toLocaleString('en-LK')}
          </span>
        </div>
      </div>

      {/* Main Analysis Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white/80 backdrop-blur-lg p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-lg font-semibold text-dreamco-dark mb-6">6-Month Revenue Trend (LKR)</h3>
          <div className="flex-1 min-h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} tickFormatter={(value) => `Rs.${value}`} />
                <Tooltip 
                  cursor={{ fill: '#F3F4F6' }} 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  formatter={(value: any) => [`Rs. ${Number(value).toLocaleString('en-LK')}`, 'Revenue']}
                />
                <Bar dataKey="total" fill="#1273B9" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Side Stack: Inventory Summary & Top Equipment */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          
          {/* NEW: Inventory Summary Card */}
          <div className="bg-white/80 backdrop-blur-lg p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
            <h3 className="text-lg font-semibold text-dreamco-dark mb-4">Inventory Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 font-medium">Available</span>
                <span className="font-bold text-green-600">{invStats.available}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 font-medium">Rented Out</span>
                <span className="font-bold text-blue-600">{invStats.rented}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 font-medium">In Maintenance</span>
                <span className="font-bold text-orange-500">{invStats.maintenance}</span>
              </div>
              <div className="pt-3 border-t border-gray-100 flex justify-between items-center mt-2">
                <span className="font-semibold text-gray-800">Total Fleet</span>
                <span className="font-bold text-dreamco-dark text-lg">{invStats.total}</span>
              </div>
            </div>
          </div>

          {/* Top Equipment Card */}
          <div className="bg-white/80 backdrop-blur-lg p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col flex-1">
            <h3 className="text-lg font-semibold text-dreamco-dark mb-4">Top Performing Tools</h3>
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {topItems.length === 0 ? (
                <p className="text-gray-400 text-sm text-center mt-6">No rental data yet.</p>
              ) : (
                topItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-dreamco-blue/10 text-dreamco-blue flex items-center justify-center font-bold text-sm">
                        {idx + 1}
                      </div>
                      <span className="font-medium text-gray-800">{item.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-600">{item.rents} Rents</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-lg font-semibold text-dreamco-dark">Recent Transactions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-gray-100 text-sm text-gray-500">
                <th className="py-3 px-6 font-medium">Invoice ID</th>
                <th className="py-3 px-6 font-medium">Customer</th>
                <th className="py-3 px-6 font-medium">Date</th>
                <th className="py-3 px-6 font-medium">Status</th>
                <th className="py-3 px-6 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentInvoices.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-gray-400">No transactions recorded yet.</td></tr>
              ) : (
                recentInvoices.map((inv, idx) => (
                  <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
                    <td className="py-4 px-6 font-semibold text-dreamco-blue">{inv.invoice_number}</td>
                    <td className="py-4 px-6 text-gray-800">{inv.customer_name}</td>
                    <td className="py-4 px-6 text-gray-500">{inv.date}</td>
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        inv.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right font-medium text-gray-800">
                      Rs. {inv.total_amount.toLocaleString('en-LK')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}