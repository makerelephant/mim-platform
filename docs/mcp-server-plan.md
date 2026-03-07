# MCP Server: MiM Intelligence Command Center

## Vision

The MiM platform's web dashboard is a passive display. The MCP server turns it into an active intelligence system — a conversational co-pilot for the CEO. Instead of clicking buttons and navigating pages, Mark talks to Claude, which queries the database, triggers scanners, creates tasks, surfaces intelligence, and manages relationships on demand.

**Phase 1**: stdio transport for personal CEO use via Claude Desktop/Code
**Phase 2**: SSE transport for team access (Walt, ops team)
**Phase 3**: Customer-facing AI console for club/league operators

## Why MCP Over the Web Dashboard

| Capability | Web Dashboard | MCP Server |
|-----------|--------------|------------|
| Query orgs/contacts | Click through pages | "Show me all investor orgs at First Meeting stage" |
| Run scanners | Click button, wait, no feedback | "Scan my email for the last 7 days" — with full error reporting |
| Create tasks | Navigate to task page, fill form | "Create a task to follow up with 10X Venture Partners" |
| Entity dossier | Open org page, scroll through tabs | "Tell me everything about FoundersEdge" |
| Pipeline overview | Open pipeline page | "What's our deal pipeline look like?" |
| Cross-reference | Manual mental effort | "Which investors have we emailed this week but have no follow-up tasks?" |
| Knowledge search | Navigate to KB, search | "What do we know about the youth sports market?" |

## Architecture

```
mcp-server/                 # Standalone package (no Next.js dependency)
├── package.json             # @modelcontextprotocol/sdk, @supabase/supabase-js, zod
├── tsconfig.json            # ES2022, ESM
├── src/
│   ├── index.ts             # MCP Server bootstrap, tool registration, stdio transport
│   ├── supabase.ts          # Direct Supabase connection via service key
│   ├── tools/
│   │   ├── organizations.ts # search, get, create, update (4 tools)
│   │   ├── contacts.ts      # search, get, create, update (4 tools)
│   │   ├── tasks.ts         # list, create, update (3 tools)
│   │   ├── knowledge.ts     # search, get, ingest (3 tools)
│   │   ├── pipeline.ts      # list, create, update opportunities (3 tools)
│   │   ├── intelligence.ts  # activity feed, entity dossier, business summary (3 tools)
│   │   └── scanners.ts      # trigger scanner, get weekly report (2 tools)
│   └── lib/
│       ├── dossier.ts       # Entity dossier builder (7 parallel Supabase queries)
│       └── taxonomy.ts      # Taxonomy loader (single query + defaults)
```

**Key Design Decision**: Direct Supabase connection via service key. The MCP server bypasses the Next.js app for all reads/writes, eliminating Vercel timeout issues and deployment protection complications. Scanner triggers are the only HTTP calls (to the deployed Vercel routes).

## 22 Tools Across 7 Domains

### Organizations (4)
- `search_organizations` — Search/filter by name, type (Investor/Customer/Partner), status
- `get_organization` — Full details + contacts, tasks, correspondence, opportunities, dossier
- `create_organization` — Add new org with type classification
- `update_organization` — Modify any org field

### Contacts (4)
- `search_contacts` — Search by name, email, org
- `get_contact` — Full contact with linked orgs, tasks, correspondence
- `create_contact` — Add contact, optionally link to org
- `update_contact` — Modify contact fields

### Tasks (3)
- `list_tasks` — Filter by status, priority, entity
- `create_task` — Create action item with entity linking
- `update_task` — Update status, priority, star

### Knowledge Base (3)
- `search_knowledge` — Search by title, tags, source type
- `get_knowledge_entry` — Full KB entry with content
- `ingest_knowledge` — Add text to KB via ingestion pipeline

### Pipeline (3)
- `list_opportunities` — Filter deals by stage, type, org
- `create_opportunity` — Add new deal
- `update_opportunity` — Advance stage, update value

### Intelligence (3)
- `get_activity_feed` — Recent activity across all agents
- `get_entity_dossier` — Comprehensive entity intelligence profile (7 parallel queries)
- `get_business_summary` — CEO at-a-glance: org counts, pipeline, tasks, activity volume

### Scanners & Reports (2)
- `trigger_scanner` — Run any scanner (gmail, slack, sheets, sentiment, customer, partnership, fundraising)
- `get_weekly_report` — Generate new report or retrieve latest

## Configuration

### Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "mim-platform": {
      "command": "node",
      "args": ["<path>/mcp-server/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://smychxtekmfzezirpubp.supabase.co",
        "SUPABASE_SERVICE_KEY": "<service-key>",
        "MIM_APP_URL": "https://mim-platform.vercel.app"
      }
    }
  }
}
```

## Example Conversations

**Morning briefing:**
> "Give me a business summary for the last 7 days"

Claude calls `get_business_summary(period_days=7)` and returns org counts, pipeline metrics, open tasks, recent activity volume.

**Investor follow-up:**
> "What's the latest with FoundersEdge?"

Claude calls `get_entity_dossier(entity_type="organizations", entity_id="a5e0a238...")` and returns the full dossier with recent emails, open tasks, pipeline status, and relationship context.

**New investor intro:**
> "Create an investor org for 10X Venture Partners, add Douglas Coulter as a contact"

Claude calls `create_organization(name="10X Venture Partners", org_type=["Investor"])` then `create_contact(name="Douglas Coulter", primary_org_id=<new-org-id>)`.

**Task management:**
> "Show me all overdue high-priority tasks"

Claude calls `list_tasks(status="todo", priority="high")` and filters by due date.


# Bigger Vision: MiM Intelligence Platform

## What MiM Is Becoming

MiM started as a custom merchandise platform for youth sports organizations. The intelligence layer transforms it from "a store" into "a business operating system" — an AI-powered CRM that:

1. **Scans all business communications** (Gmail, Slack, Google Sheets) and automatically classifies them by relationship type (Investor, Partner, Customer)
2. **Creates tasks and action items** from email conversations without manual entry
3. **Routes activity to the right dashboard section** so the CEO sees what matters
4. **Builds entity dossiers** — comprehensive profiles combining correspondence, tasks, knowledge, sentiment, and pipeline data
5. **Generates weekly reports** summarizing activity across all relationship types
6. **Ingests knowledge** — meeting notes, articles, research — and connects it to entities

## The Three-Pillar Architecture

```
┌─────────────────────────────────────────────────────┐
│                  MiM Intelligence                    │
│                                                      │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Investors │  │  Partners    │  │  Customers   │  │
│  │ (Fundrais)│  │ (Channels)   │  │ (Communities)│  │
│  └────┬─────┘  └──────┬───────┘  └──────┬───────┘  │
│       │                │                  │          │
│  ┌────┴────────────────┴──────────────────┴────┐    │
│  │            Inference Taxonomy                │    │
│  │  (Signal keywords, priority rules, routing)  │    │
│  └──────────────────┬──────────────────────────┘    │
│                     │                                │
│  ┌──────────────────┴──────────────────────────┐    │
│  │              Scanner Pipeline                │    │
│  │  Gmail → Classify → Route → Task → Activity  │    │
│  │  Slack → Classify → Route → Task → Activity  │    │
│  │  Sheets → Import → Enrich → Activity          │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │           Knowledge + Sentiment               │    │
│  │  KB entries, news scanning, entity feedback   │    │
│  └──────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

## Immediate Priorities (Next Session)

### 1. Fix Scanner Timeout
The Gmail scanner can't process 100+ emails within Vercel's 120-second timeout. Solutions:
- **Batched scanning**: Process 15-20 emails per invocation, track progress in DB
- **Background functions**: Use Vercel's background function capability
- **Local runner**: A script that calls the scanner API in batches

### 2. Knowledge Ingestion Entity Extraction
When a user enters "Jess @ FoundersEdge introduced us to Sarah Smith Fund", the system should:
- Extract entities: Jess (contact), FoundersEdge (org), Sarah Smith Fund (org)
- Create/update orgs and contacts as needed
- Link the KB entry to the entities
- Create relationships (introduction = warm lead)

### 3. Build the MCP Server
Follow the plan in this document. The MCP server bypasses all the web dashboard limitations:
- No Vercel timeout (runs as a local process)
- No deployment protection issues
- Direct Supabase access with service key
- Full error reporting in conversation
- Cross-entity queries that the dashboard can't do

### 4. Enrich Organization-Contact Coverage
Only 381 organization_contacts links exist for 551 orgs. Many orgs imported from the CRM have no linked contacts. The scanner can't route emails to these orgs without the links. Options:
- Bulk import contact-org links from the original CRM data
- Auto-link based on email domain matching
- Manual enrichment via MCP server ("link all @foundersedge.co contacts to FoundersEdge")
