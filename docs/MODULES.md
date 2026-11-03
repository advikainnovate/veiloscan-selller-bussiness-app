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
| New-order alerts ✅ | Banner + vibration when a new order or request arrives while the app is open; tap to open it | `/notifications` (polled every 30 s) | — |

## Next, in order

Ordered by how often a seller needs it on the go.

| # | Module | Panel page | Backend | Permission |
| --- | --- | --- | --- | --- |
| 1 | Notifications | header bell | `/notifications`, `/notifications/:id/read`, `/notifications/read-all` | — |
| 2 | Products (list, detail, status) | `/dashboard/products-master` | `/products-master` | `products-master:manage` |
| 8 | Stock Health, Pending Stock | `/dashboard/operations/*` | store operations | `store-operations:manage`, `pending-stock:manage` |
| 9 | Support Tickets, Support Dashboard | `/dashboard/support/*` | `/support/*` | `support-tickets:view`, `support-reports:view` |
| 10 | Freebies, Gift Cards, Promotions | `/dashboard/freebie-master` … | `/freebie-master`, `/gift-cards`, `/my-promotions` | `*:manage` |
| 11 | Pricing & Discounts (quantity slabs) | `/dashboard/pricing-discounts/*` | `/quantity-discounts` | `quantity-discounts:manage` |
| 12 | Shipping | `/dashboard/shipping` | shipping methods / zones | `shipping:manage` |
| 13 | Product create / edit wizard | `/dashboard/products-master/create` | product builder | `products-master:manage` |
| 14 | Variants, Business Variants, Product Specs, Brand Approvals | catalog pages | catalog endpoints | catalog permissions |
| 15 | Warehouses, Inventory Ledger (transactions) | `/dashboard/warehouse-master`, `/inventory-transactions` | `/warehouse-master`, `/inventory-transactions` | `*:manage` |
| 16 | Users (staff) | `/dashboard/users` | `/users` | `users:view` |
| 17 | Subscription | settings page | `/subscriptions/me` | none |
| 18 | My Profile | account menu | `/auth/me` (PATCH) | — |

## Not for sellers

Platform-admin pages in the panel's code (Categories, Brands master, Tax,
Global Charges, CMS, FAQs, Roles, Designations, Companies, Base Values,
Platform Settings, Reviews, User Bonuses, Store approvals) are never shown to
sellers — their permissions are stripped by `src/lib/access-policy.ts` — so
the app leaves them out.

## Known gaps

- Store Settings: the description (formatted text), onboarding and the
  Categories tab stay on the Seller Panel; logo and banner aren't cropped
  in the app (checked against the size rules instead), and document uploads
  are photos (or a file URL).

- New-order alerts work while the app is open. Alerts with the app closed need
  push notifications (Firebase Cloud Messaging / APNs) — a backend and
  app-store setup task.
- The Seller Panel plays a chime (and can read the order aloud); the app
  vibrates. A sound needs an audio library.
