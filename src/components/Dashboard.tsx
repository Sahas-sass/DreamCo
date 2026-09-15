import { useState, useEffect } from 'react';
import { loadDatabase } from '../database';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { save } from '@tauri-apps/plugin-dialog';
import { generateSummaryPDF } from '../pdfGenerator';
import Modal from './Modal';

interface DashboardStats { activeRentals: number; maintenanceItems: number; monthlyRevenue: number; totalCustomers: number; }
interface RevenueData { name: string; total: number; }
interface TopItem { name: string; rents: number; }
interface InventoryStats { total: number; available: number; rented: number; maintenance: number; }
interface OngoingInvoice { invoice_number: string; customer_name: string; start_date: string; expected_return: string; isOverdue?: boolean; daysOverdue?: number; }

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({ activeRentals: 0, maintenanceItems: 0, monthlyRevenue: 0, totalCustomers: 0 });
  const [revenueTrend, setRevenueTrend] = useState<RevenueData[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [invStats, setInvStats] = useState<InventoryStats>({ total: 0, available: 0, rented: 0, maintenance: 0 });
  const [ongoingInvoices, setOngoingInvoices] = useState<OngoingInvoice[]>([]);
  const [chartFilter, setChartFilter] = useState<'6months' | 'month' | '7days'>('6months');
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' as 'success'|'error'|'info' });

  // NEW: Export Modal State
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [exportRange, setExportRange] = useState<'all' | '7days' | 'month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split('T')[0]);

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

        setStats({ activeRentals: activeResult[0]?.count || 0, maintenanceItems: maintResult[0]?.count || 0, totalCustomers: custResult[0]?.count || 0, monthlyRevenue: revResult[0]?.total || 0 });

        const topItemsResult = await db.select<TopItem[]>(`SELECT e.name, COUNT(ri.id) as rents FROM rental_items ri JOIN equipment e ON ri.equipment_id = e.id GROUP BY e.id ORDER BY rents DESC LIMIT 5`);
        setTopItems(topItemsResult);

        const eqStats = await db.select<{ status: string, count: number }[]>("SELECT status, COUNT(*) as count FROM equipment GROUP BY status");
        let t = 0, a = 0, r = 0, m = 0;
        eqStats.forEach(stat => {
          t += stat.count;
          if (stat.status === 'Available') a = stat.count;
          if (stat.status === 'Rented') r = stat.count;
          if (stat.status === 'Maintenance') m = stat.count;
        });
        setInvStats({ total: t, available: a, rented: r, maintenance: m });

        const ongoingResult = await db.select<OngoingInvoice[]>(`SELECT r.invoice_number, c.name as customer_name, r.start_date, r.expected_return FROM rentals r JOIN customers c ON r.customer_id = c.id WHERE r.status = 'Issued' ORDER BY r.expected_return ASC`);
        
        const currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);

        const processedOngoing = ongoingResult.map(inv => {
          const expDate = new Date(inv.expected_return);
          expDate.setHours(0, 0, 0, 0);
          const diffTime = currentDate.getTime() - expDate.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return { ...inv, isOverdue: diffDays > 0, daysOverdue: diffDays > 0 ? diffDays : 0 };
        });

        setOngoingInvoices(processedOngoing);
      } catch (error) { console.error("Failed to load dashboard data:", error); }
    };
    fetchDashboardData();
  }, []);

  useEffect(() => {
    const fetchChartData = async () => {
      try {
        const db = await loadDatabase();
        const trendData: RevenueData[] = [];
        const today = new Date();

        if (chartFilter === '6months') {
          for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const monthName = d.toLocaleString('default', { month: 'short' });
            const monthRev = await db.select<{ total: number | null }[]>("SELECT SUM(total_amount) as total FROM rentals WHERE status = 'Completed' AND return_date LIKE $1", [`${monthStr}%`]);
            trendData.push({ name: monthName, total: monthRev[0]?.total || 0 });
          }
        } 
        else if (chartFilter === '7days') {
          for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const dayName = d.toLocaleDateString('default', { weekday: 'short' });
            const dayRev = await db.select<{ total: number | null }[]>("SELECT SUM(total_amount) as total FROM rentals WHERE status = 'Completed' AND return_date = $1", [dateStr]);
            trendData.push({ name: dayName, total: dayRev[0]?.total || 0 });
          }
        } 
        else if (chartFilter === 'month') {
          const year = today.getFullYear();
          const month = today.getMonth();
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
          
          const monthData = await db.select<{ return_date: string, total_amount: number }[]>("SELECT return_date, total_amount FROM rentals WHERE status = 'Completed' AND return_date LIKE $1", [`${monthStr}%`]);
          
          for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${monthStr}-${String(i).padStart(2, '0')}`;
            const total = monthData.filter(r => r.return_date === dateStr).reduce((sum, r) => sum + r.total_amount, 0);
            trendData.push({ name: String(i), total });
          }
        }
        setRevenueTrend(trendData);
      } catch (error) { console.error("Failed to load chart data:", error); }
    };
    fetchChartData();
  }, [chartFilter]);

  // NEW: Dynamic Data Fetching for Exporting
  const fetchExportData = async () => {
    const db = await loadDatabase();
    let query = `
      SELECT r.invoice_number as Invoice_ID, c.name as Customer_Name, c.nic as NIC, 
             r.start_date as Issue_Date, r.return_date as Return_Date, 
             r.billed_days as Total_Days, r.total_amount as Revenue 
      FROM rentals r JOIN customers c ON r.customer_id = c.id 
      WHERE r.status = 'Completed'
    `;
    let params: string[] = [];
    let dateRangeText = "All Time";

    const today = new Date();

    if (exportRange === '7days') {
      const d = new Date();
      d.setDate(today.getDate() - 7);
      const startStr = d.toISOString().split('T')[0];
      const endStr = today.toISOString().split('T')[0];
      query += ` AND r.return_date >= $1 AND r.return_date <= $2`;
      params = [startStr, endStr];
      dateRangeText = `Last 7 Days (${startStr} to ${endStr})`;
    } else if (exportRange === 'month') {
      const startStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      const eom = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const endStr = eom.toISOString().split('T')[0];
      query += ` AND r.return_date >= $1 AND r.return_date <= $2`;
      params = [startStr, endStr];
      dateRangeText = `This Month (${today.toLocaleString('default', { month: 'long', year: 'numeric' })})`;
    } else if (exportRange === 'custom') {
      if (customStartDate > customEndDate) {
        throw new Error("Start date cannot be after end date.");
      }
      query += ` AND r.return_date >= $1 AND r.return_date <= $2`;
      params = [customStartDate, customEndDate];
      dateRangeText = `Custom Range (${customStartDate} to ${customEndDate})`;
    }

    query += ` ORDER BY r.return_date DESC`;
    const data = await db.select<any[]>(query, params);
    return { data, dateRangeText };
  };

  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      const { data, dateRangeText } = await fetchExportData();

      if (data.length === 0) {
        setIsExportMenuOpen(false);
        return setModal({ isOpen: true, title: 'No Data', message: `No completed transactions found for ${dateRangeText}.`, type: 'info' });
      }

      if (format === 'csv') {
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map(row => Object.values(row).map(value => `"${value}"`).join(','));
        const csvContent = [headers, ...rows].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `DreamCo_Revenue_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
      } else {
        generateSummaryPDF(data, dateRangeText);
      }
      
      setIsExportMenuOpen(false);
      setModal({ isOpen: true, title: 'Export Successful', message: `Your ${format.toUpperCase()} report has been downloaded.`, type: 'success' });
    } catch (error) { 
      setModal({ isOpen: true, title: 'Export Failed', message: String(error), type: 'error' }); 
    }
  };

  const handleBackupDB = async () => {
    try {
      const backupPath = await save({
        title: 'Save Database Backup', defaultPath: `DreamCo_Backup_${new Date().toISOString().split('T')[0]}.db`,
        filters: [{ name: 'SQLite Database', extensions: ['db'] }]
      });
      if (!backupPath) return;

      const db = await loadDatabase();
      const safePath = backupPath.replace(/'/g, "''");
      
      try {
        await db.execute(`VACUUM INTO '${safePath}'`);
        setModal({ isOpen: true, title: 'Backup Successful!', message: `Database safely copied to: ${backupPath}`, type: 'success' });
      } catch (sqlError: any) {
        if (String(sqlError).includes("exists")) {
          setModal({ isOpen: true, title: 'Backup Failed', message: 'That file already exists. Please delete it first or choose a new name.', type: 'error' });
        } else throw sqlError;
      }
    } catch (error) { setModal({ isOpen: true, title: 'Backup Error', message: String(error), type: 'error' }); }
  };

  const overdueInvoices = ongoingInvoices.filter(inv => inv.isOverdue);

  return (
    <div className="space-y-8 animate-fade-in pb-12 relative">
      <Modal {...modal} onClose={() => setModal({ ...modal, isOpen: false })} />

      {/* NEW: Export Settings Modal */}
      {isExportMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsExportMenuOpen(false)}></div>
          <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-8 rounded-2xl shadow-2xl max-w-md w-full">
            <h3 className="text-2xl font-bold text-dreamco-dark dark:text-white mb-6">Export Report</h3>
            
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Select Date Range</label>
                <select 
                  value={exportRange} 
                  onChange={(e) => setExportRange(e.target.value as any)} 
                  className="w-full bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-dreamco-blue/40 transition-colors"
                >
                  <option value="all">All Time</option>
                  <option value="month">This Month</option>
                  <option value="7days">Last 7 Days</option>
                  <option value="custom">Custom Range...</option>
                </select>
              </div>

              {exportRange === 'custom' && (
                <div className="grid grid-cols-2 gap-4 animate-fade-in">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Start Date</label>
                    <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">End Date</label>
                    <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none" />
                  </div>
                </div>
              )}

              <div className="pt-6 border-t border-gray-100 dark:border-gray-800 flex gap-3">
                <button onClick={() => handleExport('csv')} className="flex-1 bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2">
                  <span>📊</span> Excel (CSV)
                </button>
                <button onClick={() => handleExport('pdf')} className="flex-1 bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2">
                  <span>📄</span> PDF Report
                </button>
              </div>
            </div>
            
            <button onClick={() => setIsExportMenuOpen(false)} className="absolute top-4 right-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl">&times;</button>
          </div>
        </div>
      )}

      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-semibold text-dreamco-dark dark:text-white transition-colors">Business Overview</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1 transition-colors">Real-time metrics, revenue trends, and operational insights.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleBackupDB} className="bg-gray-900 dark:bg-gray-800 text-white px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all font-medium flex items-center gap-2">
            <span className="text-blue-400 font-bold">💾</span> Backup DB
          </button>
          {/* UPDATED: Export Report Button */}
          <button onClick={() => setIsExportMenuOpen(true)} className="bg-white dark:bg-gray-700 text-dreamco-dark dark:text-white border border-gray-200 dark:border-gray-600 px-5 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all font-medium flex items-center gap-2">
            <span className="text-green-600 font-bold">⭳</span> Export Report
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
        <div className="lg:col-span-2 bg-white/80 dark:bg-gray-900/60 backdrop-blur-lg p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col transition-colors">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-dreamco-dark dark:text-white">Revenue Trend (LKR)</h3>
            <select 
              value={chartFilter}
              onChange={(e) => setChartFilter(e.target.value as '6months' | 'month' | '7days')}
              className="bg-white dark:bg-gray-800 text-gray-700 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 outline-none text-sm shadow-sm transition-colors cursor-pointer"
            >
              <option value="7days">Last 7 Days</option>
              <option value="month">This Month</option>
              <option value="6months">Last 6 Months</option>
            </select>
          </div>
          
          <div className="flex-1 min-h-75 w-full">
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
              {topItems.length === 0 ? (
                <p className="text-gray-400 text-sm text-center mt-6">No rental data yet.</p>
              ) : (
                topItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-dreamco-blue/10 text-dreamco-blue flex items-center justify-center font-bold text-sm">{idx + 1}</div>
                      <span className="font-medium text-gray-800 dark:text-gray-200">{item.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">{item.rents} Rents</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="lg:col-span-2 bg-white dark:bg-gray-900/60 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden transition-colors">
          <div className="p-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
            <h3 className="text-lg font-semibold text-dreamco-dark dark:text-gray-200">Ongoing Rentals</h3>
          </div>
          
          <div className="overflow-x-auto max-h-75">
            <table className="w-full text-left border-collapse min-w-125">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                <tr className="border-b border-gray-100 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                  <th className="py-3 px-6 font-medium">Invoice ID</th>
                  <th className="py-3 px-6 font-medium">Customer</th>
                  <th className="py-3 px-6 font-medium">Issue Date</th>
                  <th className="py-3 px-6 font-medium">Expected Return</th>
                </tr>
              </thead>
              <tbody>
                {ongoingInvoices.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-gray-400 dark:text-gray-600">No active rentals at the moment.</td></tr>
                ) : (
                  ongoingInvoices.map((inv, idx) => (
                    <tr key={idx} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50/30 dark:hover:bg-gray-800 transition-colors">
                      <td className="py-3 px-6 font-semibold text-dreamco-blue">{inv.invoice_number}</td>
                      <td className="py-3 px-6 text-gray-800 dark:text-gray-300">{inv.customer_name}</td>
                      <td className="py-3 px-6 text-gray-500 dark:text-gray-400">{inv.start_date}</td>
                      <td className="py-3 px-6">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          inv.isOverdue 
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' 
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {inv.expected_return}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-1 bg-white/80 dark:bg-gray-900/60 backdrop-blur-lg p-6 rounded-2xl shadow-sm border border-red-100 dark:border-red-900/30 flex flex-col transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🚨</span>
            <h3 className="text-lg font-bold text-red-600 dark:text-red-400">Overdue Alerts</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-3">
            {overdueInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 dark:text-gray-500 pt-8">
                <span className="text-4xl mb-2">🎉</span>
                <p>All items are on time!</p>
              </div>
            ) : (
              overdueInvoices.map((inv, idx) => (
                <div key={idx} className="p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-800/30">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-red-700 dark:text-red-400">{inv.invoice_number}</span>
                    <span className="text-xs font-bold bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-300 px-2 py-1 rounded-md">
                      {inv.daysOverdue} {inv.daysOverdue === 1 ? 'Day' : 'Days'} Late
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{inv.customer_name}</p>
                  <p className="text-xs text-red-500 dark:text-red-400/80 mt-1">Expected: {inv.expected_return}</p>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}