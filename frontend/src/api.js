// In browser dev mode, use Vite's proxy "/api" by default to prevent CORS and IPv6 loopback errors.
// If VITE_API_URL is explicitly configured, respect it.
const API_BASE = import.meta.env.VITE_API_URL !== undefined
  ? import.meta.env.VITE_API_URL
  : (typeof window !== "undefined" && window.location.port === "5173" ? "/api" : "http://127.0.0.1:8000");

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem("dokan_token");

  const headers = {
    ...options.headers,
  };

  // If not FormData or URLSearchParams, default to application/json
  if (
    !(options.body instanceof FormData) &&
    !(options.body instanceof URLSearchParams) &&
    !headers["Content-Type"]
  ) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (networkError) {
    console.error("Network error accessing API:", networkError);
    throw new Error(
      "Cannot connect to Dokan Bandhu API server. Please ensure the backend is running at http://127.0.0.1:8000 (run: uvicorn app.main:app --reload)."
    );
  }

  if (response.status === 204) {
    return null;
  }

  // Handle CSV downloads
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("text/csv")) {
    const blob = await response.blob();
    return blob;
  }

  const data = await response.json().catch(() => null);

  if (response.status === 401) {
    localStorage.removeItem("dokan_token");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("dokan-auth-expired"));
    }
    const errorMsg = data?.detail || "Session expired or invalid credentials. Please log in again.";
    throw new Error(typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg));
  }

  if (!response.ok) {
    const errorMsg = data?.detail || response.statusText || "Something went wrong";
    throw new Error(typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg));
  }

  return data;
}

export const api = {
  // Auth
  register: (payload) => apiRequest("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: async (email, password) => {
    const formData = new URLSearchParams();
    formData.append("username", email);
    formData.append("password", password);
    return apiRequest("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString()
    });
  },
  logout: async () => {
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } catch {
      // Ignore network errors on logout
    }
    localStorage.removeItem("dokan_token");
    localStorage.removeItem("dokan_active_shop_id");
  },
  getMe: () => apiRequest("/auth/me"),

  // Shops
  getMyShops: () => apiRequest("/shops"),
  createShop: (payload) => apiRequest("/shops", { method: "POST", body: JSON.stringify(payload) }),
  getShop: (shopId) => apiRequest(`/shops/${shopId}`),
  updateShop: (shopId, payload) => apiRequest(`/shops/${shopId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  getShopMembers: (shopId) => apiRequest(`/shops/${shopId}/members`),
  addShopMember: (shopId, payload) => apiRequest(`/shops/${shopId}/members`, { method: "POST", body: JSON.stringify(payload) }),

  // Categories
  getCategories: (shopId) => apiRequest(`/shops/${shopId}/categories`),
  createCategory: (shopId, payload) => apiRequest(`/shops/${shopId}/categories`, { method: "POST", body: JSON.stringify(payload) }),
  updateCategory: (shopId, id, payload) => apiRequest(`/shops/${shopId}/categories/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteCategory: (shopId, id) => apiRequest(`/shops/${shopId}/categories/${id}`, { method: "DELETE" }),

  // Products
  getProducts: (shopId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/shops/${shopId}/products${query ? `?${query}` : ""}`);
  },
  createProduct: (shopId, payload) => apiRequest(`/shops/${shopId}/products`, { method: "POST", body: JSON.stringify(payload) }),
  updateProduct: (shopId, id, payload) => apiRequest(`/shops/${shopId}/products/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteProduct: (shopId, id) => apiRequest(`/shops/${shopId}/products/${id}`, { method: "DELETE" }),
  updateStock: (shopId, id, payload) => apiRequest(`/shops/${shopId}/products/${id}/stock`, { method: "POST", body: JSON.stringify(payload) }),


  // Inventory
  stockIn: (shopId, productId, payload) => apiRequest(`/shops/${shopId}/products/${productId}/stock-in`, { method: "POST", body: JSON.stringify(payload) }),
  stockOut: (shopId, productId, payload) => apiRequest(`/shops/${shopId}/products/${productId}/stock-out`, { method: "POST", body: JSON.stringify(payload) }),
  stockAdjust: (shopId, productId, payload) => apiRequest(`/shops/${shopId}/products/${productId}/stock-adjust`, { method: "POST", body: JSON.stringify(payload) }),
  getProductMovements: (shopId, productId) => apiRequest(`/shops/${shopId}/products/${productId}/stock-movements`),
  getAllMovements: (shopId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/shops/${shopId}/inventory/movements${query ? `?${query}` : ""}`);
  },
  getLowStock: (shopId) => apiRequest(`/shops/${shopId}/inventory/low-stock`),
  getInventorySummary: (shopId) => apiRequest(`/shops/${shopId}/inventory/summary`),

  // Customers
  getCustomers: (shopId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/shops/${shopId}/customers${query ? `?${query}` : ""}`);
  },
  createCustomer: (shopId, payload) => apiRequest(`/shops/${shopId}/customers`, { method: "POST", body: JSON.stringify(payload) }),
  updateCustomer: (shopId, id, payload) => apiRequest(`/shops/${shopId}/customers/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteCustomer: (shopId, id) => apiRequest(`/shops/${shopId}/customers/${id}`, { method: "DELETE" }),
  getCustomerLedger: (shopId, id) => apiRequest(`/shops/${shopId}/customers/${id}/ledger`),

  // Suppliers
  getSuppliers: (shopId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/shops/${shopId}/suppliers${query ? `?${query}` : ""}`);
  },
  createSupplier: (shopId, payload) => apiRequest(`/shops/${shopId}/suppliers`, { method: "POST", body: JSON.stringify(payload) }),
  updateSupplier: (shopId, id, payload) => apiRequest(`/shops/${shopId}/suppliers/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteSupplier: (shopId, id) => apiRequest(`/shops/${shopId}/suppliers/${id}`, { method: "DELETE" }),

  // Purchases
  getPurchases: (shopId) => apiRequest(`/shops/${shopId}/purchases`),
  createPurchase: (shopId, payload) => apiRequest(`/shops/${shopId}/purchases`, { method: "POST", body: JSON.stringify(payload) }),
  getPurchase: (shopId, id) => apiRequest(`/shops/${shopId}/purchases/${id}`),

  // Sales
  getSales: (shopId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/shops/${shopId}/sales${query ? `?${query}` : ""}`);
  },
  createSale: (shopId, payload) => apiRequest(`/shops/${shopId}/sales`, { method: "POST", body: JSON.stringify(payload) }),
  getSale: (shopId, id) => apiRequest(`/shops/${shopId}/sales/${id}`),
  getReceipt: (shopId, id) => apiRequest(`/shops/${shopId}/sales/${id}/receipt`),

  // Payments
  getPayments: (shopId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/shops/${shopId}/payments${query ? `?${query}` : ""}`);
  },
  createPayment: (shopId, payload) => apiRequest(`/shops/${shopId}/payments`, { method: "POST", body: JSON.stringify(payload) }),

  // Dashboard & Reports
  getDashboard: (shopId) => apiRequest(`/shops/${shopId}/dashboard`),
  getSalesReport: (shopId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/shops/${shopId}/reports/sales${query ? `?${query}` : ""}`);
  },
  getCustomerDuesReport: (shopId) => apiRequest(`/shops/${shopId}/reports/customer-dues`),
  exportSalesCsv: (shopId) => apiRequest(`/shops/${shopId}/reports/sales/csv`),
  exportCustomerDuesCsv: (shopId) => apiRequest(`/shops/${shopId}/reports/customer-dues/csv`),
  exportInventoryCsv: (shopId) => apiRequest(`/shops/${shopId}/reports/inventory/csv`),
};
