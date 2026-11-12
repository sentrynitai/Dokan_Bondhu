import React, { useState, useEffect } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import {
  AlertTriangle,
  XCircle,
  Plus,
  CheckCircle2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

export function LowStockView({ onRefreshCounts }) {
  const { activeShop } = useAuth();
  const [products, setProducts] = useState([]);
  const [filterType, setFilterType] = useState("all"); // "all" | "low" | "out"
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Quick Restock Modal
  const [restockProduct, setRestockProduct] = useState(null);
  const [restockQty, setRestockQty] = useState("");
  const [restockReason, setRestockReason] = useState("");
  const [restockSubmitting, setRestockSubmitting] = useState(false);
  const [restockError, setRestockError] = useState("");

  const loadLowStockProducts = async () => {
    if (!activeShop) return;
    try {
      setLoading(true);
      setError("");
      const data = await api.getLowStock(activeShop.id);
      setProducts(data || []);
      if (onRefreshCounts) {
        onRefreshCounts(data?.length || 0);
      }
    } catch (err) {
      setError(err.message || "Failed to load low-stock items");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLowStockProducts();
  }, [activeShop]);

  const handleOpenRestock = (prod) => {
    setRestockProduct(prod);
    setRestockQty("");
    setRestockReason("");
    setRestockError("");
  };

  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    if (!restockProduct) return;
    setRestockError("");

    const qty = parseFloat(restockQty);
    if (isNaN(qty) || qty <= 0) {
      setRestockError("Please enter a valid restock quantity greater than zero.");
      return;
    }

    try {
      setRestockSubmitting(true);
      await api.updateStock(activeShop.id, restockProduct.id, {
        action: "increase",
        quantity: qty.toFixed(3),
        reason: restockReason.trim() || "Stock Replenishment",
      });

      setRestockProduct(null);
      setSuccessMsg(`Successfully added ${qty} ${restockProduct.unit} to "${restockProduct.name}"!`);
      setTimeout(() => setSuccessMsg(""), 3500);
      loadLowStockProducts();
    } catch (err) {
      setRestockError(err.message || "Failed to update stock");
    } finally {
      setRestockSubmitting(false);
    }
  };

  // Filter products by filterType and search
  const filteredProducts = products.filter((p) => {
    const qty = parseFloat(p.stock_quantity ?? p.quantity ?? 0);
    const limit = parseFloat(p.low_stock_threshold ?? p.low_stock_limit ?? 5);

    if (filterType === "out" && qty !== 0) return false;
    if (filterType === "low" && (qty === 0 || qty > limit)) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchSku = p.sku ? p.sku.toLowerCase().includes(q) : false;
      return matchName || matchSku;
    }

    return true;
  });

  const outOfStockCount = products.filter((p) => parseFloat(p.stock_quantity ?? p.quantity ?? 0) === 0).length;
  const lowStockOnlyCount = products.filter((p) => {
    const q = parseFloat(p.stock_quantity ?? p.quantity ?? 0);
    const l = parseFloat(p.low_stock_threshold ?? p.low_stock_limit ?? 5);
    return q > 0 && q <= l;
  }).length;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
            <span>Low Stock & Restock Alert</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Products that have fallen at or below their low-stock limit and need replenishment
          </p>
        </div>

        <button
          onClick={loadLowStockProducts}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Global Notifications */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs sm:text-sm font-medium flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg("")} className="text-emerald-600 hover:text-emerald-800 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs sm:text-sm font-medium flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-rose-600 hover:text-rose-800 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Filter Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold gap-1">
          <button
            onClick={() => setFilterType("all")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              filterType === "all"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All Items ({products.length})
          </button>
          <button
            onClick={() => setFilterType("low")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              filterType === "low"
                ? "bg-amber-500 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Low Stock ({lowStockOnlyCount})
          </button>
          <button
            onClick={() => setFilterType("out")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              filterType === "out"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Out of Stock ({outOfStockCount})
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search low stock items..."
            className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Low Stock Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <div className="w-7 h-7 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs font-medium">Checking inventory stock levels...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h3 className="font-bold text-slate-700 text-sm sm:text-base">
              {search
                ? "No matching items found in low stock"
                : filterType === "out"
                ? "No out of stock products! All products have stock available."
                : filterType === "low"
                ? "No products currently running low."
                : "Awesome! All products are well stocked."}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Your inventory levels are healthy. Products will automatically appear here when their available quantity reaches or drops below their set low stock limit.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-slate-500 text-xs font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3.5 px-4">Product Name</th>
                  <th className="py-3.5 px-4">Product Code / SKU</th>
                  <th className="py-3.5 px-4 text-right">Available Qty</th>
                  <th className="py-3.5 px-4 text-center">Unit</th>
                  <th className="py-3.5 px-4 text-right">Low Stock Limit</th>
                  <th className="py-3.5 px-4 text-center">Stock Status</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                  const qty = parseFloat(p.stock_quantity ?? p.quantity ?? 0);
                  const limit = parseFloat(p.low_stock_threshold ?? p.low_stock_limit ?? 5);
                  const isOut = qty === 0;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {p.name}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-500">
                        {p.sku || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                        {qty.toLocaleString("en-IN", { maximumFractionDigits: 3 })}
                      </td>
                      <td className="py-3.5 px-4 text-center text-xs text-slate-600">
                        {p.unit}
                      </td>
                      <td className="py-3.5 px-4 text-right text-xs font-medium text-slate-500">
                        {limit.toLocaleString("en-IN", { maximumFractionDigits: 3 })}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Out of Stock</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Low Stock</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleOpenRestock(p)}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Restock</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Restock Modal */}
      {restockProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  Restock Product: {restockProduct.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Current stock: <span className="font-bold text-slate-700">{parseFloat(restockProduct.stock_quantity ?? restockProduct.quantity ?? 0)} {restockProduct.unit}</span> (Limit: {parseFloat(restockProduct.low_stock_threshold ?? restockProduct.low_stock_limit ?? 5)})
                </p>
              </div>
              <button
                onClick={() => setRestockProduct(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRestockSubmit} className="p-4 space-y-4">
              {restockError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
                  {restockError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Quantity to Add ({restockProduct.unit}) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  required
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  placeholder="e.g. 20"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reference / Note (Optional)
                </label>
                <input
                  type="text"
                  value={restockReason}
                  onChange={(e) => setRestockReason(e.target.value)}
                  placeholder="e.g. Received new stock delivery"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              {restockQty && !isNaN(parseFloat(restockQty)) && (
                <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl text-xs text-emerald-800 flex justify-between items-center">
                  <span>New Stock Total:</span>
                  <span className="font-bold text-sm">
                    {parseFloat(restockProduct.stock_quantity ?? restockProduct.quantity ?? 0) + parseFloat(restockQty)}{" "}
                    {restockProduct.unit}
                  </span>
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRestockProduct(null)}
                  className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={restockSubmitting}
                  className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {restockSubmitting ? "Restocking..." : "Confirm Restock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
