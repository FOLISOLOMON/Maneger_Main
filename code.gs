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
    'created_at'
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

      // ---- batched snapshots: return everything a page needs in ONE request ----
      case 'getDashboardSnapshot':
        result = {
          settings: getRecords('Settings')[0] || null,
          batches: joinBatches(getRecords('InventoryBatches')),
          products: joinProducts(getRecords('Products')),
          sales: joinSales(Array.isArray(params.sales) ? params.sales : getRecords('Sales').slice(0, params.salesLimit || 0)),
          expenses: joinExpenses(Array.isArray(params.expenses) ? params.expenses : getRecords('Expenses').slice(0, params.expensesLimit || 0)),
          walletTx: joinWalletTransactions(getRecords('WalletTransactions').slice(0, params.walletTxLimit || 0)),
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
          batches: joinBatches(getRecords('InventoryBatches'))
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

  const existingHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0] || [];
  if (existingHeaders.join('').trim() === '') {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
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
    notes: productPayload.notes || ''
  });

  updateRecord('Products', product.id, {
    current_stock: Math.max(Number(product.current_stock || 0) - quantity, 0)
  });

  recomputeBatch(batch.id);

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
 * voidSale : restore stock, mark voided, recompute parent batch.
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

  updateRecord('Sales', saleId, { status: 'Voided' });

  recomputeBatch(sale.batch_id);

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
 * recomputeBatch : recompute stored aggregates (revenue, profit, net, roi,
 * completion, remaining stock, status) from products + sales + expenses.
 */
/**
 * allocateBatchProfit : single source of truth for splitting a batch's net
 * profit into the Needs/Savings/Growth wallets. Once a batch is Completed or
 * Archived it must NOT be re-allocated, so callers can safely invoke this
 * without creating duplicate Allocation rows.
 */
function allocateBatchProfit(batchId) {
  const batch = getRecordById('InventoryBatches', batchId);
  if (!batch) return { needs: 0, savings: 0, growth: 0 };

  const net = Number(batch.net_profit || 0);
  if (net <= 0) return { needs: 0, savings: 0, growth: 0 };

  // Once-only guard based on tangible proof: if Allocation rows already exist
  // for this batch, do not create duplicates. This is robust to call order —
  // recomputeBatch writes status='Completed' to the sheet BEFORE calling us, so
  // a status-based guard would always see 'Completed' and block the allocation.
  const alreadyAllocated = getRecords('WalletTransactions').some(function (tx) {
    return String(tx.batch_id || '') === String(batchId) && tx.transaction_type === 'Allocation';
  });
  if (alreadyAllocated) {
    return { needs: 0, savings: 0, growth: 0 };
  }

  const settings = getRecords('Settings')[0] || {};
  let needsPct = Number(settings.needs_percentage || 0);
  let savingsPct = Number(settings.savings_percentage || 0);
  let growthPct = Number(settings.growth_percentage || 0);

  // Default 40/35/25 when no percentages are configured.
  if (needsPct <= 0 && savingsPct <= 0 && growthPct <= 0) {
    needsPct = 40;
    savingsPct = 35;
    growthPct = 25;
  }

  const needs = net * (needsPct / 100);
  const savings = net * (savingsPct / 100);
  const growth = net * (growthPct / 100);

  createRecord('WalletTransactions', {
    wallet: 'Needs',
    transaction_type: 'Allocation',
    batch_id: batchId,
    amount: needs,
    reason: 'Allocation from ' + batch.batch_code,
    created_by: 'System'
  });
  createRecord('WalletTransactions', {
    wallet: 'Savings',
    transaction_type: 'Allocation',
    batch_id: batchId,
    amount: savings,
    reason: 'Allocation from ' + batch.batch_code,
    created_by: 'System'
  });
  createRecord('WalletTransactions', {
    wallet: 'Growth',
    transaction_type: 'Allocation',
    batch_id: batchId,
    amount: growth,
    reason: 'Allocation from ' + batch.batch_code,
    created_by: 'System'
  });

  return { needs: needs, savings: savings, growth: growth };
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

  // Allocate profit exactly once, on the run that flips the batch to Completed
  // (e.g. auto-complete by selling out). The proof-based guard in
  // allocateBatchProfit prevents duplicates when closeBatchAction also runs.
  if (!wasCompleted && status === 'Completed' && netProfit > 0) {
    const allocated = allocateBatchProfit(batchId);
    if (allocated.needs || allocated.savings || allocated.growth) {
      createRecord('Notifications', {
        type: 'batch_completed',
        title: 'Batch Completed',
        message: batch.batch_code + ' sold out. Net profit allocated to wallets.',
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

  const allocated = allocateBatchProfit(batchId);
  const needs = allocated.needs;
  const savings = allocated.savings;
  const growth = allocated.growth;

  updateRecord('InventoryBatches', batchId, { status: 'Completed' });

  createRecord('Notifications', {
    type: 'batch_completed',
    title: 'Batch Completed',
    message: batch.batch_code + ' has been closed. Net profit allocated to wallets.',
    reference_type: 'batch',
    reference_id: batchId,
    priority: 'Medium',
    read: false
  });

  logActivity('System', 'Batch Closed', 'Inventory', batchId,
    'Closed ' + batch.batch_code + ' with net profit ' + net);

  return {
    success: true,
    message: 'Batch closed and profit allocated',
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
