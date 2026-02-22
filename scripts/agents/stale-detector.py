"""
Stale Pipeline Detector
Flags investor relationships that have gone cold (>30 days no contact).

Prerequisites:
  pip install supabase

Environment variables:
  SUPABASE_URL, SUPABASE_SERVICE_KEY
"""

import os
from datetime import datetime, timedelta

from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://smychxtekmfzezirpubp.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
AGENT_NAME = "stale-detector"
STALE_DAYS = 30


def run():
    """Main agent run."""
    print(f"[{AGENT_NAME}] Checking for stale investor relationships...")

    if not SUPABASE_KEY:
        print("ERROR: Set SUPABASE_SERVICE_KEY environment variable")
        return

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Log run start
    run_data = sb.table("agent_runs").insert({
        "agent_name": AGENT_NAME,
        "status": "running",
    }).execute()
    run_id = run_data.data[0]["id"] if run_data.data else None

    records_processed = 0
    records_updated = 0

    try:
        cutoff = (datetime.now() - timedelta(days=STALE_DAYS)).strftime("%Y-%m-%d")

        # Find investors with old last_contact_date, not already Passed or Closed
        investors = sb.table("investors").select(
            "id, firm_name, last_contact_date, pipeline_status, connection_status"
        ).not_.in_("pipeline_status", ["Passed", "Closed"]).execute()

        for inv in investors.data:
            records_processed += 1
            last_contact = inv.get("last_contact_date")

            # Flag as stale if no contact date or contact was before cutoff
            is_stale = not last_contact or last_contact < cutoff

            if is_stale and inv.get("connection_status") != "Stale":
                # Update connection status
                sb.table("investors").update({
                    "connection_status": "Stale"
                }).eq("id", inv["id"]).execute()

                # Create follow-up task
                sb.table("tasks").insert({
                    "title": f"Re-engage {inv['firm_name']} — last contact {last_contact or 'unknown'}",
                    "entity_type": "investors",
                    "entity_id": inv["id"],
                    "priority": "medium",
                    "source": AGENT_NAME,
                }).execute()

                # Log activity
                sb.table("activity_log").insert({
                    "agent_name": AGENT_NAME,
                    "action_type": "investor_flagged_stale",
                    "entity_type": "investors",
                    "entity_id": inv["id"],
                    "summary": f"Flagged {inv['firm_name']} as stale — last contact {last_contact or 'never'}",
                }).execute()

                records_updated += 1
                print(f"  Flagged stale: {inv['firm_name']}")

        # Complete run
        if run_id:
            sb.table("agent_runs").update({
                "status": "completed",
                "completed_at": datetime.now().isoformat(),
                "records_processed": records_processed,
                "records_updated": records_updated,
            }).eq("id", run_id).execute()

        print(f"  Checked: {records_processed}, Flagged stale: {records_updated}")

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
