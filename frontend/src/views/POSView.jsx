import React, { useState, useEffect } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CheckCircle2,
  Printer,
  X,
  CreditCard,
  UserPlus,
} from "lucide-react";

export function POSView() {
  const { activeShop } = useAuth();

  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");
  const [paidAmount, setPaidAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [receiptData, setReceiptData] = useState(null);

  // Load products and customers
  useEffect(() => {
    if (!activeShop) return;

    api.getProducts(activeShop.id, { limit: 100 })
      .then(setProducts)
      .catch((err) => setError(err.message));

    api.getCustomers(activeShop.id, { limit: 100 })
      .then(setCustomers)
      .catch(() => {});
  }, [activeShop]);

  // Filtered products for quick search
  const filteredProducts = products.filter(
    (p) =>
      p.is_active &&
      (p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const addToCart = (product) => {
    setError("");
    const existingIndex = cart.findIndex((item) => item.product_id === product.id);

    if (existingIndex > -1) {
      const currentQty = cart[existingIndex].quantity;
      if (currentQty + 1 > parseFloat(product.stock_quantity)) {
        setError(`Cannot exceed stock limit (${product.stock_quantity} ${product.unit})`);
        return;
      }
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      if (parseFloat(product.stock_quantity) < 1) {
        setError(`Product is out of stock!`);
        return;
      }
      setCart([
        ...cart,
        {
          product_id: product.id,
          name: product.name,
          unit: product.unit,
          stock: parseFloat(product.stock_quantity),
          unit_price: parseFloat(product.selling_price),
          quantity: 1,
        },
      ]);
    }
  };

  const updateQuantity = (productId, newQty) => {
    setError("");
    const item = cart.find((i) => i.product_id === productId);
    if (!item) return;

    const val = parseFloat(newQty);
    if (isNaN(val) || val <= 0) {
      removeFromCart(productId);
      return;
    }

    if (val > item.stock) {
      setError(`Stock available: ${item.stock} ${item.unit}`);
      return;
    }

    setCart(
      cart.map((i) => (i.product_id === productId ? { ...i, quantity: val } : i))
    );
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter((item) => item.product_id !== productId));
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const discountVal = parseFloat(discount) || 0;
  const taxVal = parseFloat(tax) || 0;
  const totalAmount = Math.max(0, subtotal - discountVal + taxVal);

  // Auto-fill paidAmount when cart changes unless manually overridden
  const effectivePaid = paidAmount === "" ? totalAmount : parseFloat(paidAmount) || 0;
  const dueAmount = Math.max(0, totalAmount - effectivePaid);

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      setError("Please add at least one item to the cart");
      return;
    }

    if (dueAmount > 0 && !selectedCustomerId) {
      setError("Credit / Unpaid due is only allowed for registered customers. Please select a customer.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const payload = {
        customer_id: selectedCustomerId ? parseInt(selectedCustomerId) : null,
        discount: discountVal.toFixed(2),
        tax: taxVal.toFixed(2),
        paid_amount: effectivePaid.toFixed(2),
        payment_method: paymentMethod,
        items: cart.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity.toFixed(3),
        })),
      };

      const sale = await api.createSale(activeShop.id, payload);
      const receipt = await api.getReceipt(activeShop.id, sale.id);
      setReceiptData(receipt);

      // Reset cart and fields
      setCart([]);
      setDiscount("0");
      setTax("0");
      setPaidAmount("");
      setSelectedCustomerId("");

      // Refresh product list to update stock numbers
      api.getProducts(activeShop.id).then(setProducts);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-emerald-600" />
            POS Billing Counter (কাউন্টার বিক্রয়)
          </h2>
          <p className="text-xs text-slate-500">Scan or select items, bill, and generate instant invoice</p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Main Two Column POS Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Product Selector (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product name or scan SKU barcode..."
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-sm"
            />
          </div>

          {/* Product Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[580px] overflow-y-auto pr-1">
            {filteredProducts.map((p) => {
              const inCart = cart.find((i) => i.product_id === p.id);
              const outOfStock = parseFloat(p.stock_quantity) <= 0;

              return (
                <button
                  key={p.id}
                  disabled={outOfStock}
                  onClick={() => addToCart(p)}
                  className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                    outOfStock
                      ? "bg-slate-100/70 border-slate-200 opacity-60 cursor-not-allowed"
                      : inCart
                      ? "bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500"
                      : "bg-white border-slate-200 hover:border-emerald-400 hover:shadow-md cursor-pointer"
                  }`}
                >
                  {inCart && (
                    <span className="absolute -top-2 -right-2 bg-emerald-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow-sm">
                      {inCart.quantity}
                    </span>
                  )}
                  <div>
                    <div className="text-[10px] font-mono text-slate-400 uppercase">
                      {p.sku || "NO-SKU"}
                    </div>
                    <div className="font-semibold text-xs text-slate-800 line-clamp-2 mt-0.5">
                      {p.name}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900">
                      ₹{parseFloat(p.selling_price).toFixed(2)}
                    </span>
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        outOfStock
                          ? "bg-rose-100 text-rose-700 font-bold"
                          : parseFloat(p.stock_quantity) <= parseFloat(p.low_stock_threshold)
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {outOfStock ? "OUT" : `${parseFloat(p.stock_quantity)} ${p.unit}`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Cart & Billing Form (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <ShoppingCart className="w-4 h-4 text-emerald-600" />
                Current Bill ({cart.length} items)
              </h3>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-xs text-rose-600 hover:underline cursor-pointer"
                >
                  Clear Cart
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="max-h-[220px] overflow-y-auto divide-y divide-slate-100 py-1">
              {cart.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  Cart is empty. Click items on the left to add to bill.
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.product_id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="max-w-[150px]">
                      <div className="font-semibold text-slate-800 truncate">{item.name}</div>
                      <div className="text-slate-400 text-[11px]">
                        ₹{item.unit_price.toFixed(2)} / {item.unit}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                        className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        step="0.001"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.product_id, e.target.value)}
                        className="w-12 text-center border border-slate-200 rounded py-0.5 text-xs font-semibold focus:outline-none"
                      />
                      <button
                        onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                        className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="text-right flex items-center gap-2">
                      <span className="font-bold text-slate-900">
                        ₹{(item.quantity * item.unit_price).toFixed(2)}
                      </span>
                      <button
                        onClick={() => removeFromCart(item.product_id)}
                        className="text-slate-300 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Customer Selection & Totals */}
          <div className="space-y-3 pt-3 border-t border-slate-200">
            {/* Customer Picker */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Customer (গ্রাহক নির্বাচন)
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full text-xs p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-slate-50 font-medium"
              >
                <option value="">Walk-in Customer (নগদ খদ্দের)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ""} {parseFloat(c.outstanding_due) > 0 ? `• Due: ₹${c.outstanding_due}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Calculations Breakdown */}
            <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-800">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Discount (ছাড়)</span>
                <div className="flex items-center gap-1">
                  <span>-₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="w-16 p-0.5 text-right border border-slate-200 rounded text-xs"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Tax / GST</span>
                <div className="flex items-center gap-1">
                  <span>+₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={tax}
                    onChange={(e) => setTax(e.target.value)}
                    className="w-16 p-0.5 text-right border border-slate-200 rounded text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>Total Bill (মোট)</span>
                <span className="text-emerald-700">₹{totalAmount.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="font-semibold text-slate-700">Amount Paid (নগদ জমা)</span>
                <div className="flex items-center gap-1">
                  <span>₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={totalAmount.toFixed(2)}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className="w-20 p-1 text-right font-bold border border-emerald-300 rounded text-xs text-emerald-800 bg-emerald-50/50"
                  />
                </div>
              </div>

              {dueAmount > 0 && (
                <div className="flex justify-between text-xs font-bold text-rose-600 pt-1 border-t border-dashed border-slate-200">
                  <span>Remaining Due (বাকি/খাতা)</span>
                  <span>₹{dueAmount.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Payment Method Selector */}
            <div className="flex items-center gap-2">
              {["CASH", "UPI", "CARD"].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    paymentMethod === m
                      ? "bg-slate-800 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Complete Sale Button */}
            <button
              onClick={handleCheckout}
              disabled={loading || cart.length === 0}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? "Processing..." : `Complete & Print Bill (₹${totalAmount.toFixed(2)})`}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Printable Receipt Modal */}
      {receiptData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Sale Completed
              </span>
              <button
                onClick={() => setReceiptData(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Receipt Preview */}
            <div id="receipt-print-area" className="text-xs text-slate-700 font-mono space-y-2 border border-slate-100 p-4 rounded-xl bg-slate-50">
              <div className="text-center space-y-0.5">
                <div className="font-bold text-sm text-slate-900">{receiptData.shop.name}</div>
                <div>{receiptData.shop.address || "Main Bazaar"}</div>
                <div>Phone: {receiptData.shop.phone || "N/A"}</div>
              </div>

              <div className="border-t border-dashed border-slate-300 pt-2 space-y-0.5">
                <div>Invoice: {receiptData.invoice_number}</div>
                <div>Date: {new Date(receiptData.date).toLocaleString()}</div>
                <div>Customer: {receiptData.customer?.name || "Walk-in Customer"}</div>
              </div>

              {/* Items Table */}
              <div className="border-t border-dashed border-slate-300 pt-2">
                <div className="grid grid-cols-12 font-bold mb-1">
                  <span className="col-span-6">Item</span>
                  <span className="col-span-3 text-right">Qty</span>
                  <span className="col-span-3 text-right">Total</span>
                </div>
                {receiptData.items.map((i) => (
                  <div key={i.id} className="grid grid-cols-12 py-0.5">
                    <span className="col-span-6 truncate">{i.product_name}</span>
                    <span className="col-span-3 text-right">{i.quantity}</span>
                    <span className="col-span-3 text-right">₹{i.total_price}</span>
                  </div>
                ))}
              </div>

              {/* Financials */}
              <div className="border-t border-dashed border-slate-300 pt-2 space-y-0.5">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{receiptData.subtotal}</span>
                </div>
                {parseFloat(receiptData.discount) > 0 && (
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <span>-₹{receiptData.discount}</span>
                  </div>
                )}
                {parseFloat(receiptData.tax) > 0 && (
                  <div className="flex justify-between">
                    <span>Tax:</span>
                    <span>+₹{receiptData.tax}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-slate-900 text-sm pt-1 border-t border-slate-200">
                  <span>TOTAL:</span>
                  <span>₹{receiptData.total_amount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Paid ({receiptData.payment_method}):</span>
                  <span>₹{receiptData.paid_amount}</span>
                </div>
                {parseFloat(receiptData.due_amount) > 0 && (
                  <div className="flex justify-between font-bold text-rose-600">
                    <span>Due Balance:</span>
                    <span>₹{receiptData.due_amount}</span>
                  </div>
                )}
                {receiptData.customer?.current_due && (
                  <div className="flex justify-between text-slate-500 pt-1 border-t border-dashed border-slate-200">
                    <span>Total Khata Due:</span>
                    <span>₹{receiptData.customer.current_due}</span>
                  </div>
                )}
              </div>

              <div className="text-center pt-3 text-[11px] text-slate-500">
                ধন্যবাদ! আবার আসবেন। (Thank you!)
              </div>
            </div>

            {/* Print & Close */}
            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Printer className="w-4 h-4" /> Print Receipt
              </button>
              <button
                onClick={() => setReceiptData(null)}
                className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
