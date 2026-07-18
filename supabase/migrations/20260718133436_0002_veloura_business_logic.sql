/*
# Veloura Manager V2 — Business Logic RPC Functions

1. Purpose
   Implements the core financial operations as PostgreSQL RPC functions so
   that business rules (stock decrement, profit calculation, wallet
   allocation, batch closing) execute atomically server-side. This is the
   "backend brain" described in spec Chapter 6 — the frontend never computes
   financial results, it only calls these functions and displays the result.

2. Functions
   - record_sale(p_product_id, p_customer_id, p_quantity, p_unit_price,
     p_discount, p_discount_type, p_payment_method, p_notes)
     Validates stock, decrements product.current_stock, inserts a sale row
     with computed cost/profit, recomputes the parent batch aggregates
     (gross_revenue, gross_profit, net_profit, roi, completion_percentage,
     remaining_stock, status), and returns the new sale row.
   - recompute_batch(p_batch_id)
     Recomputes all stored aggregates for a batch from its products + sales +
     batch expenses. Centralizes the calculation so triggers and the sale
     function share one source of truth.
   - close_batch(p_batch_id)
     Finalizes a batch: requires remaining_stock = 0, sets status to
     'Completed', and allocates net profit into Needs/Savings/Growth wallets
     via three wallet_transactions rows using the percentages from settings.
   - record_expense(...) handled client-side for now (simple insert + batch
     recompute) — kept in the service layer because it needs flexible
     categories. The recompute_batch RPC is reused to update batch profit.

3. Status transitions enforced
   - Cannot sell from a Completed/Archived batch.
   - Cannot sell more than current_stock.
   - close_batch requires remaining_stock = 0 and status != 'Archived'.

4. Wallet allocation
   Only happens on close_batch (spec golden rule #6: net profit calculated
   before wallet allocation). Allocation rows are append-only
   wallet_transactions with transaction_type = 'Allocation'.

5. Notes
   All functions are SECURITY DEFINER so they can read/write across the RLS
   tables. They return JSON with a consistent {success, message, data} shape
   matching the spec's API response format (section 6.3).
*/

-- ============================================================
-- recompute_batch: recompute all stored aggregates for one batch
-- ============================================================
CREATE OR REPLACE FUNCTION recompute_batch(p_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_cost numeric;
  v_total_initial integer;
  v_total_current integer;
  v_gross_revenue numeric;
  v_cogs numeric;
  v_gross_profit numeric;
  v_batch_expenses numeric;
  v_net_profit numeric;
  v_roi numeric;
  v_completion numeric;
  v_status text;
  v_threshold numeric;
BEGIN
  -- total batch cost (purchase + overheads)
  SELECT total_batch_cost INTO v_total_cost
  FROM inventory_batches WHERE id = p_batch_id;

  -- stock totals across products
  SELECT
    COALESCE(SUM(initial_stock),0),
    COALESCE(SUM(current_stock),0)
  INTO v_total_initial, v_total_current
  FROM products WHERE batch_id = p_batch_id;

  -- revenue + COGS from completed sales
  SELECT
    COALESCE(SUM(total_sale),0),
    COALESCE(SUM(total_cost),0)
  INTO v_gross_revenue, v_cogs
  FROM sales WHERE batch_id = p_batch_id AND status = 'Completed';

  v_gross_profit := v_gross_revenue - v_cogs;

  -- batch expenses
  SELECT COALESCE(SUM(amount),0) INTO v_batch_expenses
  FROM expenses WHERE batch_id = p_batch_id AND expense_type = 'Batch';

  v_net_profit := v_gross_profit - v_batch_expenses;

  v_roi := CASE WHEN v_total_cost > 0 THEN (v_net_profit / v_total_cost) * 100 ELSE 0 END;

  v_completion := CASE WHEN v_total_initial > 0
    THEN ((v_total_initial - v_total_current)::numeric / v_total_initial) * 100
    ELSE 0 END;

  -- status transition
  SELECT batch_completion_threshold INTO v_threshold FROM settings LIMIT 1;
  v_status := (SELECT status FROM inventory_batches WHERE id = p_batch_id);

  IF v_status NOT IN ('Completed','Archived') THEN
    IF v_total_current = 0 AND v_total_initial > 0 THEN
      v_status := 'Completed';
    ELSIF v_total_initial > 0 AND (v_total_current::numeric / v_total_initial) * 100 <= v_threshold THEN
      v_status := 'Almost Finished';
    ELSIF v_gross_revenue > 0 THEN
      v_status := 'Selling';
    ELSIF v_total_initial > 0 THEN
      v_status := 'Purchased';
    ELSE
      v_status := 'Draft';
    END IF;
  END IF;

  UPDATE inventory_batches SET
    gross_revenue = v_gross_revenue,
    gross_profit = v_gross_profit,
    net_profit = v_net_profit,
    roi = v_roi,
    completion_percentage = v_completion,
    remaining_stock = v_total_current,
    status = v_status
  WHERE id = p_batch_id;
END;
$$;

-- ============================================================
-- record_sale: atomic sale + stock decrement + batch recompute
-- ============================================================
CREATE OR REPLACE FUNCTION record_sale(
  p_product_id uuid,
  p_customer_id uuid,
  p_quantity integer,
  p_unit_price numeric,
  p_discount numeric DEFAULT 0,
  p_discount_type text DEFAULT 'Amount',
  p_payment_method text DEFAULT 'Cash',
  p_notes text DEFAULT NULL,
  p_sale_date timestamptz DEFAULT now()
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_product products%ROWTYPE;
  v_batch inventory_batches%ROWTYPE;
  v_sale_id uuid;
  v_sale_code text;
  v_total_sale numeric;
  v_total_cost numeric;
  v_profit numeric;
  v_discount_amount numeric;
BEGIN
  SELECT * INTO v_product FROM products WHERE id = p_product_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Product not found', 'code', 'PRODUCT_NOT_FOUND');
  END IF;

  SELECT * INTO v_batch FROM inventory_batches WHERE id = v_product.batch_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Batch not found', 'code', 'BATCH_NOT_FOUND');
  END IF;

  IF v_batch.status IN ('Completed','Archived') THEN
    RETURN json_build_object('success', false, 'message', 'Batch is closed and cannot accept sales', 'code', 'BATCH_ALREADY_COMPLETED');
  END IF;

  IF v_product.current_stock < p_quantity THEN
    RETURN json_build_object('success', false, 'message', 'Insufficient stock', 'code', 'INSUFFICIENT_STOCK');
  END IF;

  -- discount amount
  IF p_discount_type = 'Percent' THEN
    v_discount_amount := (p_unit_price * p_quantity) * (p_discount / 100.0);
  ELSE
    v_discount_amount := p_discount;
  END IF;

  v_total_sale := (p_unit_price * p_quantity) - v_discount_amount;
  v_total_cost := v_product.cost_price * p_quantity;
  v_profit := v_total_sale - v_total_cost;

  v_sale_code := generate_business_id('SAL');
  v_sale_id := gen_random_uuid();

  INSERT INTO sales (
    id, sale_code, batch_id, product_id, customer_id, sale_date,
    quantity, unit_cost, unit_price, discount, discount_type,
    total_cost, total_sale, profit, payment_method, notes
  ) VALUES (
    v_sale_id, v_sale_code, v_batch.id, p_product_id, p_customer_id, p_sale_date,
    p_quantity, v_product.cost_price, p_unit_price, p_discount, p_discount_type,
    v_total_cost, v_total_sale, v_profit, p_payment_method, p_notes
  );

  -- decrement stock
  UPDATE products SET current_stock = current_stock - p_quantity
  WHERE id = p_product_id;

  -- recompute batch aggregates
  PERFORM recompute_batch(v_batch.id);

  -- activity log
  INSERT INTO activity_logs (log_code, action, module, reference_id, description)
  VALUES (generate_business_id('LOG'), 'Sale Recorded', 'Sales', v_sale_id,
    'Recorded sale ' || v_sale_code || ' for ' || p_quantity || ' unit(s)');

  RETURN json_build_object('success', true, 'message', 'Sale recorded', 'data',
    json_build_object('sale_id', v_sale_id, 'sale_code', v_sale_code, 'total_sale', v_total_sale, 'profit', v_profit)
  );
END;
$$;

-- ============================================================
-- close_batch: finalize + allocate wallets
-- ============================================================
CREATE OR REPLACE FUNCTION close_batch(p_batch_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch inventory_batches%ROWTYPE;
  v_settings settings%ROWTYPE;
  v_needs numeric;
  v_savings numeric;
  v_growth numeric;
  v_net numeric;
BEGIN
  SELECT * INTO v_batch FROM inventory_batches WHERE id = p_batch_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Batch not found', 'code', 'BATCH_NOT_FOUND');
  END IF;

  IF v_batch.status = 'Archived' THEN
    RETURN json_build_object('success', false, 'message', 'Archived batches cannot be modified', 'code', 'BATCH_ALREADY_COMPLETED');
  END IF;

  IF v_batch.remaining_stock > 0 THEN
    RETURN json_build_object('success', false, 'message', 'Cannot close a batch with remaining stock', 'code', 'VALIDATION_ERROR');
  END IF;

  -- final recompute
  PERFORM recompute_batch(p_batch_id);

  SELECT * INTO v_batch FROM inventory_batches WHERE id = p_batch_id;
  SELECT * INTO v_settings FROM settings LIMIT 1;

  v_net := v_batch.net_profit;
  IF v_net > 0 THEN
    v_needs := v_net * (v_settings.needs_percentage / 100.0);
    v_savings := v_net * (v_settings.savings_percentage / 100.0);
    v_growth := v_net * (v_settings.growth_percentage / 100.0);

    INSERT INTO wallet_transactions (transaction_code, wallet, transaction_type, batch_id, amount, reason)
    VALUES (generate_business_id('WTX'), 'Needs', 'Allocation', p_batch_id, v_needs, 'Allocation from ' || v_batch.batch_code);

    INSERT INTO wallet_transactions (transaction_code, wallet, transaction_type, batch_id, amount, reason)
    VALUES (generate_business_id('WTX'), 'Savings', 'Allocation', p_batch_id, v_savings, 'Allocation from ' || v_batch.batch_code);

    INSERT INTO wallet_transactions (transaction_code, wallet, transaction_type, batch_id, amount, reason)
    VALUES (generate_business_id('WTX'), 'Growth', 'Allocation', p_batch_id, v_growth, 'Allocation from ' || v_batch.batch_code);
  END IF;

  UPDATE inventory_batches SET status = 'Completed' WHERE id = p_batch_id;

  INSERT INTO notifications (notification_code, type, title, message, reference_type, reference_id, priority)
  VALUES (generate_business_id('NOT'), 'batch_completed', 'Batch Completed',
    v_batch.batch_code || ' has been closed. Net profit allocated to wallets.',
    'batch', p_batch_id, 'Medium');

  INSERT INTO activity_logs (log_code, action, module, reference_id, description)
  VALUES (generate_business_id('LOG'), 'Batch Closed', 'Inventory', p_batch_id,
    'Closed ' || v_batch.batch_code || ' with net profit ' || v_net);

  RETURN json_build_object('success', true, 'message', 'Batch closed and profit allocated', 'data',
    json_build_object('batch_id', p_batch_id, 'net_profit', v_net, 'needs', v_needs, 'savings', v_savings, 'growth', v_growth)
  );
END;
$$;

-- ============================================================
-- void_sale: reverse a sale (restore stock, recompute batch)
-- ============================================================
CREATE OR REPLACE FUNCTION void_sale(p_sale_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale sales%ROWTYPE;
BEGIN
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Sale not found', 'code', 'SALE_NOT_FOUND');
  END IF;

  IF v_sale.status = 'Voided' THEN
    RETURN json_build_object('success', false, 'message', 'Sale already voided', 'code', 'VALIDATION_ERROR');
  END IF;

  -- restore stock
  UPDATE products SET current_stock = current_stock + v_sale.quantity
  WHERE id = v_sale.product_id;

  -- mark voided
  UPDATE sales SET status = 'Voided' WHERE id = p_sale_id;

  -- recompute batch
  PERFORM recompute_batch(v_sale.batch_id);

  INSERT INTO activity_logs (log_code, action, module, reference_id, description)
  VALUES (generate_business_id('LOG'), 'Sale Voided', 'Sales', p_sale_id,
    'Voided sale ' || v_sale.sale_code);

  RETURN json_build_object('success', true, 'message', 'Sale voided and stock restored');
END;
$$;

-- ============================================================
-- recompute all batches (utility for after expense insert)
-- ============================================================
CREATE OR REPLACE FUNCTION recompute_batch_if_active(p_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM inventory_batches WHERE id = p_batch_id;
  IF FOUND AND v_status NOT IN ('Completed','Archived') THEN
    PERFORM recompute_batch(p_batch_id);
  END IF;
END;
$$;
