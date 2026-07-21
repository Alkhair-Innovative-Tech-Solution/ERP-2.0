'use client';

import { useRef } from 'react';
import { Receipt, Printer, Download, X } from 'lucide-react';

interface ReceiptData {
  receipt_number: string;
  student_name: string;
  student_id?: string;
  cnic?: string;
  course_name: string;
  section_label?: string;
  fee_type: string;
  fee_month: string;
  amount_due: number;
  amount_paid: number;
  discount_amount: number;
  original_amount?: number;
  payment_status: string;
  paid_date?: string;
  collected_by_name?: string;
  transactions: any[];
}

interface ReceiptDocumentProps {
  data: ReceiptData;
  onClose: () => void;
}

export default function ReceiptDocument({ data, onClose }: ReceiptDocumentProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  const formatMonth = (m: string) => {
    const d = new Date(m + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  const formatDate = (d: string) => {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const content = receiptRef.current?.innerHTML || '';
    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt - ${data.receipt_number}</title>
          <style>
            @page { margin: 15mm; }
            body { font-family: 'Courier New', monospace; color: #1e293b; padding: 20px; max-width: 800px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #1e293b; padding-bottom: 16px; margin-bottom: 24px; }
            .header h1 { font-size: 22px; margin: 0; letter-spacing: 2px; text-transform: uppercase; }
            .header p { margin: 4px 0 0; font-size: 12px; color: #64748b; }
            .receipt-no { font-size: 13px; font-weight: bold; text-align: right; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; margin: 16px 0; }
            th, td { padding: 8px 12px; text-align: left; font-size: 14px; }
            th { background: #f1f5f9; font-weight: bold; }
            .totals { margin-top: 16px; border-top: 2px solid #1e293b; padding-top: 12px; }
            .totals .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; }
            .totals .grand { font-size: 18px; font-weight: bold; border-top: 1px solid #cbd5e1; padding-top: 8px; margin-top: 8px; }
            .footer { margin-top: 32px; padding-top: 16px; border-top: 1px dashed #cbd5e1; font-size: 11px; color: #94a3b8; text-align: center; }
            .badge { display: inline-block; padding: 2px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
            .badge.paid { background: #dcfce7; color: #16a34a; }
            .student-info { margin-bottom: 16px; }
            .student-info .row { display: flex; padding: 3px 0; font-size: 14px; }
            .student-info .label { width: 140px; font-weight: bold; color: #64748b; }
          </style>
        </head>
        <body>
          ${content}
          <div class="footer">
            <p>This is a computer-generated receipt. No signature required.</p>
          </div>
          <script>
            window.onload = function() { window.print(); };
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownload = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: html2canvas } = await import('html2canvas');
    if (!receiptRef.current) return;
    const canvas = await html2canvas(receiptRef.current, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`receipt-${data.receipt_number || 'payment'}.pdf`);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Toolbar */}
        <div className="sticky top-0 bg-white border-b border-slate-100 p-4 flex items-center justify-between z-10">
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-brand-teal" />
            Payment Receipt
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="p-2 hover:bg-slate-100 rounded-xl transition-colors" title="Print">
              <Printer size={16} className="text-slate-500" />
            </button>
            <button onClick={handleDownload} className="p-2 hover:bg-slate-100 rounded-xl transition-colors" title="Download PDF">
              <Download size={16} className="text-slate-500" />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors" title="Close">
              <X size={16} className="text-slate-500" />
            </button>
          </div>
        </div>

        {/* Receipt Content */}
        <div ref={receiptRef} className="p-8">
          <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
            <h1 className="text-2xl font-black tracking-tight uppercase">AIT LMS</h1>
            <p className="text-xs text-slate-400 font-bold mt-1">Fee Payment Receipt</p>
          </div>

          <div className="text-right text-sm font-bold text-slate-500 mb-4">
            Receipt #: <span className="text-slate-900">{data.receipt_number || 'N/A'}</span>
          </div>

          {data.payment_status === 'paid' && (
            <div className="text-right mb-4">
              <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full text-[10px] font-black uppercase tracking-widest">Paid</span>
            </div>
          )}

          {/* Student Info */}
          <div className="border border-slate-200 rounded-xl p-4 mb-4">
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <div><span className="text-slate-400 font-bold">Student Name</span><p className="font-black text-slate-900">{data.student_name || 'N/A'}</p></div>
              <div><span className="text-slate-400 font-bold">Student ID</span><p className="font-black text-slate-900">{data.student_id || 'N/A'}</p></div>
              {data.cnic && <div><span className="text-slate-400 font-bold">CNIC</span><p className="font-black text-slate-900">{data.cnic}</p></div>}
            </div>
          </div>

          {/* Course Info */}
          <div className="border border-slate-200 rounded-xl p-4 mb-6">
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <div><span className="text-slate-400 font-bold">Course</span><p className="font-black text-slate-900">{data.course_name}</p></div>
              {data.section_label && <div><span className="text-slate-400 font-bold">Section</span><p className="font-black text-slate-900">{data.section_label}</p></div>}
              <div><span className="text-slate-400 font-bold">Fee Type</span><p className="font-black text-slate-900 capitalize">{data.fee_type === 'full' ? 'Full Course' : 'Monthly'}</p></div>
              <div><span className="text-slate-400 font-bold">Period</span><p className="font-black text-slate-900">{formatMonth(data.fee_month)}</p></div>
            </div>
          </div>

          {/* Payment Details */}
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                <th className="text-right p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount (PKR)</th>
              </tr>
            </thead>
            <tbody>
              {data.original_amount && data.discount_amount > 0 ? (
                <>
                  <tr className="border-t border-slate-100">
                    <td className="p-3 text-sm font-bold text-slate-600">Original Fee</td>
                    <td className="p-3 text-sm font-black text-right text-slate-900">{data.original_amount.toLocaleString()}</td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <td className="p-3 text-sm font-bold text-green-600">Discount</td>
                    <td className="p-3 text-sm font-black text-right text-green-600">-{data.discount_amount.toLocaleString()}</td>
                  </tr>
                </>
              ) : null}
              <tr className="border-t border-slate-100">
                <td className="p-3 text-sm font-bold text-slate-600">{data.fee_type === 'full' ? 'Full Course Payment (discounted)' : 'Monthly Fee'}</td>
                <td className="p-3 text-sm font-black text-right text-slate-900">{data.amount_due.toLocaleString()}</td>
              </tr>
              <tr className="border-t-2 border-slate-900">
                <td className="p-3 text-base font-black text-slate-900">Total Paid</td>
                <td className="p-3 text-base font-black text-right text-emerald-600">{data.amount_paid.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          {/* Transactions */}
          {data.transactions && data.transactions.length > 0 && (
            <div className="mt-6 border border-slate-200 rounded-xl p-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Payment Transactions</h3>
              {data.transactions.map((t: any, i: number) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-xs font-bold text-slate-700 capitalize">{t.payment_method || 'Cash'}</p>
                    {t.transaction_reference && <p className="text-[9px] text-slate-400">Ref: {t.transaction_reference}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-900">PKR {(t.amount || 0).toLocaleString()}</p>
                    {t.received_at && <p className="text-[9px] text-slate-400">{new Date(t.received_at).toLocaleDateString()}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Payment Info */}
          <div className="border border-slate-200 rounded-xl p-4 mt-4">
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              {data.paid_date && <div><span className="text-slate-400 font-bold">Payment Date</span><p className="font-black text-slate-900">{formatDate(data.paid_date)}</p></div>}
              {data.collected_by_name && <div><span className="text-slate-400 font-bold">Received By</span><p className="font-black text-slate-900">{data.collected_by_name}</p></div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
