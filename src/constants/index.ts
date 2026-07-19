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
  Draft: { label: 'Draft', color: 'bg-surface-alt text-text-secondary', dot: 'bg-text-muted' },
  Purchased: { label: 'Purchased', color: 'bg-info-bg text-info', dot: 'bg-info' },
  Selling: { label: 'Selling', color: 'bg-success-bg text-success', dot: 'bg-success' },
  'Almost Finished': {
    label: 'Almost Finished',
    color: 'bg-warning-bg text-warning',
    dot: 'bg-warning',
  },
  Completed: {
    label: 'Completed',
    color: 'bg-accent/15 text-accent-muted',
    dot: 'bg-accent',
  },
  Archived: { label: 'Archived', color: 'bg-surface-alt text-text-muted', dot: 'bg-border-strong' },
};

export const WALLET_META: Record<
  WalletName,
  { label: string; color: string; bg: string; ring: string; icon: string }
> = {
  Needs: {
    label: 'Needs',
    color: 'text-info',
    bg: 'bg-info-bg',
    ring: 'ring-info/20',
    icon: 'Wallet',
  },
  Savings: {
    label: 'Savings',
    color: 'text-success',
    bg: 'bg-success-bg',
    ring: 'ring-success/20',
    icon: 'PiggyBank',
  },
  Growth: {
    label: 'Growth',
    color: 'text-accent-muted',
    bg: 'bg-accent/15',
    ring: 'ring-accent/20',
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
