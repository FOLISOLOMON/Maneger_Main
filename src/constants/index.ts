// Veloura Manager V2 — App Constants
// Central place for category lists, labels, and configuration that does not
// change at runtime. Keeps components free of magic strings.

import type {
  BatchStatus,
  ExpenseType,
  PaymentMethod,
  WalletName,
  WalletTxType,
} from '../types';

export const BATCH_STATUSES: BatchStatus[] = [
  'Draft',
  'Purchased',
  'Selling',
  'Almost Finished',
  'Completed',
  'Archived',
];

export const ACTIVE_BATCH_STATUSES: BatchStatus[] = [
  'Draft',
  'Purchased',
  'Selling',
  'Almost Finished',
];

export const WALLET_NAMES: WalletName[] = ['Needs', 'Savings', 'Growth'];

export const WALLET_TX_TYPES: WalletTxType[] = [
  'Allocation',
  'Expense',
  'Transfer',
  'Withdrawal',
  'Adjustment',
];

export const PAYMENT_METHODS: PaymentMethod[] = [
  'Cash',
  'Mobile Money',
  'Bank Transfer',
  'Card',
  'Credit',
];

export const EXPENSE_TYPES: ExpenseType[] = ['Batch', 'Business'];

export const BATCH_EXPENSE_CATEGORIES = [
  'Transport',
  'Fuel',
  'Loading',
  'Packaging',
  'Delivery',
  'Import Duty',
  'Market Levy',
  'Insurance',
  'Other',
];

export const BUSINESS_EXPENSE_CATEGORIES = [
  'Shop Rent',
  'WiFi',
  'Electricity',
  'Water',
  'Printer',
  'Office Supplies',
  'Salary',
  'Airtime',
  'Repairs',
  'Marketing',
  'Other',
];

export const PRODUCT_CATEGORIES = [
  'EDP',
  'EDT',
  'Oil Perfume',
  'Body Spray',
  'Attar',
  'Tester',
  'Set',
  'Other',
];

export const CURRENCIES = [
  { code: 'GHS', symbol: '₵', label: 'Ghana Cedi (₵)' },
  { code: 'USD', symbol: '$', label: 'US Dollar ($)' },
  { code: 'NGN', symbol: '₦', label: 'Nigerian Naira (₦)' },
  { code: 'KES', symbol: 'KSh', label: 'Kenyan Shilling (KSh)' },
  { code: 'ZAR', symbol: 'R', label: 'South African Rand (R)' },
  { code: 'GBP', symbol: '£', label: 'British Pound (£)' },
  { code: 'EUR', symbol: '€', label: 'Euro (€)' },
];

export const BATCH_STATUS_META: Record<
  BatchStatus,
  { label: string; color: string; dot: string }
> = {
  Draft: { label: 'Draft', color: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
  Purchased: { label: 'Purchased', color: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
  Selling: { label: 'Selling', color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  'Almost Finished': {
    label: 'Almost Finished',
    color: 'bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
  },
  Completed: {
    label: 'Completed',
    color: 'bg-violet-50 text-violet-700',
    dot: 'bg-violet-500',
  },
  Archived: { label: 'Archived', color: 'bg-zinc-100 text-zinc-500', dot: 'bg-zinc-400' },
};

export const WALLET_META: Record<
  WalletName,
  { label: string; color: string; bg: string; ring: string; icon: string }
> = {
  Needs: {
    label: 'Needs',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    ring: 'ring-blue-200',
    icon: 'Wallet',
  },
  Savings: {
    label: 'Savings',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    ring: 'ring-emerald-200',
    icon: 'PiggyBank',
  },
  Growth: {
    label: 'Growth',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    ring: 'ring-amber-200',
    icon: 'TrendingUp',
  },
};

export const DEFAULT_WALLET_PERCENTAGES = {
  needs: 40,
  savings: 35,
  growth: 25,
};

export const DEFAULT_LOW_STOCK_THRESHOLD = 5;
export const DEFAULT_COMPLETION_THRESHOLD = 10;

export const ID_PREFIXES = {
  supplier: 'SUP',
  batch: 'BAT',
  product: 'PRD',
  sale: 'SAL',
  expense: 'EXP',
  customer: 'CUS',
  walletTx: 'WTX',
  notification: 'NOT',
  activity: 'LOG',
} as const;

export const PAGE_TITLES = {
  dashboard: 'Dashboard',
  inventory: 'Inventory',
  sales: 'Sales',
  reports: 'Reports',
  customers: 'Customers',
  suppliers: 'Suppliers',
  expenses: 'Expenses',
  wallets: 'Wallets',
  settings: 'Settings',
  notifications: 'Notifications',
} as const;

export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: 'LayoutDashboard' },
  { to: '/inventory', label: 'Inventory', icon: 'Package' },
  { to: '/sales', label: 'Sales', icon: 'ShoppingCart' },
  { to: '/reports', label: 'Reports', icon: 'BarChart3' },
] as const;

export const MORE_ITEMS = [
  { to: '/customers', label: 'Customers', icon: 'Users' },
  { to: '/suppliers', label: 'Suppliers', icon: 'Truck' },
  { to: '/expenses', label: 'Expenses', icon: 'Receipt' },
  { to: '/wallets', label: 'Wallets', icon: 'Wallet' },
  { to: '/notifications', label: 'Notifications', icon: 'Bell' },
  { to: '/settings', label: 'Settings', icon: 'Settings' },
] as const;
