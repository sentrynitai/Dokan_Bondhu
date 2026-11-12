import React, { useState, useEffect } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import {
  Boxes,
  ArrowDownLeft,
  ArrowUpRight,
  SlidersHorizontal,
  AlertTriangle,
  X,
  History,
  TrendingUp,
} from "lucide-react";

export function InventoryView({ setTab }) {
  const { activeShop } = useAuth();
  const [summary, setSummary] = useState(null);
  const [products, setProducts] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal State
  const [actionModal, setActionModal] = useState(null); // { type: 'IN' | 'OUT' | 'ADJUST', product: Product }
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  const loadData = async () => {
    if (!activeShop) return;
    try {
      setLoading(true);
      const [sum, prods, low] = await Promise.all([
        api.getInventorySummary(activeShop.id),
        api.getProducts(activeShop.id, { limit: 100 }),
        api.getLowStock(activeShop.id),
      ]);
      setSummary(sum);
      setProducts(prods);
      setLowStockProducts(low);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeShop]);

  const handleStockAction = async (e) => {
    e.preventDefault();
    if (!actionModal) return;
    setError("");

    try {
      const { type, product } = actionModal;
      if (type === "IN") {
        await api.stockIn(activeShop.id, product.id, {
          quantity: parseFloat(quantity).toFixed(3),
          reason: reason || "Manual Stock In",
        });
      } else if (type === "OUT") {
        await api.stockOut(activeShop.id, product.id, {
          quantity: parseFloat(quantity).toFixed(3),
          reason: reason || "Damage / Wastage Stock Out",
        });
      } else if (type === "ADJUST") {
        await api.stockAdjust(activeShop.id, product.id, {
          counted_quantity: parseFloat(quantity).toFixed(3),
          reason: reason || "Physical Count Stock Audit",
        });
      }

      setActionModal(null);
      setQuantity("");
      setReason("");
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Boxes className="w-5 h-5 text-emerald-600" />
            Inventory & Stock Operations (মজুদ ব্যবস্থাপনা)
          </h2>
          <p className="text-xs text-slate-500">Record stock ins, damages, and physical audit adjustments</p>
        </div>

        <button
          onClick={() => setTab("movements")}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
        >
          <History className="w-4 h-4" /> View Stock Movements Ledger
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Valuation KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-xs font-semibold text-slate-500 uppercase">Total Inventory Units</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {parseFloat(summary.total_units_in_stock).toLocaleString()}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">Across {summary.total_products} products</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-xs font-semibold text-slate-500 uppercase">Stock Cost Valuation</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              ₹{parseFloat(summary.total_cost_valuation).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">Capital invested in stock</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-xs font-semibold text-slate-500 uppercase">Stock Retail Valuation</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">
              ₹{parseFloat(summary.total_retail_valuation).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">Expected sales value</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-xs font-semibold text-amber-800 uppercase">Low Stock Alerts</div>
            <div className="text-2xl font-bold text-amber-900 mt-1">
              {summary.low_stock_count}
            </div>
            <div className="text-xs text-amber-700 mt-0.5">Products below threshold</div>
          </div>
        </div>
      )}

      {/* Inventory Action Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-800">Quick Stock In / Out & Adjustments</h3>
          <span className="text-xs text-slate-400">All modifications create permanent ledger audit trails</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[11px] border-b border-slate-100">
              <tr>
                <th className="p-3.5">Product Name</th>
                <th className="p-3.5">SKU</th>
                <th className="p-3.5 text-right">Selling Price</th>
                <th className="p-3.5 text-right">Current Stock</th>
                <th className="p-3.5 text-right">Quick Stock Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {products.map((p) => {
                const isLow = parseFloat(p.stock_quantity) <= parseFloat(p.low_stock_threshold);
                return (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-900">{p.name}</div>
                    </td>
                    <td className="p-3.5 font-mono text-slate-500">{p.sku || "—"}</td>
                    <td className="p-3.5 text-right font-bold text-slate-900">
                      ₹{parseFloat(p.selling_price).toFixed(2)}
                    </td>
                    <td className="p-3.5 text-right">
                      <span className={`font-bold ${isLow ? "text-amber-600" : "text-slate-800"}`}>
                        {parseFloat(p.stock_quantity)} {p.unit}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setActionModal({ type: "IN", product: p });
                            setReason("Received stock");
                          }}
                          className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <ArrowDownLeft className="w-3 h-3" /> Stock In
                        </button>
                        <button
                          onClick={() => {
                            setActionModal({ type: "OUT", product: p });
                            setReason("Damaged / Expired");
                          }}
                          className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <ArrowUpRight className="w-3 h-3" /> Stock Out
                        </button>
                        <button
                          onClick={() => {
                            setActionModal({ type: "ADJUST", product: p });
                            setQuantity(p.stock_quantity);
                            setReason("Physical stock audit");
                          }}
                          className="px-2.5 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <SlidersHorizontal className="w-3 h-3" /> Adjust
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Action Modal */}
      {actionModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                {actionModal.type === "IN" && "Stock In (মজুদ যোগ করুন)"}
                {actionModal.type === "OUT" && "Stock Out (মজুদ হ্রাস / ক্ষতি)"}
                {actionModal.type === "ADJUST" && "Physical Stock Audit Count"}
              </h3>
              <button onClick={() => setActionModal(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <div className="font-semibold text-slate-900">{actionModal.product.name}</div>
              <div className="text-slate-500">
                Current Stock: {actionModal.product.stock_quantity} {actionModal.product.unit}
              </div>
            </div>

            <form onSubmit={handleStockAction} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {actionModal.type === "ADJUST" ? "Actual Counted Stock *" : "Quantity *"}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="e.g. 10.000"
                    className="w-full p-2 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <span className="font-semibold text-slate-500">{actionModal.product.unit}</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason / Note *</label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. New supplier shipment, Shelf leakage, Audit"
                  className="w-full p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActionModal(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-sm cursor-pointer"
                >
                  Confirm Movement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
