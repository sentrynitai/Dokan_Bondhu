# Dokan Bandhu (দোকান বন্ধু) — Full-Stack Shop Management Application 🏪

A modern, production-grade, multi-tenant digital shop management and inventory application designed for retail shops, grocery stores, and local merchants. Built with **FastAPI**, **SQLAlchemy 2.0**, **MySQL 8**, and **React (Vite + Tailwind CSS)**.

Default Currency: **₹ INR**

---

## 🚀 Key Features by Module

1. **User Authentication & Multi-Tenancy**:
   - Secure Argon2id password hashing via `pwdlib`.
   - Stateless JWT authentication via `PyJWT`.
   - Multi-shop management: Users can own or join multiple shops with Role-Based Access Control (`owner`, `manager`, `staff`).
   - Shop-level data isolation: Zero leakage across shops.

2. **Product & Category Management**:
   - Master catalog with SKU, cost price, selling price, units (`pcs`, `kg`, `litre`, etc.).
   - Product categories with soft archiving (`is_active = False`).
   - Opening stock audit: Initial stock automatically generates an initial stock movement.
   - Protected endpoints: Product edit endpoints strictly prohibit direct stock alteration.

3. **Inventory Management & Concurrency Control**:
   - Stock In, Stock Out, and Physical Stock Count Audit Adjustment.
   - Pessimistic row locking (`with_for_update()`) to eliminate race conditions and overselling.
   - Full immutable stock movement audit ledger.
   - Real-time low-stock alerts.

4. **Customer Management & Baki Khata (বাকি খাতা)**:
   - Customer directory with contact details and running debt balance.
   - Dedicated customer transaction ledger (sales + payments).

5. **Supplier Management**:
   - Vendor directory, wholesale order history, and outstanding shop payables.

6. **Purchase Management**:
   - Multi-product purchase orders from suppliers.
   - Automatic stock increase and supplier balance updates within an atomic transaction.
   - Optional auto-update of product master cost prices based on new shipment rates.

7. **POS Billing & Sales Counter**:
   - High-speed checkout counter with search and live barcode/SKU lookup.
   - Support for walk-in and registered customers.
   - Itemized line discounts, configurable taxes, and partial/credit payment support.
   - Canonical row sorting to eliminate cyclic database deadlocks.
   - Instant printable thermal receipt generation.

8. **Customer Dues & Payments**:
   - Customer payment collection against past credit balances.
   - Payment method support: Cash, UPI, and Card.

9. **Dashboard & Real-Time Analytics**:
   - Real-time database aggregations for today's sales, month's sales, low-stock count, customer dues, and top-selling products.

10. **Reports & CSV Data Export**:
    - Daily & monthly sales reports with date filters.
    - One-click CSV downloads for Excel: Sales Ledger, Customer Dues, and Stock Valuation.

11. **Modern Responsive Frontend**:
    - React 19 + Vite + Tailwind CSS single-page application.
    - Mobile and desktop responsive layouts with Lucide icons.

---

## 🛠️ Technology Stack

- **Backend**: Python 3.10+, FastAPI, SQLAlchemy 2.0 ORM, MySQL 8 (PyMySQL driver), Pydantic v2.
- **Security**: Argon2id password hashing (`pwdlib`), JWT (`PyJWT`).
- **Migrations**: Alembic.
- **Testing**: Pytest, FastAPI TestClient.
- **Frontend**: React 19, Vite, Tailwind CSS, Lucide React.

---

## 📦 Project Directory Structure

```
Dokan_Bondhu/
├── app/
│   ├── core/
│   │   └── security.py           # Argon2id hashing & JWT token creation
│   ├── database.py               # SQLAlchemy 2.0 engine, Base & get_db dependency
│   ├── dependencies/
│   │   └── auth.py               # get_current_user & require_shop_member RBAC
│   ├── models.py                 # SQLAlchemy 2.0 ORM models
│   ├── schemas/                  # Pydantic v2 schemas
│   │   ├── auth.py
│   │   ├── shop.py
│   │   ├── product.py
│   │   ├── category.py
│   │   ├── inventory.py
│   │   ├── customer.py
│   │   ├── supplier.py
│   │   ├── purchase.py
│   │   ├── sale.py
│   │   ├── payment.py
│   │   └── dashboard.py
│   ├── services/                 # Atomic business logic & transactions
│   │   ├── inventory_service.py
│   │   ├── purchase_service.py
│   │   ├── sales_service.py
│   │   └── payment_service.py
│   ├── routers/                  # FastAPI routers
│   │   ├── auth.py
│   │   ├── shops.py
│   │   ├── categories.py
│   │   ├── products.py
│   │   ├── inventory.py
│   │   ├── customers.py
│   │   ├── suppliers.py
│   │   ├── purchases.py
│   │   ├── sales.py
│   │   ├── payments.py
│   │   ├── dashboard.py
│   │   └── reports.py
│   └── main.py                   # FastAPI application & router assembly
├── frontend/                     # React 19 + Vite + Tailwind CSS frontend
│   ├── src/
│   │   ├── components/           # Navbar, Sidebar
│   │   ├── context/              # AuthContext & active shop state
│   │   ├── views/                # 13 complete view screens
│   │   ├── api.js                # Centralized backend HTTP client
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
├── alembic/                      # Database migrations
│   └── versions/
│       └── 001_initial_schema.py
├── tests/                        # 24 automated Pytest test cases
│   ├── conftest.py
│   ├── test_auth.py
│   ├── test_shops.py
│   ├── test_products.py
│   ├── test_inventory.py
│   ├── test_parties.py
│   ├── test_purchases.py
│   ├── test_sales.py
│   └── test_dashboard_and_reports.py
├── LEARNING_NOTES.md             # In-depth architectural & interview preparation notes
├── requirements.txt
├── .env.example
└── README.md
```

---

## ⚡ Quickstart Guide

### 1. Backend Setup

```bash
# 1. Activate virtual environment
# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# Linux / macOS:
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment variables
# Copy .env.example to .env and configure your MySQL credentials:
cp .env.example .env

# 4. Run database migrations
alembic upgrade head

# 5. Start FastAPI server (explicitly binding to 127.0.0.1 avoids Windows IPv6 localhost conflicts)
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

- Interactive API Documentation:
  - Swagger UI: `http://localhost:8000/docs`
  - ReDoc: `http://localhost:8000/redoc`

### 2. Frontend Setup

```bash
cd frontend

# Install frontend dependencies
npm install

# Start Vite development server
npm run dev
```

- Open your browser at: `http://localhost:5173`

### 3. Running Automated Tests

The test suite runs in-memory without modifying your development or production database:

```bash
pytest tests/ -v
```

All 24 automated tests will execute and pass.

---

## 🔍 Troubleshooting & Common Issues

### "Failed to fetch" Error during Registration or Login
If you see **"Failed to fetch"** or **"Cannot connect to Dokan Bandhu API server"** when registering a new shopkeeper or logging in:

1. **Verify Backend is Running**:
   FastAPI must be running in a separate terminal window:
   ```bash
   uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```
   Open `http://127.0.0.1:8000/docs` in your browser to confirm the backend is up.

2. **Windows IPv4 vs IPv6 Resolution**:
   On Windows, `localhost` often resolves to IPv6 `::1`, while Uvicorn binds to IPv4 `127.0.0.1`.
   Always start Uvicorn with `--host 127.0.0.1`. The Vite frontend dev server is configured with a reverse proxy in `vite.config.js` (`/api` &rarr; `http://127.0.0.1:8000`) so browser calls never suffer from CORS or IPv6 loopback mismatch.

3. **Check Frontend Network Console**:
   Open browser DevTools (`F12`), go to the **Network** tab, and filter by `Fetch/XHR`. If the status is `(failed)` with `net::ERR_CONNECTION_REFUSED`, the backend is either stopped or listening on a different port.

---

## 📖 Learning Handbook

For full code explanations, SQL equivalences, deadlock prevention analysis, and software engineering interview questions, see [LEARNING_NOTES.md](file:///c:/Users/nitai/OneDrive/Attachments/Desktop/NITAI/Dokan_Bondhu/LEARNING_NOTES.md).
