# Session Notes — March 6, 2026

## Objective
Fix the MiM Intelligence Platform dashboard so scanned email/Slack activity correctly surfaces in the Investors, Partners, and Customers sections.

## Root Causes Identified

### 1. Entity Resolution Defaulting to Mark Slater
**Problem**: The Gmail scanner's entity resolver included the user's own emails (mark@madeinmotion.co, markslater9@gmail.com, etc.) in the participant list. Since Mark is the recipient on every email, his contact record absorbed all email activity. Since Mark's contact has no `organization_contacts` links, none of the activity routed to any org — making the dashboard empty.

**Fix applied** (`gmail-scanner.ts`):
- Filter user emails out of the participant list before entity resolution
- Removed the fallback that re-included user emails when no counterparty was found
- Auto-create contacts for unknown senders so they can be resolved

### 2. Vercel Deployment Protection Blocking Self-Referencing API Calls
**Problem**: The partnership/customer/fundraising scanners called the Gmail and Slack scanner endpoints via `fetch()` HTTP requests. Vercel's deployment protection (SSO auth) blocked these server-to-server calls.

**Fix applied** (scanner route files):
- Replaced HTTP self-referencing calls with direct function imports (`runGmailScanner`, `runSlackScanner`)

### 3. Thread-Skip Discarding Activity Entirely
**Problem**: When the scanner found an existing open task for the same email thread (< 48 hours old), it executed `continue;` which skipped ALL processing — no activity_log entry, no correspondence entry. This made ongoing conversations invisible to the dashboard.

**Fix applied** (`gmail-scanner.ts`):
- Thread-skipped emails now still create activity_log and correspondence entries
- Only task creation is skipped (avoiding duplicates)

### 4. Dashboard Showing Knowledge Ingestion Entries
**Problem**: After allowing null entity_id entries through to tag-based routing, `knowledge_ingested` activity entries (which have tags like "customer-behavior") leaked into the Partner/Investor/Customer sections.

**Fix applied** (`page.tsx`):
- Added `ACTIVITY_ACTION_TYPES` filter: only `email_scanned` and `slack_scanned` entries are processed for dashboard routing

### 5. Agents Table Overriding Scan Hours Parameter
**Problem**: `runGmailScanner(sb, 168)` was being overridden by the agents table config (`scan_hours: 24`), limiting every scan to 24 hours regardless of the parameter passed.

**Fix applied** (`gmail-scanner.ts`):
- Explicit scan hours parameter now takes priority over the agents table default

### 6. Vercel Serverless Timeout (120 seconds)
**Problem**: A full 7-day scan processing 100+ emails through Claude API classification exceeds Vercel's 120-second serverless function timeout. The scan times out before completing.

**Status**: UNRESOLVED — requires architectural change (batched scanning, background jobs, or longer timeout via Vercel Pro plan).

## What Was Deployed (Commits)
1. `68627da` — Entity resolution fix, HTTP→direct imports, null entity_id routing, error feedback
2. `fe06ea5` — Auto-org creation for unknown senders
3. `01a4b38` — Action type filter to exclude knowledge_ingested
4. `9484f74` → `16ca4b9` — Remove entity resolution fallback, preserve thread-skip activity
5. `8c8699d` — Fix scan hours parameter override

## Current State of the Data
- **226 activity_log entries** (53 after data clearing, 20 new from latest scan)
- **FoundersEdge** (Investor org) correctly resolved for 1 email (Drizly forwarded)
- **10X Venture Partners** — task deleted so re-scan can auto-create the org
- **11 new contacts** auto-created from sender emails
- **381 organization_contacts links** exist connecting contacts to orgs
- **152 Investor orgs**, **8 Partner orgs**, **343 Customer orgs** in the database

## Data Verification
A Python simulation of the dashboard's exact data flow was run against the anon key. With the original 148 email_scanned entries (before cleanup), the simulation produced:
- **49 investor rows** (mostly FoundersEdge)
- **4 partner rows** (SB Gunners, City Sports Programs, New England Surf)
- **4 customer rows** (same orgs that have both Partner and Customer types)

This proves the dashboard code IS correct. The issue is getting enough properly-resolved scan data into the activity_log.

## Remaining Issues

### Critical
1. **Full 7-day scan can't complete** — Vercel's 120s timeout kills it. Options:
   - Use Vercel Pro for 300s timeout
   - Implement batched scanning (process 10-20 emails per invocation)
   - Run scanner locally or via a long-running process
   - Use Vercel background functions or cron jobs

2. **Knowledge ingestion doesn't update CRM** — When a user enters "Jess @ FoundersEdge introduced us to Sarah Smith Fund" in the knowledge view, it creates a KB entry with a nice summary but does NOT create/update orgs, contacts, or relationships. The knowledge ingestion pipeline needs entity extraction.

3. **Dashboard needs a hard refresh** — Browser caching may show old JS bundles. Users should do Ctrl+Shift+R after deployments.

### Architectural
4. **Entity resolver is contact-first** — It only matches emails to existing contacts. If a contact doesn't exist for an investor's email, the email gets auto-contact-created but not auto-org-created (unless the classifier's tags match a taxonomy category AND the sender has a non-free-email domain).

5. **Organization_contacts coverage is sparse** — Only 381 links exist for 551 orgs. Many orgs have no linked contacts, meaning emails from those orgs' people won't route correctly.

6. **Single-pass scanner** — The scanner processes each email once. If entity resolution fails (e.g., before the fix), re-running the scanner won't reprocess old emails (dedup by gmail_message_id). Fixing this requires clearing correspondence entries.

## Key Files Modified
- `src/lib/gmail-scanner.ts` — Entity resolution, thread-skip, auto-org creation, hours override
- `src/app/page.tsx` — Activity action type filter, error feedback on scanner buttons
- `src/app/api/agents/partnership-scanner/route.ts` — Direct function imports
- `src/app/api/agents/customer-scanner/route.ts` — Direct function imports
- `src/app/api/agents/fundraising-scanner/route.ts` — Direct function imports
