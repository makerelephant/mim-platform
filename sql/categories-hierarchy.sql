-- ============================================================
-- Community Categories: Add hierarchy support + populate
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add parent_id column for hierarchy
ALTER TABLE community_categories
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES community_categories(id),
  ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;

-- 2. Clear old seed data (Youth Soccer, Retail, etc.)
DELETE FROM community_categories;

-- 3. Insert parent categories
INSERT INTO community_categories (name, sort_order) VALUES
  ('Youth Sports', 1),
  ('Music', 2),
  ('Gaming', 3),
  ('Civic Groups', 4),
  ('Education', 5),
  ('Affinity Groups', 6),
  ('Recreational Organizations', 7),
  ('Events', 8)
ON CONFLICT (name) DO NOTHING;

-- 4. Insert sub-categories under Youth Sports
INSERT INTO community_categories (name, parent_id, sort_order)
SELECT sub.name, p.id, sub.sort_order
FROM (VALUES
  ('Soccer', 1),
  ('Lacrosse', 2),
  ('Hockey', 3),
  ('Volleyball', 4),
  ('Basketball', 5)
) AS sub(name, sort_order)
CROSS JOIN community_categories p
WHERE p.name = 'Youth Sports' AND p.parent_id IS NULL
ON CONFLICT (name) DO NOTHING;

-- 5. Index for parent lookups
CREATE INDEX IF NOT EXISTS idx_community_categories_parent
  ON community_categories(parent_id);

-- 6. RLS (ensure policies exist)
ALTER TABLE community_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_community_categories" ON community_categories;
CREATE POLICY "anon_read_community_categories" ON community_categories
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "authenticated_all_community_categories" ON community_categories;
CREATE POLICY "authenticated_all_community_categories" ON community_categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Verify
SELECT
  p.name AS category,
  c.name AS subcategory,
  p.sort_order
FROM community_categories p
LEFT JOIN community_categories c ON c.parent_id = p.id
WHERE p.parent_id IS NULL
ORDER BY p.sort_order, c.sort_order;
