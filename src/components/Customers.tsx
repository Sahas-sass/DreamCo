import { useState } from 'react';
import { loadDatabase } from '../database';
import { generateInvoicePDF } from '../pdfGenerator';
import Modal from './Modal';

interface InvoiceItem { id: number; name: string; unique_number: string | null; daily_rate: number; qty: number; equipment_id: number; }
interface InvoiceDetail { id: number; invoice_number: string; customer_name: string; nic: string; phone: string; start_date: string; issue_time: string; status: string; total_amount: number; return_date?: string; return_time?: string; billed_days?: number; items: InvoiceItem[]; }

export default function Customers() {
  const [searchQuery, setSearchQuery] = useState('');
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [searchError, setSearchError] = useState('');
  const [billedDays, setBilledDays] = useState<number>(1);
  const [discount, setDiscount] = useState<number>(0);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [returnTime, setReturnTime] = useState(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
  
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' as 'success'|'error'|'info' });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError(''); setInvoice(null); setDiscount(0);
    try {
      const db = await loadDatabase();
      const rentalResult = await db.select<any[]>(`SELECT r.*, c.name as customer_name, c.nic, c.phone FROM rentals r JOIN customers c ON r.customer_id = c.id WHERE r.invoice_number = $1`, [searchQuery.toUpperCase()]);
      if (rentalResult.length === 0) return setSearchError('Invoice not found. Please check the ID and try again.');
      
      const rentalData = rentalResult[0];
      const itemsResult = await db.select<any[]>(`SELECT ri.qty, ri.daily_rate, ri.equipment_id, e.name, e.unique_number FROM rental_items ri JOIN equipment e ON ri.equipment_id = e.id WHERE ri.rental_id = $1`, [rentalData.id]);
      
      setInvoice({ ...rentalData, items: itemsResult });
      const diffTime = Math.abs(new Date().getTime() - new Date(rentalData.start_date).getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setBilledDays(diffDays === 0 ? 1 : diffDays); 
    } catch (error) { setModal({ isOpen: true, title: 'Search Error', message: String(error), type: 'error' }); }
  };

  const baseTotal = invoice ? invoice.items.reduce((sum, item) => sum + (item.daily_rate * billedDays), 0) : 0;
  const calculatedTotal = Math.max(0, baseTotal - discount);

  const handleCompleteReturn = async () => {
    if (!invoice) return;
    try {
      const db = await loadDatabase();
      await db.execute(`UPDATE rentals SET status = 'Completed', return_date = $1, return_time = $2, billed_days = $3, total_amount = $4 WHERE id = $5`, [returnDate, returnTime, billedDays, calculatedTotal, invoice.id]);
      for (const item of invoice.items) {
        await db.execute("UPDATE equipment SET status = 'Available' WHERE id = $1", [item.equipment_id]);
      }
      
      generateInvoicePDF({
        invoice_number: invoice.invoice_number, customer_name: invoice.customer_name, nic: invoice.nic,
        date: returnDate, time: returnTime, items: invoice.items, days: billedDays, total: calculatedTotal, discount: discount
      }, 'Return');

      setModal({ isOpen: true, title: 'Return Processed!', message: `Final Total: Rs. ${calculatedTotal.toLocaleString('en-LK')}. PDF Receipt downloaded.`, type: 'success' });
      setInvoice(null); setSearchQuery('');
    } catch (error) { setModal({ isOpen: true, title: 'Update Error', message: String(error), type: 'error' }); }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12 max-w-5xl mx-auto">
      <Modal {...modal} onClose={() => setModal({ ...modal, isOpen: false })} />
      
      <header className="text-center mb-10">
        <h2 className="text-3xl font-semibold text-dreamco-dark dark:text-white transition-colors">Return Hub & Customer Search</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 transition-colors">Scan or enter an Invoice ID to process returned equipment.</p>
      </header>

      <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col items-center transition-colors">
        <form onSubmit={handleSearch} className="w-full max-w-lg flex gap-3">
          <input type="text" placeholder="e.g., INV-123456" required value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 bg-gray-50 dark:bg-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl px-5 py-3.5 text-lg font-medium outline-none uppercase transition-colors" />
          <button type="submit" className="bg-dreamco-dark dark:bg-gray-700 text-white px-8 py-3.5 rounded-xl shadow-md font-medium text-lg">Search</button>
        </form>
        {searchError && <p className="text-red-500 mt-4 text-sm font-medium">{searchError}</p>}
      </div>

      {invoice && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in mt-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white/70 dark:bg-gray-900/60 backdrop-blur-lg p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 transition-colors">
              <div className="flex justify-between items-start border-b border-gray-100 dark:border-gray-800 pb-4 mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-dreamco-blue">{invoice.invoice_number}</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Status: <span className={`font-medium ${invoice.status === 'Completed' ? 'text-green-600' : 'text-orange-500'}`}>{invoice.status}</span></p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-dreamco-dark dark:text-white">{invoice.customer_name}</p>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">NIC: {invoice.nic}</p>
                </div>
              </div>
              <h4 className="font-semibold text-dreamco-dark dark:text-gray-200 mb-3">Rented Items</h4>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-y border-gray-100 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                    <th className="py-2 px-4 font-medium">Item</th>
                    <th className="py-2 px-4 font-medium text-right">Daily Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-50 dark:border-gray-800/50">
                      <td className="py-3 px-4 text-gray-800 dark:text-gray-200">{item.name}</td>
                      <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">Rs. {item.daily_rate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:col-span-1">
            {invoice.status === 'Completed' ? (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 p-6 rounded-2xl flex flex-col items-center justify-center h-full text-center">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mb-4 text-xl">✓</div>
                <h3 className="text-lg font-bold text-green-800 dark:text-green-400">Return Completed</h3>
                <button onClick={() => generateInvoicePDF({...invoice, date: invoice.return_date!, time: invoice.return_time!, days: invoice.billed_days!, total: invoice.total_amount, discount}, 'Return')} className="mt-4 bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 w-full shadow-sm">Re-Download Receipt</button>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 p-6 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 transition-colors">
                <h3 className="text-lg font-semibold text-dreamco-dark dark:text-white mb-5 border-b border-gray-100 dark:border-gray-700 pb-2">Process Return</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Return Date</label>
                    <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="w-full bg-white dark:bg-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 flex justify-between"><span>Billed Days</span></label>
                    <input type="number" min="1" value={billedDays} onChange={(e) => setBilledDays(parseInt(e.target.value)||1)} className="w-full bg-white dark:bg-gray-800 dark:text-white border border-dreamco-blue/40 rounded-xl px-4 py-2.5 outline-none font-bold" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 flex justify-between"><span>Discount (LKR)</span></label>
                    <input type="number" min="0" value={discount} onChange={(e) => setDiscount(parseInt(e.target.value)||0)} className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-orange-400/40 text-orange-600 font-medium" />
                  </div>
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700 mt-6">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Final Amount Due</p>
                    <p className="text-3xl font-bold text-dreamco-dark dark:text-white mb-6">Rs. {calculatedTotal.toLocaleString('en-LK')}</p>
                    <button onClick={handleCompleteReturn} className="w-full bg-gradient-to-r from-dreamco-blue to-blue-500 text-white px-6 py-3.5 rounded-xl shadow-lg font-semibold">Complete & Close Invoice</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}