# Dokan Bandhu — Personal Engineering Learning Notes 📚

Welcome to your personal engineering handbook for **Dokan Bandhu** (দোকান বন্ধু / Shop's Friend)!
This notebook is created specifically for you as an IT student to master Python, FastAPI, SQLAlchemy 2.0, MySQL, and full-stack software architecture.

---

## 🏛️ Application Architecture Overview

```
 [ React Frontend ] 
         │ (HTTP / JSON + Bearer JWT)
         ▼
 [ FastAPI Application ] ──► CORS & Lifespan
         │
         ├──► [ Dependency Injection: get_current_user, require_shop_member ]
         │         │
         │         ▼
         ├──► [ Pydantic Schemas: Request Validation & Response Serialization ]
         │         │
         │         ▼
         ├──► [ Routers / Controllers: Endpoints ]
         │         │
         │         ▼
         ├──► [ Service Layer: Business Logic & Calculations ]
         │         │
         │         ▼
         └──► [ SQLAlchemy 2.0 ORM + with_for_update() Row Locking ]
                   │
                   ▼ (PyMySQL Driver)
           [ MySQL 8 Database ]
```

---

## 📖 Module 1: User Authentication & Shop Multi-Tenancy

### 1. Real-World Story: What are we building & Why?
Imagine a bazaar where **Babu** owns a grocery shop ("Babu Stores") and **Rahim** owns a stationery shop ("Rahim Book House").
- Babu hires an employee, **Sumon**, to bill items.
- Babu must be able to log in, add products, view daily profit, and manage staff.
- Sumon should be able to create bills, but must NOT be allowed to delete the shop or change settings.
- Most importantly, Rahim must NEVER see Babu's customer dues, sales, or product costs.

In software engineering, this is called **Multi-Tenancy with Role-Based Access Control (RBAC)**.
- **Tenant**: Each `Shop` is an isolated data boundary.
- **Roles**:
  - `owner`: Full control (delete shop, manage members, billing, inventory, reports).
  - `manager`: High-level operational control (add products, purchase, inventory adjustments, billing).
  - `staff`: Front-line operational control (create bills, view product prices).

### 2. Core Concepts Explained Simply

#### A. Password Hashing (Argon2id vs Plain Text / MD5)
- **Why we NEVER save plain text**: If a database is leaked or inspected, plain-text passwords compromise the user across other websites.
- **Why Argon2id**: Argon2id is the winner of the Password Hashing Competition. Unlike MD5 or SHA256 (which are fast algorithms designed for data checksums and can be brute-forced billions of times per second using GPUs), Argon2id is memory-hard and time-costly, making brute-force attacks impractical.
- **In our code**: We use `pwdlib` with `PasswordHash.recommended()` (Argon2id).

#### B. JSON Web Tokens (JWT)
- **What is it?**: A digitally signed string containing 3 base64 parts separated by dots: `Header.Payload.Signature`.
  - `Header`: Algorithm used (e.g. `HS256`).
  - `Payload`: Claims, such as `sub` (user_id) and `exp` (expiration time).
  - `Signature`: `HMACSHA256(Base64(Header) + "." + Base64(Payload), SECRET_KEY)`.
- **Stateless Authentication**: The backend does not need to store the session in a database. It simply verifies the signature using `SECRET_KEY`.

#### C. FastAPI Dependency Injection (`Depends`)
- Instead of repeatedly copying `db = SessionLocal()`, decoding the JWT, and checking shop membership in every single route, FastAPI lets us define reusable dependency functions.
- `current_user: Annotated[User, Depends(get_current_user)]`: Validates token and fetches the logged-in user.
- `membership: Annotated[ShopMember, Depends(require_shop_member)]`: Validates that `current_user` belongs to `shop_id`. If not, raises `HTTP 403 Forbidden`.

### 3. Execution Flow of a Protected Request
```
1. Client sends request: GET /shops/5/products with Header: "Authorization: Bearer <jwt_token>"
2. FastAPI intercepts request and passes token to `oauth2_scheme`
3. `get_current_user` decodes token using SECRET_KEY:
   - Token expired? -> 401 Unauthorized
   - Token invalid? -> 401 Unauthorized
   - Extracts user_id -> Queries MySQL for User record -> Not found? -> 401 Unauthorized
4. `require_shop_member` executes with (shop_id=5, user_id):
   - Queries `shop_members` table for (shop_id=5, user_id)
   - Not found? -> 403 Forbidden ("You do not have access to this shop")
5. Router handler executes business logic safely knowing user and shop access are verified.
6. Returns JSON response serialized according to Pydantic `response_model`.
```

### 4. SQLAlchemy 2.x vs Raw SQL Equivalence

| Operation | SQLAlchemy 2.0 | Raw SQL Equivalent |
|---|---|---|
| Find user by email | `db.scalar(select(User).where(User.email == email))` | `SELECT * FROM users WHERE email = %s LIMIT 1;` |
| Check shop membership | `db.get(ShopMember, (shop_id, user_id))` | `SELECT * FROM shop_members WHERE shop_id = %s AND user_id = %s;` |
| Insert new user | `db.add(user); db.flush()` | `INSERT INTO users (full_name, email, password_hash) VALUES (%s, %s, %s);` |
| Save transaction | `db.commit()` | `COMMIT;` |
| Rollback on error | `db.rollback()` | `ROLLBACK;` |

---

## 🎯 Common Student Mistakes in Module 1
1. **Trusting the frontend `shop_id` blindly**:
   - *Bug*: Writing `@router.get("/shops/{shop_id}/products")` and querying by `shop_id` without checking if `current_user.id` is actually a member of that `shop_id`! Any logged-in user could read any other store's data by changing the ID in the URL.
   - *Fix*: Always inject `require_shop_member` dependency.
2. **Missing `db.rollback()` on exception**:
   - If an error occurs during `db.commit()`, the session remains in an error state. Always handle `IntegrityError` or general exceptions with `db.rollback()`.
3. **Storing passwords in lower/uppercase incorrectly**:
   - Passwords must be hashed with case sensitivity preserved. Emails should always be lowercased (`email.strip().lower()`).

---

## 💼 Technical Interview Preparation: Module 1
- **Q1: Why did you choose JWT over traditional server-side sessions?**
  - *Answer*: JWTs are stateless. The server doesn't need a Redis cache or session table lookup on every single API request just to check if the user is authenticated. It scales well and works seamlessly across web and mobile clients.
- **Q2: What is the risk of using JWT and how do you mitigate it?**
  - *Answer*: JWTs cannot be trivially revoked before their expiration time without maintaining a blacklist or token version. We mitigate this by using short expiration times (e.g., 30–60 minutes) and verifying critical state (such as active user status and shop membership) against the database on protected actions.
- **Q3: How does your application prevent Shop A from accessing Shop B's records?**
  - *Answer*: We enforce strict shop-level isolation using FastAPI dependencies. Every shop-scoped endpoint requires `shop_id` in its path and validates the user against the `shop_members` table using `require_shop_member`. All subsequent queries filter explicitly by `shop_id`.


---

## 📦 Module 2: Category & Product Management

### 1. Real-World Story: What are we building & Why?
In Babu's grocery shop:
- Products belong to Categories like "Spices", "Dairy", "Grains", "Snacks".
- Each product has:
  - `name`: e.g., "Mustard Oil 1L"
  - `sku`: Barcode or unique stock code e.g. "OIL-MUST-1L"
  - `selling_price`: ₹160.00
  - `cost_price`: ₹140.00 (profit margin = ₹20.00)
  - `unit`: "litre", "kg", "packet", "pcs"
  - `low_stock_threshold`: 5 (warn when remaining quantity is 5 or fewer)
- **CRITICAL BUSINESS RULE**: If an employee edits the product details (e.g. changes name or price), they must NEVER be able to arbitrarily change the stock number on that same screen. Why? Because inventory changes must have a recorded audit trail (Opening Stock, Purchase, Sale, Damage, or Physical Audit adjustment).

### 2. Core Concepts Explained Simply

#### A. Why Python `Decimal` and SQL `Numeric(10, 2)` instead of `Float`?
- **The Binary Floating Point Problem**: Computers store numbers in base-2 binary. Fractions like `0.1` cannot be stored precisely in binary:
  ```python
  0.1 + 0.2 == 0.30000000000000004  # In float!
  ```
- If a shop calculates thousands of sales with float, they will lose paise or face rounding discrepancies.
- **Solution**: Python `decimal.Decimal` and MySQL `DECIMAL(10, 2)` or `NUMERIC(12, 3)` perform exact fixed-point decimal arithmetic.

#### B. Opening Stock Audit Automation
- When a shopkeeper adds a new product with an initial stock of 25 kg:
  1. The product row is inserted into `products`.
  2. Simultaneously in the same transaction, a row is inserted into `stock_movements`:
     - `movement_type = "IN"`
     - `quantity = 25.000`
     - `reason = "Opening Stock"`
  3. This ensures that: `Initial Stock + All Purchases - All Sales = Current Stock` always balances mathematically.

#### C. Soft Deletion (`is_active = False`)
- If Babu stops selling "Dettol Soap 50g", we do NOT execute `DELETE FROM products WHERE id = 12`.
- **Why?**: Because old bills, sales records, and purchase invoices refer to `product_id = 12`. If we delete the row, foreign keys would either break or cascade-delete historical financial records!
- **Solution**: Soft delete sets `is_active = False`. The product is hidden from the active catalog but historical invoices remain 100% intact.

### 3. SQLAlchemy 2.x vs Raw SQL Equivalence

| Operation | SQLAlchemy 2.0 | Raw SQL Equivalent |
|---|---|---|
| Search products with category | `select(Product, Category.name).outerjoin(Category).where(Product.shop_id == shop_id, Product.name.ilike('%oil%'))` | `SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.shop_id = 1 AND p.name LIKE '%oil%';` |
| Soft delete product | `product.is_active = False; db.commit()` | `UPDATE products SET is_active = 0, updated_at = NOW() WHERE id = %s;` |
| Unique constraint check | `UniqueConstraint("shop_id", "sku")` | `ALTER TABLE products ADD CONSTRAINT uq_products_shop_sku UNIQUE (shop_id, sku);` |

---

## 💼 Technical Interview Preparation: Module 2
- **Q1: Why should you never use `float` for currency and inventory in financial systems?**
  - *Answer*: Floats use IEEE 754 floating-point representation, which causes binary rounding inaccuracies (e.g. `0.1 + 0.2 != 0.3`). In retail and financial accounting, we use fixed-point `DECIMAL(10, 2)` in SQL and Python's `Decimal` to ensure exact calculations without rounding loss.
- **Q2: Why do you separate product detail edits from stock adjustments?**
  - *Answer*: Separation of concerns and auditability. Updating product metadata (like name or category) is a master-data change. Modifying stock is an inventory transaction. If stock could be changed on an ordinary edit screen, shop staff could cover up theft or discrepancies without leaving a ledger entry.
- **Q3: What is the purpose of Soft Delete and how is it implemented?**
  - *Answer*: Soft delete preserves relational integrity. Instead of removing the database row with `DELETE`, we set an `is_active = False` flag. Active queries filter with `WHERE is_active = TRUE`, while historical records (like past sales and purchase invoices) continue to reference the product safely.


---

## 📊 Module 3: Inventory Management & Pessimistic Row Locking

### 1. Real-World Story: What are we building & Why?
Imagine Babu's shop has only **1 packet** of Amul Butter left in the refrigerator.
- Two cashiers, Sumon and Amit, are billing customers at two different counters at the exact same second:
  - Counter 1 scans the butter.
  - Counter 2 scans the butter.
- If both computers read `stock = 1` and both submit `stock = stock - 1`:
  - Without locking: Both sales succeed! The stock becomes `0`, but 2 customers walked away with 2 packets when the shop only had 1! (Negative physical stock / Overselling).
- In computer science, this is called a **Race Condition** or **Lost Update Anomaly**.

### 2. Core Concepts Explained Simply

#### A. Pessimistic Locking with `with_for_update()`
- In SQLAlchemy 2.0:
  ```python
  product = db.scalar(
      select(Product)
      .where(Product.id == product_id)
      .with_for_update()
  )
  ```
- **What MySQL does behind the scenes**:
  It generates: `SELECT * FROM products WHERE id = 1 FOR UPDATE;`
  MySQL places an exclusive row lock on that specific product row.
  - If Counter 2 arrives a fraction of a millisecond later, MySQL forces Counter 2 to **wait** until Counter 1 finishes its transaction.
  - When Counter 1 commits `stock = 0`, Counter 2 wakes up, reads the new stock `0`, and our code raises `HTTP 409: Insufficient stock available`!

#### B. Single Transaction Principle (`db.flush()` vs `db.commit()`)
- Notice that in `inventory_service.py`, we call `db.flush()`, NOT `db.commit()`:
  - `db.flush()` sends the `UPDATE products` and `INSERT INTO stock_movements` SQL to MySQL within the active transaction. IDs are generated and constraints are checked, but the transaction is NOT saved permanently yet.
  - The caller (the router or checkout service) calls `db.commit()` when ALL steps are successful.
  - If anything fails, `db.rollback()` undoes everything automatically.

### 3. SQLAlchemy 2.x vs Raw SQL Equivalence

| Operation | SQLAlchemy 2.0 | Raw SQL Equivalent |
|---|---|---|
| Pessimistic lock row | `select(Product).where(Product.id == id).with_for_update()` | `SELECT * FROM products WHERE id = %s FOR UPDATE;` |
| Low stock check | `select(Product).where(Product.stock_quantity <= Product.low_stock_threshold)` | `SELECT * FROM products WHERE shop_id = %s AND is_active = 1 AND stock_quantity <= low_stock_threshold ORDER BY stock_quantity ASC;` |
| Record movement | `db.add(StockMovement(...))` | `INSERT INTO stock_movements (shop_id, product_id, movement_type, quantity, quantity_before, quantity_after, reason, created_by) VALUES (...);` |

---

## 💼 Technical Interview Preparation: Module 3
- **Q1: What is a Race Condition in inventory systems and how did you prevent it?**
  - *Answer*: A race condition occurs when concurrent transactions read the same stock quantity simultaneously and make decisions based on stale data, leading to overselling or negative stock. We prevent this using pessimistic concurrency control via `SELECT ... FOR UPDATE` (`with_for_update()` in SQLAlchemy), which locks the product row in MySQL until the transaction commits or rolls back.
- **Q2: Why use Pessimistic Locking instead of Optimistic Locking for Dokan Bandhu?**
  - *Answer*: Optimistic locking uses a version number (`version_id`). If a conflict occurs, optimistic locking fails the request and forces the user to retry. In a busy checkout counter, a shopkeeper scanning items cannot have their checkout fail randomly due to version conflicts; pessimistic locking queues the concurrent transaction gracefully.
- **Q3: What is the difference between `db.flush()` and `db.commit()`?**
  - *Answer*: `db.flush()` pushes pending Python object changes as SQL queries (`INSERT`, `UPDATE`, `DELETE`) to the database buffer within the active transaction without terminating it. `db.commit()` writes the entire transaction permanently to disk, releases row locks, and closes the transaction boundary.


---

## 👥 Module 4 & 5: Customer Khata & Supplier Management

### 1. Real-World Story: What are we building & Why?
In Indian/Bengali retail culture, local shops thrive on trust and relationships:
- **Baki Khata (বাকি খাতা / Customer Credit Ledger)**: Regular neighborhood families buy goods daily and clear their tab at the end of the month or upon receiving their salary.
- **Supplier Wholesale Credit**: The shopkeeper buys ₹50,000 worth of goods from an ITC or Unilever distributor, pays ₹30,000 upfront, and pays the remaining ₹20,000 after selling the items.
- If this information is kept in paper notebooks, entries get lost, stained, or disputed. Dokan Bandhu digitizes the entire ledger with exact payment dates, invoice links, and automated balance calculation.

### 2. Core Concepts Explained Simply

#### A. Ledger Balance Maintenance
- Rather than calculating a customer's total due by summing thousands of past invoices on every page load (which is $O(N)$ and slows down as the database grows), we maintain a running `outstanding_due` column on the `Customer` record.
- Every sale that has a balance adds to `outstanding_due`.
- Every repayment subtracts from `outstanding_due`.
- The `Payment` table stores an immutable ledger of every payment transaction for audit verification.

#### B. SQL Equivalence

| Operation | SQLAlchemy 2.0 | Raw SQL Equivalent |
|---|---|---|
| Search customers by name or phone | `select(Customer).where(or_(Customer.name.ilike('%ghosh%'), Customer.phone.ilike('%98300%')))` | `SELECT * FROM customers WHERE shop_id = 1 AND is_active = 1 AND (name LIKE '%ghosh%' OR phone LIKE '%98300%');` |
| Filter pending dues | `select(Customer).where(Customer.outstanding_due > 0)` | `SELECT * FROM customers WHERE shop_id = 1 AND outstanding_due > 0 ORDER BY outstanding_due DESC;` |

---

## 🛒 Module 6 & 7: Purchases, POS Billing & Deadlock Prevention

### 1. Real-World Story: What are we building & Why?
A customer walks up to the counter with:
- 2 packets of Tata Tea Gold
- 5 kg of Basmati Rice
- 1 jar of Ghee
The shopkeeper scans the items, offers a ₹15 festive discount, adds 5% GST, accepts ₹500 in cash, and marks the remaining ₹120 as a Khata due.

### 2. Important Architectural Logic: Deadlock Prevention via Canonical Row Sorting
- **The Problem**:
  Suppose Transaction A (Counter 1) sells Product #1 and Product #2.
  Transaction B (Counter 2) sells Product #2 and Product #1 at the same millisecond.
  - Transaction A locks Product #1 and waits for Product #2.
  - Transaction B locks Product #2 and waits for Product #1.
  - Both transactions wait for each other forever! This is a classic **Database Deadlock** (`1213: Deadlock found when trying to get lock`).
- **Our Solution**:
  ```python
  # In sales_service.py:
  sorted_items = sorted(payload.items, key=lambda x: x.product_id)
  ```
  By sorting `product_id` in ascending order (1, then 2) before acquiring row locks, both Counter 1 and Counter 2 always request locks in the exact same sequence. Cyclic waiting is impossible, **mathematically eliminating deadlocks**!

### 3. Historical Price Snapshotting
- Notice that `SaleItem` has its own `unit_price`, `product_name`, and `unit` columns.
- **Why?**: If Tata Tea costs ₹140 today, and next month inflation increases it to ₹160 in the `Product` table:
  - If `SaleItem` simply pointed to `Product.selling_price`, printing a 2-month-old bill would incorrectly show the new ₹160 price, altering historical accounts and tax filings!
  - By taking a **snapshot** of the name and price in `SaleItem` at the time of purchase, historical records are permanently immutable.

---

## 📈 Module 9 & 10: Dashboard Analytics & Real-Time Aggregation

### 1. SQL Aggregations vs Application-Level Loops
- Instead of downloading 10,000 sales records into Python memory and summing them in a `for` loop (which wastes memory and network bandwidth), we delegate aggregation directly to MySQL's optimized C++ engine:
  ```python
  # SQLAlchemy 2.0
  stmt = select(
      func.coalesce(func.sum(Sale.total_amount), Decimal("0.00")),
      func.count(Sale.id)
  ).where(Sale.shop_id == shop_id, Sale.created_at >= today_start)
  ```
  - `Raw SQL`: `SELECT COALESCE(SUM(total_amount), 0.00), COUNT(id) FROM sales WHERE shop_id = 1 AND created_at >= '2026-11-09 00:00:00';`
- `COALESCE(SUM(...), 0.00)` ensures that if no sales occurred today, MySQL returns `0.00` rather than `NULL`, preventing Python `NoneType` errors.

### 2. CSV Streaming / Exporting
- Using Python's standard `csv.writer` and `io.StringIO`, reports are generated on-the-fly and returned with `media_type="text/csv"` and `Content-Disposition: attachment; filename=...`.
- Shopkeepers can open these directly in Microsoft Excel or Google Sheets for bookkeeping, tax compliance, or accountant review.

---

## 🌐 Module 11: Frontend Architecture & Communication Flow

### 1. The Full-Stack Pipeline
```
[User Action in React UI]
      │ (e.g. Clicks "Complete Sale")
      ▼
[POSView.jsx: handleCheckout()]
      │ Calls api.createSale(shopId, payload)
      ▼
[api.js: fetch(url, options)]
      │ Reads JWT Bearer token from localStorage
      │ Headers: { "Authorization": "Bearer eyJhbGciOi...", "Content-Type": "application/json" }
      ▼
[FastAPI: @router.post("/shops/{shop_id}/sales")]
      │
      ├── 1. Depends(oauth2_scheme) -> Validates JWT signature
      ├── 2. Depends(get_current_user) -> Finds User in MySQL
      ├── 3. Depends(require_shop_member) -> Verifies user belongs to shop_id
      ├── 4. Pydantic (SaleCreate) -> Validates types, quantities > 0
      ▼
[sales_service.py: create_sale_transaction()]
      │
      ├── Locks product rows: SELECT ... FOR UPDATE
      ├── Deducts inventory + records StockMovement
      ├── Updates customer due (if credit)
      └── Saves Sale & SaleItem
      ▼
[db.commit()]
      │ MySQL writes to InnoDB redo log & releases locks
      ▼
[FastAPI Response]
      │ Serializes to JSON via SaleResponse
      ▼
[React UI]
      │ Receives JSON, displays instant printable thermal receipt modal
```

---

## 🎓 Ultimate Technical Interview Preparation: Dokan Bandhu

### Q1: What is Dokan Bandhu and what problem does it solve?
> **Answer**: Dokan Bandhu is a production-ready, multi-tenant shop management and inventory application built with FastAPI, SQLAlchemy 2.0, MySQL 8, and React. It solves the operational challenges of small retailers and grocery shopkeepers by digitizing product catalogs, inventory tracking, supplier purchases, barcode/POS billing, and neighborhood credit ledgers (Baki Khata).

### Q2: Why did you choose FastAPI over Django or Flask?
> **Answer**:
> 1. **High Performance**: FastAPI is built on Starlette and Pydantic, making it one of the fastest Python frameworks available.
> 2. **Type Safety & Auto-Validation**: Pydantic v2 automatically parses, coerces, and validates incoming JSON payloads at compile/runtime, catching errors before they reach business logic.
> 3. **Clean Dependency Injection**: FastAPI's `Depends` system enables modular, decoupled authentication, role authorization, and database session lifecycles without boilerplate decorators.
> 4. **Automatic OpenAPI/Swagger Documentation**: Interactive documentation (`/docs`) is generated automatically from schemas.

### Q3: How does your application ensure multi-tenant data isolation?
> **Answer**: Multi-tenancy is enforced at both the database and routing levels. Every business entity (`products`, `customers`, `sales`, `purchases`, `stock_movements`) contains a non-nullable foreign key `shop_id`. Furthermore, our FastAPI dependency `require_shop_member` intercepts every request, checks the authenticated user's ID against the `shop_members` association table, and throws an `HTTP 403 Forbidden` if the user is not a member of that specific shop. All database queries are explicitly partitioned by `shop_id`.

### Q4: How do you prevent race conditions and overselling during simultaneous checkouts?
> **Answer**: We use pessimistic concurrency control (`SELECT ... FOR UPDATE` via `with_for_update()` in SQLAlchemy 2.0). When an item is being billed, the database acquires an exclusive row lock on that product. Any concurrent checkout must wait until the first transaction commits or rolls back. Furthermore, to eliminate cyclic deadlocks when transactions purchase multiple overlapping products, we sort product IDs canonically before acquiring locks.

### Q5: Why is inventory modification forbidden on general product edit endpoints?
> **Answer**: For auditability and financial integrity. Modifying product details (such as description or category) is a master data update, whereas changing stock is an inventory movement. If staff could edit stock numbers on an ordinary edit screen, discrepancies or theft could be covered up without a trace. Every stock change in Dokan Bandhu is strictly required to pass through `/stock-in`, `/stock-out`, or `/stock-adjust`, each of which creates an immutable `StockMovement` ledger entry.

### Q6: How do you handle database transactions and rollbacks?
> **Answer**: We follow the Unit of Work pattern using SQLAlchemy sessions. Complex workflows (like POS billing, which involves updating stock, inserting `sale_items`, logging `stock_movements`, and updating `customer.outstanding_due`) execute in a single database transaction. If any validation fails (e.g., insufficient stock or invalid payment), an exception is raised, `db.rollback()` reverts all partial changes, and no corrupt or orphaned records are written to MySQL.
