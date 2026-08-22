import { useState, useEffect } from 'react';
import { loadDatabase } from '../database';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { save } from '@tauri-apps/plugin-dialog';
import Modal from './Modal';

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

  // Custom Modal State
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' as 'success'|'error'|'info' });

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

  // FEATURE 1: EXPORT CSV
  const handleExportCSV = async () => {
    try {
      const db = await loadDatabase();
      const exportData = await db.select<any[]>(`
        SELECT r.invoice_number as Invoice_ID, c.name as Customer_Name, c.nic as NIC, 
               r.start_date as Issue_Date, r.return_date as Return_Date, 
               r.billed_days as Total_Days, r.total_amount as Revenue 
        FROM rentals r 
        JOIN customers c ON r.customer_id = c.id 
        WHERE r.status = 'Completed'
        ORDER BY r.return_date DESC
      `);

      if (exportData.length === 0) {
        return setModal({ isOpen: true, title: 'No Data', message: 'No completed transactions to export yet.', type: 'info' });
      }

      const headers = Object.keys(exportData[0]).join(',');
      const rows = exportData.map(row => Object.values(row).map(value => `"${value}"`).join(','));
      const csvContent = [headers, ...rows].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `DreamCo_Revenue_Report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setModal({ isOpen: true, title: 'Export Successful', message: 'Your monthly revenue report has been downloaded.', type: 'success' });
    } catch (error) {
      setModal({ isOpen: true, title: 'Export Failed', message: String(error), type: 'error' });
    }
  };

  // FEATURE 2: 1-CLICK BACKUP
  const handleBackupDB = async () => {
    try {
      const backupPath = await save({
        title: 'Save Database Backup',
        defaultPath: `DreamCo_Backup_${new Date().toISOString().split('T')[0]}.db`,
        filters: [{ name: 'SQLite Database', extensions: ['db'] }]
      });

      if (!backupPath) return; // User canceled the dialog

      const db = await loadDatabase();
      const safePath = backupPath.replace(/'/g, "''"); // Escape just in case
      
      try {
        // SQLite's native cloning command
        await db.execute(`VACUUM INTO '${safePath}'`);
        setModal({ isOpen: true, title: 'Backup Successful!', message: `Database safely copied to: ${backupPath}`, type: 'success' });
      } catch (sqlError: any) {
        // VACUUM INTO fails if the file already exists to prevent accidental overwrites
        if (String(sqlError).includes("exists")) {
          setModal({ isOpen: true, title: 'Backup Failed', message: 'That file already exists. Please delete it first or choose a new name.', type: 'error' });
        } else {
          throw sqlError;
        }
      }
    } catch (error) {
      setModal({ isOpen: true, title: 'Backup Error', message: String(error), type: 'error' });
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <Modal {...modal} onClose={() => setModal({ ...modal, isOpen: false })} />

      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-semibold text-dreamco-dark dark:text-white transition-colors">Business Overview</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1 transition-colors">Real-time metrics, revenue trends, and operational insights.</p>
        </div>
        
        {/* ACTION BUTTONS */}
        <div className="flex gap-3">
          <button 
            onClick={handleBackupDB}
            className="bg-gray-900 dark:bg-gray-800 text-white px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all font-medium flex items-center gap-2"
          >
            <span className="text-blue-400 font-bold">💾</span> Backup DB
          </button>
          
          <button 
            onClick={handleExportCSV}
            className="bg-white dark:bg-gray-700 text-dreamco-dark dark:text-white border border-gray-200 dark:border-gray-600 px-5 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all font-medium flex items-center gap-2"
          >
            <span className="text-green-600 font-bold">⭳</span> Export CSV
          </button>
        </div>
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