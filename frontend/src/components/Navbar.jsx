import React from "react";
import { useAuth } from "../context/AuthContext";
import { Store, LogOut, User, ShieldCheck } from "lucide-react";

export function Navbar() {
  const { user, shops, activeShop, switchShop, logout } = useAuth();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-6 py-2.5 flex items-center justify-between shadow-sm">
      <div className="flex items-center space-x-3">
        <div className="bg-emerald-600 text-white p-2 rounded-xl flex items-center justify-center shadow-sm">
          <Store className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-lg text-slate-800 tracking-tight flex items-center gap-1.5">
            Dokan Bandhu
            <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
              দোকান বন্ধু
            </span>
          </h1>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Shop Switcher */}
        {shops.length > 0 && activeShop && (
          <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
            <span className="text-xs text-slate-500 font-medium px-2 hidden sm:inline">Shop:</span>
            <select
              value={activeShop.id}
              onChange={(e) => switchShop(parseInt(e.target.value))}
              className="bg-transparent font-medium text-xs sm:text-sm text-slate-800 focus:outline-none cursor-pointer pr-2"
            >
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.role})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* User Info & Role Badge */}
        {user && (
          <div className="flex items-center space-x-3 pl-2 border-l border-slate-200">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold text-slate-800 leading-tight">
                {user.full_name}
              </div>
              <div className="text-xs text-emerald-700 capitalize flex items-center justify-end gap-1 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                {activeShop?.role || "User"}
              </div>
            </div>

            <button
              onClick={logout}
              title="Logout"
              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
