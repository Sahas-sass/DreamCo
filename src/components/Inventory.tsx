import { useState, useEffect } from 'react';
import { loadDatabase } from '../database';

interface Equipment {
  id: number;
  name: string;
  category: string;
  unique_number: string | null;
  total_qty: number;
  daily_rate: number;
  status: string;
}

const CATEGORIES = [
  "Heavy Vehicles",
  "Heavy Tools",
  "Power Tools",
  "Scaffolding",
  "Safety Gear",
  "General"
];

export default function Inventory() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  
  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [uniqueId, setUniqueId] = useState('');
  const [qty, setQty] = useState('1');
  const [rate, setRate] = useState('');

  const fetchEquipment = async () => {
    try {
      const db = await loadDatabase();
      const result = await db.select<Equipment[]>("SELECT * FROM equipment ORDER BY id DESC");
      setEquipment(result);
    } catch (error) {
      console.error("Failed to load inventory:", error);
    }
  };

  useEffect(() => {
    fetchEquipment();
  }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !rate) return;

    try {
      const db = await loadDatabase();
      await db.execute(
        "INSERT INTO equipment (name, category, unique_number, total_qty, daily_rate) VALUES ($1, $2, $3, $4, $5)",
        [name, category, uniqueId || null, parseInt(qty), parseFloat(rate)]
      );
      
      // Reset form
      setName('');
      setUniqueId('');
      setQty('1');
      setRate('');
      fetchEquipment();
    } catch (error) {
      console.error("Failed to add item:", error);
    }
  };

  // Feature: Update Daily Rate
  const handleEditRate = async (id: number, currentRate: number) => {
    const newRateStr = window.prompt("Enter new daily rate (LKR):", currentRate.toString());
    if (!newRateStr) return;
    
    const newRate = parseFloat(newRateStr);
    if (isNaN(newRate)) {
      alert("Please enter a valid number.");
      return;
    }

    try {
      const db = await loadDatabase();
      await db.execute("UPDATE equipment SET daily_rate = $1 WHERE id = $2", [newRate, id]);
      fetchEquipment();
    } catch (error) {
      console.error("Failed to update rate:", error);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <header>
        <h2 className="text-3xl font-semibold text-dreamco-dark">Inventory Management</h2>
        <p className="text-gray-500 mt-1">Track your fleet and set LKR daily rates.</p>
      </header>

      {/* Add Item Form */}
      <div className="bg-white/80 backdrop-blur-lg p-6 rounded-2xl shadow-sm border border-gray-100">
        <form onSubmit={handleAddItem} className="flex flex-wrap gap-4 items-end">
          
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-600 mb-1">Item Name</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Concrete Mixer" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-dreamco-blue/40 outline-none" />
          </div>

          <div className="w-40">
            <label className="block text-sm font-medium text-gray-600 mb-1">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-dreamco-blue/40 outline-none">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="w-32">
            <label className="block text-sm font-medium text-gray-600 mb-1">Unique ID</label>
            <input type="text" value={uniqueId} onChange={(e) => setUniqueId(e.target.value)} placeholder="Optional" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-dreamco-blue/40 outline-none" />
          </div>

          <div className="w-24">
            <label className="block text-sm font-medium text-gray-600 mb-1">Qty</label>
            <input type="number" min="1" required value={qty} onChange={(e) => setQty(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-dreamco-blue/40 outline-none" />
          </div>

          <div className="w-36">
            <label className="block text-sm font-medium text-gray-600 mb-1">Rate (LKR)</label>
            <input type="number" step="0.01" required value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0.00" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-dreamco-blue/40 outline-none" />
          </div>

          <button type="submit" className="bg-gradient-to-r from-dreamco-blue to-blue-500 text-white px-6 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all font-medium h-[46px]">
            + Add Item
          </button>
        </form>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100 text-sm text-gray-500">
              <th className="py-4 px-6 font-medium">Item Name & ID</th>
              <th className="py-4 px-6 font-medium">Category</th>
              <th className="py-4 px-6 font-medium">Qty</th>
              <th className="py-4 px-6 font-medium">Daily Rate (LKR)</th>
              <th className="py-4 px-6 font-medium">Status</th>
              <th className="py-4 px-6 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {equipment.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-gray-400">No equipment added yet.</td></tr>
            ) : (
              equipment.map((item) => (
                <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
                  <td className="py-4 px-6 font-medium text-gray-800">
                    {item.name}
                    {item.unique_number && <span className="block text-xs text-gray-400 mt-0.5">ID: {item.unique_number}</span>}
                  </td>
                  <td className="py-4 px-6 text-gray-600">{item.category || 'General'}</td>
                  <td className="py-4 px-6 text-gray-600">{item.total_qty}</td>
                  <td className="py-4 px-6 text-gray-800 font-medium">
                    Rs. {item.daily_rate.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-4 px-6">
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">{item.status}</span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button 
                      onClick={() => handleEditRate(item.id, item.daily_rate)}
                      className="text-dreamco-blue hover:text-blue-700 text-sm font-medium transition-colors"
                    >
                      Edit Rate
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}