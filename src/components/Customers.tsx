import { useState } from 'react';
import { loadDatabase } from '../database';
import { generateInvoicePDF } from '../pdfGenerator';

interface InvoiceItem {
  id: number;
  name: string;
  unique_number: string | null;
  daily_rate: number;
  qty: number;
  equipment_id: number;
}

interface InvoiceDetail {
  id: number;
  invoice_number: string;
  customer_name: string;
  nic: string;
  phone: string;
  start_date: string;
  issue_time: string;
  status: string;
  items: InvoiceItem[];
}

export default function Customers() {
  const [searchQuery, setSearchQuery] = useState('');
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [searchError, setSearchError] = useState('');

  // Return Processing State
  const [billedDays, setBilledDays] = useState<number>(1);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [returnTime, setReturnTime] = useState(
    new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  );

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError('');
    setInvoice(null);

    try {
      const db = await loadDatabase();
      
      // 1. Fetch the main rental and customer data
      const rentalResult = await db.select<any[]>(`
        SELECT r.*, c.name as customer_name, c.nic, c.phone 
        FROM rentals r 
        JOIN customers c ON r.customer_id = c.id 
        WHERE r.invoice_number = $1
      `, [searchQuery.toUpperCase()]);

      if (rentalResult.length === 0) {
        setSearchError('Invoice not found. Please check the ID and try again.');
        return;
      }

      const rentalData = rentalResult[0];

      // 2. Fetch the associated equipment items
      const itemsResult = await db.select<any[]>(`
        SELECT ri.qty, ri.daily_rate, ri.equipment_id, e.name, e.unique_number 
        FROM rental_items ri 
        JOIN equipment e ON ri.equipment_id = e.id 
        WHERE ri.rental_id = $1
      `, [rentalData.id]);

      setInvoice({
        ...rentalData,
        items: itemsResult
      });

      // 3. Auto-calculate suggested days based on issue date vs today
      const issueDateObj = new Date(rentalData.start_date);
      const today = new Date();
      const diffTime = Math.abs(today.getTime() - issueDateObj.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      setBilledDays(diffDays === 0 ? 1 : diffDays); // Minimum 1 day

    } catch (error) {
      console.error("Search failed:", error);
      setSearchError('A database error occurred.');
    }
  };

  // Calculate the dynamic total whenever the user changes the day count
  const calculatedTotal = invoice 
    ? invoice.items.reduce((sum, item) => sum + (item.daily_rate * billedDays), 0)
    : 0;

  const handleCompleteReturn = async () => {
    if (!invoice) return;

    try {
      const db = await loadDatabase();

      // 1. Update the rental invoice to 'Completed' with final dates and total
      await db.execute(`
        UPDATE rentals 
        SET status = 'Completed', return_date = $1, return_time = $2, billed_days = $3, total_amount = $4 
        WHERE id = $5
      `, [returnDate, returnTime, billedDays, calculatedTotal, invoice.id]);

      // 2. Release all equipment back into 'Available' inventory
      for (const item of invoice.items) {
        await db.execute("UPDATE equipment SET status = 'Available' WHERE id = $1", [item.equipment_id]);
      }

      // GENERATE PDF
      generateInvoicePDF({
        invoice_number: invoice.invoice_number,
        customer_name: invoice.customer_name,
        nic: invoice.nic,
        date: returnDate,
        time: returnTime,
        items: invoice.items,
        days: billedDays,
        total: calculatedTotal
      }, 'Return');

      alert(`Return Processed!\nFinal Total: Rs. ${calculatedTotal.toLocaleString('en-LK')}`);
      
      // Reset view
      setInvoice(null);
      setSearchQuery('');
    } catch (error) {
      console.error("Return process failed:", error);
      alert("Failed to process return.");
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12 max-w-5xl mx-auto">
      <header className="text-center mb-10">
        <h2 className="text-3xl font-semibold text-dreamco-dark">Return Hub & Customer Search</h2>
        <p className="text-gray-500 mt-2">Scan or enter an Invoice ID to process returned equipment.</p>
      </header>

      {/* Search Bar - Minimal & Clean */}
      <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
        <form onSubmit={handleSearch} className="w-full max-w-lg flex gap-3">
          <input 
            type="text" 
            placeholder="e.g., INV-123456" 
            required
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-5 py-3.5 text-lg font-medium focus:ring-2 focus:ring-dreamco-blue/40 outline-none uppercase transition-all"
          />
          <button type="submit" className="bg-dreamco-dark text-white px-8 py-3.5 rounded-xl shadow-md hover:bg-gray-800 transition-all font-medium text-lg">
            Search
          </button>
        </form>
        {searchError && <p className="text-red-500 mt-4 text-sm font-medium">{searchError}</p>}
      </div>

      {/* Invoice Details & Return Panel (Glassmorphism layout) */}
      {invoice && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in mt-8">
          
          {/* Left Column: Original Invoice Data */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white/70 backdrop-blur-lg p-8 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-start border-b border-gray-100 pb-4 mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-dreamco-blue">{invoice.invoice_number}</h3>
                  <p className="text-gray-500 text-sm mt-1">Status: <span className={`font-medium ${invoice.status === 'Completed' ? 'text-green-600' : 'text-orange-500'}`}>{invoice.status}</span></p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-dreamco-dark">{invoice.customer_name}</p>
                  <p className="text-gray-500 text-sm">NIC: {invoice.nic}</p>
                  <p className="text-gray-500 text-sm">{invoice.phone}</p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-sm text-gray-500 mb-1">Issue Date & Time</p>
                <p className="font-medium text-gray-800">{invoice.start_date} at {invoice.issue_time}</p>
              </div>

              <h4 className="font-semibold text-dreamco-dark mb-3">Rented Items</h4>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-y border-gray-100 text-sm text-gray-500">
                    <th className="py-2 px-4 font-medium">Item</th>
                    <th className="py-2 px-4 font-medium text-right">Daily Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-50">
                      <td className="py-3 px-4 text-gray-800">
                        {item.name} {item.unique_number && <span className="text-gray-400 text-xs ml-1">(#{item.unique_number})</span>}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-600">Rs. {item.daily_rate.toLocaleString('en-LK')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Return Processing Action Panel */}
          <div className="lg:col-span-1">
            {invoice.status === 'Completed' ? (
              <div className="bg-green-50 border border-green-100 p-6 rounded-2xl flex flex-col items-center justify-center h-full text-center">
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4 text-xl">✓</div>
                <h3 className="text-lg font-bold text-green-800">Return Completed</h3>
                <p className="text-green-600 text-sm mt-2">This invoice is closed.</p>
                <button 
                  onClick={() => generateInvoicePDF({
                    invoice_number: invoice.invoice_number,
                    customer_name: invoice.customer_name,
                    nic: invoice.nic,
                    date: invoice.return_date || new Date().toISOString().split('T')[0],
                    time: invoice.return_time || '',
                    items: invoice.items,
                    days: invoice.billed_days || 1,
                    total: invoice.total_amount
                  }, 'Return')}
                  className="mt-4 bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  Re-Download Receipt
                </button>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-white to-gray-50 p-6 rounded-2xl shadow-md border border-gray-100">
                <h3 className="text-lg font-semibold text-dreamco-dark mb-5 border-b border-gray-100 pb-2">Process Return</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Return Date</label>
                    <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Return Time</label>
                    <input type="time" value={returnTime} onChange={(e) => setReturnTime(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1 flex justify-between">
                      <span>Billed Days</span>
                      <span className="text-xs text-dreamco-blue">Editable</span>
                    </label>
                    <input type="number" min="1" value={billedDays} onChange={(e) => setBilledDays(parseInt(e.target.value) || 1)} className="w-full bg-white border border-dreamco-blue/40 ring-2 ring-dreamco-blue/10 rounded-xl px-4 py-2.5 outline-none font-bold text-dreamco-dark" />
                  </div>

                  <div className="pt-4 border-t border-gray-200 mt-6">
                    <p className="text-sm text-gray-500 mb-1">Final Amount Due</p>
                    <p className="text-3xl font-bold text-dreamco-dark mb-6">
                      Rs. {calculatedTotal.toLocaleString('en-LK')}
                    </p>

                    <button onClick={handleCompleteReturn} className="w-full bg-gradient-to-r from-dreamco-blue to-blue-500 text-white px-6 py-3.5 rounded-xl shadow-lg hover:shadow-xl transition-all font-semibold">
                      Complete & Close Invoice
                    </button>
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