import React, { useState, useEffect } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { BarChart3, Download, Calendar, FileSpreadsheet, IndianRupee } from "lucide-react";

export function ReportsView() {
  const { activeShop } = useAuth();
  const [salesReport, setSalesReport] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReport = async () => {
    if (!activeShop) return;
    try {
      setLoading(true);
      const data = await api.getSalesReport(activeShop.id, {
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      setSalesReport(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [activeShop]);

  const downloadFile = async (apiCall, defaultName) => {
    try {
      const blob = await apiCall(activeShop.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = defaultName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setError("Failed to download CSV: " + err.message);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            Financial Reports & Data Exports (হিসাব ও রিপোর্ট)
          </h2>
          <p className="text-xs text-slate-500">Export official business reports to CSV / Microsoft Excel</p>
        </div>

        {/* Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => downloadFile(api.exportSalesCsv, `sales_${activeShop.name}.csv`)}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Sales CSV
          </button>
          <button
            onClick={() => downloadFile(api.exportCustomerDuesCsv, `khata_dues_${activeShop.name}.csv`)}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Khata Dues CSV
          </button>
          <button
            onClick={() => downloadFile(api.exportInventoryCsv, `inventory_${activeShop.name}.csv`)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Inventory CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Date Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-700 font-semibold">
          <Calendar className="w-4 h-4 text-emerald-600" /> Date Range:
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="text-xs p-2 border border-slate-200 rounded-xl bg-slate-50"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="text-xs p-2 border border-slate-200 rounded-xl bg-slate-50"
          />
        </div>
        <button
          onClick={loadReport}
          className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 cursor-pointer"
        >
          Apply Filter
        </button>
      </div>

      {/* Sales Summary Metrics */}
      {salesReport && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-xs font-semibold text-slate-500 uppercase">Total Invoices</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{salesReport.total_invoices}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-xs font-semibold text-slate-500 uppercase">Gross Revenue</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              ₹{parseFloat(salesReport.total_revenue).toFixed(2)}
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-xs font-semibold text-emerald-700 uppercase">Cash / UPI Collected</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">
              ₹{parseFloat(salesReport.total_collected).toFixed(2)}
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-xs font-semibold text-rose-700 uppercase">Credit / Unpaid Dues</div>
            <div className="text-2xl font-bold text-rose-700 mt-1">
              ₹{parseFloat(salesReport.total_due).toFixed(2)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
