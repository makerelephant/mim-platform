# MCP Functional Spec
> **Author:** Mark Slater, Co-founder & CEO — Made in Motion PBC
> **Status:** Draft. MCP server built (28 tools), not yet deployed to host.
> **Last updated:** 2026-03-18

---

## 1. What Is MCP

MCP (Model Context Protocol) is the interface standard that allows AI models to call structured tools on external systems. For In Motion, it is the mechanism that gives Claude — or any MCP-compatible AI client — direct, structured access to the brain's data and capabilities.

In plain terms: MCP turns the brain into an API that any AI can call with natural language.

---

## 2. Why MCP Over a Custom Chat UI

| Concern | Custom UI | MCP Server |
|---------|-----------|------------|
| Natural language understanding | Must be built | Claude handles it natively |
| Client surface | One app | Claude Desktop, Claude Code, any future MCP client |
| Tool composition | Manual | Claude chains tools automatically |
| Maintenance | Ongoing | Tools are stable; Claude handles query variability |
| Extensibility | App-specific | Any AI tool can connect |

The brain becomes a headless intelligence layer. The CEO interacts with it from whatever surface they're already in.

---

## 3. Current State

**Built:** 28 tools across 9 domains.
**Not deployed:** MCP server exists as a TypeScript project but has not been deployed to a host. Currently only runnable locally via stdio transport.

---

## 4. Tool Inventory

### Domain: Knowledge
| Tool | Description |
|------|-------------|
| `search_knowledge` | Semantic search over knowledge_base via RAG (vector similarity) |
| `ingest_document` | Upload/ingest text or file into knowledge_base |
| `get_document` | Retrieve a specific document with its chunks |

### Domain: Instructions
| Tool | Description |
|------|-------------|
| `create_instruction` | Give the brain a standing order, report inclusion, or scheduled action |
| `list_instructions` | Show active/pending instructions |
| `update_instruction` | Modify, pause, or cancel an instruction |

### Domain: Intelligence
| Tool | Description |
|------|-------------|
| `ask_brain` | General-purpose Q&A: RAG + entity dossiers + active instructions → Claude synthesis |
| `get_activity_feed` | Recent brain activity log |
| `get_business_summary` | Cross-source synthesis for an entity or topic |

### Domain: Reports
| Tool | Description |
|------|-------------|
| `generate_report` | Trigger report generation (with instruction fulfillment) |
| `get_report` | Retrieve a specific generated report |

### Domain: Tasks
| Tool | Description |
|------|-------------|
| `list_tasks` | Query tasks with filters (owner, status, category, date range) |
| `create_task` | Create a task manually |
| `update_task` | Approve, dismiss, or edit a task |

### Domain: Contacts
| Tool | Description |
|------|-------------|
| `search_contacts` | Search contacts by name, email, organisation |
| `get_contact` | Full contact record with correspondence history |
| `create_contact` | Add a new contact (routes through ingestion point) |

### Domain: Organisations
| Tool | Description |
|------|-------------|
| `search_orgs` | Search organisations |
| `get_entity_dossier` | Full intelligence profile for an org or contact |
| `update_org` | Update organisation fields |

### Domain: Pipeline
| Tool | Description |
|------|-------------|
| `list_pipeline` | Pipeline deals with status, value, stage |
| `update_pipeline` | Move deals through stages |

### Domain: Correspondence
| Tool | Description |
|------|-------------|
| `search_correspondence` | Semantic search over email and Slack history |
| `get_thread` | Full email or Slack thread with context |

### Domain: System / Gophers
| Tool | Description |
|------|-------------|
| `trigger_gopher` | Run a Gopher (Gmail, Slack, Briefing, etc.) |
| `get_system_health` | Platform health status |
| `list_behavioral_rules` | Active learned rules |

---

## 5. The `ask_brain` Tool — Core Logic

`ask_brain` is the general-purpose query tool and the MCP server's most important capability:

```
ask_brain(question: string) →

  1. Embed question via OpenAI text-embedding-3-small
  2. Vector search: brain.search_knowledge RPC → top 15 relevant chunks
  3. Entity resolution: extract named entities from question
  4. Entity dossiers: build context block for each resolved entity
  5. Active instructions: load relevant standing orders
  6. Recent activity: last 30 days for mentioned entities
  7. Claude synthesis: all context → structured answer with citations

Returns: answer text + source citations + entity references
```

---

## 6. Transport Strategy

| Phase | Transport | Client |
|-------|-----------|--------|
| Now | stdio (local) | Claude Desktop, Claude Code |
| Next | SSE (remote) | Web clients, mobile, third-party AI tools |

For CEO use from Claude Desktop: `npx mcp-server` locally, pointed at production Supabase URL + service key.

---

## 7. Deployment Requirements

To deploy the MCP server:

1. Host the TypeScript server (Node.js) — Render, Railway, or Vercel Edge Function
2. Configure environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
3. Switch transport from stdio to SSE for remote access
4. Register MCP server endpoint with the CEO's Claude Desktop config

---

## 8. Classifier Ontology as a Queryable Resource

One of the most underutilised capabilities of the MCP server is exposing the brain's classifier ontology as a queryable resource. The 11 Acumen categories, their definitions, priority rules, and harness documents can be surfaced through MCP tools — allowing any AI agent to understand the brain's operating logic before sending data through it.

**Practical example:** An external agent processing a new email can call `get_classifier_context(category: "fundraising")` before classifying, ensuring it applies the same rules the brain uses internally. This is the mechanism that makes the brain's intelligence portable.

---

## 9. Open Decisions

1. **Hosting platform:** Where to deploy the MCP server for always-on access?
2. **Authentication:** How does the MCP server authenticate callers in SSE mode? Service key only, or per-user tokens?
3. **Rate limiting:** At what call volume does the MCP server need rate limiting on Supabase queries?
4. **Tool versioning:** How do we handle breaking changes to tool schemas when CEO workflows depend on them?

---

## 10. Success Criteria

The MCP server is production-ready when the CEO can:

- [ ] Ask "what do we know about our Adidas partnership?" from Claude Desktop and get a sourced answer
- [ ] Say "include the Q1 strategy doc in this week's report" and see it appear
- [ ] Trigger the Gmail Gopher from Claude Code without opening the browser
- [ ] Create a standing order conversationally that persists across sessions
- [ ] Query pipeline status, task backlog, and entity dossiers from any MCP client
