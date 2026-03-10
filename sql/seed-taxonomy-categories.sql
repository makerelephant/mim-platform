-- ============================================================================
-- Seed: Expanded Inference Taxonomy Categories
-- ============================================================================
-- Adds interest-based and research categories beyond the 3 core business
-- categories (Fundraising, Partnerships, Communities). These help the AI
-- classifier properly tag news articles, research, and knowledge base entries
-- that don't fit neatly into the investor/partner/customer buckets.
-- ============================================================================

BEGIN;

-- ── Youth Sports ─────────────────────────────────────────────────────────────

INSERT INTO inference_taxonomy (category, slug, description, signal_keywords, dashboard_card_key, prompt_fragment, icon, color, sort_order)
VALUES (
  'Youth Sports',
  'youth-sports',
  'Youth sports industry news, trends, leagues, clubs, tournaments, and sub-sport categories',
  ARRAY['youth-sports', 'youth-soccer', 'youth-hockey', 'youth-basketball', 'youth-lacrosse',
        'youth-volleyball', 'youth-athletics', 'club-sports', 'travel-sports', 'rec-league',
        'tournament', 'aau', 'usys', 'ecnl', 'ga-league', 'mlsnext', 'usclub',
        'little-league', 'pop-warner', 'youth-football', 'youth-baseball'],
  'sentiment',
  'Youth sports industry: any news about youth soccer, hockey, basketball, lacrosse, volleyball, baseball, football, or other youth athletics. Includes leagues (ECNL, GA, MLS NEXT, USYS, AAU), clubs, tournaments, travel sports, rec leagues, and youth development programs.',
  'Trophy',
  'text-orange-600',
  4
)
ON CONFLICT (slug) DO UPDATE SET
  signal_keywords = EXCLUDED.signal_keywords,
  description = EXCLUDED.description,
  prompt_fragment = EXCLUDED.prompt_fragment;

-- ── Generative Commerce ──────────────────────────────────────────────────────

INSERT INTO inference_taxonomy (category, slug, description, signal_keywords, dashboard_card_key, prompt_fragment, icon, color, sort_order)
VALUES (
  'Generative Commerce',
  'generative-commerce',
  'AI-powered commerce models, generative product design, on-demand manufacturing, personalized merchandise',
  ARRAY['generative-commerce', 'ai-commerce', 'on-demand', 'print-on-demand', 'personalization',
        'custom-merch', 'ai-design', 'generative-design', 'dynamic-pricing', 'ai-retail',
        'shopify-ai', 'commerce-ai', 'product-generation', 'mass-customization'],
  'sentiment',
  'Generative commerce and new commerce models leveraging AI: on-demand manufacturing, AI-powered product design, personalized merchandise, dynamic pricing, AI retail innovations, and the intersection of generative AI with e-commerce.',
  'Sparkles',
  'text-pink-600',
  5
)
ON CONFLICT (slug) DO UPDATE SET
  signal_keywords = EXCLUDED.signal_keywords,
  description = EXCLUDED.description,
  prompt_fragment = EXCLUDED.prompt_fragment;

-- ── AI Innovation ────────────────────────────────────────────────────────────

INSERT INTO inference_taxonomy (category, slug, description, signal_keywords, dashboard_card_key, prompt_fragment, icon, color, sort_order)
VALUES (
  'AI Innovation',
  'ai-innovation',
  'Major AI announcements, model releases, breakthroughs, benchmarks, and industry shifts',
  ARRAY['ai-innovation', 'ai-announcement', 'llm', 'foundation-model', 'gpt', 'claude',
        'gemini', 'llama', 'mistral', 'openai', 'anthropic', 'deepmind', 'meta-ai',
        'ai-breakthrough', 'benchmark', 'ai-safety', 'alignment', 'scaling-laws',
        'transformer', 'diffusion-model', 'multimodal', 'reasoning-model'],
  'sentiment',
  'AI innovation announcements: new model releases, capability breakthroughs, benchmark results, research papers, safety developments, and major shifts in the AI industry from OpenAI, Anthropic, Google DeepMind, Meta, Mistral, and others.',
  'Zap',
  'text-violet-600',
  6
)
ON CONFLICT (slug) DO UPDATE SET
  signal_keywords = EXCLUDED.signal_keywords,
  description = EXCLUDED.description,
  prompt_fragment = EXCLUDED.prompt_fragment;

-- ── AI Thought Leaders ───────────────────────────────────────────────────────

INSERT INTO inference_taxonomy (category, slug, description, signal_keywords, dashboard_card_key, prompt_fragment, icon, color, sort_order)
VALUES (
  'AI Thought Leaders',
  'ai-thought-leaders',
  'Opinions, interviews, and updates from key AI leaders: Dario Amodei, Sam Altman, and others',
  ARRAY['dario-amodei', 'sam-altman', 'demis-hassabis', 'yann-lecun', 'ilya-sutskever',
        'jensen-huang', 'satya-nadella', 'sundar-pichai', 'mark-zuckerberg',
        'thought-leader', 'ai-leadership', 'ai-policy', 'ai-ethics', 'ai-regulation',
        'executive-ai', 'keynote-ai'],
  'sentiment',
  'AI thought leaders and executives: commentary, interviews, blog posts, and announcements from Dario Amodei (Anthropic), Sam Altman (OpenAI), Demis Hassabis (DeepMind), Jensen Huang (NVIDIA), and other influential voices shaping AI direction and policy.',
  'Mic',
  'text-amber-600',
  7
)
ON CONFLICT (slug) DO UPDATE SET
  signal_keywords = EXCLUDED.signal_keywords,
  description = EXCLUDED.description,
  prompt_fragment = EXCLUDED.prompt_fragment;

-- ── Agentic Commerce ─────────────────────────────────────────────────────────

INSERT INTO inference_taxonomy (category, slug, description, signal_keywords, dashboard_card_key, prompt_fragment, icon, color, sort_order)
VALUES (
  'Agentic Commerce',
  'agentic-commerce',
  'AI agents in commerce: autonomous shopping, agent-to-agent transactions, agentic workflows in retail',
  ARRAY['agentic-commerce', 'ai-agent', 'autonomous-shopping', 'agent-workflow',
        'agent-to-agent', 'commerce-agent', 'shopping-agent', 'agentic-workflow',
        'agentic-ai', 'autonomous-commerce', 'agent-framework', 'tool-use'],
  'sentiment',
  'Agentic commerce: AI agents that autonomously browse, compare, purchase, and transact. Agent-to-agent commerce, agentic workflows in retail and e-commerce, autonomous shopping assistants, and the emerging agent economy.',
  'Bot',
  'text-cyan-600',
  8
)
ON CONFLICT (slug) DO UPDATE SET
  signal_keywords = EXCLUDED.signal_keywords,
  description = EXCLUDED.description,
  prompt_fragment = EXCLUDED.prompt_fragment;

-- ── OpenClaw ─────────────────────────────────────────────────────────────────

INSERT INTO inference_taxonomy (category, slug, description, signal_keywords, dashboard_card_key, prompt_fragment, icon, color, sort_order)
VALUES (
  'OpenClaw',
  'openclaw',
  'OpenClaw project news, updates, and related open-source AI initiatives',
  ARRAY['openclaw', 'open-claw', 'open-source-ai', 'oss-ai'],
  'sentiment',
  'OpenClaw: any news, updates, releases, or discussions related to the OpenClaw project and initiative.',
  'Cog',
  'text-red-600',
  9
)
ON CONFLICT (slug) DO UPDATE SET
  signal_keywords = EXCLUDED.signal_keywords,
  description = EXCLUDED.description,
  prompt_fragment = EXCLUDED.prompt_fragment;

-- ── MIT ──────────────────────────────────────────────────────────────────────

INSERT INTO inference_taxonomy (category, slug, description, signal_keywords, dashboard_card_key, prompt_fragment, icon, color, sort_order)
VALUES (
  'MIT',
  'mit',
  'MIT research, alumni news, CSAIL, Media Lab, and MIT-affiliated AI/tech developments',
  ARRAY['mit', 'massachusetts-institute-of-technology', 'csail', 'mit-media-lab',
        'mit-sloan', 'mit-research', 'mit-alumni', 'mit-technology-review'],
  'sentiment',
  'MIT (Massachusetts Institute of Technology): research publications, alumni news, CSAIL and Media Lab developments, MIT Sloan, MIT Technology Review articles, and any MIT-affiliated AI or technology breakthroughs.',
  'GraduationCap',
  'text-red-700',
  10
)
ON CONFLICT (slug) DO UPDATE SET
  signal_keywords = EXCLUDED.signal_keywords,
  description = EXCLUDED.description,
  prompt_fragment = EXCLUDED.prompt_fragment;

-- ── AI + UI/UX ───────────────────────────────────────────────────────────────

INSERT INTO inference_taxonomy (category, slug, description, signal_keywords, dashboard_card_key, prompt_fragment, icon, color, sort_order)
VALUES (
  'AI + UI/UX',
  'ai-ui-ux',
  'The intersection of AI with user interfaces and user experience design',
  ARRAY['ai-ux', 'ai-ui', 'ai-interface', 'generative-ui', 'conversational-ui',
        'ai-design-system', 'copilot-ux', 'ai-assistant-ui', 'natural-language-ui',
        'ai-personalization', 'adaptive-interface', 'human-ai-interaction',
        'prompt-ui', 'ai-frontend'],
  'sentiment',
  'The intersection of AI and UI/UX: generative user interfaces, conversational UI patterns, AI copilot experiences, adaptive interfaces, human-AI interaction design, prompt-driven UIs, and how AI is transforming frontend development and user experience.',
  'Palette',
  'text-indigo-600',
  11
)
ON CONFLICT (slug) DO UPDATE SET
  signal_keywords = EXCLUDED.signal_keywords,
  description = EXCLUDED.description,
  prompt_fragment = EXCLUDED.prompt_fragment;

-- ── Local Models ─────────────────────────────────────────────────────────────

INSERT INTO inference_taxonomy (category, slug, description, signal_keywords, dashboard_card_key, prompt_fragment, icon, color, sort_order)
VALUES (
  'Local Models',
  'local-models',
  'On-device AI, local inference, edge models, and self-hosted LLM developments',
  ARRAY['local-model', 'on-device-ai', 'edge-ai', 'ollama', 'llama-cpp', 'gguf',
        'quantization', 'mlx', 'local-inference', 'self-hosted-llm', 'private-ai',
        'on-prem-ai', 'small-language-model', 'slm', 'phi', 'tinyllama'],
  'sentiment',
  'Local and on-device AI models: Ollama, llama.cpp, MLX, quantized models, GGUF format, edge deployment, self-hosted LLMs, small language models (SLMs), and the movement toward private, local AI inference.',
  'HardDrive',
  'text-slate-600',
  12
)
ON CONFLICT (slug) DO UPDATE SET
  signal_keywords = EXCLUDED.signal_keywords,
  description = EXCLUDED.description,
  prompt_fragment = EXCLUDED.prompt_fragment;

-- ── MCP (Model Context Protocol) ─────────────────────────────────────────────

INSERT INTO inference_taxonomy (category, slug, description, signal_keywords, dashboard_card_key, prompt_fragment, icon, color, sort_order)
VALUES (
  'MCP',
  'mcp',
  'Model Context Protocol news, server implementations, integrations, and ecosystem developments',
  ARRAY['mcp', 'model-context-protocol', 'mcp-server', 'mcp-client', 'mcp-tool',
        'claude-mcp', 'mcp-integration', 'mcp-ecosystem', 'context-protocol',
        'tool-use-protocol'],
  'sentiment',
  'MCP (Model Context Protocol): any news about the Model Context Protocol standard, new MCP server implementations, client integrations, ecosystem growth, tool-use patterns, and how MCP is enabling AI agents to interact with external systems.',
  'Plug',
  'text-purple-600',
  13
)
ON CONFLICT (slug) DO UPDATE SET
  signal_keywords = EXCLUDED.signal_keywords,
  description = EXCLUDED.description,
  prompt_fragment = EXCLUDED.prompt_fragment;

-- ── Crawl4AI ─────────────────────────────────────────────────────────────────

INSERT INTO inference_taxonomy (category, slug, description, signal_keywords, dashboard_card_key, prompt_fragment, icon, color, sort_order)
VALUES (
  'Crawl4AI',
  'crawl4ai',
  'Crawl4AI project updates, web scraping for AI, and structured data extraction',
  ARRAY['crawl4ai', 'crawl-4-ai', 'web-scraping-ai', 'ai-crawler', 'structured-extraction',
        'web-data-ai'],
  'sentiment',
  'Crawl4AI: updates, releases, and discussions about the Crawl4AI project for web scraping and structured data extraction for AI applications.',
  'Globe',
  'text-teal-600',
  14
)
ON CONFLICT (slug) DO UPDATE SET
  signal_keywords = EXCLUDED.signal_keywords,
  description = EXCLUDED.description,
  prompt_fragment = EXCLUDED.prompt_fragment;

COMMIT;
