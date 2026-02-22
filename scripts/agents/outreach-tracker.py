"""
Market Map Outreach Tracker
Tracks which soccer programs have been contacted and flags high-value opportunities.

Prerequisites:
  pip install supabase

Environment variables:
  SUPABASE_URL, SUPABASE_SERVICE_KEY
"""

import os
from datetime import datetime

from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://smychxtekmfzezirpubp.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
AGENT_NAME = "outreach-tracker"
MIN_PLAYERS_HIGH_VALUE = 300


def run():
    """Main agent run."""
    print(f"[{AGENT_NAME}] Scanning market map for outreach opportunities...")

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
        # Fetch all programs
        programs = sb.table("market_map").select(
            "id, program_name, league, players, merch_link, outreach_status, primary_contact"
        ).execute()

        for prog in programs.data:
            records_processed += 1

            # Flag high-value uncontacted programs
            is_high_value = (
                (prog.get("players") or 0) >= MIN_PLAYERS_HIGH_VALUE and
                prog.get("outreach_status") == "Not Contacted"
            )

            has_merch_opportunity = (
                prog.get("merch_link") is not None and
                prog.get("outreach_status") == "Not Contacted"
            )

            if is_high_value or has_merch_opportunity:
                reasons = []
                if is_high_value:
                    reasons.append(f"{prog['players']} players")
                if has_merch_opportunity:
                    reasons.append("has merch link")

                reason_str = ", ".join(reasons)

                # Create outreach task
                sb.table("tasks").insert({
                    "title": f"Reach out to {prog['program_name']} ({prog['league']}) — {reason_str}",
                    "description": f"High-value program: {reason_str}. Contact: {prog.get('primary_contact', 'unknown')}",
                    "entity_type": "market_map",
                    "entity_id": prog["id"],
                    "priority": "high" if is_high_value else "medium",
                    "source": AGENT_NAME,
                }).execute()

                # Log activity
                sb.table("activity_log").insert({
                    "agent_name": AGENT_NAME,
                    "action_type": "outreach_opportunity_flagged",
                    "entity_type": "market_map",
                    "entity_id": prog["id"],
                    "summary": f"Flagged {prog['program_name']} for outreach — {reason_str}",
                }).execute()

                records_updated += 1
                print(f"  Flagged: {prog['program_name']} ({reason_str})")

        # Complete run
        if run_id:
            sb.table("agent_runs").update({
                "status": "completed",
                "completed_at": datetime.now().isoformat(),
                "records_processed": records_processed,
                "records_updated": records_updated,
            }).eq("id", run_id).execute()

        print(f"  Scanned: {records_processed}, Flagged: {records_updated}")

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
