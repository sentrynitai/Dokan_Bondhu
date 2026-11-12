import React, { useState, useEffect } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { Users, Plus, Search, Phone, MapPin, Eye, X, BookOpen } from "lucide-react";

export function CustomersView({ setTab }) {
  const { activeShop } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [activeLedger, setActiveLedger] = useState(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [initialDue, setInitialDue] = useState("0");

  const loadCustomers = async () => {
    if (!activeShop) return;
    try {
      setLoading(true);
      const data = await api.getCustomers(activeShop.id, {
        search: search || undefined,
        limit: 100,
      });
      setCustomers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [activeShop]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.createCustomer(activeShop.id, {
        name,
        phone: phone || null,
        email: email || null,
        address: address || null,
        initial_due: parseFloat(initialDue).toFixed(2),
      });

      setShowAddModal(false);
      setName("");
      setPhone("");
      setEmail("");
      setAddress("");
      setInitialDue("0");
      loadCustomers();
    } catch (err) {
      setError(err.message);
    }
  };

  const openLedger = async (customer) => {
    try {
      const ledger = await api.getCustomerLedger(activeShop.id, customer.id);
      setActiveLedger(ledger);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            Customer Directory (খরিদ্দার তালিকা)
          </h2>
          <p className="text-xs text-slate-500">Manage regular store customers and credit khata</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab("dues")}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-rose-600" /> View Pending Dues (খাতা)
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Customer
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search customer by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadCustomers()}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[11px] border-b border-slate-100">
              <tr>
                <th className="p-3.5">Customer Name</th>
                <th className="p-3.5">Phone Number</th>
                <th className="p-3.5">Address</th>
                <th className="p-3.5 text-right">Outstanding Due (বাকি)</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-400">
                    No customers registered yet.
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const hasDue = parseFloat(c.outstanding_due) > 0;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3.5 font-semibold text-slate-900">{c.name}</td>
                      <td className="p-3.5 text-slate-600 font-mono">{c.phone || "—"}</td>
                      <td className="p-3.5 text-slate-500">{c.address || "—"}</td>
                      <td className="p-3.5 text-right font-bold">
                        <span className={hasDue ? "text-rose-600" : "text-slate-400"}>
                          ₹{parseFloat(c.outstanding_due).toFixed(2)}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => openLedger(c)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" /> Khata Ledger
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Add New Customer</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Subhash Ghosh"
                  className="w-full p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9830012345"
                  className="w-full p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Address / Landmark</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Near Kalighat temple"
                  className="w-full p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Prior Khata Due (পূর্বের বাকি ₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={initialDue}
                  onChange={(e) => setInitialDue(e.target.value)}
                  placeholder="0.00"
                  className="w-full p-2 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-sm cursor-pointer"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Ledger Modal */}
      {activeLedger && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{activeLedger.customer.name}'s Ledger</h3>
                <div className="text-xs text-rose-600 font-bold mt-0.5">
                  Current Due Balance: ₹{parseFloat(activeLedger.outstanding_due).toFixed(2)}
                </div>
              </div>
              <button onClick={() => setActiveLedger(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sales Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Past Purchases</h4>
              {activeLedger.sales.length === 0 ? (
                <div className="text-slate-400 text-xs italic">No purchases recorded.</div>
              ) : (
                <div className="divide-y divide-slate-100 text-xs border border-slate-100 rounded-xl p-2 bg-slate-50">
                  {activeLedger.sales.map((s) => (
                    <div key={s.id} className="py-1.5 flex justify-between">
                      <div>
                        <span className="font-semibold text-slate-800">{s.invoice_number}</span>
                        <span className="text-slate-400 ml-2">({new Date(s.created_at).toLocaleDateString()})</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold">₹{s.total_amount}</span>
                        {parseFloat(s.due_amount) > 0 && (
                          <span className="text-rose-600 text-[10px] ml-2 font-bold">(Due: ₹{s.due_amount})</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payments Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Repayments Received</h4>
              {activeLedger.payments.length === 0 ? (
                <div className="text-slate-400 text-xs italic">No repayments recorded.</div>
              ) : (
                <div className="divide-y divide-slate-100 text-xs border border-slate-100 rounded-xl p-2 bg-slate-50">
                  {activeLedger.payments.map((p) => (
                    <div key={p.id} className="py-1.5 flex justify-between">
                      <div>
                        <span className="text-emerald-700 font-bold">₹{p.amount}</span>
                        <span className="text-slate-500 ml-2">via {p.payment_method}</span>
                      </div>
                      <span className="text-slate-400">{new Date(p.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
