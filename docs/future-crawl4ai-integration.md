# Future Initiative: Crawl4AI Integration

**Status:** Proposed
**Priority:** Medium
**Date:** 2026-03-10

## Problem

The news scanner currently relies exclusively on RSS feeds, which limits coverage to sources that publish feeds. Many valuable sources for our interest categories (MCP ecosystem, OpenClaw, Crawl4AI itself, AI thought leader blogs, MIT research pages) don't have RSS feeds or have incomplete ones. This means the brain has blind spots — the taxonomy categories exist but content isn't flowing into them.

## Proposed Solution

Integrate [Crawl4AI](https://github.com/unclecode/crawl4ai) (or a similar structured web scraping tool) into the scanner pipeline to:

1. **Crawl targeted web sources** beyond RSS — blogs, project pages, GitHub release pages, research portals
2. **Extract structured content** — articles, announcements, changelogs, research papers
3. **Feed into the existing pipeline** — taxonomy classification, knowledge base ingestion, sentiment analysis

## Architecture Considerations

### Option A: Python Agent (Recommended)
- Add a new Python agent in `scripts/agents/` alongside the existing Gmail scanner
- Uses Crawl4AI's async crawler with LLM extraction strategy
- Runs on a schedule (daily or twice-daily)
- Outputs to the same `knowledge_base` table via Supabase

### Option B: Next.js API Route
- New `/api/agents/web-scanner` route similar to existing scanner routes
- Calls a hosted Crawl4AI instance or uses a lighter JS-based scraper
- Risk: Vercel timeout limits (60s on Pro) may be too short for crawling

### Option C: Standalone Service
- Separate containerized service running Crawl4AI
- Pushes results to Supabase directly
- Most flexible but adds infrastructure complexity

## Target Sources by Category

| Category | Example Sources |
|----------|----------------|
| MCP | anthropic.com/news, modelcontextprotocol.io, GitHub MCP repos |
| AI Innovation | arxiv.org (AI papers), openai.com/blog, anthropic.com/research |
| AI Thought Leaders | darioamodei.com, blog.samaltman.com, personal blogs/substacks |
| OpenClaw | GitHub releases, project blog |
| Crawl4AI | GitHub releases, docs updates |
| Local Models | ollama.com/blog, huggingface.co trending, r/LocalLLaMA |
| MIT | news.mit.edu, csail.mit.edu/news, MIT Technology Review |
| AI + UI/UX | vercel.com/blog, specific design+AI blogs |
| Youth Sports | Youth sports business publications, league announcement pages |
| Generative Commerce | Shopify engineering blog, commerce-focused AI newsletters |

## Integration with Existing System

```
Crawl4AI Agent
    ↓
Extract & clean content
    ↓
POST /api/brain/ingest (existing route)
    ↓
Claude classifier (uses taxonomy categories)
    ↓
knowledge_base table + activity_log
    ↓
Appears in Sentiment card + Knowledge Base
```

The key insight is that Crawl4AI should feed into the **existing ingestion pipeline** rather than bypass it. This means:
- Taxonomy categories and signal keywords apply automatically
- Entity resolution works the same way
- Knowledge base deduplication handles repeat crawls
- No new UI needed — content appears in existing views

## Implementation Steps

1. **Phase 1: Proof of concept** — Single Python script crawling 3-5 sources, outputting to knowledge_base
2. **Phase 2: Source management** — DB table for crawl targets (URL, frequency, extraction rules)
3. **Phase 3: Scheduling** — Integrate with `run-all.py` orchestrator or GitHub Actions daily scan
4. **Phase 4: UI** — Source management page in Settings to add/edit/disable crawl targets

## Cost & Rate Limit Considerations

- Crawl4AI is open source (free) but needs a host to run
- LLM extraction strategy uses Claude tokens per page crawled
- Should implement deduplication to avoid re-processing unchanged pages
- Respect robots.txt and rate limits per domain
- Consider caching/hashing page content to skip unchanged pages

## Dependencies

- Python 3.10+ environment (already exists for agents)
- Crawl4AI package (`pip install crawl4ai`)
- Playwright (Crawl4AI dependency for JS-rendered pages)
- Existing Supabase connection and brain ingestion API
