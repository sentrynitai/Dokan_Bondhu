import React from "react";
import {
  LayoutDashboard,
  Package,
  AlertTriangle,
  LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function Sidebar({ currentTab, setTab, lowStockCount = 0 }) {
  const { logout } = useAuth();

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out of your shop?")) {
      logout();
    }
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "products", label: "Products", icon: Package },
    {
      id: "low-stock",
      label: "Low Stock",
      icon: AlertTriangle,
      badge: lowStockCount > 0 ? lowStockCount : null,
    },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 min-h-[calc(100vh-57px)] justify-between">
      <div className="p-3 space-y-1">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 py-2">
          Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all cursor-pointer ${
                isActive
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-500"}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    isActive
                      ? "bg-white text-emerald-700"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Logout button at bottom */}
      <div className="p-3 border-t border-slate-100">
        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl font-medium text-sm text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4 text-rose-500" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

