import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PDFData {
  invoice_number: string;
  customer_name: string;
  nic: string;
  date: string;
  time: string;
  items: any[];
  days: number;
  total: number;
  discount?: number;
  issue_date?: string; // NEW: Added Issue Date field
}

export const generateInvoicePDF = (data: PDFData, type: 'Issue' | 'Return') => {
  const doc = new jsPDF();

  doc.setFontSize(24);
  doc.setTextColor(18, 115, 185);
  doc.text("DreamCo", 14, 22);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("CONSTRUCTION RENTALS", 14, 28);
  doc.text("Your Project. Our Tools. Endless Possibilities.", 14, 34);

  doc.setFontSize(16);
  doc.setTextColor(40, 40, 40);
  doc.text(`${type === 'Issue' ? 'EQUIPMENT ISSUE' : 'FINAL RETURN'} RECEIPT`, 14, 50);
  
  doc.setFontSize(11);
  doc.text(`Invoice ID: ${data.invoice_number}`, 14, 60);
  
  // NEW: Print both dates if it's a Return Receipt
  if (type === 'Return' && data.issue_date) {
    doc.text(`Issue Date: ${data.issue_date}`, 14, 66);
    doc.text(`Return Date: ${data.date} at ${data.time}`, 14, 72);
    doc.text(`Customer: ${data.customer_name}`, 120, 60);
    doc.text(`NIC: ${data.nic}`, 120, 66);
  } else {
    doc.text(`Date: ${data.date} at ${data.time}`, 14, 66);
    doc.text(`Customer: ${data.customer_name}`, 120, 60);
    doc.text(`NIC: ${data.nic}`, 120, 66);
  }

  // UPDATED: Removed the "Days" column to simplify the receipt
  const tableRows = data.items.map(item => [
    `${item.name} ${item.unique_number ? `(#${item.unique_number})` : ''}`,
    (item.qty || 1).toString(), 
    `Rs. ${item.daily_rate.toLocaleString('en-LK')}`,
    `Rs. ${(item.daily_rate * (item.qty || 1) * data.days).toLocaleString('en-LK')}`
  ]);

  autoTable(doc, {
    startY: type === 'Return' ? 80 : 75, // Pushed down slightly for returns
    head: [['Item Description', 'Qty', 'Daily Rate', 'Subtotal']],
    body: tableRows,
    theme: 'striped',
    headStyles: { fillColor: [18, 115, 185], textColor: 255 },
    styles: { fontSize: 10, cellPadding: 4 },
  });

  let finalY = (doc as any).lastAutoTable.finalY || 80;
  
  if (data.discount && data.discount > 0) {
    const subtotal = data.total + data.discount;
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(`Subtotal: Rs. ${subtotal.toLocaleString('en-LK')}`, 14, finalY + 10);
    doc.setTextColor(239, 68, 68); 
    doc.text(`Discount Applied: - Rs. ${data.discount.toLocaleString('en-LK')}`, 14, finalY + 16);
    finalY += 14; 
  }

  doc.setFontSize(14);
  doc.setTextColor(18, 115, 185);
  doc.text(`${type === 'Issue' ? 'Estimated' : 'Final'} Total: Rs. ${data.total.toLocaleString('en-LK')}`, 14, finalY + 14);

  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  doc.text("Thank you for choosing DreamCo Construction.", 14, finalY + 32);
  
  doc.save(`${data.invoice_number}_${type}.pdf`);
};