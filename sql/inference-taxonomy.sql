-- ============================================================================
-- Inference Taxonomy: User-configurable classification categories
-- ============================================================================
-- This table replaces hardcoded INVESTOR_TAGS / PARTNER_TAGS / CUSTOMER_TAGS
-- arrays. The scanners, dashboard, and classifier all read from this table
-- to determine how inbound data is categorized, prioritized, and routed.
-- ============================================================================

BEGIN;

-- ── Table ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inference_taxonomy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,                        -- Display name: 'Fundraising'
  slug TEXT NOT NULL UNIQUE,                     -- Machine key: 'fundraising'
  description TEXT,                              -- User-facing explanation
  signal_keywords TEXT[] NOT NULL DEFAULT '{}',  -- Tags that trigger this category
  org_type_match TEXT,                           -- Maps to organizations.org_type (e.g. 'Investor')
  dashboard_card_key TEXT,                       -- Dashboard routing key: 'investors', 'partners', 'customers'
  prompt_fragment TEXT,                          -- Injected into Claude classifier system prompt
  priority_rules JSONB DEFAULT '[]',            -- [{condition, priority}] rules
  actions JSONB DEFAULT '{"create_task": true, "route_to_card": true, "send_alert": false}',
  icon TEXT DEFAULT 'Tag',                       -- Lucide icon name for UI
  color TEXT DEFAULT 'text-gray-600',            -- Tailwind color class
  active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_taxonomy_active ON inference_taxonomy(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_taxonomy_slug ON inference_taxonomy(slug);
CREATE INDEX IF NOT EXISTS idx_taxonomy_sort ON inference_taxonomy(sort_order, category);
CREATE INDEX IF NOT EXISTS idx_taxonomy_keywords ON inference_taxonomy USING GIN(signal_keywords);

-- ── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE inference_taxonomy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on inference_taxonomy"
  ON inference_taxonomy FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert on inference_taxonomy"
  ON inference_taxonomy FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated update on inference_taxonomy"
  ON inference_taxonomy FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated delete on inference_taxonomy"
  ON inference_taxonomy FOR DELETE USING (true);

-- ── Seed data (mirrors current hardcoded arrays) ──────────────────────────

INSERT INTO inference_taxonomy (category, slug, description, signal_keywords, org_type_match, dashboard_card_key, prompt_fragment, priority_rules, icon, color, sort_order)
VALUES
(
  'Fundraising',
  'fundraising',
  'Investor communications: fundraising rounds, term sheets, due diligence, cap tables, pitch decks, financial projections',
  ARRAY['fundraising', 'investment', 'investor', 'deal-update', 'term-sheet', 'due-diligence', 'funding', 'capital', 'seed-round', 'series-a', 'valuation', 'cap-table', 'pitch-deck'],
  'Investor',
  'investors',
  'Investors: venture capital firms, angel investors, seed funds, family offices. Communications about fundraising rounds, cap tables, term sheets, due diligence, pitch decks, portfolio updates, financial projections, board meetings.',
  '[{"condition": "term-sheet", "priority": "critical"}, {"condition": "due-diligence", "priority": "high"}, {"condition": "board-meeting", "priority": "high"}]'::jsonb,
  'TrendingUp',
  'text-green-600',
  1
),
(
  'Partnerships',
  'partnership',
  'Partner communications: distribution, integration, co-marketing, team stores, referrals, sponsorships',
  ARRAY['partnership', 'partner', 'team-store', 'merch', 'co-brand', 'distribution', 'reseller', 'channel-partner', 'sponsorship', 'integration', 'affiliate', 'referral'],
  'Partner',
  'partners',
  'Partners (Channel Partners): distribution partners, resellers, platform integrators, affiliates, sponsors. Communications about partnership agreements, revenue sharing, integration, co-marketing, referrals, team stores, merchandise.',
  '[{"condition": "partnership-agreement", "priority": "high"}, {"condition": "integration", "priority": "medium"}]'::jsonb,
  'Handshake',
  'text-emerald-600',
  2
),
(
  'Communities',
  'community',
  'Customer communications: merchandise orders, tournaments, team stores, Drop links, uniforms, onboarding, renewals',
  ARRAY['customer', 'support', 'onboarding', 'renewal', 'subscription', 'churn', 'upsell', 'client', 'account-management', 'merchandise', 'tournament', 'team-store', 'drop-link', 'uniform'],
  'Customer',
  'customers',
  'Communities (Customers): youth sports organizations, clubs, leagues, schools, recreation centers, civic groups. Communications about merchandise, tournaments, player registrations, outreach, sponsorships, uniforms, team stores, Drop links.',
  '[{"condition": "churn", "priority": "critical"}, {"condition": "large-order", "priority": "high"}]'::jsonb,
  'Users',
  'text-blue-600',
  3
)
ON CONFLICT (slug) DO NOTHING;

COMMIT;
