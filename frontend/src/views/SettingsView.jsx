import React, { useState, useEffect } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { Settings, Store, Users, UserPlus, Shield, Check, X } from "lucide-react";

export function SettingsView() {
  const { activeShop, refreshShops } = useAuth();
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [members, setMembers] = useState([]);

  // Add Member
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("staff");

  // Create New Shop
  const [showCreateShop, setShowCreateShop] = useState(false);
  const [newShopName, setNewShopName] = useState("");
  const [newShopPhone, setNewShopPhone] = useState("");
  const [newShopAddress, setNewShopAddress] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const loadData = async () => {
    if (!activeShop) return;
    try {
      setShopName(activeShop.name);
      setPhone(activeShop.phone || "");
      setAddress(activeShop.address || "");

      const memList = await api.getShopMembers(activeShop.id);
      setMembers(memList);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeShop]);

  const handleUpdateShop = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");
    setLoading(true);
    try {
      await api.updateShop(activeShop.id, {
        name: shopName,
        phone: phone || null,
        address: address || null,
      });
      setMsg("Shop profile updated successfully!");
      refreshShops();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");
    try {
      await api.addShopMember(activeShop.id, {
        email: memberEmail,
        role: memberRole,
      });
      setShowAddMember(false);
      setMemberEmail("");
      setMsg("Staff member added successfully!");
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateNewShop = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");
    try {
      await api.createShop({
        name: newShopName,
        phone: newShopPhone || null,
        address: newShopAddress || null,
      });
      setShowCreateShop(false);
      setNewShopName("");
      setNewShopPhone("");
      setNewShopAddress("");
      setMsg("New shop created! Switch to it in the top bar.");
      refreshShops();
    } catch (err) {
      setError(err.message);
    }
  };

  const isOwner = activeShop?.role === "owner";

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-emerald-600" />
          Shop Settings & Staff Roles (দোকান সেটিংস)
        </h2>
        <p className="text-xs text-slate-500">Manage store details, add additional branches, and invite staff</p>
      </div>

      {msg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-semibold flex items-center gap-1.5">
          <Check className="w-4 h-4" /> {msg}
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Shop Profile Form */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <Store className="w-4 h-4 text-emerald-600" /> Shop Profile ({activeShop.name})
        </h3>

        <form onSubmit={handleUpdateShop} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Shop Name</label>
            <input
              type="text"
              required
              disabled={!isOwner}
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
              <input
                type="tel"
                disabled={!isOwner}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Address / Landmark</label>
              <input
                type="text"
                disabled={!isOwner}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>
          </div>

          {isOwner && (
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm cursor-pointer disabled:opacity-50"
            >
              {loading ? "Saving..." : "Update Shop Details"}
            </button>
          )}
        </form>
      </div>

      {/* Staff & Members */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600" /> Shop Staff & Access Roles
          </h3>
          {isOwner && (
            <button
              onClick={() => setShowAddMember(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" /> Invite Staff
            </button>
          )}
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {members.map((m) => (
            <div key={m.user_id} className="py-3 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-900">{m.user_name}</div>
                <div className="text-slate-400 text-[11px]">{m.user_email}</div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-100">
                {m.role}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Create Another Branch / Shop */}
      <div className="bg-slate-50 border border-dashed border-slate-200 p-6 rounded-2xl flex items-center justify-between">
        <div>
          <h4 className="font-bold text-sm text-slate-800">Own multiple stores or branches?</h4>
          <p className="text-xs text-slate-500 mt-0.5">
            You can create and manage multiple shops under one login account.
          </p>
        </div>
        <button
          onClick={() => setShowCreateShop(true)}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
        >
          Create New Shop
        </button>
      </div>

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Add Staff Member</h3>
              <button onClick={() => setShowAddMember(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Registered User Email *</label>
                <input
                  type="email"
                  required
                  placeholder="staff@example.com"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Role</label>
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-xl bg-slate-50 font-medium"
                >
                  <option value="staff">Staff (Can do billing & view stock)</option>
                  <option value="manager">Manager (Can manage products, stock & purchases)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddMember(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-sm cursor-pointer"
                >
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create New Shop Modal */}
      {showCreateShop && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Create Additional Shop</h3>
              <button onClick={() => setShowCreateShop(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewShop} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Shop Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dokan 2 - Stationary"
                  value={newShopName}
                  onChange={(e) => setNewShopName(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                <input
                  type="tel"
                  placeholder="Optional"
                  value={newShopPhone}
                  onChange={(e) => setNewShopPhone(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  placeholder="Optional"
                  value={newShopAddress}
                  onChange={(e) => setNewShopAddress(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateShop(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-sm cursor-pointer"
                >
                  Create Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
