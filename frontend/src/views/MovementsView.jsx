import React, { useState, useEffect } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { History, ArrowDownLeft, ArrowUpRight, Filter } from "lucide-react";

export function MovementsView() {
  const { activeShop } = useAuth();
  const [movements, setMovements] = useState([]);
  const [filterType, setFilterType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadMovements = async () => {
    if (!activeShop) return;
    try {
      setLoading(true);
      const data = await api.getAllMovements(activeShop.id, {
        movement_type: filterType || undefined,
        limit: 100,
      });
      setMovements(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMovements();
  }, [activeShop, filterType]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-600" />
            Stock Movement History (মজুদ খতিয়ান)
          </h2>
          <p className="text-xs text-slate-500">Immutable audit log of all stock increases, sales, and adjustments</p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs py-2 px-3 border border-slate-200 rounded-xl bg-white font-medium"
          >
            <option value="">All Movements (সব)</option>
            <option value="IN">Stock IN (+)</option>
            <option value="OUT">Stock OUT (-)</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[11px] border-b border-slate-100">
              <tr>
                <th className="p-3.5">Date & Time</th>
                <th className="p-3.5">Product Name</th>
                <th className="p-3.5 text-center">Type</th>
                <th className="p-3.5 text-right">Quantity</th>
                <th className="p-3.5 text-right">Before</th>
                <th className="p-3.5 text-right">After</th>
                <th className="p-3.5">Reason / Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {movements.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-400">
                    No stock movement records found.
                  </td>
                </tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3.5 text-slate-500 whitespace-nowrap">
                      {new Date(m.created_at).toLocaleString()}
                    </td>
                    <td className="p-3.5 font-semibold text-slate-900">
                      {m.product_name || `Product #${m.product_id}`}
                    </td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          m.movement_type === "IN"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {m.movement_type === "IN" ? (
                          <ArrowDownLeft className="w-3 h-3" />
                        ) : (
                          <ArrowUpRight className="w-3 h-3" />
                        )}
                        {m.movement_type}
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-bold text-slate-900">
                      {parseFloat(m.quantity)}
                    </td>
                    <td className="p-3.5 text-right text-slate-400">
                      {parseFloat(m.quantity_before)}
                    </td>
                    <td className="p-3.5 text-right font-semibold text-slate-800">
                      {parseFloat(m.quantity_after)}
                    </td>
                    <td className="p-3.5 text-slate-600 max-w-xs truncate">
                      {m.reason}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
