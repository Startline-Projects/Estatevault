---
name: new-migration
description: Scaffold a Supabase SQL migration file with RLS policies, correct naming convention, and rollback comments.
---

Scaffold a new Supabase migration file for EstateVault based on the schema change the user describes.

## Output
Create a file at the project root named `migration-[feature].sql`.

## Template to follow

```sql
-- Migration: [feature]
-- Description: [what this migration does]
-- Created: [date]

-- ============================================================
-- ROLLBACK (run this section to undo)
-- ============================================================
-- DROP TABLE IF EXISTS [table_name];
-- DROP POLICY IF EXISTS "[policy_name]" ON [table_name];
-- ============================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS [table_name] (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
  -- add columns here
);

-- 2. Enable Row Level Security
ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
CREATE POLICY "Users can view own [table_name]"
  ON [table_name] FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own [table_name]"
  ON [table_name] FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own [table_name]"
  ON [table_name] FOR UPDATE
  USING (auth.uid() = user_id);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS [table_name]_user_id_idx ON [table_name](user_id);

-- 5. Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

CREATE TRIGGER update_[table_name]_updated_at
  BEFORE UPDATE ON [table_name]
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Rules
- RLS must be enabled on every table containing user data
- Every user-data table scoped by `user_id` referencing `auth.users(id)`
- Financial values stored as integers (cents) — never floats
- Vault/credential data noted in comments as "encrypted at application layer"
- Rollback block always included at the top
- Index on `user_id` always included

## Ask the user if not provided
- Feature name (becomes the filename suffix)
- What tables are being created or altered
- What columns are needed
- Are there any foreign key relationships?
- Who can access this data (user-scoped, partner-scoped, admin-only)?
