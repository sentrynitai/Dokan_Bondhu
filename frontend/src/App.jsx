import React, { useState, useEffect } from "react";
import { useAuth } from "./context/AuthContext";
import { Navbar } from "./components/Navbar";
import { Sidebar } from "./components/Sidebar";

import { LoginView } from "./views/LoginView";
import { DashboardView } from "./views/DashboardView";
import { ProductsView } from "./views/ProductsView";
import { LowStockView } from "./views/LowStockView";
import { api } from "./api";

export function App() {
  const { user, loading, activeShop } = useAuth();
  const [currentTab, setTab] = useState("dashboard");
  const [lowStockCount, setLowStockCount] = useState(0);

  // Load low stock alert count for the active shop
  useEffect(() => {
    if (!activeShop) return;
    api.getLowStock(activeShop.id)
      .then((items) => {
        setLowStockCount(items ? items.length : 0);
      })
      .catch(() => {});
  }, [activeShop, currentTab]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div className="text-sm font-semibold text-slate-600">Loading Dokan Bandhu...</div>
        </div>
      </div>
    );
  }

  if (!user || !activeShop) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans antialiased text-slate-800">
      <Navbar />

      <div className="flex flex-1">
        <Sidebar
          currentTab={currentTab}
          setTab={setTab}
          lowStockCount={lowStockCount}
        />

        <main className="flex-1 min-w-0 pb-16 overflow-y-auto">
          {currentTab === "dashboard" && (
            <DashboardView setTab={setTab} onRefreshCounts={setLowStockCount} />
          )}
          {currentTab === "products" && (
            <ProductsView onRefreshCounts={setLowStockCount} />
          )}
          {currentTab === "low-stock" && (
            <LowStockView onRefreshCounts={setLowStockCount} />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
