import { useState, useEffect } from 'react';
import { loadDatabase } from '../database';
import { generateInvoicePDF } from '../pdfGenerator';
import Modal from './Modal';

interface Equipment {
  id: number;
  name: string;
  category: string;
  unique_number: string | null;
  daily_rate: number;
}

interface ActiveRental {
  id: number;
  invoice_number: string;
  customer_name: string;
  start_date: string;
  issue_time: string;
  total_amount: number;
  status: string;
}

interface CartItem {
  equipment: Equipment;
  days: number;
  subtotal: number;
}

export default function Rentals() {
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [activeRentals, setActiveRentals] = useState<ActiveRental[]>([]);
  
  // Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNic, setCustomerNic] = useState('');
  const [nicPhotoPath, setNicPhotoPath] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedEqId, setSelectedEqId] = useState('');
  const [rentalDays, setRentalDays] = useState('1');
  const [cart, setCart] = useState<CartItem[]>([]);

  // MODAL STATE
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' as 'success'|'error'|'info' });

  const fetchData = async () => {
    try {
      const db = await loadDatabase();
      const eqResult = await db.select<Equipment[]>("SELECT id, name, category, unique_number, daily_rate FROM equipment WHERE status = 'Available'");
      setEquipmentList(eqResult);
      
      const rentalResult = await db.select<ActiveRental[]>(`
        SELECT r.id, r.invoice_number, c.name as customer_name, r.start_date, r.issue_time, r.total_amount, r.status 
        FROM rentals r 
        JOIN customers c ON r.customer_id = c.id 
        WHERE r.status = 'Issued'
        ORDER BY r.id DESC
      `);
      setActiveRentals(rentalResult);
    } catch (error) {
      console.error("Failed to load data:", error);
      setModal({ isOpen: true, title: 'Database Error', message: String(error), type: 'error' });
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const categories = Array.from(new Set(equipmentList.map(eq => eq.category || 'General')));
  const filteredEquipment = equipmentList.filter(eq => selectedCategory === '' || eq.category === selectedCategory);

  const handleAddToCart = () => {
    if (!selectedEqId) return;
    const item = equipmentList.find(eq => eq.id.toString() === selectedEqId);
    if (!item) return;

    if (cart.some(c => c.equipment.id === item.id)) {
      setModal({ isOpen: true, title: 'Item Exists', message: 'This item is already in the cart.', type: 'info' });
      return;
    }

    const days = parseInt(rentalDays);
    setCart([...cart, { equipment: item, days, subtotal: item.daily_rate * days }]);
    setSelectedEqId('');
    setRentalDays('1');
  };

  const removeFromCart = (indexToRemove: number) => {
    setCart(cart.filter((_, index) => index !== indexToRemove));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerName || !customerNic) {
      setModal({ isOpen: true, title: 'Missing Info', message: 'Please fill in Customer Name and NIC.', type: 'error' });
      return;
    }
    if (cart.length === 0) {
      setModal({ isOpen: true, title: 'Empty Invoice', message: 'Please add at least one item.', type: 'error' });
      return;
    }

    try {
      const db = await loadDatabase();
      const today = new Date();
      const issueDate = today.toISOString().split('T')[0];
      const issueTime = today.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const invoiceNumber = 'INV-' + Date.now().toString().slice(-6);

      const custResult = await db.execute(
        "INSERT INTO customers (name, phone, nic, nic_photo_path) VALUES ($1, $2, $3, $4)",
        [customerName, customerPhone, customerNic, nicPhotoPath]
      );
      
      const rentResult = await db.execute(
        "INSERT INTO rentals (customer_id, start_date, issue_time, expected_return, total_amount, invoice_number, status) VALUES ($1, $2, $3, $4, $5, $6, 'Issued')",
        [custResult.lastInsertId, issueDate, issueTime, issueDate, cartTotal, invoiceNumber]
      );

      for (const cartItem of cart) {
        await db.execute(
          "INSERT INTO rental_items (rental_id, equipment_id, qty, daily_rate) VALUES ($1, $2, 1, $3)",
          [rentResult.lastInsertId, cartItem.equipment.id, cartItem.equipment.daily_rate]
        );
        await db.execute("UPDATE equipment SET status = 'Rented' WHERE id = $1", [cartItem.equipment.id]);
      }

      generateInvoicePDF({
        invoice_number: invoiceNumber,
        customer_name: customerName,
        nic: customerNic,
        date: issueDate,
        time: issueTime,
        items: cart.map(c => c.equipment),
        days: cart[0]?.days || 1, 
        total: cartTotal
      }, 'Issue');

      setCustomerName(''); setCustomerPhone(''); setCustomerNic(''); setNicPhotoPath(''); setCart([]);
      fetchData();
      
      // TRIGGER SUCCESS MODAL INSTEAD OF ALERT
      setModal({ 
        isOpen: true, 
        title: 'Invoice Created!', 
        message: `Invoice ${invoiceNumber} has been issued successfully. The PDF is downloading.`, 
        type: 'success' 
      });

    } catch (error) {
      console.error("Checkout failed:", error);
      setModal({ isOpen: true, title: 'Save Failed', message: String(error), type: 'error' });
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* CUSTOM MODAL ATTACHED HERE */}
      <Modal {...modal} onClose={() => setModal({ ...modal, isOpen: false })} />

      <header>
        <h2 className="text-3xl font-semibold text-dreamco-dark dark:text-white transition-colors">Issue Equipment</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1 transition-colors">Select items, build the invoice, and log the checkout time.</p>
      </header>

      {/* DARK MODE CLASSES ADDED TO CARD (dark:bg-gray-900/60 dark:border-gray-800) */}
      <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-lg p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 transition-colors">
        <form onSubmit={handleCheckout} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-dreamco-dark dark:text-gray-200 border-b border-gray-100 dark:border-gray-800 pb-2 transition-colors">1. Customer Details</h3>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Customer Name *</label>
                <input type="text" required value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-dreamco-blue/40 transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">NIC *</label>
                  <input type="text" required value={customerNic} onChange={(e) => setCustomerNic(e.target.value)} placeholder="e.g. 199012345678" className="w-full bg-gray-50 dark:bg-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-dreamco-blue/40 transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Phone</label>
                  <input type="text" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-dreamco-blue/40 transition-colors" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-dreamco-dark dark:text-gray-200 border-b border-gray-100 dark:border-gray-800 pb-2 transition-colors">2. Add Equipment</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Filter by Category</label>
                  <select value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setSelectedEqId(''); }} className="w-full bg-gray-50 dark:bg-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-dreamco-blue/40 transition-colors">
                    <option value="">All Categories</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Select Item</label>
                  <select value={selectedEqId} onChange={(e) => setSelectedEqId(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-dreamco-blue/40 transition-colors">
                    <option value="">-- Choose --</option>
                    {filteredEquipment.map(eq => (
                      <option key={eq.id} value={eq.id}>{eq.name} {eq.unique_number ? `(#${eq.unique_number})` : ''} - Rs. {eq.daily_rate}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-end gap-4">
                <div className="w-1/3">
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Est. Days</label>
                  <input type="number" min="1" value={rentalDays} onChange={(e) => setRentalDays(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-dreamco-blue/40 transition-colors" />
                </div>
                <button type="button" onClick={handleAddToCart} className="w-2/3 bg-gray-100 dark:bg-gray-800 text-dreamco-dark dark:text-gray-200 border border-gray-200 dark:border-gray-700 px-6 py-2.5 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all font-medium">
                  Add to List &darr;
                </button>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100 dark:border-gray-800 transition-colors">
            <h3 className="text-lg font-semibold text-dreamco-dark dark:text-gray-200 mb-4">3. Invoice Preview</h3>
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden mb-4 transition-colors">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 transition-colors">
                    <th className="py-2 px-4 font-medium">Item</th>
                    <th className="py-2 px-4 font-medium">Rate/Day</th>
                    <th className="py-2 px-4 font-medium">Days</th>
                    <th className="py-2 px-4 font-medium">Subtotal</th>
                    <th className="py-2 px-4 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.length === 0 ? (
                    <tr><td colSpan={5} className="py-6 text-center text-gray-400 dark:text-gray-500 text-sm">No items added to this invoice yet.</td></tr>
                  ) : (
                    cart.map((c, index) => (
                      <tr key={c.equipment.id} className="border-b border-gray-50 dark:border-gray-800/50 transition-colors">
                        <td className="py-3 px-4 font-medium text-gray-800 dark:text-gray-200">{c.equipment.name}</td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400">Rs. {c.equipment.daily_rate}</td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{c.days}</td>
                        <td className="py-3 px-4 text-gray-800 dark:text-gray-200 font-medium">Rs. {c.subtotal}</td>
                        <td className="py-3 px-4 text-right">
                          <button type="button" onClick={() => removeFromCart(index)} className="text-red-400 hover:text-red-500 dark:hover:text-red-400 text-sm font-medium">Remove</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center">
              <div className="text-xl font-bold text-dreamco-dark dark:text-white transition-colors">
                Est. Total: <span className="text-dreamco-blue">Rs. {cartTotal.toLocaleString('en-LK')}</span>
              </div>
              <button type="submit" disabled={cart.length === 0} className="bg-gradient-to-r from-dreamco-blue to-blue-500 disabled:from-gray-300 disabled:to-gray-400 dark:disabled:from-gray-700 dark:disabled:to-gray-800 disabled:text-gray-500 text-white px-8 py-3 rounded-xl shadow-md hover:shadow-lg transition-all font-medium">
                Generate Part 1 Invoice
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-900/60 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden mt-8 transition-colors">
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 transition-colors">
          <h3 className="text-lg font-semibold text-dreamco-dark dark:text-gray-200">Active Invoices (Pending Returns)</h3>
        </div>
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 text-sm text-gray-500 dark:text-gray-400 transition-colors">
              <th className="py-3 px-6 font-medium">Invoice ID</th>
              <th className="py-3 px-6 font-medium">Customer</th>
              <th className="py-3 px-6 font-medium">Issued On</th>
              <th className="py-3 px-6 font-medium">Est. Total</th>
            </tr>
          </thead>
          <tbody>
            {activeRentals.length === 0 ? (
              <tr><td colSpan={4} className="py-8 text-center text-gray-400 dark:text-gray-600">No equipment currently checked out.</td></tr>
            ) : (
              activeRentals.map((rental) => (
                <tr key={rental.id} className="border-b border-gray-50 dark:border-gray-800/50 transition-colors">
                  <td className="py-4 px-6 font-semibold text-dreamco-blue">{rental.invoice_number}</td>
                  <td className="py-4 px-6 text-gray-800 dark:text-gray-300">{rental.customer_name}</td>
                  <td className="py-4 px-6 text-gray-500 dark:text-gray-400 text-sm">{rental.start_date} <br/><span className="text-gray-400 dark:text-gray-500">{rental.issue_time}</span></td>
                  <td className="py-4 px-6 font-medium text-gray-800 dark:text-gray-200">Rs. {rental.total_amount.toLocaleString('en-LK')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}