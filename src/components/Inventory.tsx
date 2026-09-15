import { useState, useEffect } from 'react';
import { loadDatabase } from '../database';
import Modal from './Modal';

interface Equipment { id: number; name: string; category: string; unique_number: string | null; total_qty: number; daily_rate: number; status: string; }
const CATEGORIES = ["Heavy Vehicles", "Heavy Tools", "Power Tools", "Scaffolding", "Safety Gear", "General"];

export default function Inventory() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [uniqueId, setUniqueId] = useState('');
  const [qty, setQty] = useState('1');
  const [rate, setRate] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' as 'success'|'error'|'info' });

  const fetchEquipment = async () => {
    try {
      const db = await loadDatabase();
      const result = await db.select<Equipment[]>("SELECT * FROM equipment ORDER BY id DESC");
      setEquipment(result);
    } catch (error) { setModal({ isOpen: true, title: 'Error', message: String(error), type: 'error' }); }
  };

  useEffect(() => { fetchEquipment(); }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !rate) return;
    try {
      const db = await loadDatabase();
      await db.execute(
        "INSERT INTO equipment (name, category, unique_number, total_qty, daily_rate) VALUES ($1, $2, $3, $4, $5)",
        [name, category, uniqueId || null, parseInt(qty), parseFloat(rate)]
      );
      setName(''); setUniqueId(''); setQty('1'); setRate(''); fetchEquipment();
      setModal({ isOpen: true, title: 'Item Added', message: `${name} has been added to inventory.`, type: 'success' });
    } catch (error) { setModal({ isOpen: true, title: 'Database Error', message: String(error), type: 'error' }); }
  };

  const handleEditRate = async (id: number, currentRate: number) => {
    const newRateStr = window.prompt("Enter new daily rate (LKR):", currentRate.toString());
    if (!newRateStr) return;
    const newRate = parseFloat(newRateStr);
    if (isNaN(newRate)) return setModal({ isOpen: true, title: 'Invalid Input', message: 'Please enter a valid number.', type: 'error' });

    try {
      const db = await loadDatabase();
      await db.execute("UPDATE equipment SET daily_rate = $1 WHERE id = $2", [newRate, id]);
      fetchEquipment();
    } catch (error) { setModal({ isOpen: true, title: 'Error', message: String(error), type: 'error' }); }
  };

  const handleDelete = async (id: number, status: string) => {
    if (status === 'Rented') {
      return setModal({ isOpen: true, title: 'Action Denied', message: 'You cannot delete an item while it is currently rented out.', type: 'error' });
    }
    
    if (!window.confirm("Are you sure you want to permanently delete this item?")) return;

    try {
      const db = await loadDatabase();
      await db.execute("DELETE FROM equipment WHERE id = $1", [id]);
      fetchEquipment();
      setModal({ isOpen: true, title: 'Item Deleted', message: 'The equipment has been removed from your inventory.', type: 'success' });
    } catch (error) { 
      setModal({ isOpen: true, title: 'Error', message: String(error), type: 'error' }); 
    }
  };

  const handleToggleMaintenance = async (id: number, currentStatus: string) => {
    if (currentStatus === 'Rented') {
      return setModal({ isOpen: true, title: 'Action Denied', message: 'You cannot put an item into maintenance while it is rented out.', type: 'error' });
    }

    const newStatus = currentStatus === 'Maintenance' ? 'Available' : 'Maintenance';

    try {
      const db = await loadDatabase();
      await db.execute("UPDATE equipment SET status = $1 WHERE id = $2", [newStatus, id]);
      fetchEquipment();
    } catch (error) { 
      setModal({ isOpen: true, title: 'Error', message: String(error), type: 'error' }); 
    }
  };

  const displayedEquipment = filterCategory === 'All' ? equipment : equipment.filter(item => item.category === filterCategory);

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <Modal {...modal} onClose={() => setModal({ ...modal, isOpen: false })} />
      <header>
        <h2 className="text-3xl font-semibold text-dreamco-dark dark:text-white transition-colors">Inventory Management</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Track your fleet and set LKR daily rates.</p>
      </header>

      <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-lg p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 transition-colors">
        <form onSubmit={handleAddItem} className="flex flex-wrap gap-4 items-end">
          {/* UPDATED: min-w-[200px] to min-w-50 */}
          <div className="flex-1 min-w-50">
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Item Name</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-dreamco-blue/40" />
          </div>
          <div className="w-40">
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-dreamco-blue/40">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="w-32">
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Unique ID</label>
            <input type="text" value={uniqueId} onChange={(e) => setUniqueId(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-dreamco-blue/40" />
          </div>
          <div className="w-24">
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Qty</label>
            <input type="number" min="1" required value={qty} onChange={(e) => setQty(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-dreamco-blue/40" />
          </div>
          <div className="w-36">
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Rate (LKR)</label>
            <input type="number" step="0.01" required value={rate} onChange={(e) => setRate(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-dreamco-blue/40" />
          </div>
          
          {/* UPDATED: bg-gradient-to-r to bg-linear-to-r and h-[46px] to h-11.5 */}
          <button type="submit" className="bg-linear-to-r from-dreamco-blue to-blue-500 text-white px-6 py-2.5 rounded-xl shadow-md font-medium h-11.5">
            + Add Item
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-900/60 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden transition-colors">
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-dreamco-dark dark:text-white">Current Inventory</h3>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Filter:</label>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="bg-white dark:bg-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 outline-none text-sm shadow-sm">
              <option value="All">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 text-sm text-gray-500 dark:text-gray-400">
              <th className="py-4 px-6 font-medium">Item Name & ID</th>
              <th className="py-4 px-6 font-medium">Category</th>
              <th className="py-4 px-6 font-medium">Qty</th>
              <th className="py-4 px-6 font-medium">Daily Rate (LKR)</th>
              <th className="py-4 px-6 font-medium">Status</th>
              <th className="py-4 px-6 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayedEquipment.map((item) => (
              <tr key={item.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50/30 dark:hover:bg-gray-800 transition-colors">
                <td className="py-4 px-6 font-medium text-gray-800 dark:text-gray-200">{item.name} {item.unique_number && <span className="block text-xs text-gray-400 dark:text-gray-500 mt-0.5">ID: {item.unique_number}</span>}</td>
                <td className="py-4 px-6 text-gray-600 dark:text-gray-400">{item.category || 'General'}</td>
                <td className="py-4 px-6 text-gray-600 dark:text-gray-400">{item.total_qty}</td>
                <td className="py-4 px-6 text-gray-800 dark:text-gray-200 font-medium">Rs. {item.daily_rate.toLocaleString('en-LK', { minimumFractionDigits: 2 })}</td>
                <td className="py-4 px-6">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    item.status === 'Available' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    item.status === 'Rented' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                    'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                  }`}>{item.status}</span>
                </td>
                <td className="py-4 px-6 text-right">
                  <div className="flex justify-end gap-4 items-center">
                    <button onClick={() => handleEditRate(item.id, item.daily_rate)} className="text-dreamco-blue hover:text-blue-700 dark:hover:text-blue-400 text-sm font-medium transition-colors">Edit Rate</button>
                    
                    {item.status !== 'Rented' && (
                      <>
                        <button 
                          onClick={() => handleToggleMaintenance(item.id, item.status)} 
                          className="text-orange-500 hover:text-orange-700 dark:hover:text-orange-400 text-sm font-medium transition-colors"
                        >
                          {item.status === 'Maintenance' ? 'Make Available' : 'Maintenance'}
                        </button>
                        <button 
                          onClick={() => handleDelete(item.id, item.status)} 
                          className="text-red-500 hover:text-red-700 dark:hover:text-red-400 text-sm font-medium transition-colors"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}