import React, { useState, useEffect } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { Receipt, Search, Printer, Eye, X } from "lucide-react";

export function SalesHistoryView() {
  const { activeShop } = useAuth();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeReceipt, setActiveReceipt] = useState(null);

  const loadSales = async () => {
    if (!activeShop) return;
    try {
      setLoading(true);
      const data = await api.getSales(activeShop.id, { limit: 100 });
      setSales(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, [activeShop]);

  const openReceipt = async (saleId) => {
    try {
      const receipt = await api.getReceipt(activeShop.id, saleId);
      setActiveReceipt(receipt);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-600" />
            Sales History & Invoices (বিক্রয় খতিয়ান)
          </h2>
          <p className="text-xs text-slate-500">View past customer bills, payment breakdown, and reprint receipts</p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Sales Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[11px] border-b border-slate-100">
              <tr>
                <th className="p-3.5">Invoice #</th>
                <th className="p-3.5">Date & Time</th>
                <th className="p-3.5">Customer</th>
                <th className="p-3.5 text-right">Total Amount</th>
                <th className="p-3.5 text-right">Paid</th>
                <th className="p-3.5 text-right">Due</th>
                <th className="p-3.5 text-center">Payment</th>
                <th className="p-3.5 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {sales.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-slate-400">
                    No sales invoices recorded yet.
                  </td>
                </tr>
              ) : (
                sales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-slate-900">{s.invoice_number}</td>
                    <td className="p-3.5 text-slate-500 whitespace-nowrap">
                      {new Date(s.created_at).toLocaleString()}
                    </td>
                    <td className="p-3.5 font-semibold text-slate-800">
                      {s.customer_name || <span className="text-slate-400 font-normal">Walk-in</span>}
                    </td>
                    <td className="p-3.5 text-right font-bold text-slate-900">
                      ₹{parseFloat(s.total_amount).toFixed(2)}
                    </td>
                    <td className="p-3.5 text-right text-emerald-700 font-bold">
                      ₹{parseFloat(s.paid_amount).toFixed(2)}
                    </td>
                    <td className="p-3.5 text-right font-bold">
                      {parseFloat(s.due_amount) > 0 ? (
                        <span className="text-rose-600">₹{parseFloat(s.due_amount).toFixed(2)}</span>
                      ) : (
                        <span className="text-slate-300">₹0.00</span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                        {s.payment_method}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => openReceipt(s.id)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer inline-flex items-center gap-1"
                      >
                        <Printer className="w-3.5 h-3.5" /> View Receipt
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipt Modal */}
      {activeReceipt && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Invoice: {activeReceipt.invoice_number}
              </span>
              <button onClick={() => setActiveReceipt(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-700 font-mono space-y-2 border border-slate-100 p-4 rounded-xl bg-slate-50">
              <div className="text-center">
                <div className="font-bold text-sm text-slate-900">{activeReceipt.shop.name}</div>
                <div>{activeReceipt.shop.address || "Main Bazaar"}</div>
                <div>Phone: {activeReceipt.shop.phone || "N/A"}</div>
              </div>

              <div className="border-t border-dashed border-slate-300 pt-2 space-y-0.5">
                <div>Date: {new Date(activeReceipt.date).toLocaleString()}</div>
                <div>Customer: {activeReceipt.customer?.name || "Walk-in Customer"}</div>
              </div>

              <div className="border-t border-dashed border-slate-300 pt-2">
                {activeReceipt.items.map((i) => (
                  <div key={i.id} className="grid grid-cols-12 py-0.5">
                    <span className="col-span-6 truncate">{i.product_name}</span>
                    <span className="col-span-3 text-right">{i.quantity}</span>
                    <span className="col-span-3 text-right">₹{i.total_price}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-slate-300 pt-2 space-y-0.5 font-bold">
                <div className="flex justify-between text-slate-900">
                  <span>TOTAL:</span>
                  <span>₹{activeReceipt.total_amount}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Paid ({activeReceipt.payment_method}):</span>
                  <span>₹{activeReceipt.paid_amount}</span>
                </div>
                {parseFloat(activeReceipt.due_amount) > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Due:</span>
                    <span>₹{activeReceipt.due_amount}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Printer className="w-4 h-4" /> Print Receipt
              </button>
              <button
                onClick={() => setActiveReceipt(null)}
                className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
