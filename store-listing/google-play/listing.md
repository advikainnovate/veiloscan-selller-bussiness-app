# VeiloScan Business — Google Play listing

Package: `com.veiloscan.business` · Default language: English (India) — en-IN

Paste each block into Play Console › Grow › Store presence › Main store listing.

---

## App name (max 30)

```
VeiloScan Business
```

## Short description (max 80)

```
Run your shop from your phone: orders, billing, credit, stock and sales reports.
```

## Full description (max 4,000)

```
VeiloScan Business is the seller app for stores on VeiloScan. Take orders, bill customers at the counter, track who owes you money, keep an eye on stock and see how your shop is doing — all from your phone.

ORDERS AND BILLING
• See every new order the moment it arrives, with an alert and vibration
• Accept, mark ready and hand over pickup orders in a tap
• Bill walk-in and phone customers at the counter: search products, weighed items, quantity discounts, coupons and line discounts
• Take payment by cash, UPI or card — or split it across methods
• Share tax invoices and payment receipts as PDF

CUSTOMER CREDIT (UDHAAR)
• Sell on credit with a due date and automatic reminders
• Record part payments and see what each customer still owes
• Spot overdue credit and follow up with a call

CUSTOMERS
• Every customer's purchases, orders, saved addresses and credit in one place
• Find your top buyers and who owes you money

STOCK AND INVENTORY
• Stock Health shows low and out-of-stock items, with how much to reorder
• Receive stock, count and adjust it, record damage, transfer between warehouses
• Track stock ordered from suppliers until it arrives

REPORTS AND YOUR BUSINESS
• Today's sales, orders and customers on the home screen
• Sales, profit, margin and expenses by day, week or month
• Sales by payment method, category, product, customer and staff
• Record expenses and supplier bills, with payments and reminders
• Daily business summary and notes for your team

YOUR STORE AND TEAM
• Manage store details, hours, branding, GST and documents
• Products, variants, prices, coupons, offers and shipping zones
• Add staff with their own sign-in and choose what each role can do
• Run more than one store and switch between them

VeiloScan Business works with your VeiloScan seller account and the VeiloScan Seller Panel — everything stays in sync. Don't have an account yet? Register your store at veiloscan.com.

Need help? Write to support@veiloscan.com.
```

## Category and contact

| Field | Value |
| --- | --- |
| App or game | App |
| Category | Business |
| Tags (pick up to 5 in Console) | Business management, Point of sale, Inventory, Invoicing, Shopping & retail tools |
| Email | support@veiloscan.com |
| Website | https://veiloscan.com |
| Privacy policy | https://veiloscan.com/privacy-policy |
| Phone | *(optional — add if you want one shown)* |

## Release notes — "What's new" for 1.0 (max 500)

```
First release of VeiloScan Business: orders and counter billing, customer credit with reminders, customers, stock health and inventory, sales reports, expenses, store settings and staff users.
```

---

## Graphics (this folder)

| Play Console slot | File | Spec |
| --- | --- | --- |
| App icon | `icon-512.png` | 512 × 512 PNG, full-bleed (Play rounds the corners) |
| Feature graphic | `feature-graphic-1024x500.png` | 1024 × 500 PNG, no transparency |
| Phone screenshots (7) | `screenshots/01-home.png` … `07-stock.png` | 1080 × 1920 PNG, 9:16, upload in this order |

Screenshot order and captions:

1. Your whole store in your pocket — Home
2. Never miss an order — Orders
3. Accept, pack and hand over — Order detail
4. Track every rupee on credit — Customer Credit
5. Know your regular customers — Customers
6. See how your shop is doing — Sales Reports
7. Restock before you run out — Stock Health

All screenshots are the real app showing a made-up demo store ("Mehta Kirana Store", owner "Anil Mehta"); names, phone numbers (+91 98765 001xx) and figures are fictional. Product names are generic, with no third-party brands. To retake them, set `DEMO_MODE = true` in `src/demo/flag.ts` on a debug build, capture, then set it back to `false`.

---

## Before you submit — still needed in Play Console

- **Account deletion URL** (App content › Data safety): Play requires a web page or link where users can ask to delete their VeiloScan account and data. None exists yet; e.g. a section on https://veiloscan.com/contact or a dedicated page.
- **App access**: the app needs a sign-in, so give reviewers a working demo seller login (email + password) under App content › App access.
- **Data safety form**, draft answers — please confirm against the backend:
  - Personal info collected: name, email address, phone number (seller and staff accounts); customers' names and phone numbers entered by the seller.
  - Photos: product, store and document images the user chooses to upload.
  - App activity / device IDs: push notification token (Firebase Cloud Messaging) to send order alerts.
  - Financial info: order amounts and payment records (no card numbers are collected by the app).
  - Encrypted in transit: yes (HTTPS). Users can request deletion: yes, once the deletion URL above exists.
  - Not sold to third parties; not used for advertising.
- **Financial features** (App content › Financial features): tick **"My app doesn't provide any financial features"**. The app only records payments and credit that the seller handles outside the app (cash, UPI, card, udhaar). It doesn't process payments, hold money, lend, or connect to a payment gateway. If a reviewer asks about "customer credit", call it bookkeeping: the seller records what their own customers owe them.
- **Content rating** questionnaire: business tool, no user-to-user public content, no gambling or mature content.
- **Target audience**: 18+ (business users).
- **Ads**: the app contains no ads.
- **Version**: `android/app/build.gradle` has `versionCode 1`, `versionName "1.0"`; the menu footer reads "v0.0.1", which may be worth aligning before release.
