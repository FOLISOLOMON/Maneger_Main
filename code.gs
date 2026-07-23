/**
 * Veloura Manager Apps Script
 *
 * Google Sheets-backed backend exposing a JSON HTTP API for the Veloura Manager
 * app. It replaces the previous Supabase backend. The script creates the required
 * sheets, exposes generic CRUD helpers over a HTTP API (doGet/doPost), and
 * re-implements the business logic previously held in Postgres RPCs:
 *   - recordSale   : validate stock, decrement product, recompute batch aggregates
 *   - voidSale     : restore stock, recompute batch aggregates
 *   - closeBatch   : finalize + allocate net profit into Needs/Savings/Growth wallets
 *   - recomputeBatch : recompute stored batch aggregates from products + sales + expenses
 *   - createExpense : insert expense, recompute batch, create wallet outflow
 *
 * Deploy: Extensions > Apps Script > Deploy > New deployment > Web app
 *   Execute as: Me
 *   Who has access: Anyone
 * Then copy the Web App URL into the app's VITE_SHEETS_API_URL.
 */

const SHEET_DEFINITIONS = {
  Settings: [
    'id',
    'business_name',
    'owner_name',
    'phone',
    'email',
    'business_address',
    'currency',
    'currency_symbol',
    'theme',
    'low_stock_threshold',
    'batch_completion_threshold',
    'needs_percentage',
    'savings_percentage',
    'growth_percentage',
    'created_at',
    'updated_at'
  ],
  Suppliers: [
    'id',
    'supplier_code',
    'supplier_name',
    'phone',
    'email',
    'location',
    'contact_person',
    'notes',
    'status',
    'created_at',
    'updated_at'
  ],
  InventoryBatches: [
    'id',
    'batch_code',
    'batch_name',
    'supplier_id',
    'purchase_date',
    'expected_arrival',
    'arrival_date',
    'purchase_cost',
    'transport_cost',
    'loading_cost',
    'import_duty',
    'insurance',
    'other_costs',
    'total_batch_cost',
    'status',
    'completion_percentage',
    'remaining_stock',
    'gross_revenue',
    'gross_profit',
    'net_profit',
    'roi',
    'notes',
    'created_at',
    'updated_at'
  ],
  Products: [
    'id',
    'product_code',
    'batch_id',
    'product_name',
    'brand',
    'category',
    'sku',
    'barcode',
    'cost_price',
    'selling_price',
    'initial_stock',
    'current_stock',
    'reorder_level',
    'description',
    'image_url',
    'status',
    'created_at',
    'updated_at'
  ],
  Customers: [
    'id',
    'customer_code',
    'customer_name',
    'phone',
    'email',
    'location',
    'gender',
    'birthday',
    'notes',
    'status',
    'created_at',
    'updated_at'
  ],
  Sales: [
    'id',
    'sale_code',
    'batch_id',
    'product_id',
    'customer_id',
    'sale_date',
    'quantity',
    'unit_cost',
    'unit_price',
    'discount',
    'discount_type',
    'total_cost',
    'total_sale',
    'profit',
    'payment_method',
    'reference_number',
    'status',
    'notes',
    'created_at',
    'amount_paid',
    'balance',
    'payment_status'
  ],
  Expenses: [
    'id',
    'expense_code',
    'expense_type',
    'batch_id',
    'category',
    'expense_name',
    'amount',
    'expense_date',
    'description',
    'receipt_url',
    'created_at'
  ],
  WalletTransactions: [
    'id',
    'transaction_code',
    'wallet',
    'transaction_type',
    'batch_id',
    'reference_id',
    'amount',
    'balance_after',
    'reason',
    'created_by',
    'created_at'
  ],
  Payments: [
    'id',
    'payment_code',
    'sale_id',
    'customer_id',
    'amount',
    'payment_method',
    'payment_date',
    'notes',
    'created_at'
  ],
  Notifications: [
    'id',
    'notification_code',
    'type',
    'title',
    'message',
    'reference_type',
    'reference_id',
    'priority',
    'read',
    'created_at'
  ],
  ActivityLogs: [
    'id',
    'log_code',
    'actor',
    'action',
    'module',
    'reference_id',
    'description',
    'created_at'
  ]
};

const API_KEY = ''; // Optional shared secret. Set a value and the app must send ?key= or header x-api-key.

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Veloura Manager')
    .addItem('Initialize sheets', 'initializeVelouraSheets')
    .addItem('Create sample batch', 'createSampleBatch')
    .addItem('Backfill payment fields', 'backfillPaymentsAction')
    .addToUi();
}

// ============================================================
// HTTP API ENTRY POINTS
// ============================================================

function doGet(e) {
  // All requests are GET with a JSON-encoded `params` query string, plus a
  // flat `action` (and optional `key`). Decode the params object so nested
  // payloads survive the query string and the browser never sends a CORS
  // preflight.
  return handleRequest(decodeRequestParams(e), 'GET');
}

function doPost(e) {
  let params;
  const body = e && e.postData && e.postData.contents;
  if (body) {
    try {
      params = JSON.parse(body);
    } catch (err) {
      params = getParamsFromRequest(e);
    }
  } else {
    params = getParamsFromRequest(e);
  }
  return handleRequest(params, 'POST');
}

function doOptions(e) {
  return jsonResponse({ ok: true }, 200);
}

function getParamsFromRequest(e) {
  const params = {};
  if (e && e.parameter) {
    for (const key in e.parameter) {
      params[key] = e.parameter[key];
    }
  }
  return params;
}

// Decodes a GET request: pulls the flat `action`/`key` and the JSON-encoded
// `params` object. Used so the browser can call the API with simple GETs and
// avoid CORS preflight requests.
function decodeRequestParams(e) {
  const flat = getParamsFromRequest(e);
  const decoded = Object.assign({}, flat);
  if (flat.params) {
    try {
      const nested = JSON.parse(flat.params);
      for (const key in nested) {
        decoded[key] = nested[key];
      }
    } catch (err) {
      // leave flat params as-is if not JSON
    }
  }
  return decoded;
}

// Dispatch a single action to its handler and return the raw result. Shared by
// handleRequest (one action per HTTP call) and the 'batch' action (many actions
// per HTTP call). The request-scoped _recordCache keeps repeated reads cheap.
function runAction(action, params) {
  let result;
  switch (action) {
      // ---- generic CRUD ----
      case 'list':
        result = getRecords(params.sheet);
        break;
      case 'get':
        result = getRecordById(params.sheet, params.id);
        break;
      case 'create':
        result = createRecord(params.sheet, params.payload || {});
        break;
      case 'update':
        result = updateRecord(params.sheet, params.id, params.payload || {});
        break;
      case 'delete':
        result = deleteRecord(params.sheet, params.id);
        break;

      // ---- joined reads used by the UI ----
      case 'listBatches':
        result = joinBatches(getRecords('InventoryBatches'));
        break;
      case 'getBatch':
        result = joinBatch(getRecordById('InventoryBatches', params.id));
        break;
      case 'listProducts':
        result = joinProducts(getRecords('Products'));
        break;
      case 'listProductsByBatch':
        result = joinProducts(getRecords('Products').filter(function (p) {
          return String(p.batch_id || '') === String(params.batchId || '');
        }));
        break;
      case 'listSales':
        result = joinSales(getRecords('Sales'));
        break;
      case 'listSalesByBatch':
        result = joinSales(getRecords('Sales').filter(function (s) {
          return String(s.batch_id || '') === String(params.batchId || '');
        }));
        break;
      case 'listSalesByCustomer':
        result = joinSales(getRecords('Sales').filter(function (s) {
          return String(s.customer_id || '') === String(params.customerId || '');
        }));
        break;
      case 'listExpenses':
        result = joinExpenses(getRecords('Expenses'));
        break;
      case 'listExpensesByBatch':
        result = getRecords('Expenses').filter(function (ex) {
          return String(ex.batch_id || '') === String(params.batchId || '');
        });
        break;
      case 'listWalletTransactions':
        result = joinWalletTransactions(getRecords('WalletTransactions'));
        break;
      case 'listPayments':
        result = joinPayments(getRecords('Payments'));
        break;
      case 'listSettings':
        result = getRecords('Settings')[0] || null;
        break;

      // ---- business actions ----
      case 'createInventoryBatch':
        result = createInventoryBatch(params.batchPayload || {}, params.productPayloads || []);
        break;
      case 'recordSale':
        result = recordSaleAction(params);
        break;
      case 'voidSale':
        result = voidSaleAction(params.saleId);
        break;
      case 'closeBatch':
        result = closeBatchAction(params.batchId);
        break;
      case 'recomputeBatch':
        result = recomputeBatch(params.batchId);
        break;
      case 'createBatchAction':
        result = createBatchAction(params.payload || {});
        break;
      case 'createProductAction':
        result = createProductAction(params.payload || {});
        break;
      case 'createExpense':
        result = createExpenseAction(params);
        break;
      case 'allocateWallet':
        result = createRecord('WalletTransactions', Object.assign({
          transaction_type: 'Allocation',
          amount: 0,
          created_by: 'System'
        }, params.walletPayload || {}));
        break;
      case 'recordPayment':
        result = recordPaymentAction(params);
        break;
      case 'backfillPayments':
        result = backfillPaymentsAction();
        break;
      case 'logActivity':
        result = logActivity(
          params.actor,
          params.actionName,
          params.moduleName,
          params.referenceId,
          params.description
        );
        break;
      case 'createSampleBatch':
        result = createSampleBatch();
        break;
      case 'markNotificationRead':
        result = markNotificationReadAction(params.id);
        break;
      case 'markAllNotificationsRead':
        result = markAllNotificationsReadAction();
        break;
      case 'createNotification': {
        const notifPayload = params.payload || {};
        result = createRecord('Notifications', {
          type: notifPayload.type || 'info',
          title: notifPayload.title || 'Notification',
          message: notifPayload.message || '',
          reference_type: notifPayload.reference_type || '',
          reference_id: notifPayload.reference_id || '',
          priority: notifPayload.priority || 'Medium',
          read: false,
          created_at: new Date().toISOString()
        });
        break;
      }
      // ---- batched snapshots: return everything a page needs in ONE request ----
      case 'getDashboardSnapshot':
        result = {
          settings: getRecords('Settings')[0] || null,
          batches: joinBatches(getRecords('InventoryBatches')),
          products: joinProducts(getRecords('Products')),
          sales: joinSales(Array.isArray(params.sales) ? params.sales : getRecords('Sales').slice(0, params.salesLimit || 0)),
          expenses: joinExpenses(Array.isArray(params.expenses) ? params.expenses : getRecords('Expenses').slice(0, params.expensesLimit || 0)),
          walletTx: joinWalletTransactions(getRecords('WalletTransactions').slice(0, params.walletTxLimit || 0)),
          payments: joinPayments(getRecords('Payments').slice(0, params.paymentsLimit || 0)),
          notifications: getRecords('Notifications').slice(0, params.notificationsLimit || 0)
        };
        break;
      case 'getInventorySnapshot':
        result = {
          batches: joinBatches(getRecords('InventoryBatches')),
          products: joinProducts(getRecords('Products')),
          suppliers: getRecords('Suppliers')
        };
        break;
      case 'getBatchSnapshot':
        result = {
          batch: joinBatch(getRecordById('InventoryBatches', params.id)),
          products: joinProducts(getRecordsByBatch('Products', params.id)),
          sales: joinSales(getRecordsByBatch('Sales', params.id).slice(0, params.salesLimit || 0)),
          expenses: getRecordsByBatch('Expenses', params.id).slice(0, params.expensesLimit || 0),
          walletTx: joinWalletTransactions(getRecordsByBatch('WalletTransactions', params.id).slice(0, params.walletTxLimit || 0))
        };
        break;
      case 'getSalesSnapshot':
        result = {
          sales: joinSales(getRecords('Sales').slice(0, params.salesLimit || 0)),
          products: joinProducts(getRecords('Products')),
          customers: getRecords('Customers'),
          batches: joinBatches(getRecords('InventoryBatches')),
          payments: joinPayments(getRecords('Payments').slice(0, params.paymentsLimit || 0))
        };
        break;
      case 'getWalletsSnapshot':
        result = {
          walletTx: joinWalletTransactions(getRecords('WalletTransactions').slice(0, params.walletTxLimit || 0)),
          settings: getRecords('Settings')[0] || null
        };
        break;
      case 'getNotificationsSnapshot':
        const allNotifications = getRecords('Notifications');
        result = {
          notifications: params.notificationsLimit ? allNotifications.slice(0, params.notificationsLimit) : allNotifications
        };
        break;
      case 'batch': {
        // Execute several actions in a single round-trip.
        const actions = Array.isArray(params.actions) ? params.actions : [];
        result = actions.map(function (a) {
          try {
            return runAction(a.action, a.params || {});
          } catch (e) {
            return { success: false, message: String(e && e.message ? e.message : e) };
          }
        });
        break;
      }

      default:
        throw new Error('Unknown action: ' + action);
    }

    return result;
}

function handleRequest(params, method) {
  try {
    if (API_KEY && params.key !== API_KEY) {
      return jsonResponse({ success: false, message: 'Unauthorized' }, 401);
    }

    const action = params.action;
    if (!action) {
      return jsonResponse({ success: false, message: 'Missing action' }, 400);
    }

    const result = runAction(action, params);
    return jsonResponse({ success: true, data: result }, 200);
  } catch (err) {
    return jsonResponse({ success: false, message: String(err && err.message ? err.message : err) }, 500);
  }
}

function jsonResponse(obj, code) {
  const out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}

// ============================================================
// SHEET INITIALIZATION
// ============================================================

function initializeVelouraSheets() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEET_DEFINITIONS).forEach(function (sheetName) {
    initializeSheet(spreadsheet, sheetName);
  });
  spreadsheet.toast('Veloura sheets initialized.');
}

function initializeSheet(spreadsheet, sheetName) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  const headers = SHEET_DEFINITIONS[sheetName] || [];
  if (!headers.length) {
    return sheet;
  }

  const existingHeaders = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0] || [];
  if (existingHeaders.join('').trim() === '') {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
    return sheet;
  }

  // Append any missing columns at the end (schema migration)
  const missing = headers.slice(existingHeaders.length);
  if (missing.length > 0) {
    const startCol = existingHeaders.length + 1;
    sheet.getRange(1, startCol, 1, missing.length).setValues([missing]);
    sheet.autoResizeColumns(startCol, missing.length);
  }

  return sheet;
}

// ============================================================
// GENERIC DATA HELPERS
// ============================================================

function getSheet(sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
}

function getHeaders(sheetName) {
  const sheet = getSheet(sheetName);
  const headerRow = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0] || [];
  return headerRow.length ? headerRow : (SHEET_DEFINITIONS[sheetName] || []);
}

// Request-scoped read cache. Reading a whole sheet (getDataRange) is the
// dominant cost of every request, and getRecordById / join* functions re-read
// the same sheets many times per request. Cache by sheet name for the lifetime
// of a single doGet/doPost invocation; writes clear their sheet's cache so
// subsequent reads in the same request stay fresh.
const _recordCache = {};

function clearRecordCache(sheetName) {
  if (sheetName) {
    delete _recordCache[sheetName];
  } else {
    Object.keys(_recordCache).forEach(function (k) { delete _recordCache[k]; });
  }
}

function getRecords(sheetName) {
  if (_recordCache[sheetName]) {
    return _recordCache[sheetName];
  }

  const sheet = getSheet(sheetName);
  const headers = getHeaders(sheetName);
  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    _recordCache[sheetName] = [];
    return [];
  }

  const result = values.slice(1).filter(function (row) {
    return row.some(function (cell) {
      return cell !== '' && cell !== null && cell !== undefined;
    });
  }).map(function (row) {
    const item = {};
    headers.forEach(function (header, index) {
      item[header] = row[index] !== undefined ? row[index] : '';
    });
    return item;
  });

  _recordCache[sheetName] = result;
  return result;
}

function getRecordById(sheetName, id) {
  const records = getRecords(sheetName);
  return records.find(function (record) {
    return String(record.id || '') === String(id || '');
  }) || null;
}

function createRecord(sheetName, payload) {
  const sheet = getSheet(sheetName);
  const headers = getHeaders(sheetName);
  const timestamp = new Date().toISOString();
  const item = Object.assign({}, payload || {});

  if (!item.id) {
    item.id = generateBusinessId(sheetName);
  }

  if (!item.created_at) {
    item.created_at = timestamp;
  }

  if (!item.updated_at) {
    item.updated_at = timestamp;
  }

  const row = headers.map(function (header) {
    if (header === 'id') {
      return item.id || '';
    }
    if (header === 'created_at') {
      return item.created_at || timestamp;
    }
    if (header === 'updated_at') {
      return item.updated_at || timestamp;
    }
    if (header === 'status' && sheetName === 'InventoryBatches') {
      return item.status || 'Draft';
    }
    return item[header] !== undefined ? item[header] : '';
  });

  sheet.appendRow(row);
  clearRecordCache(sheetName);
  return getRecordById(sheetName, item.id);
}

function updateRecord(sheetName, id, payload) {
  const sheet = getSheet(sheetName);
  const headers = getHeaders(sheetName);
  const rowIndex = findRowIndexById(sheet, headers, id);

  if (rowIndex === null) {
    return null;
  }

  const item = Object.assign({}, getRecordById(sheetName, id), payload || {});
  item.updated_at = new Date().toISOString();

  const row = headers.map(function (header) {
    if (header === 'id') {
      return item.id || '';
    }
    if (header === 'created_at') {
      return item.created_at || '';
    }
    if (header === 'updated_at') {
      return item.updated_at || '';
    }
    if (header === 'status' && sheetName === 'InventoryBatches') {
      return item.status || 'Draft';
    }
    return item[header] !== undefined ? item[header] : '';
  });

  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([row]);
  clearRecordCache(sheetName);
  return getRecordById(sheetName, id);
}

function deleteRecord(sheetName, id) {
  const sheet = getSheet(sheetName);
  const headers = getHeaders(sheetName);
  const rowIndex = findRowIndexById(sheet, headers, id);

  if (rowIndex === null) {
    return false;
  }

  sheet.deleteRow(rowIndex);
  clearRecordCache(sheetName);
  return true;
}

function generateBusinessId(sheetName) {
  const prefixMap = {
    Settings: 'SET',
    Suppliers: 'SUP',
    InventoryBatches: 'BAT',
    Products: 'PRD',
    Customers: 'CUS',
    Sales: 'SAL',
    Expenses: 'EXP',
    WalletTransactions: 'WAL',
    Payments: 'PAY',
    Notifications: 'NOT',
    ActivityLogs: 'LOG'
  };

  const prefix = prefixMap[sheetName] || sheetName.slice(0, 3).toUpperCase();
  const properties = PropertiesService.getScriptProperties();
  const counterKey = 'counter_' + sheetName.toUpperCase();
  const currentValue = Number(properties.getProperty(counterKey) || '0');
  const nextValue = currentValue + 1;
  properties.setProperty(counterKey, String(nextValue));
  return prefix + '-' + String(nextValue).padStart(6, '0');
}

function findRowIndexById(sheet, headers, id) {
  const values = sheet.getDataRange().getValues();
  const idIndex = headers.indexOf('id');
  for (let i = 1; i < values.length; i++) {
    const rowValue = values[i][idIndex];
    if (String(rowValue || '') === String(id || '')) {
      return i + 1;
    }
  }
  return null;
}

function totalBatchCost(payload) {
  return (
    (Number(payload.purchase_cost) || 0) +
    (Number(payload.transport_cost) || 0) +
    (Number(payload.loading_cost) || 0) +
    (Number(payload.import_duty) || 0) +
    (Number(payload.insurance) || 0) +
    (Number(payload.other_costs) || 0)
  );
}

// ============================================================
// FILTERED READ HELPERS
// ============================================================

function getRecordsByBatch(sheetName, batchId) {
  var all = getRecords(sheetName);
  return all.filter(function (r) {
    return String(r.batch_id || '') === String(batchId || '');
  });
}

function getRecordsByCustomer(sheetName, customerId) {
  var all = getRecords(sheetName);
  return all.filter(function (r) {
    return String(r.customer_id || '') === String(customerId || '');
  });
}

// ============================================================
// JOIN HELPERS (return related objects inline, like Supabase joins)
// ============================================================

function joinBatch(batch) {
  if (!batch) return null;
  const supplier = getRecordById('Suppliers', batch.supplier_id);
  return Object.assign({}, batch, {
    supplier: supplier ? {
      id: supplier.id,
      supplier_name: supplier.supplier_name,
      supplier_code: supplier.supplier_code
    } : null
  });
}

function joinBatches(batches) {
  return batches.map(joinBatch);
}

function joinProduct(product) {
  if (!product) return null;
  const batch = getRecordById('InventoryBatches', product.batch_id);
  return Object.assign({}, product, {
    batch: batch ? {
      id: batch.id,
      batch_code: batch.batch_code,
      batch_name: batch.batch_name
    } : null
  });
}

function joinProducts(products) {
  return products.map(joinProduct);
}

/**
 * joinSale : join related product, customer, batch.
 */
function joinSale(sale) {
  if (!sale) return null;
  const product = getRecordById('Products', sale.product_id);
  const customer = sale.customer_id ? getRecordById('Customers', sale.customer_id) : null;
  const batch = getRecordById('InventoryBatches', sale.batch_id);
  return Object.assign({}, sale, {
    product: product ? {
      id: product.id,
      product_name: product.product_name,
      brand: product.brand
    } : null,
    customer: customer ? {
      id: customer.id,
      customer_name: customer.customer_name
    } : null,
    batch: batch ? {
      id: batch.id,
      batch_code: batch.batch_code,
      batch_name: batch.batch_name
    } : null
  });
}

function joinSales(sales) {
  return sales.map(joinSale);
}

function joinExpense(expense) {
  if (!expense) return null;
  const batch = expense.batch_id ? getRecordById('InventoryBatches', expense.batch_id) : null;
  return Object.assign({}, expense, {
    batch: batch ? {
      id: batch.id,
      batch_code: batch.batch_code,
      batch_name: batch.batch_name
    } : null
  });
}

function joinExpenses(expenses) {
  return expenses.map(joinExpense);
}

function joinWalletTx(tx) {
  if (!tx) return null;
  const batch = tx.batch_id ? getRecordById('InventoryBatches', tx.batch_id) : null;
  return Object.assign({}, tx, {
    batch: batch ? {
      id: batch.id,
      batch_code: batch.batch_code,
      batch_name: batch.batch_name
    } : null
  });
}

function joinWalletTransactions(txs) {
  return txs.map(joinWalletTx);
}

function joinPayment(payment) {
  if (!payment) return null;
  const sale = payment.sale_id ? getRecordById('Sales', payment.sale_id) : null;
  const customer = payment.customer_id ? getRecordById('Customers', payment.customer_id) : null;
  return Object.assign({}, payment, {
    sale: sale ? {
      id: sale.id,
      sale_code: sale.sale_code,
      total_sale: sale.total_sale
    } : null,
    customer: customer ? {
      id: customer.id,
      customer_name: customer.customer_name
    } : null
  });
}

function joinPayments(payments) {
  return payments.map(joinPayment);
}

// ============================================================
// BUSINESS LOGIC (previously Postgres RPCs)
// ============================================================

function createInventoryBatch(batchPayload, productPayloads) {
  const batch = createRecord('InventoryBatches', Object.assign({
    status: 'Draft',
    completion_percentage: 0,
    remaining_stock: 0,
    gross_revenue: 0,
    gross_profit: 0,
    net_profit: 0,
    roi: 0
  }, batchPayload));

  const createdProducts = (productPayloads || []).map(function (productPayload) {
    return createRecord('Products', Object.assign({
      batch_id: batch.id,
      status: 'Active',
      current_stock: 0,
      initial_stock: 0,
      reorder_level: 0
    }, productPayload));
  });

  return {
    batch: batch,
    products: createdProducts
  };
}

function createBatchAction(payload) {
  const total = totalBatchCost(payload);
  const status = total > 0 ? 'Purchased' : 'Draft';

  const batch = createRecord('InventoryBatches', Object.assign({
    total_batch_cost: total,
    status: status,
    completion_percentage: 0,
    remaining_stock: 0,
    gross_revenue: 0,
    gross_profit: 0,
    net_profit: 0,
    roi: 0
  }, payload));

  logActivity('System', 'Batch Created', 'Inventory', batch.id,
    'Created batch ' + batch.batch_code);

  return joinBatch(batch);
}

function createProductAction(payload) {
  const product = createRecord('Products', Object.assign({
    batch_id: payload.batch_id,
    status: 'Active',
    current_stock: payload.initial_stock || 0,
    initial_stock: payload.initial_stock || 0,
    reorder_level: payload.reorder_level || 0
  }, payload));

  recomputeBatch(payload.batch_id);

  logActivity('System', 'Product Added', 'Inventory', product.id,
    'Added product ' + product.product_name);

  return {
    product: joinProduct(product),
    batch: joinBatch(getRecordById('InventoryBatches', payload.batch_id))
  };
}

/**
 * calculateAllocatedProfit : sum of Allocation wallet transactions for a batch.
 */
function calculateAllocatedProfit(batchId) {
  return getRecords('WalletTransactions')
    .filter(function (tx) {
      return String(tx.batch_id || '') === String(batchId || '') && tx.transaction_type === 'Allocation';
    })
    .reduce(function (sum, tx) { return sum + Number(tx.amount || 0); }, 0);
}

/**
 * calculateAdjustmentProfit : absolute sum of Adjustment transactions for a batch.
 */
function calculateAdjustmentProfit(batchId) {
  return Math.abs(getRecords('WalletTransactions')
    .filter(function (tx) {
      return String(tx.batch_id || '') === String(batchId || '') && tx.transaction_type === 'Adjustment';
    })
    .reduce(function (sum, tx) { return sum + Number(tx.amount || 0); }, 0));
}

/**
 * allocateIncrementalProfit : split an amount into Needs/Savings/Growth and
 * create Allocation transactions. If triggerSaleId is provided, assign it as
 * reference_id on each row for per-sale tracking.
 */
function allocateIncrementalProfit(batchId, amount, triggerSaleId) {
  var batch = getRecordById('InventoryBatches', batchId);
  if (!batch) return { needs: 0, savings: 0, growth: 0 };

  var raw = Math.round(Number(amount || 0) * 100) / 100;
  if (raw <= 0) return { needs: 0, savings: 0, growth: 0 };

  var settings = getRecords('Settings')[0] || {};
  var needsPct = Number(settings.needs_percentage || 0);
  var savingsPct = Number(settings.savings_percentage || 0);
  var growthPct = Number(settings.growth_percentage || 0);
  if (needsPct <= 0 && savingsPct <= 0 && growthPct <= 0) {
    needsPct = 40;
    savingsPct = 35;
    growthPct = 25;
  }

  var needs = Math.round(raw * (needsPct / 100) * 100) / 100;
  var savings = Math.round(raw * (savingsPct / 100) * 100) / 100;
  var growth = Math.round(raw * (growthPct / 100) * 100) / 100;

  var sum = Math.round((needs + savings + growth) * 100) / 100;
  if (sum !== raw) {
    var diff = Math.round((raw - sum) * 100) / 100;
    needs = Math.round((needs + diff) * 100) / 100;
  }

  var reason = triggerSaleId ? 'Allocation from sale ' + triggerSaleId : 'Allocation from ' + batch.batch_code;

  createRecord('WalletTransactions', {
    wallet: 'Needs',
    transaction_type: 'Allocation',
    batch_id: batchId,
    reference_id: triggerSaleId || null,
    amount: needs,
    reason: reason,
    created_by: 'System'
  });
  createRecord('WalletTransactions', {
    wallet: 'Savings',
    transaction_type: 'Allocation',
    batch_id: batchId,
    reference_id: triggerSaleId || null,
    amount: savings,
    reason: reason,
    created_by: 'System'
  });
  createRecord('WalletTransactions', {
    wallet: 'Growth',
    transaction_type: 'Allocation',
    batch_id: batchId,
    reference_id: triggerSaleId || null,
    amount: growth,
    reason: reason,
    created_by: 'System'
  });

  return { needs: needs, savings: savings, growth: growth };
}

/**
 * reconcileBatch : ensure total allocated + adjustments matches final net profit.
 * Idempotent — safe to call multiple times.
 */
function reconcileBatch(batchId) {
  var refreshed = getRecordById('InventoryBatches', batchId);
  if (!refreshed) return { needs: 0, savings: 0, growth: 0, adjustments: false };

  var finalProfit = Math.round(Number(refreshed.net_profit || 0) * 100) / 100;
  var allocated = calculateAllocatedProfit(batchId);
  var adjustmentAbs = calculateAdjustmentProfit(batchId);
  var delta = Math.round((finalProfit - (allocated - adjustmentAbs)) * 100) / 100;

  if (Math.abs(delta) < 0.01) return { needs: 0, savings: 0, growth: 0, adjustments: false };

  if (delta > 0.01) {
    var result = allocateIncrementalProfit(batchId, delta, null);
    return { needs: result.needs, savings: result.savings, growth: result.growth, adjustments: false };
  }

  var settings = getRecords('Settings')[0] || {};
  var needsPct = Number(settings.needs_percentage || 0);
  var savingsPct = Number(settings.savings_percentage || 0);
  var growthPct = Number(settings.growth_percentage || 0);
  if (needsPct <= 0 && savingsPct <= 0 && growthPct <= 0) {
    needsPct = 40;
    savingsPct = 35;
    growthPct = 25;
  }

  var totalPct = needsPct + savingsPct + growthPct;
  var needs = Math.round((delta * (needsPct / totalPct)) * 100) / 100;
  var savings = Math.round((delta * (savingsPct / totalPct)) * 100) / 100;
  var growth = Math.round((delta * (growthPct / totalPct)) * 100) / 100;

  var sum = Math.round((needs + savings + growth) * 100) / 100;
  var diff = Math.round((sum - delta) * 100) / 100;
  var finalNeeds = Math.round((needs - diff) * 100) / 100;

  if (finalNeeds > 0) {
    createRecord('WalletTransactions', {
      wallet: 'Needs',
      transaction_type: 'Adjustment',
      batch_id: batchId,
      amount: finalNeeds,
      reason: 'Reconciliation adjustment: ' + refreshed.batch_code,
      created_by: 'System'
    });
  }
  if (savings > 0) {
    createRecord('WalletTransactions', {
      wallet: 'Savings',
      transaction_type: 'Adjustment',
      batch_id: batchId,
      amount: savings,
      reason: 'Reconciliation adjustment: ' + refreshed.batch_code,
      created_by: 'System'
    });
  }
  if (growth > 0) {
    createRecord('WalletTransactions', {
      wallet: 'Growth',
      transaction_type: 'Adjustment',
      batch_id: batchId,
      amount: growth,
      reason: 'Reconciliation adjustment: ' + refreshed.batch_code,
      created_by: 'System'
    });
  }

  return { needs: 0, savings: 0, growth: 0, adjustments: true };
}

/**
 * recordSale : validate stock, decrement product, recompute parent batch.
 * Mirrors the Postgres record_sale RPC.
 */
function recordSaleAction(params) {
  const productPayload = params.payload || {};
  const product = getRecordById('Products', productPayload.product_id);
  if (!product) {
    return { success: false, message: 'Product not found', code: 'PRODUCT_NOT_FOUND' };
  }

  const batch = getRecordById('InventoryBatches', product.batch_id);
  if (!batch) {
    return { success: false, message: 'Batch not found', code: 'BATCH_NOT_FOUND' };
  }

  if (batch.status === 'Completed' || batch.status === 'Archived') {
    return { success: false, message: 'Batch is closed and cannot accept sales', code: 'BATCH_ALREADY_COMPLETED' };
  }

  const quantity = Number(productPayload.quantity || 0);
  if (product.current_stock < quantity) {
    return { success: false, message: 'Insufficient stock', code: 'INSUFFICIENT_STOCK' };
  }

  const unitPrice = Number(productPayload.unit_price || 0);
  const discount = Number(productPayload.discount || 0);
  const discountType = productPayload.discount_type || 'Amount';

  const discountAmount = discountType === 'Percent'
    ? (unitPrice * quantity) * (discount / 100)
    : discount;

  const totalSale = (unitPrice * quantity) - discountAmount;
  const totalCost = Number(product.cost_price || 0) * quantity;
  const profit = totalSale - totalCost;

  const sale = createRecord('Sales', {
    batch_id: batch.id,
    product_id: product.id,
    customer_id: productPayload.customer_id || '',
    sale_date: productPayload.sale_date || new Date().toISOString(),
    quantity: quantity,
    unit_cost: Number(product.cost_price || 0),
    unit_price: unitPrice,
    discount: discount,
    discount_type: discountType,
    total_cost: totalCost,
    total_sale: totalSale,
    profit: profit,
    payment_method: productPayload.payment_method || 'Cash',
    reference_number: productPayload.reference_number || '',
    status: 'Completed',
    notes: productPayload.notes || '',
    amount_paid: 0,
    balance: totalSale,
    payment_status: 'pending'
  });

  updateRecord('Products', product.id, {
    current_stock: Math.max(Number(product.current_stock || 0) - quantity, 0)
  });

  var newStock = Math.max(Number(product.current_stock || 0) - quantity, 0);
  if (newStock <= Number(product.reorder_level || 0)) {
    createNotification(
      'low_stock',
      'Low Stock Alert',
      product.product_name + ' is down to ' + newStock + ' units (reorder level: ' + product.reorder_level + ')',
      'product',
      product.id,
      'High'
    );
  }

  if (totalSale >= 1000) {
    createNotification(
      'large_sale',
      'Large Sale Recorded',
      'Sale ' + sale.sale_code + ' for ' + totalSale.toFixed(2) + ' (' + quantity + 'x ' + product.product_name + ')',
      'sale',
      sale.id,
      'Medium'
    );
  }

  recomputeBatch(batch.id);

  var refreshedBatchAfter = getRecordById('InventoryBatches', batch.id);
  var realizedProfit = Number(refreshedBatchAfter.net_profit || 0);
  var allocatedProfit = calculateAllocatedProfit(batch.id);
  var availableProfit = Math.round((realizedProfit - allocatedProfit) * 100) / 100;

  if (availableProfit > 0.01) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      var recheckedAllocated = calculateAllocatedProfit(batch.id);
      var recheckedAvailable = Math.round((realizedProfit - recheckedAllocated) * 100) / 100;
      if (recheckedAvailable > 0.01) {
        var alreadyDid = getRecords('WalletTransactions').some(function (tx) {
          return String(tx.batch_id || '') === String(batch.id) && String(tx.reference_id || '') === String(sale.id);
        });
        if (!alreadyDid) {
          allocateIncrementalProfit(batch.id, recheckedAvailable, sale.id);
        }
      }
    } catch (e) {
      console.log('Allocation lock failed: ' + e.message);
    }
  }

  logActivity('System', 'Sale Recorded', 'Sales', sale.id,
    'Recorded sale ' + sale.sale_code + ' for ' + quantity + ' unit(s)');

  return {
    success: true,
    message: 'Sale recorded',
    data: {
      sale: joinSale(sale),
      batch: joinBatch(getRecordById('InventoryBatches', batch.id))
    }
  };
}

/**
 * voidSale : restore stock, mark voided, recompute parent batch. If sale has
 * partial payments, create a refund payment and reset sale balance fields.
 */
function voidSaleAction(saleId) {
  const sale = getRecordById('Sales', saleId);
  if (!sale) {
    return { success: false, message: 'Sale not found', code: 'SALE_NOT_FOUND' };
  }
  if (sale.status === 'Voided') {
    return { success: false, message: 'Sale already voided', code: 'VALIDATION_ERROR' };
  }

  const product = getRecordById('Products', sale.product_id);
  if (product) {
    updateRecord('Products', product.id, {
      current_stock: Number(product.current_stock || 0) + Number(sale.quantity || 0)
    });
  }

  if (Number(sale.amount_paid || 0) > 0) {
    const refundAmount = -Number(sale.amount_paid || 0);
    createRecord('Payments', {
      sale_id: sale.id,
      customer_id: sale.customer_id || '',
      amount: refundAmount,
      payment_method: 'Refund',
      payment_date: new Date().toISOString(),
      notes: 'Refund for voided sale ' + sale.sale_code,
      created_at: new Date().toISOString()
    });
    updateRecord('Sales', sale.id, {
      amount_paid: 0,
      balance: Number(sale.total_sale || 0),
      payment_status: 'pending'
    });
    logActivity('System', 'Sale Voided with Refund', 'Sales', saleId,
      'Voided sale ' + sale.sale_code + ' and refunded payment of ' + Math.abs(refundAmount));
  }

  updateRecord('Sales', saleId, { status: 'Voided' });

  recomputeBatch(sale.batch_id);

  createNotification(
    'sale_voided',
    'Sale Voided',
    'Sale ' + sale.sale_code + ' has been voided. Stock has been restored.',
    'sale',
    saleId,
    'Medium'
  );

  logActivity('System', 'Sale Voided', 'Sales', saleId, 'Voided sale ' + sale.sale_code);

  return {
    success: true,
    message: 'Sale voided and stock restored',
    data: {
      sale: joinSale(getRecordById('Sales', saleId)),
      batch: joinBatch(getRecordById('InventoryBatches', sale.batch_id))
    }
  };
}

/**
 * recordPaymentAction : create a payment, revalidate linked sale balances.
 */
function recordPaymentAction(params) {
  const saleId = params.sale_id;
  const customerId = params.customer_id || '';
  const amount = Number(params.amount || 0);
  const paymentMethod = params.payment_method || 'Cash';
  const paymentDate = params.payment_date || new Date().toISOString();
  const notes = params.notes || '';

  if (amount <= 0) {
    return { success: false, message: 'Payment amount must be positive', code: 'VALIDATION_ERROR' };
  }

  const sale = saleId ? getRecordById('Sales', saleId) : null;
  if (saleId && !sale) {
    return { success: false, message: 'Sale not found', code: 'SALE_NOT_FOUND' };
  }
  if (sale && sale.status !== 'Completed') {
    return { success: false, message: 'Only completed sales can receive payments', code: 'VALIDATION_ERROR' };
  }

  const currentPaid = Number(sale?.amount_paid || 0);
  const totalSale = Number(sale?.total_sale || 0);
  const newPaid = currentPaid + amount;
  const newBalance = totalSale - newPaid;

  if (sale && newBalance < -0.01) {
    return { success: false, message: 'Payment exceeds remaining balance', code: 'VALIDATION_ERROR' };
  }

  const payment = createRecord('Payments', {
    sale_id: saleId || '',
    customer_id: customerId || sale?.customer_id || '',
    amount: amount,
    payment_method: paymentMethod,
    payment_date: paymentDate,
    notes: notes,
    created_at: new Date().toISOString()
  });

  if (saleId && sale) {
    updateRecord('Sales', saleId, {
      amount_paid: newPaid,
      balance: Math.max(newBalance, 0),
      payment_status: newBalance <= 0.01 ? 'paid' : 'partial'
    });

    if (newBalance <= 0.01) {
      createNotification(
        'payment_cleared',
        'Balance Cleared',
        'Sale ' + sale.sale_code + ' has been fully paid (' + amount.toFixed(2) + ' via ' + paymentMethod + ')',
        'sale',
        saleId,
        'High'
      );
    } else {
      createNotification(
        'payment_recorded',
        'Payment Recorded',
        'Payment of ' + amount.toFixed(2) + ' received for sale ' + sale.sale_code + ' (remaining: ' + newBalance.toFixed(2) + ')',
        'sale',
        saleId,
        'Low'
      );
    }
  } else {
    createNotification(
      'payment_recorded',
      'Payment Recorded',
      'Unallocated payment of ' + amount.toFixed(2) + ' received from customer',
      'payment',
      payment.id,
      'Low'
    );
  }

  logActivity('System', 'Payment Recorded', 'Payments', payment.id,
    'Recorded payment of ' + amount + ' for sale ' + (sale?.sale_code || saleId));

  return {
    success: true,
    message: 'Payment recorded',
    data: {
      payment: joinPayment(payment),
      sale: saleId ? joinSale(getRecordById('Sales', saleId)) : null
    }
  };
}

/**
 * backfillPaymentsAction : one-time backfill of Sales payment fields for
 * existing data. Run manually from the Apps Script editor or menu.
 */
function backfillPaymentsAction() {
  const sales = getRecords('Sales');
  let updated = 0;
  sales.forEach(function (sale) {
    const current = getRecordById('Sales', sale.id);
    if (!current) return;
    const amountPaid = Number(current.amount_paid || 0);
    const totalSale = Number(current.total_sale || 0);
    const balance = totalSale - amountPaid;
    let paymentStatus = 'pending';
    if (amountPaid > 0 && balance <= 0.01) paymentStatus = 'paid';
    else if (amountPaid > 0) paymentStatus = 'partial';

    updateRecord('Sales', sale.id, {
      amount_paid: amountPaid,
      balance: Math.max(balance, 0),
      payment_status: paymentStatus
    });
    updated++;
  });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.toast('Backfilled ' + updated + ' sales with payment fields.');
  return { success: true, updated: updated };
}

/**
 * allocateBatchProfit : legacy wrapper — delegates to reconcileBatch to preserve
 * external references while adopting the continuous profit realization model.
 */
function allocateBatchProfit(batchId) {
  var result = reconcileBatch(batchId);
  return { needs: result.needs, savings: result.savings, growth: result.growth };
}

function recomputeBatch(batchId) {
  const batch = getRecordById('InventoryBatches', batchId);
  if (!batch) return;

  const totalCost = totalBatchCost({
    purchase_cost: batch.purchase_cost,
    transport_cost: batch.transport_cost,
    loading_cost: batch.loading_cost,
    import_duty: batch.import_duty,
    insurance: batch.insurance,
    other_costs: batch.other_costs
  });

  const products = getRecordsByBatch('Products', batchId);
  const sales = getRecordsByBatch('Sales', batchId).filter(function (s) {
    return s.status === 'Completed';
  });

  let totalInitial = 0;
  let totalCurrent = 0;
  products.forEach(function (p) {
    totalInitial += Number(p.initial_stock || 0);
    totalCurrent += Number(p.current_stock || 0);
  });

  let grossRevenue = 0;
  let cogs = 0;
  sales.forEach(function (s) {
    grossRevenue += Number(s.total_sale || 0);
    cogs += Number(s.total_cost || 0);
  });

  const grossProfit = grossRevenue - cogs;

  const batchExpenses = getRecordsByBatch('Expenses', batchId).filter(function (e) {
    return e.expense_type === 'Batch';
  }).reduce(function (sum, e) {
    return sum + Number(e.amount || 0);
  }, 0);

  const netProfit = grossProfit - batchExpenses;
  const roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
  const completion = totalInitial > 0
    ? ((totalInitial - totalCurrent) / totalInitial) * 100
    : 0;

  const settings = getRecords('Settings')[0];
  const threshold = settings ? Number(settings.batch_completion_threshold || 0) : 10;

  let status = batch.status;
  const wasCompleted = (status === 'Completed' || status === 'Archived');
  if (status !== 'Completed' && status !== 'Archived') {
    if (totalCurrent === 0 && totalInitial > 0) {
      status = 'Completed';
    } else if (totalInitial > 0 && (totalCurrent / totalInitial) * 100 <= threshold) {
      status = 'Almost Finished';
    } else if (grossRevenue > 0) {
      status = 'Selling';
    } else if (totalInitial > 0) {
      status = 'Purchased';
    } else {
      status = 'Draft';
    }
  }

  updateRecord('InventoryBatches', batchId, {
    total_batch_cost: totalCost,
    gross_revenue: grossRevenue,
    gross_profit: grossProfit,
    net_profit: netProfit,
    roi: roi,
    completion_percentage: completion,
    remaining_stock: totalCurrent,
    status: status
  });

  // Reconcile profit on the transition to Completed (e.g. auto-complete by selling out).
  // reconcileBatch handles incremental allocations and adjustments idempotently.
  if (!wasCompleted && status === 'Completed' && netProfit > 0) {
    const reconciled = reconcileBatch(batchId);
    if (reconciled.needs || reconciled.savings || reconciled.growth || reconciled.adjustments) {
      createRecord('Notifications', {
        type: 'batch_completed',
        title: 'Batch Completed',
        message: batch.batch_code + ' sold out. Profit reconciled to wallets.',
        reference_type: 'batch',
        reference_id: batchId,
        priority: 'Medium',
        read: false
      });
    }
  }
}

/**
 * closeBatch : finalize and allocate net profit to Needs/Savings/Growth wallets.
 */
function closeBatchAction(batchId) {
  const batch = getRecordById('InventoryBatches', batchId);
  if (!batch) {
    return { success: false, message: 'Batch not found', code: 'BATCH_NOT_FOUND' };
  }
  if (batch.status === 'Archived') {
    return { success: false, message: 'Archived batches cannot be modified', code: 'BATCH_ALREADY_COMPLETED' };
  }
  if (Number(batch.remaining_stock || 0) > 0) {
    return { success: false, message: 'Cannot close a batch with remaining stock', code: 'VALIDATION_ERROR' };
  }

  recomputeBatch(batchId);
  const refreshed = getRecordById('InventoryBatches', batchId);
  const net = Number(refreshed.net_profit || 0);

  const reconciled = reconcileBatch(batchId);
  const needs = reconciled.needs;
  const savings = reconciled.savings;
  const growth = reconciled.growth;

  updateRecord('InventoryBatches', batchId, { status: 'Completed' });

  if (reconciled.adjustments || reconciled.needs || reconciled.savings || reconciled.growth) {
    createRecord('Notifications', {
      type: 'batch_completed',
      title: 'Batch Completed',
      message: batch.batch_code + ' has been closed. Profit reconciled to wallets.',
      reference_type: 'batch',
      reference_id: batchId,
      priority: 'Medium',
      read: false
    });
  }

  logActivity('System', 'Batch Closed', 'Inventory', batchId,
    'Closed ' + batch.batch_code + ' with net profit ' + net);

  return {
    success: true,
    message: 'Batch closed and profit reconciled',
    data: {
      batch: joinBatch(getRecordById('InventoryBatches', batchId)),
      net_profit: net,
      needs: needs,
      savings: savings,
      growth: growth
    }
  };
}

/**
 * createExpense : insert expense, recompute batch if batch expense, create
 * wallet outflow from the Needs wallet.
 */
function createExpenseAction(params) {
  const input = params.payload || {};
  const expense = createRecord('Expenses', Object.assign({
    expense_type: 'Business',
    amount: 0
  }, input));

  if (input.expense_type === 'Batch' && input.batch_id) {
    recomputeBatch(input.batch_id);
    createRecord('WalletTransactions', {
      wallet: 'Needs',
      transaction_type: 'Expense',
      batch_id: input.batch_id,
      amount: Number(input.amount || 0),
      reason: 'Expense: ' + input.expense_name,
      created_by: 'System'
    });
  } else {
    createRecord('WalletTransactions', {
      wallet: 'Needs',
      transaction_type: 'Expense',
      amount: Number(input.amount || 0),
      reason: 'Business expense: ' + input.expense_name,
      created_by: 'System'
    });
  }

  if (Number(input.amount || 0) >= 500) {
    createNotification(
      'large_expense',
      'Large Expense Recorded',
      'Expense ' + input.expense_name + ' for ' + Number(input.amount || 0).toFixed(2),
      'expense',
      expense.id,
      'Medium'
    );
  }

  logActivity('System', 'Expense Added', 'Expenses', expense.id,
    'Recorded ' + input.expense_type + ' expense ' + input.expense_name + ' (' + input.amount + ')');

  return expense;
}

function logActivity(actor, action, moduleName, referenceId, description) {
  return createRecord('ActivityLogs', {
    actor: actor || 'System',
    action: action || 'Viewed',
    module: moduleName || 'General',
    reference_id: referenceId || '',
    description: description || ''
  });
}

function createSampleBatch() {
  const batchResult = createInventoryBatch({
    batch_name: 'Sample Summer Collection',
    supplier_id: 'SUP-000001',
    purchase_date: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    purchase_cost: 1200,
    transport_cost: 80,
    loading_cost: 25,
    total_batch_cost: 1305,
    status: 'Purchased'
  }, [
    {
      product_name: 'Veloura Bloom',
      product_code: 'PRD-000001',
      cost_price: 25,
      selling_price: 40,
      initial_stock: 40,
      current_stock: 40,
      reorder_level: 10
    }
  ]);

  logActivity(
    'System',
    'Created sample batch',
    'Inventory',
    batchResult.batch.id,
    'Initialized a sample batch for the spreadsheet demo.'
  );

  return batchResult;
}

function createNotification(type, title, message, referenceType, referenceId, priority) {
  createRecord('Notifications', {
    type: type || 'info',
    title: title || 'Notification',
    message: message || '',
    reference_type: referenceType || '',
    reference_id: referenceId || '',
    priority: priority || 'Medium',
    read: false,
    created_at: new Date().toISOString()
  });
}

function markNotificationReadAction(id) {
  const record = getRecordById('Notifications', id);
  if (!record) return { success: false, message: 'Notification not found' };
  updateRecord('Notifications', id, { read: true });
  return { success: true };
}

function markAllNotificationsReadAction() {
  const all = getRecords('Notifications');
  let count = 0;
  all.forEach(function (n) {
    if (!n.read) {
      updateRecord('Notifications', n.id, { read: true });
      count++;
    }
  });
  return { success: true, count: count };
}
