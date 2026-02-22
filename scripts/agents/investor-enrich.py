"""
Investor Enrichment Agent
For investors with sparse data, uses Claude to search the web and fill in missing fields.

Prerequisites:
  pip install anthropic supabase

Environment variables:
  SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY
"""

import os
import json
from datetime import datetime

import anthropic
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://smychxtekmfzezirpubp.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
AGENT_NAME = "investor-enrich"
MAX_ENRICHMENTS = 20


def enrich_investor(client, firm_name):
    """Use Claude to look up investor firm information."""
    try:
        response = client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=800,
            messages=[{
                "role": "user",
                "content": f"""Look up the investment firm "{firm_name}" and provide the following information.
Return ONLY a JSON object with these fields (use null for unknown):
{{
  "description": "Brief description of the firm (1-2 sentences)",
  "sector_focus": "Their investment sector focus areas",
  "website": "Their website URL",
  "notable_investments": "Notable portfolio companies",
  "check_size": "Typical check/investment size range"
}}

Return ONLY the JSON object, nothing else."""
            }]
        )
        text = response.content[0].text.strip()
        # Find JSON in response
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(text[start:end])
    except Exception as e:
        print(f"  Error enriching {firm_name}: {e}")
    return None


def run():
    """Main agent run."""
    print(f"[{AGENT_NAME}] Starting enrichment...")

    if not SUPABASE_KEY or not ANTHROPIC_KEY:
        print("ERROR: Set SUPABASE_SERVICE_KEY and ANTHROPIC_API_KEY environment variables")
        return

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)

    # Log run start
    run_data = sb.table("agent_runs").insert({
        "agent_name": AGENT_NAME,
        "status": "running",
    }).execute()
    run_id = run_data.data[0]["id"] if run_data.data else None

    records_processed = 0
    records_updated = 0

    try:
        # Find investors with sparse data
        investors = sb.table("investors").select("id, firm_name, description, sector_focus, website, notable_investments").execute()

        sparse = [
            inv for inv in investors.data
            if not inv.get("description") and not inv.get("sector_focus")
        ]

        print(f"  Found {len(sparse)} investors needing enrichment (max {MAX_ENRICHMENTS})")

        for inv in sparse[:MAX_ENRICHMENTS]:
            records_processed += 1
            print(f"  Enriching: {inv['firm_name']}...")

            data = enrich_investor(client, inv["firm_name"])
            if not data:
                continue

            # Update record with non-null values
            update = {}
            for field in ["description", "sector_focus", "website", "notable_investments", "check_size"]:
                if data.get(field):
                    update[field] = data[field]

            if update:
                sb.table("investors").update(update).eq("id", inv["id"]).execute()
                records_updated += 1

                # Log activity
                fields_updated = ", ".join(update.keys())
                sb.table("activity_log").insert({
                    "agent_name": AGENT_NAME,
                    "action_type": "investor_enriched",
                    "entity_type": "investors",
                    "entity_id": inv["id"],
                    "summary": f"Enriched {inv['firm_name']} — added {fields_updated}",
                    "raw_data": update,
                }).execute()

                print(f"    Updated: {fields_updated}")

        # Complete run
        if run_id:
            sb.table("agent_runs").update({
                "status": "completed",
                "completed_at": datetime.now().isoformat(),
                "records_processed": records_processed,
                "records_updated": records_updated,
            }).eq("id", run_id).execute()

        print(f"  Processed: {records_processed}, Updated: {records_updated}")

    except Exception as e:
        print(f"  Error: {e}")
        if run_id:
            sb.table("agent_runs").update({
                "status": "failed",
                "completed_at": datetime.now().isoformat(),
                "error_message": str(e),
            }).eq("id", run_id).execute()


if __name__ == "__main__":
    run()
