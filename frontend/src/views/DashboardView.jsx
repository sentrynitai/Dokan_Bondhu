import React, { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import {
  Package,
  Boxes,
  AlertTriangle,
  XCircle,
  Plus,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  PlusCircle,
  X,
} from "lucide-react";

export function DashboardView({ setTab, onRefreshCounts }) {
  const { user, activeShop } = useAuth();
  const [summary, setSummary] = useState(null);
  const [restockProducts, setRestockProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Stock update modal state
  const [stockModalProduct, setStockModalProduct] = useState(null);
  const [stockAction, setStockAction] = useState("increase");
  const [stockQty, setStockQty] = useState("");
  const [stockReason, setStockReason] = useState("");
  const [stockSubmitting, setStockSubmitting] = useState(false);
  const [stockError, setStockError] = useState("");
  const [stockSuccess, setStockSuccess] = useState("");

  const loadDashboardData = async () => {
    if (!activeShop) return;
    try {
      setLoading(true);
      setError("");
      const [sumRes, lowRes] = await Promise.all([
        api.getInventorySummary(activeShop.id),
        api.getLowStock(activeShop.id),
      ]);
      setSummary(sumRes);
      setRestockProducts(lowRes || []);
      if (onRefreshCounts) {
        onRefreshCounts(sumRes.low_stock_count || 0);
      }
    } catch (err) {
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [activeShop]);

  const handleOpenStockModal = (product) => {
    setStockModalProduct(product);
    setStockAction("increase");
    setStockQty("");
    setStockReason("");
    setStockError("");
    setStockSuccess("");
  };

  const handleStockSubmit = async (e) => {
    e.preventDefault();
    if (!stockModalProduct) return;
    const qtyVal = parseFloat(stockQty);
    if (isNaN(qtyVal) || qtyVal <= 0) {
      setStockError("Please enter a valid quantity greater than zero.");
      return;
    }

    const currentQty = parseFloat(stockModalProduct.stock_quantity ?? stockModalProduct.quantity ?? 0);
    if (stockAction === "decrease" && qtyVal > currentQty) {
      setStockError(`Cannot decrease stock by ${qtyVal}. Only ${currentQty} units available.`);
      return;
    }

    try {
      setStockSubmitting(true);
      setStockError("");
      await api.updateStock(activeShop.id, stockModalProduct.id, {
        action: stockAction,
        quantity: qtyVal.toFixed(3),
        reason: stockReason.trim() || undefined,
      });

      setStockSuccess("Stock updated successfully!");
      setTimeout(() => {
        setStockModalProduct(null);
        setStockSuccess("");
        loadDashboardData();
      }, 700);
    } catch (err) {
      setStockError(err.message || "Failed to update stock");
    } finally {
      setStockSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 font-medium space-y-3">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-sm">Loading inventory dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={loadDashboardData}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-xl font-medium text-xs cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  const totalProducts = summary?.total_products || 0;
  const totalStockQty = summary ? parseFloat(summary.total_stock_quantity || summary.total_units_in_stock || 0) : 0;
  const lowStockCount = summary?.low_stock_products || 0;
  const outOfStockCount = summary?.out_of_stock_products || 0;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      {/* 1. Welcome Message & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
            Welcome, {user?.full_name || "Shopkeeper"} 👋
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Store: <span className="font-semibold text-emerald-700">{activeShop?.name}</span> — Basic Inventory Management
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab("products")}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs sm:text-sm rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* 2. Exactly Four Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Products */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Products
            </span>
            <div className="p-2 bg-slate-100 text-slate-700 rounded-xl">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-800">
            {totalProducts}
          </div>
          <p className="text-xs text-slate-400 mt-1">Active items in catalog</p>
        </div>

        {/* Card 2: Total Stock Quantity */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Stock Quantity
            </span>
            <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-800">
            {totalStockQty.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-slate-400 mt-1">Available units across inventory</p>
        </div>

        {/* Card 3: Low Stock Products */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-amber-200/80 bg-amber-50/20 shadow-xs">
          <div className="flex items-center justify-between text-amber-700 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Low Stock Products
            </span>
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-amber-900">
            {lowStockCount}
          </div>
          <p className="text-xs text-amber-700/80 mt-1">Running low on shelf</p>
        </div>

        {/* Card 4: Out of Stock Products */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-rose-200/80 bg-rose-50/20 shadow-xs">
          <div className="flex items-center justify-between text-rose-700 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Out of Stock Products
            </span>
            <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-rose-900">
            {outOfStockCount}
          </div>
          <p className="text-xs text-rose-700/80 mt-1">Zero quantity remaining</p>
        </div>
      </div>

      {/* 3. Small list of products that need restocking */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Products Needing Restock</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Items with current stock at or below their low stock limit
            </p>
          </div>

          {restockProducts.length > 0 && (
            <button
              onClick={() => setTab("low-stock")}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
            >
              <span>View all ({restockProducts.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {restockProducts.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h4 className="font-semibold text-slate-800 text-sm">All products are sufficiently stocked!</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No products are currently low or out of stock. You can monitor your full catalog from the Products page.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-slate-500 text-xs font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Product Code / SKU</th>
                  <th className="py-3 px-4 text-right">Available Qty</th>
                  <th className="py-3 px-4 text-center">Unit</th>
                  <th className="py-3 px-4 text-right">Low Stock Limit</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {restockProducts.slice(0, 8).map((product) => {
                  const qty = parseFloat(product.stock_quantity ?? product.quantity ?? 0);
                  const limit = parseFloat(product.low_stock_threshold ?? product.low_stock_limit ?? 5);
                  const isOutOfStock = qty === 0;

                  return (
                    <tr key={product.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {product.name}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-xs">
                        {product.sku || "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {qty.toLocaleString("en-IN", { maximumFractionDigits: 3 })}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-600 text-xs">
                        {product.unit}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500 text-xs font-medium">
                        {limit.toLocaleString("en-IN", { maximumFractionDigits: 3 })}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isOutOfStock ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                            Out of Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                            Low Stock
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleOpenStockModal(product)}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Update Stock
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

      {/* Quick Stock Update Modal */}
      {stockModalProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                  Update Stock: {stockModalProduct.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Current stock: <span className="font-bold text-slate-700">{parseFloat(stockModalProduct.stock_quantity ?? stockModalProduct.quantity ?? 0)} {stockModalProduct.unit}</span>
                </p>
              </div>
              <button
                onClick={() => setStockModalProduct(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStockSubmit} className="p-4 space-y-4">
              {stockError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
                  {stockError}
                </div>
              )}
              {stockSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-medium">
                  {stockSuccess}
                </div>
              )}

              {/* Action buttons */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Action
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStockAction("increase")}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                      stockAction === "increase"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    + Increase Stock
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockAction("decrease")}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                      stockAction === "decrease"
                        ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    - Decrease Stock
                  </button>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Quantity to {stockAction === "increase" ? "Add" : "Remove"} ({stockModalProduct.unit}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  required
                  value={stockQty}
                  onChange={(e) => setStockQty(e.target.value)}
                  placeholder="e.g. 10"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Reason (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason / Note (Optional)
                </label>
                <input
                  type="text"
                  value={stockReason}
                  onChange={(e) => setStockReason(e.target.value)}
                  placeholder={stockAction === "increase" ? "e.g. New delivery" : "e.g. Damaged / Returned"}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Preview of new quantity */}
              {stockQty && !isNaN(parseFloat(stockQty)) && (
                <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 flex justify-between items-center">
                  <span>Resulting Stock:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {Math.max(
                      0,
                      stockAction === "increase"
                        ? parseFloat(stockModalProduct.stock_quantity ?? stockModalProduct.quantity ?? 0) + parseFloat(stockQty)
                        : parseFloat(stockModalProduct.stock_quantity ?? stockModalProduct.quantity ?? 0) - parseFloat(stockQty)
                    )}{" "}
                    {stockModalProduct.unit}
                  </span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStockModalProduct(null)}
                  className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={stockSubmitting}
                  className={`flex-1 py-2 px-3 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                    stockAction === "increase"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-rose-600 hover:bg-rose-700"
                  } disabled:opacity-50`}
                >
                  {stockSubmitting ? "Updating..." : "Save Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
