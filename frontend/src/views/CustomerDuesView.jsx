import React, { useState, useEffect } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { BookOpen, IndianRupee, CheckCircle2, X } from "lucide-react";

export function CustomerDuesView() {
  const { activeShop } = useAuth();
  const [customersWithDues, setCustomersWithDues] = useState([]);
  const [totalDues, setTotalDues] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Payment Modal State
  const [payModal, setPayModal] = useState(null); // Customer
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [notes, setNotes] = useState("");

  const loadDues = async () => {
    if (!activeShop) return;
    try {
      setLoading(true);
      const res = await api.getCustomerDuesReport(activeShop.id);
      setCustomersWithDues(res.customers);
      setTotalDues(res.total_outstanding_dues);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDues();
  }, [activeShop]);

  const handleCollectPayment = async (e) => {
    e.preventDefault();
    if (!payModal) return;
    setError("");

    try {
      await api.createPayment(activeShop.id, {
        customer_id: payModal.id,
        amount: parseFloat(amount).toFixed(2),
        payment_method: paymentMethod,
        notes: notes || `Khata payment received from ${payModal.name}`,
      });

      setPayModal(null);
      setAmount("");
      setNotes("");
      loadDues();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-rose-600" />
            Khata / Customer Dues Ledger (বাকি খাতা)
          </h2>
          <p className="text-xs text-slate-500">Track all customer credit balances and collect due repayments</p>
        </div>

        <div className="bg-rose-50 border border-rose-200 px-4 py-2 rounded-2xl text-right">
          <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Total Market Due</div>
          <div className="text-xl font-bold text-rose-950">
            ₹{parseFloat(totalDues).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Dues Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[11px] border-b border-slate-100">
              <tr>
                <th className="p-3.5">Customer Name</th>
                <th className="p-3.5">Phone Number</th>
                <th className="p-3.5">Address</th>
                <th className="p-3.5 text-right">Total Due Balance</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {customersWithDues.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-400">
                    🎉 Excellent! No pending customer dues for this shop.
                  </td>
                </tr>
              ) : (
                customersWithDues.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900">{c.name}</td>
                    <td className="p-3.5 text-slate-600 font-mono">{c.phone || "—"}</td>
                    <td className="p-3.5 text-slate-500">{c.address || "—"}</td>
                    <td className="p-3.5 text-right font-extrabold text-sm text-rose-600">
                      ₹{parseFloat(c.outstanding_due).toFixed(2)}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => {
                          setPayModal(c);
                          setAmount(c.outstanding_due);
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all cursor-pointer inline-flex items-center gap-1"
                      >
                        <IndianRupee className="w-3.5 h-3.5" /> Collect Payment (টাকা নিন)
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Collect Payment Modal */}
      {payModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Collect Due Repayment</h3>
              <button onClick={() => setPayModal(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs bg-rose-50 border border-rose-100 p-3 rounded-xl">
              <div className="font-bold text-slate-900">{payModal.name}</div>
              <div className="text-rose-700 font-bold mt-0.5">
                Outstanding Due: ₹{parseFloat(payModal.outstanding_due).toFixed(2)}
              </div>
            </div>

            <form onSubmit={handleCollectPayment} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={payModal.outstanding_due}
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 500.00"
                  className="w-full p-2 border border-slate-200 rounded-xl font-bold text-emerald-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {["CASH", "UPI", "CARD"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        paymentMethod === m
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. GPay ref #123456"
                  className="w-full p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPayModal(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-sm cursor-pointer"
                >
                  Confirm & Clear Due
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
