-- ============================================================
-- Knowledge Base — Universal ingestion store
-- ============================================================
-- Stores documents, research reports, presentations, etc.
-- from any surface area (email, Slack, web upload, API).
-- Each entry represents an ingested knowledge artifact.
-- ============================================================

-- 1. Main table
CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  source_type TEXT NOT NULL,              -- 'upload', 'email', 'slack', 'notion', 'chat', 'api'
  source_ref TEXT,                        -- original file path, message ID, URL, etc.
  file_type TEXT,                         -- 'pdf', 'docx', 'pptx', 'md', 'txt', 'html', 'csv'
  file_url TEXT,                          -- Supabase Storage URL (if file was uploaded)
  file_size_bytes INTEGER,
  content_text TEXT,                      -- extracted full text
  content_chunks JSONB,                   -- [{chunk_index, text, token_count}]
  summary TEXT,                           -- AI-generated summary
  taxonomy_categories TEXT[],             -- which taxonomy categories this relates to
  entity_ids UUID[],                      -- linked entities (orgs, contacts)
  tags TEXT[],                            -- extracted/classified tags
  metadata JSONB DEFAULT '{}',            -- source-specific metadata
  uploaded_by TEXT,                        -- user or surface area identifier
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error TEXT,                              -- processing error message if failed
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_kb_categories ON knowledge_base USING GIN(taxonomy_categories);
CREATE INDEX IF NOT EXISTS idx_kb_entities   ON knowledge_base USING GIN(entity_ids);
CREATE INDEX IF NOT EXISTS idx_kb_tags       ON knowledge_base USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_kb_processed  ON knowledge_base(processed) WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_kb_source     ON knowledge_base(source_type);
CREATE INDEX IF NOT EXISTS idx_kb_created    ON knowledge_base(created_at DESC);

-- 3. RLS policies
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access via service key" ON knowledge_base
  FOR ALL USING (true) WITH CHECK (true);

-- 4. Updated-at trigger
CREATE OR REPLACE FUNCTION update_knowledge_base_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kb_updated_at ON knowledge_base;
CREATE TRIGGER trg_kb_updated_at
  BEFORE UPDATE ON knowledge_base
  FOR EACH ROW EXECUTE FUNCTION update_knowledge_base_updated_at();

-- 5. Create Supabase Storage bucket (run this separately in SQL editor or via dashboard):
-- INSERT INTO storage.buckets (id, name, public) VALUES ('knowledge', 'knowledge', false);
-- Note: You can create the bucket via Supabase Dashboard > Storage > New Bucket > "knowledge"
