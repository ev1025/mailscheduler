-- v2 Phase C: Knowledge base
CREATE TABLE IF NOT EXISTS knowledge_folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  parent_id UUID REFERENCES knowledge_folders(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_knowledge_folders_parent ON knowledge_folders(parent_id, sort_order);

CREATE TABLE IF NOT EXISTS knowledge_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  folder_id UUID REFERENCES knowledge_folders(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT,
  excerpt TEXT,
  tags TEXT[],
  pinned BOOLEAN DEFAULT FALSE,
  type TEXT DEFAULT 'note' CHECK (type IN ('note','link','snippet','recipe')),
  url TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_folder ON knowledge_items(folder_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_tags ON knowledge_items USING GIN (tags);

ALTER TABLE knowledge_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON knowledge_folders;
CREATE POLICY "Allow all" ON knowledge_folders FOR ALL TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all" ON knowledge_items;
CREATE POLICY "Allow all" ON knowledge_items FOR ALL TO anon USING (true) WITH CHECK (true);
