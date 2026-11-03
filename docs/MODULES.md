# VeiloScan Business — module roadmap

The app brings the Seller Panel (`veiloscan-eshop-seller-panel`) to phones, one
module at a time. Every module uses the same backend endpoints and permissions
as the panel; pages a seller's role can't open are hidden from the menu.

Modules not built yet open a "Coming soon" page from the menu
(`src/screens/ModuleScreen.tsx`). When a module lands, give it its own screen
and route in `src/navigation/` and mark it done here.

Status: ✅ done · 🚧 in progress · ⬜ not started

## Built

| Module | App screens | Backend | Permission |
| --- | --- | --- | --- |
| Sign in, OTP sign in, password reset | Splash, Get Started, Login, Forgot / Reset Password | `/auth/*` | — |
| Navigation | Drawer menu, header, bottom tabs; store switcher (header bar and menu, remembered per user, sent as `X-Store-Id` like the panel's) | `GET /stores` | per menu item (switcher: `stores:view`) |
| Home | Banner, today's figures, Quick Access | `GET /reports/overview`, `GET /customers`, `GET /notifications` | per card |
| Orders ✅ | List (summary, search, status filters, sort, payment methods), detail, accept → ready → collect payment (split methods) or Customer Credit with reminder terms → picked up, cancel with reason, credit requests, invoice and receipt PDFs | `/orders`, `/orders/:id/*` (pickup-status, payments, invoices, receipts) | `orders:manage` (credit: `customer-credit:manage`) |
| Self orders ✅ | New order: products (search, categories, weighed items, quantity slabs, line discounts, coupon, stock check) → Quick Sale / existing / new customer → pay now (single or split, change due) or Customer Credit; order discount, hand over now or later | `/orders/for-customer/*` | `orders:manage` |
| Order Requests ✅ | List (summary cards, status counts, search), detail contact by call / WhatsApp / email, detail (availability, edit items, status changes with reasons), final bill through the self-order flow | `/order-requests/*` | `orders:manage` |
| Customers ✅ | List (totals, new this month, with credit, total credit; All / With Credit / Top Customers; search by name, mobile or customer ID; 50 a page), lifetime purchase and credit due per customer, details sheet with call | `GET /customers` (`view`), `GET /customers/summary` | `customers:manage` (credit: `customer-credit:manage`) |
| Sales Reports ✅ | Reports tab: store picker, date presets, KPIs vs the previous period (sales, orders, average order, gross profit, expenses, margin), sales & profit trend (daily / weekly / monthly), sales by payment method, top categories, sales list (all orders or by date / category / product / payment mode / customer / staff; search, payment filter, 10 a page) | `GET /stores`, `/stores/:id/operations/{overview,trend,sales,sales/breakdown}` | `store-operations:manage` (profit: `store-profit:view`) |
| Customer Credit ✅ | List (six totals, status tabs with counts, search, 20 a page, Collect), detail (amounts, payment history with receipts, customer, order, reminders, send a reminder now), receive payment (checked against what's owed, confirm step), edit due date / reminders / notes, cancel an unpaid credit | `/customer-credit/*` | `customer-credit:manage` |
| Coupons ✅ | List (totals, search, type and status filters), detail (activate / deactivate, delete), create and edit with the panel's fields and the backend's limits | `/coupons-master` | `coupons-master:manage` |
| All Stores ✅ | Every store combined (sales, expenses, cost of goods, net profit, orders, collection), store-wise share — tap to switch to it, combined stock alerts; the panel's locked view when the plan doesn't include it | `GET /reports/multi-store/overview`, `/subscriptions/me` | `store-operations:manage` + plan |
| Business Overview ✅ | Date presets + custom range, five KPIs vs the previous period, sales & profit chart (daily / weekly / monthly; series), sales by category, top products, recent orders, stock alerts and pending / delayed stock orders | `/stores/:id/operations/{overview,trend,sales,sales/breakdown,stock-health}` | `store-operations:manage` (profit: `store-profit:view`) |
| Daily Business ✅ | Any day (previous / next / pick), 12 figures (sales, profit, expenses, orders, collection, cash / online, credit given / outstanding, stock received / adjusted), activity timeline linking to orders, credits and expenses | `/stores/:id/operations/daily` | `store-operations:manage` |
| Expenses ✅ | Dashboard (period totals, owed now, 12-month chart, by category, upcoming), All Expenses (range, search, status / type / sort, filters sheet, PDF export), detail (payments with void, returns with approve / cancel, attachments, credit, reminders, audit trail; edit, duplicate, cancel, delete), add / edit / copy form with GST, credit terms and new supplier, Suppliers + ledger, Recurring, Reports (periods, custom range, PDF), Categories | `/stores/:id/operations/expense*` | `store-expenses:view` / `create` / `edit` / `delete` |
| Notes ✅ | Active / Completed / Archived with counts and urgent badge, search, priority filter, add / edit (date, priority, reminder today / tomorrow / date & time, photo), view with history, complete / reopen / archive / delete | `/stores/:id/operations/notes` | `store-notes:view` / `create` / `edit` / `delete` |
| Inventory ✅ | Stock (figures, search, warehouse / status / reserved / blocked filters, per-SKU on hand · reserved · blocked · available), Ledger (summary vs previous period, date presets, warehouse, movement type, search, 10 a page), Reservations (held quantity, orders, value, age filters), Low Stock (reorder quantity and value); receive (with or without a SKU picked), count / adjust, damage / block / write off, transfer, return, stock levels; stock record detail with lots, reservations, its own ledger and stock settings | `/inventory/*` | `product-inventory:manage` |
| Store Settings ✅ | The current store's page: logo, status, code, shop link (share), status strip, rejection banner; Overview cards; Store Setup (address & contact, logo / banner upload with size and dimension checks, colours, tagline, business hours); Operational Settings (how customers buy, prefix, minimum order, payments, customer credit days); GST & Documents (GSTIN checks, required documents, add / remove / re-upload rejected); QR Store Tag (design, theme, live preview, generate, PDF / PNG, share); Additional Info; Activity Log (filters); Edit business details; Activate / Mark Inactive / Close Store | `/stores/:id` and its `settings`, `config`, `branding`, `business-hours`, `tax-details`, `documents`, `qr-tag`, `approval-history`; `/store-document-requirements` | `stores:view` (change: `stores:edit`, close: `stores:delete`) |
| Stores ✅ | Store switcher links (Manage this store, All stores, Add New Store; Set up store with none); All Stores list (totals, plan's store allowance, search, status / type / category / city filters, per store: open, switch, edit, continue onboarding, close); Add New Store wizard (Business Details with the 100-word description, Store Setup with address, images, hours and settings, GST & Documents with required uploads, Review & Submit with terms), resuming drafts and resubmitting rejected stores | `GET /stores`, `/subscriptions/me/usage`, `/store-onboarding/*`, `/store-document-requirements{,/branding}` | `stores:view` (add: `stores:create`, continue: `stores:edit`, close: `stores:delete`) |
| Store Categories ✅ | Store page › Categories tab: selected main / sub / child counts, awaiting approval and inactive, rejected categories with Request again, the mapped tree with products per category and an on / off switch per store, Map Categories picker (one level at a time with Select All, or search across all levels by name, tag or description), save the whole selection (removals confirmed; new ones sent for approval) | `/category-master`, `/products-master?storeId`, `/stores/:id/categories` (GET, PUT, PATCH :id, POST :id/resubmit) | `store-categories:manage` |
| Quantity Discount Slabs ✅ | Pricing & Discounts menu: list (running / scheduled / ended / inactive totals and filters, search by scheme, product or ID, slab ladder, store, dates, coupons allowed, 10 a page, delete), create / edit (product search, store, status, start and end date and time, all / specific / single-SKU variants with a variant picker, per-variant or combined counting, unit, up to 20 slabs of % or ₹ per unit / per order, live "Customers will see" preview, allow coupons, history) | `/quantity-discounts`, `/quantity-discounts/products{,/:id}` | `quantity-discounts:manage` |
| Warehouses ✅ | List (active / awaiting / rejected / inactive tiles that filter, stock value, units and low-stock items, needs-attention banner, search, location / type / status filters), detail (approval notice with VeiloScan's note, stock figures, stock in it, recent movements, location with map / call / email, operations, approval history; resubmit with a note, switch on / off, manage stock), add / edit (basic, location, additional, settings switches; address changes go back for approval), activate / deactivate, delete | `/warehouse-master` (+ `/:id/resubmit`, `/:id/history`), `/inventory`, `/inventory/ledger`, `/product-business-variants` | `warehouse-master:manage` |
| Brand Approvals ✅ | List (awaiting / changes needed / approved tiles, search, changes-needed banner), detail (what to change, details, documents, progress; fix & resubmit, withdraw, add a product), new request (child category mapped to your stores, a listed brand or a new one, stores per category with already-requested ones shown, sales channels, ownership, trademark details, photos of the documents, checklist) | `/brand-requests` (+ `/options`, `/:id/resubmit`), `/categorywise-brands`, `/category-master`, `/brands-master`, `/files/upload` | `products-master:manage` |
| Product Variants ✅ | List (active / inactive tiles, products and types in use, search, product / type filters, value swatches), add / edit mapping (values follow the chosen type), view product, activate / deactivate, remove | `/product-variants`, `/variant-master`, `/variant-data`, `/product-images` | `product-variants:manage` |
| Business Variants ✅ | List (active / inactive, products covered, average price, search by SKU / barcode / product, product filter), add / edit SKU (attributes, selling / MRP / cost price, fixed or up to 5 slab tiers, image, status), activate / deactivate, delete | `/product-business-variants`, `/products-master` | `product-business-variants:manage` |
| Product Specs ✅ | List (active / inactive, products covered, values as chips, product / specification filters), detail (details, values, activate / deactivate), add / edit (only specifications mapped to the product's category and not yet assigned; select options or typed values with order) | `/product-specifications`, `/product-specification-values`, `/specifications`, `/specifications-data`, `/categories/:id/product-configuration` | `product-specifications:manage` |
| My Profile ✅ | Header avatar and menu card: photo, name, role, status, contact chips, bio; profile completeness with checklist; role / type / status / last login; personal info, security (verified email / phone, password changed, login attempts), documents, subscription plan (status, price, trial, renewal), sales team (ID or request to join); edit profile (photo, name, display name, gender, bio), change password by emailed code, sign out | `/auth/me`, `/users/:id` (PATCH), `/users/:id/profile` (GET, PUT), `/auth/forgot-password`, `/auth/reset-password`, `/subscriptions/me`, `/seller/sales-team` | — |
| Notifications ✅ | Header bell and menu: All / Unread (with count), by kind (orders, notes…), grouped by day, unread tinted with a dot, relative times, more as you scroll; tap opens the order, order request or note (and marks it read), mark all as read | `/notifications` (`page`, `isRead`), `/notifications/:id/read`, `/notifications/read-all` | — |
| Subscription ✅ | Navy plan card (stage: trial / complimentary / active / renewal due / expired, what it means, days left with progress, dates, highlights), renewal quote with GST, price / billing cycle / next charge / features included, usage meters (per-store breakdown, near-full and used-up warnings), billing details, payments (cash awaiting verification), every feature by module (all / included); owners change plan (monthly / yearly, upgrade / downgrade / switch billing, confirm; starts a trial from the free plan) | `/subscriptions/me/plan`, `/subscriptions/renewal`, `/subscriptions/me/payments`, `/public/subscription-plans`, `/subscriptions/start`, `/subscriptions/change` | none (changing: account owner) |
| Stock Health ✅ | All / Low / Out / Healthy tiles that filter (with counts), search, per SKU: current vs minimum, suggested reorder, pending from suppliers, last sold; view product or inventory, restock, create a stock request; "Order N low / out" pre-fills a stock order; more as you scroll | `/stores/:id/operations/stock-health` | `store-operations:manage` |
| Pending Stock ✅ | Open / delayed / open value / received tiles and every status as chips, search, received-of-total progress, delayed flags; stock order detail (products ordered / received / pending, receive what arrived with "everything pending arrived", mark in transit / back to ordered, change expected date, cancel with a reason, supplier bill paid or on credit, deliveries, history); new stock order (supplier, warehouse, dates, product search, quantity and unit cost, amount, notes) | `/stores/:id/operations/{skus,stock-orders,stock-orders/:id/{receive,cancel,purchase-bill}}` | `pending-stock:manage` |
| Shipping ✅ | Zones list (zones / active / inactive / methods tiles, search, covered states, method count, activate / deactivate, delete); zone page (details, its methods with rate, free-above value and delivery days; add / edit in a sheet with slug from the title, fixed / per-kg / % of order, activate / deactivate, delete); create / edit zone (slug from the title, covered states picked from the Indian states and UTs) | `/shipping-zones`, `/shipping-methods` | `shipping:manage` |
| Freebies, Gift Cards, Promotions ✅ | One list per kind (total / active / inactive tiles plus expired, or total face value for gift cards; search; promotion type or gift card category chips; activate / deactivate, delete); detail page by section; create / edit with the panel's checks (required fields, amounts, order value range, dates, % discount ≤ 100, gift card image upload) | `/freebie-master`, `/gift-cards`, `/my-promotions` | `freebie-master:manage`, `gift-cards:manage`, `my-promotions:manage` |
| Inventory Ledger ✅ | Every stock movement, newest first (movements / stock in / stock out / holds tiles, search by product, SKU, reference or lot, movement type and warehouse filters); an entry's sheet shows on hand / reserved / blocked changes and balances, quantity, lot, cost, reason, reference, notes, who and when, with links to its stock record and order. Read only: entries come from stock operations and orders | `/inventory-transactions` | `inventory-transactions:manage` |
| New-order alerts ✅ | Banner + vibration when a new order or request arrives while the app is open; tap to open it | `/notifications` (polled every 30 s) | — |

## Next, in order

Ordered by how often a seller needs it on the go.

| # | Module | Panel page | Backend | Permission |
| --- | --- | --- | --- | --- |
| 1 | Support Tickets, Support Dashboard | `/dashboard/support/*` | `/support/*` | `support-tickets:view`, `support-reports:view` |
| 2 | Users (staff) | `/dashboard/users` | `/users` | `users:view` |

## Not for sellers

Platform-admin pages in the panel's code (Categories, Brands master, Tax,
Global Charges, CMS, FAQs, Roles, Designations, Companies, Base Values,
Platform Settings, Reviews, User Bonuses, Store approvals) are never shown to
sellers — their permissions are stripped by `src/lib/access-policy.ts` — so
the app leaves them out.

## Known gaps

- Subscription renewal is paid on the Seller Panel: online payment in the app
  needs Razorpay's React Native SDK (a native module), which isn't installed.

- Freebies: picking the specific categories, brands or products for a
  "Selected" eligibility is done on the Seller Panel.

- Catalog pages: no CSV export or multi-select bulk actions (Product
  Variants); brand approval documents are photos (PDFs on the Seller Panel);
  warehouses have no pincode autofill or "find on map".

- Store Settings: the description's formatting (bold, lists) stays on the
  Seller Panel — the wizard writes the
  description as plain paragraphs and keeps a saved one unless it's edited;
  the list has no CSV export; logo and banner aren't cropped
  in the app (checked against the size rules instead), and document uploads
  are photos (or a file URL).

- New-order alerts work while the app is open. Alerts with the app closed need
  push notifications (Firebase Cloud Messaging / APNs) — a backend and
  app-store setup task.
- The Seller Panel plays a chime (and can read the order aloud); the app
  vibrates. A sound needs an audio library.
