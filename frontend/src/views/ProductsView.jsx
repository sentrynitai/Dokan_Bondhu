import React, { useState, useEffect } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  X,
  SlidersHorizontal,
  RefreshCw,
} from "lucide-react";

export function ProductsView({ onRefreshCounts }) {
  const { activeShop } = useAuth();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Add Product Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    sku: "",
    quantity: "0",
    low_stock_limit: "5",
    unit: "pcs",
  });
  const [addError, setAddError] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);

  // Edit Product Modal
  const [editingProduct, setEditingProduct] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    sku: "",
    low_stock_limit: "5",
    unit: "pcs",
  });
  const [editError, setEditError] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Update Stock Modal
  const [stockModalProduct, setStockModalProduct] = useState(null);
  const [stockAction, setStockAction] = useState("increase"); // "increase" | "decrease"
  const [stockQty, setStockQty] = useState("");
  const [stockReason, setStockReason] = useState("");
  const [stockError, setStockError] = useState("");
  const [stockSubmitting, setStockSubmitting] = useState(false);

  // Delete Confirmation Modal
  const [deletingProduct, setDeletingProduct] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const loadProducts = async (searchQuery = search) => {
    if (!activeShop) return;
    try {
      setLoading(true);
      setError("");
      const params = {};
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      const data = await api.getProducts(activeShop.id, params);
      setProducts(data || []);
      if (onRefreshCounts) {
        api.getInventorySummary(activeShop.id).then((sum) => {
          onRefreshCounts(sum?.low_stock_count || 0);
        }).catch(() => {});
      }
    } catch (err) {
      setError(err.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [activeShop]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    loadProducts(val);
  };

  // Add Product Submit
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setAddError("");

    if (!addForm.name.trim()) {
      setAddError("Product name cannot be empty.");
      return;
    }
    const qty = parseFloat(addForm.quantity);
    if (isNaN(qty) || qty < 0) {
      setAddError("Stock quantity cannot be negative.");
      return;
    }
    const limit = parseFloat(addForm.low_stock_limit);
    if (isNaN(limit) || limit < 0) {
      setAddError("Low stock limit cannot be negative.");
      return;
    }

    try {
      setAddSubmitting(true);
      await api.createProduct(activeShop.id, {
        name: addForm.name.trim(),
        sku: addForm.sku.trim() || null,
        stock_quantity: qty.toFixed(3),
        low_stock_threshold: limit.toFixed(3),
        unit: addForm.unit.trim() || "pcs",
      });

      setShowAddModal(false);
      setAddForm({
        name: "",
        sku: "",
        quantity: "0",
        low_stock_limit: "5",
        unit: "pcs",
      });
      setSuccessMsg("Product added successfully!");
      setTimeout(() => setSuccessMsg(""), 3500);
      loadProducts();
    } catch (err) {
      setAddError(err.message || "Failed to add product");
    } finally {
      setAddSubmitting(false);
    }
  };

  // Edit Product Submit
  const handleOpenEdit = (prod) => {
    setEditingProduct(prod);
    setEditForm({
      name: prod.name,
      sku: prod.sku || "",
      low_stock_limit: String(parseFloat(prod.low_stock_threshold ?? prod.low_stock_limit ?? 5)),
      unit: prod.unit || "pcs",
    });
    setEditError("");
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingProduct) return;
    setEditError("");

    if (!editForm.name.trim()) {
      setEditError("Product name cannot be empty.");
      return;
    }
    const limit = parseFloat(editForm.low_stock_limit);
    if (isNaN(limit) || limit < 0) {
      setEditError("Low stock limit cannot be negative.");
      return;
    }

    try {
      setEditSubmitting(true);
      await api.updateProduct(activeShop.id, editingProduct.id, {
        name: editForm.name.trim(),
        sku: editForm.sku.trim() || null,
        low_stock_threshold: limit.toFixed(3),
        unit: editForm.unit.trim() || "pcs",
      });

      setEditingProduct(null);
      setSuccessMsg("Product details updated successfully!");
      setTimeout(() => setSuccessMsg(""), 3500);
      loadProducts();
    } catch (err) {
      setEditError(err.message || "Failed to update product");
    } finally {
      setEditSubmitting(false);
    }
  };

  // Stock Update Submit
  const handleOpenStock = (prod) => {
    setStockModalProduct(prod);
    setStockAction("increase");
    setStockQty("");
    setStockReason("");
    setStockError("");
  };

  const handleStockSubmit = async (e) => {
    e.preventDefault();
    if (!stockModalProduct) return;
    setStockError("");

    const qty = parseFloat(stockQty);
    if (isNaN(qty) || qty <= 0) {
      setStockError("Please enter a valid quantity greater than zero.");
      return;
    }

    const currentQty = parseFloat(stockModalProduct.stock_quantity ?? stockModalProduct.quantity ?? 0);
    if (stockAction === "decrease" && qty > currentQty) {
      setStockError(`Cannot decrease stock by ${qty}. Only ${currentQty} units available.`);
      return;
    }

    try {
      setStockSubmitting(true);
      await api.updateStock(activeShop.id, stockModalProduct.id, {
        action: stockAction,
        quantity: qty.toFixed(3),
        reason: stockReason.trim() || undefined,
      });

      setStockModalProduct(null);
      setSuccessMsg(
        `Stock successfully ${stockAction === "increase" ? "increased" : "decreased"} by ${qty} ${stockModalProduct.unit}!`
      );
      setTimeout(() => setSuccessMsg(""), 3500);
      loadProducts();
    } catch (err) {
      setStockError(err.message || "Failed to update stock");
    } finally {
      setStockSubmitting(false);
    }
  };

  // Delete Product
  const handleDeleteConfirm = async () => {
    if (!deletingProduct) return;
    try {
      setDeleteSubmitting(true);
      await api.deleteProduct(activeShop.id, deletingProduct.id);
      setDeletingProduct(null);
      setSuccessMsg(`"${deletingProduct.name}" was successfully deleted.`);
      setTimeout(() => setSuccessMsg(""), 3500);
      loadProducts();
    } catch (err) {
      setError(err.message || "Failed to delete product");
      setDeletingProduct(null);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-600" />
            <span>Products</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage your shop inventory catalog, stock counts, and threshold alerts
          </p>
        </div>

        <button
          onClick={() => {
            setShowAddModal(true);
            setAddError("");
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-xs sm:text-sm transition-all shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Product</span>
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

      {/* Search Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-2">
        <Search className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
        <input
          type="text"
          value={search}
          onChange={handleSearchChange}
          placeholder="Search products by name or product code / SKU..."
          className="w-full text-xs sm:text-sm text-slate-800 placeholder-slate-400 bg-transparent focus:outline-hidden"
        />
        {search && (
          <button
            onClick={() => {
              setSearch("");
              loadProducts("");
            }}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Product Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <div className="w-7 h-7 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs font-medium">Loading products...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Package className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="font-bold text-slate-700 text-sm sm:text-base">
              {search ? "No matching products found" : "No products added yet"}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {search
                ? `No products match your search "${search}". Try searching with a different term.`
                : "Get started by adding your first product to manage its quantity and low stock limit."}
            </p>
            {!search && (
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Your First Product</span>
              </button>
            )}
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
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => {
                  const qty = parseFloat(p.stock_quantity ?? p.quantity ?? 0);
                  const limit = parseFloat(p.low_stock_threshold ?? p.low_stock_limit ?? 5);

                  let statusBadge = (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                      In Stock
                    </span>
                  );

                  if (qty === 0) {
                    statusBadge = (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                        Out of Stock
                      </span>
                    );
                  } else if (qty <= limit) {
                    statusBadge = (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                        Low Stock
                      </span>
                    );
                  }

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
                        {statusBadge}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Update Stock */}
                          <button
                            onClick={() => handleOpenStock(p)}
                            title="Update Stock"
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <span>Stock</span>
                          </button>

                          {/* Edit Product */}
                          <button
                            onClick={() => handleOpenEdit(p)}
                            title="Edit Product Details"
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Product */}
                          <button
                            onClick={() => setDeletingProduct(p)}
                            title="Delete Product"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 1. ADD PRODUCT MODAL */}
      {/* ============================================================ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Add New Product</h3>
                <p className="text-xs text-slate-500">Fill in the product details to add to shop inventory</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-5 space-y-4">
              {addError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
                  {addError}
                </div>
              )}

              {/* Product Name (Required) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="e.g. Fortune Mustard Oil 1L"
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Product Code / SKU (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Code / SKU <span className="text-slate-400 font-normal">(Optional, must be unique)</span>
                </label>
                <input
                  type="text"
                  value={addForm.sku}
                  onChange={(e) => setAddForm({ ...addForm, sku: e.target.value })}
                  placeholder="e.g. OIL-FORT-1L"
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono text-xs uppercase"
                />
              </div>

              {/* Stock Quantity & Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Current Stock Quantity <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={addForm.quantity}
                    onChange={(e) => setAddForm({ ...addForm, quantity: e.target.value })}
                    placeholder="0"
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Unit of Measure <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <select
                    value={addForm.unit}
                    onChange={(e) => setAddForm({ ...addForm, unit: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-white cursor-pointer"
                  >
                    <option value="pcs">pcs (Pieces)</option>
                    <option value="kg">kg (Kilogram)</option>
                    <option value="gram">gram (Gram)</option>
                    <option value="litre">litre (Litre)</option>
                    <option value="ml">ml (Millilitre)</option>
                    <option value="packet">packet (Packet)</option>
                    <option value="box">box (Box)</option>
                    <option value="meter">meter (Meter)</option>
                  </select>
                </div>
              </div>

              {/* Low Stock Limit (Required) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Low Stock Limit <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={addForm.low_stock_limit}
                  onChange={(e) => setAddForm({ ...addForm, low_stock_limit: e.target.value })}
                  placeholder="5"
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Alert is triggered when available quantity falls at or below this limit.
                </p>
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addSubmitting}
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {addSubmitting ? "Saving Product..." : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. EDIT PRODUCT MODAL */}
      {/* ============================================================ */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Edit Product</h3>
                <p className="text-xs text-slate-500">Update basic information and alerts</p>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-4">
              {editError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
                  {editError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Code / SKU
                </label>
                <input
                  type="text"
                  value={editForm.sku}
                  onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                  placeholder="Optional unique code"
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono text-xs uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Unit
                  </label>
                  <select
                    value={editForm.unit}
                    onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-white cursor-pointer"
                  >
                    <option value="pcs">pcs (Pieces)</option>
                    <option value="kg">kg (Kilogram)</option>
                    <option value="gram">gram (Gram)</option>
                    <option value="litre">litre (Litre)</option>
                    <option value="ml">ml (Millilitre)</option>
                    <option value="packet">packet (Packet)</option>
                    <option value="box">box (Box)</option>
                    <option value="meter">meter (Meter)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Low Stock Limit <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={editForm.low_stock_limit}
                    onChange={(e) => setEditForm({ ...editForm, low_stock_limit: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {editSubmitting ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. UPDATE STOCK MODAL */}
      {/* ============================================================ */}
      {stockModalProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
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

              {/* Increase / Decrease Toggle */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Action
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

              {/* Optional Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason / Reference (Optional)
                </label>
                <input
                  type="text"
                  value={stockReason}
                  onChange={(e) => setStockReason(e.target.value)}
                  placeholder={stockAction === "increase" ? "e.g. Shipment received" : "e.g. Spoiled / Damaged"}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Preview */}
              {stockQty && !isNaN(parseFloat(stockQty)) && (
                <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 flex justify-between items-center">
                  <span>Resulting Quantity:</span>
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

              <div className="flex gap-2 pt-2 border-t border-slate-100">
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

      {/* ============================================================ */}
      {/* 4. DELETE CONFIRMATION MODAL */}
      {/* ============================================================ */}
      {deletingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-100 p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-bold text-slate-800 text-base">Delete Product?</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to remove <span className="font-semibold text-slate-700">"{deletingProduct.name}"</span>?
                This item will no longer appear in your active inventory.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingProduct(null)}
                className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteSubmitting}
                onClick={handleDeleteConfirm}
                className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-50 cursor-pointer"
              >
                {deleteSubmitting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
