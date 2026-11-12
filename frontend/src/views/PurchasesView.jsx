import React, { useState, useEffect } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import {
  PackagePlus,
  Plus,
  Trash2,
  Eye,
  X,
  Truck,
  CheckCircle2,
} from "lucide-react";

export function PurchasesView() {
  const { activeShop } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [activePurchaseDetails, setActivePurchaseDetails] = useState(null);

  // New Purchase Form
  const [supplierId, setSupplierId] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [updateCostPrice, setUpdateCostPrice] = useState(true);
  const [items, setItems] = useState([{ product_id: "", quantity: "1", unit_cost: "" }]);

  const loadData = async () => {
    if (!activeShop) return;
    try {
      setLoading(true);
      const [pos, supps, prods] = await Promise.all([
        api.getPurchases(activeShop.id),
        api.getSuppliers(activeShop.id),
        api.getProducts(activeShop.id),
      ]);
      setPurchases(pos);
      setSuppliers(supps);
      setProducts(prods);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeShop]);

  const addItemRow = () => {
    setItems([...items, { product_id: "", quantity: "1", unit_cost: "" }]);
  };

  const removeItemRow = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;

    // Auto-fill unit_cost if product selected and has cost_price
    if (field === "product_id") {
      const p = products.find((prod) => prod.id === parseInt(value));
      if (p && p.cost_price && !updated[index].unit_cost) {
        updated[index].unit_cost = p.cost_price;
      }
    }
    setItems(updated);
  };

  const totalCalculated = items.reduce((sum, item) => {
    const q = parseFloat(item.quantity) || 0;
    const c = parseFloat(item.unit_cost) || 0;
    return sum + q * c;
  }, 0);

  const handleCreatePurchase = async (e) => {
    e.preventDefault();
    if (items.some((i) => !i.product_id || !i.unit_cost || !i.quantity)) {
      setError("Please complete all product lines with valid quantities and unit costs.");
      return;
    }

    setError("");
    try {
      await api.createPurchase(activeShop.id, {
        supplier_id: supplierId ? parseInt(supplierId) : null,
        paid_amount: paidAmount ? parseFloat(paidAmount).toFixed(2) : totalCalculated.toFixed(2),
        notes: notes || null,
        update_product_cost: updateCostPrice,
        items: items.map((i) => ({
          product_id: parseInt(i.product_id),
          quantity: parseFloat(i.quantity).toFixed(3),
          unit_cost: parseFloat(i.unit_cost).toFixed(2),
        })),
      });

      setShowModal(false);
      setSupplierId("");
      setPaidAmount("");
      setNotes("");
      setItems([{ product_id: "", quantity: "1", unit_cost: "" }]);
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
            <PackagePlus className="w-5 h-5 text-emerald-600" />
            Purchases & Restocking (মাল কেনা / চালান)
          </h2>
          <p className="text-xs text-slate-500">Record supplier shipments; automatically increases warehouse stock</p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" /> New Supplier Purchase
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Purchases Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[11px] border-b border-slate-100">
              <tr>
                <th className="p-3.5">PO Number</th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Supplier</th>
                <th className="p-3.5 text-right">Total Cost</th>
                <th className="p-3.5 text-right">Amount Paid</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-400">
                    No purchase orders recorded yet.
                  </td>
                </tr>
              ) : (
                purchases.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-slate-900">{po.purchase_number}</td>
                    <td className="p-3.5 text-slate-500 whitespace-nowrap">
                      {new Date(po.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3.5 font-semibold text-slate-800">
                      {po.supplier_name || <span className="text-slate-400">Direct Purchase</span>}
                    </td>
                    <td className="p-3.5 text-right font-bold text-slate-900">
                      ₹{parseFloat(po.total_amount).toFixed(2)}
                    </td>
                    <td className="p-3.5 text-right text-emerald-700 font-bold">
                      ₹{parseFloat(po.paid_amount).toFixed(2)}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {po.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => setActivePurchaseDetails(po)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> Items
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Purchase Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Record New Supplier Shipment / Purchase</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePurchase} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Select Supplier</label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="">No Supplier / Cash Purchase</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Notes / PO Details</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Invoice #9842"
                    className="w-full p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    Purchased Items ({items.length})
                  </span>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Product Row
                  </button>
                </div>

                <div className="space-y-2">
                  {items.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-xl border border-slate-100">
                      <div className="col-span-5">
                        <select
                          required
                          value={row.product_id}
                          onChange={(e) => updateItem(idx, "product_id", e.target.value)}
                          className="w-full p-1.5 border border-slate-200 rounded-lg text-xs"
                        >
                          <option value="">Select Product...</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.unit})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-3">
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          required
                          placeholder="Qty"
                          value={row.quantity}
                          onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                          className="w-full p-1.5 border border-slate-200 rounded-lg text-xs text-center font-bold"
                        />
                      </div>

                      <div className="col-span-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          placeholder="Unit Cost ₹"
                          value={row.unit_cost}
                          onChange={(e) => updateItem(idx, "unit_cost", e.target.value)}
                          className="w-full p-1.5 border border-slate-200 rounded-lg text-xs text-right font-bold"
                        />
                      </div>

                      <div className="col-span-1 text-center">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItemRow(idx)}
                            className="text-slate-300 hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Breakdown & Payment */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 bg-slate-100 rounded-xl">
                <div>
                  <div className="text-slate-500 font-medium">Total Purchase Cost:</div>
                  <div className="text-lg font-bold text-slate-900">₹{totalCalculated.toFixed(2)}</div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">Amount Paid Now: ₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={totalCalculated.toFixed(2)}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className="w-28 p-1.5 border border-slate-300 rounded-xl text-right font-bold bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="updateCost"
                  checked={updateCostPrice}
                  onChange={(e) => setUpdateCostPrice(e.target.checked)}
                  className="rounded text-emerald-600 cursor-pointer"
                />
                <label htmlFor="updateCost" className="text-slate-700 cursor-pointer">
                  Update product master cost price to these latest rates
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-sm cursor-pointer"
                >
                  Confirm Purchase & Update Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Item Details View Modal */}
      {activePurchaseDetails && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{activePurchaseDetails.purchase_number}</h3>
                <div className="text-xs text-slate-500">
                  Supplier: {activePurchaseDetails.supplier_name || "Direct Purchase"}
                </div>
              </div>
              <button onClick={() => setActivePurchaseDetails(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1 divide-y divide-slate-100 text-xs">
              {activePurchaseDetails.items.map((i) => (
                <div key={i.id} className="py-2 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-800">{i.product_name}</div>
                    <div className="text-slate-400 text-[11px]">
                      {i.quantity} units @ ₹{i.unit_cost}
                    </div>
                  </div>
                  <div className="font-bold text-slate-900">₹{i.total_cost}</div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-between font-bold text-xs">
              <span>Total Cost: ₹{activePurchaseDetails.total_amount}</span>
              <span className="text-emerald-700">Paid: ₹{activePurchaseDetails.paid_amount}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
