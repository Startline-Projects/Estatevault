-- ============================================================
-- Migration: Test order support
-- Run this in Supabase SQL Editor
-- ============================================================

-- Add order_type and expires_at to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type text DEFAULT 'standard';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Allow 'test' as a product_type value
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_product_type_check;
ALTER TABLE orders ADD CONSTRAINT orders_product_type_check
  CHECK (product_type IN ('will', 'trust', 'attorney_review', 'amendment', 'vault_subscription'));
