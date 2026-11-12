import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "../api";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem("dokan_token"));
  const [user, setUser] = useState(null);
  const [shops, setShops] = useState([]);
  const [activeShop, setActiveShop] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state
  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const userData = await api.getMe();
        setUser(userData);

        const shopList = await api.getMyShops();
        setShops(shopList);

        const savedShopId = localStorage.getItem("dokan_active_shop_id");
        if (savedShopId) {
          const matched = shopList.find((s) => s.id === parseInt(savedShopId));
          if (matched) {
            setActiveShop(matched);
          } else if (shopList.length > 0) {
            setActiveShop(shopList[0]);
          }
        } else if (shopList.length > 0) {
          setActiveShop(shopList[0]);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        logout();
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [token]);

  useEffect(() => {
    const handleAuthExpired = () => {
      logout();
    };
    window.addEventListener("dokan-auth-expired", handleAuthExpired);
    return () => window.removeEventListener("dokan-auth-expired", handleAuthExpired);
  }, []);

  const login = async (email, password) => {
    const data = await api.login(email, password);
    localStorage.setItem("dokan_token", data.access_token);
    setToken(data.access_token);

    const userData = await api.getMe();
    setUser(userData);

    const shopList = await api.getMyShops();
    setShops(shopList);
    if (shopList.length > 0) {
      setActiveShop(shopList[0]);
      localStorage.setItem("dokan_active_shop_id", shopList[0].id);
    }
  };

  const register = async (payload) => {
    await api.register(payload);
    await login(payload.email, payload.password);
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore network errors
    }
    localStorage.removeItem("dokan_token");
    localStorage.removeItem("dokan_active_shop_id");
    setToken(null);
    setUser(null);
    setShops([]);
    setActiveShop(null);
  };

  const switchShop = (shopId) => {
    const found = shops.find((s) => s.id === shopId);
    if (found) {
      setActiveShop(found);
      localStorage.setItem("dokan_active_shop_id", found.id);
    }
  };

  const refreshShops = async () => {
    const shopList = await api.getMyShops();
    setShops(shopList);
    if (activeShop) {
      const updated = shopList.find((s) => s.id === activeShop.id);
      if (updated) setActiveShop(updated);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        shops,
        activeShop,
        loading,
        login,
        register,
        logout,
        switchShop,
        refreshShops,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
