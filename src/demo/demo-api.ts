import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';

// Demo mode (development only): answers the app's API calls with a made-up
// store, so Play Store screenshots show the real screens without anyone's
// real data. Turned on with DEMO_MODE in ./flag.ts; release builds never use it.

const STORE = { id: 'demo-store', name: 'Mehta Kirana Store', code: 'MKS-PUNE', status: 'ACTIVE' };

const PERMISSIONS = [
  'orders:manage',
  'customers:manage',
  'customer-credit:manage',
  'products-master:manage',
  'product-inventory:manage',
  'store-operations:manage',
  'store-profit:view',
  'store-expenses:view',
  'store-notes:view',
  'pending-stock:manage',
  'stores:view',
  'users:view',
  'users:create',
  'coupons-master:manage',
];

const now = new Date();
const at = (daysAgo: number, hour = 11, minute = 0) => {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};
const day = (daysAgo: number) => at(daysAgo).slice(0, 10);

const CUSTOMERS = [
  { id: 'c1', idd: 'CUS7KQ2PRIYA', firstName: 'Priya', lastName: 'Nair', phone: '9876500101', orders: 18, spent: 24860, credit: 0, overdue: 0, last: 0 },
  { id: 'c2', idd: 'CUS4HZ8ARJUN', firstName: 'Arjun', lastName: 'Desai', phone: '9876500102', orders: 12, spent: 15420, credit: 1250, overdue: 0, last: 0 },
  { id: 'c3', idd: 'CUS9MD3KAVIT', firstName: 'Kavita', lastName: 'Joshi', phone: '9876500103', orders: 22, spent: 31975, credit: 0, overdue: 0, last: 1 },
  { id: 'c4', idd: 'CUS2LX6IMRAN', firstName: 'Imran', lastName: 'Shaikh', phone: '9876500104', orders: 9, spent: 11240, credit: 2400, overdue: 800, last: 2 },
  { id: 'c5', idd: 'CUS6PT1NEHAK', firstName: 'Neha', lastName: 'Kulkarni', phone: '9876500105', orders: 15, spent: 19680, credit: 0, overdue: 0, last: 1 },
  { id: 'c6', idd: 'CUS8RW5SURES', firstName: 'Suresh', lastName: 'Patil', phone: '9876500106', orders: 7, spent: 8930, credit: 650, overdue: 0, last: 3 },
  { id: 'c7', idd: 'CUS3QN7MEERA', firstName: 'Meera', lastName: 'Iyer', phone: '9876500107', orders: 11, spent: 13560, credit: 0, overdue: 0, last: 4 },
  { id: 'c8', idd: 'CUS5VB4ROHAN', firstName: 'Rohan', lastName: 'Gupta', phone: '9876500108', orders: 6, spent: 7215, credit: 0, overdue: 0, last: 5 },
];

const customerRow = (c: (typeof CUSTOMERS)[number]) => ({
  id: c.id,
  idd: c.idd,
  firstName: c.firstName,
  lastName: c.lastName,
  email: `${c.firstName.toLowerCase()}.${c.lastName.toLowerCase()}@example.com`,
  countryCode: '91',
  phoneNumber: c.phone,
  status: 'ACTIVE',
  createdAt: at(120),
  orderCount: c.orders,
  lifetimePurchase: c.spent,
  lastOrderAt: at(c.last, 10),
  creditOutstanding: c.credit,
  creditOverdue: c.overdue,
});

const ITEMS: Record<string, { name: string; variant: string; price: number; mrp: number }> = {
  rice: { name: 'Premium Basmati Rice', variant: '5 kg', price: 649, mrp: 725 },
  atta: { name: 'Whole Wheat Atta', variant: '10 kg', price: 465, mrp: 520 },
  oil: { name: 'Refined Sunflower Oil', variant: '1 L', price: 155, mrp: 175 },
  dal: { name: 'Toor Dal', variant: '1 kg', price: 168, mrp: 180 },
  sugar: { name: 'Sugar', variant: '1 kg', price: 46, mrp: 48 },
  tea: { name: 'Assam Tea Leaves', variant: '500 g', price: 285, mrp: 310 },
  ghee: { name: 'Pure Cow Ghee', variant: '1 L', price: 610, mrp: 650 },
  soap: { name: 'Neem Bath Soap', variant: 'Pack of 4', price: 172, mrp: 196 },
};

type Line = [keyof typeof ITEMS, number];
const ORDERS: { id: string; num: string; c: number; status: string; minsAgo: number; lines: Line[]; pay: string; method: string; credit?: number }[] = [
  { id: 'o1', num: 'ORD-20261111-K7M2QX', c: 0, status: 'CREATED', minsAgo: 6, lines: [['rice', 1], ['oil', 2], ['dal', 2]], pay: 'PENDING', method: 'CASH' },
  { id: 'o2', num: 'ORD-20261111-P3D8WN', c: 1, status: 'CONFIRMED', minsAgo: 24, lines: [['atta', 1], ['sugar', 3], ['tea', 1]], pay: 'PENDING', method: 'UPI' },
  { id: 'o3', num: 'ORD-20261111-R9T4BC', c: 2, status: 'PACKED', minsAgo: 51, lines: [['ghee', 1], ['rice', 1], ['soap', 2]], pay: 'PAID', method: 'UPI' },
  { id: 'o4', num: 'ORD-20261111-L2H6YV', c: 4, status: 'DELIVERED', minsAgo: 95, lines: [['dal', 3], ['oil', 1], ['sugar', 2]], pay: 'PAID', method: 'CASH' },
  { id: 'o5', num: 'ORD-20261111-F5J1ZA', c: 3, status: 'DELIVERED', minsAgo: 140, lines: [['atta', 2], ['ghee', 1], ['tea', 1]], pay: 'PARTIAL', method: 'CASH', credit: 1200 },
  { id: 'o6', num: 'ORD-20261110-N8C3UE', c: 6, status: 'DELIVERED', minsAgo: 60 * 20, lines: [['rice', 2], ['dal', 2]], pay: 'PAID', method: 'CARD' },
  { id: 'o7', num: 'ORD-20261110-W4S7GK', c: 5, status: 'DELIVERED', minsAgo: 60 * 23, lines: [['soap', 3], ['tea', 1], ['sugar', 2]], pay: 'PAID', method: 'UPI' },
  { id: 'o8', num: 'ORD-20261109-B6V9MD', c: 7, status: 'CANCELLED', minsAgo: 60 * 44, lines: [['oil', 3]], pay: 'PENDING', method: 'CASH' },
];

const ago = (mins: number) => new Date(now.getTime() - mins * 60000).toISOString();
const total = (lines: Line[]) => lines.reduce((s, [k, q]) => s + ITEMS[k].price * q, 0);

function orderRow(o: (typeof ORDERS)[number]) {
  const c = CUSTOMERS[o.c];
  const amount = total(o.lines);
  const paid = o.pay === 'PAID' ? amount : o.pay === 'PARTIAL' ? amount - (o.credit ?? 0) : 0;
  return {
    id: o.id,
    uniqueOrderId: o.num,
    orderStatus: o.status,
    orderStatusTimestamp: ago(o.minsAgo - 2),
    fulfillmentType: 'PICKUP',
    orderType: 'ONLINE',
    paymentStatus: o.pay,
    paymentMode: o.method,
    customerName: `${c.firstName} ${c.lastName}`,
    customerPhone: `+91 ${c.phone.slice(0, 5)} ${c.phone.slice(5)}`,
    customerAddress: null,
    customerNote: o.id === 'o2' ? 'Please pack the atta separately.' : null,
    remarks: null,
    totalAmount: amount,
    clientAmount: amount,
    subtotal: amount,
    taxAmount: 0,
    discountAmount: 0,
    couponDiscount: 0,
    cancellationReason: o.status === 'CANCELLED' ? 'Customer changed the order' : null,
    store: { name: STORE.name },
    createdAt: ago(o.minsAgo),
    payments: paid ? [{ method: o.method, amount: paid }] : [],
    creditOutstanding: o.credit ?? null,
    items: o.lines.map(([k, q], i) => ({
      id: `${o.id}-${i}`,
      productName: ITEMS[k].name,
      variantLabel: ITEMS[k].variant,
      sku: k.toUpperCase(),
      quantity: q,
      unitPrice: ITEMS[k].mrp,
      finalPrice: ITEMS[k].price,
      imageUrl: null,
    })),
  };
}

const TREND = [38200, 41850, 36900, 45600, 52300, 61200, 48700, 44100, 47950, 53400, 58800, 66250, 54900, 49800];

const salesOrders = ORDERS.filter(o => o.status !== 'CANCELLED').map(o => ({
  id: o.id,
  orderNumber: o.num,
  orderedAt: ago(o.minsAgo),
  orderStatus: o.status,
  customerName: `${CUSTOMERS[o.c].firstName} ${CUSTOMERS[o.c].lastName}`,
  customerPhone: null,
  paymentMethod: o.method,
  staffName: 'Anil Mehta',
  items: o.lines.length,
  units: o.lines.reduce((s, [, q]) => s + q, 0),
  amount: total(o.lines),
  profit: Math.round(total(o.lines) * 0.14),
}));

const metrics = (sales: number, orders: number, expenses: number, costRatio = 0.83) => {
  const cost = Math.round(sales * costRatio);
  return {
    orders,
    sales,
    expenses,
    collection: Math.round(sales * 0.94),
    cashCollection: Math.round(sales * 0.41),
    onlineCollection: Math.round(sales * 0.53),
    productCost: cost,
    grossProfit: sales - cost,
    netProfit: sales - cost - expenses,
    grossMargin: Math.round(((sales - cost) / sales) * 1000) / 10,
    netMargin: Math.round(((sales - cost - expenses) / sales) * 1000) / 10,
    linesWithoutCost: 0,
  };
};

const STOCK = [
  { name: 'Refined Sunflower Oil', sku: 'OIL-1L', combo: { Size: '1 L' }, onHand: 4, min: 12, health: 'low', pending: 24 },
  { name: 'Pure Cow Ghee', sku: 'GHEE-1L', combo: { Size: '1 L' }, onHand: 0, min: 6, health: 'out', pending: 0 },
  { name: 'Toor Dal', sku: 'DAL-1KG', combo: { Pack: '1 kg' }, onHand: 7, min: 15, health: 'low', pending: 0 },
  { name: 'Assam Tea Leaves', sku: 'TEA-500', combo: { Pack: '500 g' }, onHand: 3, min: 10, health: 'low', pending: 12 },
  { name: 'Premium Basmati Rice', sku: 'RICE-5KG', combo: { Pack: '5 kg' }, onHand: 26, min: 10, health: 'healthy', pending: 0 },
  { name: 'Whole Wheat Atta', sku: 'ATTA-10', combo: { Pack: '10 kg' }, onHand: 18, min: 8, health: 'healthy', pending: 0 },
];

const CREDITS = [
  { id: 'cr1', idd: 'CR-1042', c: 3, order: 'ORD-20261111-F5J1ZA', amount: 1200, paid: 0, due: -6, status: 'PENDING' },
  { id: 'cr2', idd: 'CR-1038', c: 3, order: 'ORD-20261029-H2K8LP', amount: 1600, paid: 400, due: 3, status: 'OVERDUE' },
  { id: 'cr3', idd: 'CR-1036', c: 1, order: 'ORD-20261101-M4N6QS', amount: 1250, paid: 0, due: -2, status: 'PENDING' },
  { id: 'cr4', idd: 'CR-1031', c: 5, order: 'ORD-20261027-T7Y2RE', amount: 1150, paid: 500, due: -1, status: 'PARTIAL' },
  { id: 'cr5', idd: 'CR-1024', c: 0, order: 'ORD-20261018-Z1X5CV', amount: 900, paid: 900, due: 10, status: 'PAID' },
];

const creditRow = (r: (typeof CREDITS)[number]) => {
  const c = CUSTOMERS[r.c];
  return {
    id: r.id,
    idd: r.idd,
    customerName: `${c.firstName} ${c.lastName}`,
    customerPhone: `+91 ${c.phone.slice(0, 5)} ${c.phone.slice(5)}`,
    customerId: c.id,
    orderId: 'o5',
    orderNumber: r.order,
    storeName: STORE.name,
    creditAmount: r.amount,
    paidAmount: r.paid,
    outstandingAmount: r.amount - r.paid,
    dueDate: day(r.due),
    status: r.status,
    overdueDays: r.due > 0 && r.status !== 'PAID' ? r.due : 0,
    dueInDays: r.due <= 0 ? -r.due : null,
    lastPaymentDate: r.paid ? day(r.due + 4) : null,
    lastPaymentAmount: r.paid || null,
  };
};

type Handler = (params: Record<string, unknown>, match: RegExpMatchArray) => unknown;

const ROUTES: [string, RegExp, Handler][] = [
  [
    'GET',
    /^\/auth\/me$/,
    () => ({ id: 'demo-user', firstName: 'Anil', lastName: 'Mehta', email: 'anil@mehtakirana.example', userType: 'SELLER', status: 'ACTIVE', roles: [{ roleTitle: 'Store Owner' }], permissions: PERMISSIONS }),
  ],
  ['GET', /^\/stores$/, () => [STORE]],
  ['GET', /^\/storefront\/banners$/, () => []],
  [
    'GET',
    /^\/reports\/overview$/,
    () => ({ storeName: STORE.name, kpis: { sales: { value: 18640, previous: 15210 }, orders: { value: 27, previous: 22 }, customers: { value: 342, previous: 336 }, products: { value: 486, previous: 480 } } }),
  ],
  ['GET', /^\/customers\/summary$/, () => ({ total: 342, newThisMonth: 28, top: 40, withCredit: 4, creditOutstanding: 5850 })],
  [
    'GET',
    /^\/customers$/,
    p => {
      const view = p.view;
      const rows = view === 'credit' ? CUSTOMERS.filter(c => c.credit > 0).sort((a, b) => b.credit - a.credit) : view === 'top' ? [...CUSTOMERS].sort((a, b) => b.spent - a.spent) : CUSTOMERS;
      return { items: rows.map(customerRow), total: view === 'credit' ? 4 : view === 'top' ? 40 : 342, page: Number(p.page ?? 1), limit: Number(p.limit ?? 50) };
    },
  ],
  [
    'GET',
    /^\/notifications$/,
    () => ({
      items: [
        { id: 'n1', type: 'ORDER', title: 'New order', message: 'Priya Nair placed an order of ₹1,317', link: null, data: { orderId: 'o1' }, readAt: null, createdAt: ago(6) },
        { id: 'n2', type: 'CREDIT', title: 'Credit overdue', message: 'Imran Shaikh owes ₹1,200 — 3 days overdue', link: null, data: null, readAt: null, createdAt: ago(90) },
        { id: 'n3', type: 'STOCK', title: 'Low stock', message: 'Pure Cow Ghee is out of stock', link: null, data: null, readAt: null, createdAt: ago(240) },
      ],
      unreadCount: 3,
      total: 3,
      page: 1,
      limit: 20,
    }),
  ],
  ['GET', /^\/orders$/, () => ORDERS.map(orderRow)],
  ['GET', /^\/orders\/([^/]+)$/, (_p, m) => orderRow(ORDERS.find(o => o.id === m[1]) ?? ORDERS[0])],
  [
    'GET',
    /^\/orders\/([^/]+)\/payments$/,
    (_p, m) => {
      const o = orderRow(ORDERS.find(x => x.id === m[1]) ?? ORDERS[0]);
      const paid = o.payments.reduce((s, x) => s + x.amount, 0);
      return {
        orderId: o.id,
        orderNumber: o.uniqueOrderId,
        paymentStatus: o.paymentStatus,
        creditAllowed: true,
        maxCreditDays: 15,
        paymentPreference: null,
        creditRequest: null,
        totalAmount: o.totalAmount,
        paidAtOrder: paid,
        onCredit: o.creditOutstanding ?? 0,
        amountDue: o.orderStatus === 'DELIVERED' ? 0 : o.totalAmount - paid,
        payments: o.payments.map((x, i) => ({ id: `${o.id}-p${i}`, method: x.method, amount: x.amount, remarks: null, paidAt: o.createdAt })),
        credit: null,
      };
    },
  ],
  ['GET', /^\/orders\/[^/]+\/(invoices|receipts)$/, () => []],
  ['GET', /^\/stores\/[^/]+\/operations\/overview$/, () => ({ canViewProfit: true, period: metrics(486250, 612, 38400), previous: metrics(431800, 571, 36900, 0.845), alerts: { lowStock: 3, outOfStock: 1, pendingStockOrders: 2, delayedStockOrders: 0 } })],
  [
    'GET',
    /^\/stores\/[^/]+\/operations\/trend$/,
    () => ({
      canViewProfit: true,
      points: TREND.map((sales, i) => {
        const m = metrics(sales, Math.round(sales / 790), Math.round(sales * 0.07));
        return { date: day(TREND.length - 1 - i), orders: m.orders, sales, expenses: m.expenses, grossProfit: m.grossProfit, netProfit: m.netProfit };
      }),
    }),
  ],
  [
    'GET',
    /^\/stores\/[^/]+\/operations\/sales\/breakdown$/,
    () => ({
      byPaymentMethod: [
        { method: 'UPI', orders: 318, sales: 254300 },
        { method: 'CASH', orders: 221, sales: 168900 },
        { method: 'CARD', orders: 48, sales: 41250 },
        { method: 'CREDIT', orders: 25, sales: 21800 },
      ],
      byCategory: [
        { categoryId: 'k1', name: 'Rice & Grains', orders: 214, units: 402, sales: 142600, profit: 17100 },
        { categoryId: 'k2', name: 'Edible Oils & Ghee', orders: 188, units: 351, sales: 118900, profit: 13080 },
        { categoryId: 'k3', name: 'Atta & Flours', orders: 160, units: 233, sales: 92400, profit: 11550 },
        { categoryId: 'k4', name: 'Dals & Pulses', orders: 149, units: 402, sales: 67550, profit: 9460 },
        { categoryId: 'k5', name: 'Tea & Beverages', orders: 102, units: 140, sales: 38900, profit: 6220 },
      ],
    }),
  ],
  ['GET', /^\/stores\/[^/]+\/operations\/sales$/, () => ({ groupBy: 'none', canViewProfit: true, total: salesOrders.length, items: salesOrders })],
  [
    'GET',
    /^\/stores\/[^/]+\/operations\/stock-health$/,
    p => {
      const filter = p.filter;
      const rows = STOCK.filter(s => !filter || filter === 'all' || s.health === filter);
      return {
        kpis: { totalSkus: 486, totalProducts: 312, lowStock: 3, outOfStock: 1, healthy: 482 },
        items: rows.map((s, i) => ({
          variantId: `v${i}`,
          productId: `p${i}`,
          productName: s.name,
          sku: s.sku,
          combination: s.combo,
          uom: 'PCS',
          onHand: s.onHand,
          available: s.onHand,
          minimum: s.min,
          reorder: s.min,
          warehouses: 1,
          inventoryId: `inv${i}`,
          health: s.health,
          imageUrl: null,
          lastSoldAt: at(i % 3, 18),
          pendingQty: s.pending,
          suggestedReorder: Math.max(0, s.min * 2 - s.onHand - s.pending),
        })),
        total: rows.length,
        page: 1,
        limit: 20,
      };
    },
  ],
  ['GET', /^\/stores\/[^/]+\/operations\/stock-orders$/, () => ({ items: [], total: 0, page: 1, limit: 20, counts: { open: 0, delayed: 0, openAmount: 0, received: 0, cancelled: 0, all: 0 } })],
  ['GET', /^\/customer-credit\/summary$/, () => ({ totalCredit: 48600, totalCollected: 42750, totalOutstanding: 5850, dueThisWeek: 2450, overdueAmount: 2400, overdueCount: 2, customersWithOutstanding: 4 })],
  [
    'GET',
    /^\/customer-credit$/,
    p => {
      const f = p.filter;
      const rows = CREDITS.filter(r =>
        !f || f === 'all' ? true : f === 'overdue' ? r.status === 'OVERDUE' : f === 'paid' ? r.status === 'PAID' : f === 'partial' ? r.status === 'PARTIAL' : f === 'pending' ? r.status === 'PENDING' : r.status !== 'PAID',
      );
      return { items: rows.map(creditRow), total: rows.length };
    },
  ],
  ['GET', /^\/subscriptions\/me$/, () => ({ stage: 'ACTIVE', planCode: 'GROWTH', planName: 'Growth', status: 'ACTIVE' })],
];

function payload(data: unknown) {
  return { success: true, code: 200, message: 'OK', data };
}

/** Answers from the demo store; anything else gets an empty answer (logged, so missing screens are easy to spot). */
export const demoAdapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  const method = (config.method ?? 'get').toUpperCase();
  const path = (config.url ?? '').replace(/^https?:\/\/[^/]+/, '').split('?')[0];
  const params = (config.params ?? {}) as Record<string, unknown>;
  let data: unknown = method === 'GET' ? [] : {};
  let found = false;
  for (const [m, re, handler] of ROUTES) {
    const match = path.match(re);
    if (m === method && match) {
      data = handler(params, match);
      found = true;
      break;
    }
  }
  if (!found) console.log(`[demo] no data for ${method} ${path}`);
  // A short wait, like a real request, so loading states settle as they do live.
  await new Promise<void>(resolve => setTimeout(resolve, 120));
  return { data: payload(data), status: 200, statusText: 'OK', headers: {}, config, request: {} };
};
