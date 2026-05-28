-- Migration 003: Add volume_tiers to tariffs and attempt tracking to packages
-- Run this in the Supabase SQL editor

-- 1. Volume tiers per tariff (e.g. 1 pkg=$9000, >=2=$6000, >=6=$5000)
ALTER TABLE tariffs
  ADD COLUMN IF NOT EXISTS volume_tiers JSONB DEFAULT '[]'::jsonb;

-- 2. Delivery attempt counter on packages (1 = first attempt, 2 = second, etc.)
ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS delivery_attempt INTEGER DEFAULT 1;

-- 3. Original route reference (set when package is returned to pool from a route)
ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS original_route_id UUID REFERENCES routes(id) ON DELETE SET NULL;
