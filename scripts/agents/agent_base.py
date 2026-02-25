"""
Shared agent infrastructure for MiM Platform agents.
Provides Supabase client, Claude client, agent run lifecycle, and logging helpers.

Usage:
    from agent_base import AgentBase

    agent = AgentBase("my-agent")
    agent.log_activity("email_scanned", "investors", entity_id, "Found email thread")
    agent.create_task("Follow up", "Details here", "investors", entity_id, "high")
    agent.complete_run(10, 3)
"""

import os
import json
from datetime import datetime
from typing import Optional

from supabase import create_client, Client

try:
    import anthropic
except ImportError:
    anthropic = None


SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://smychxtekmfzezirpubp.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "")


class AgentBase:
    """Base class providing shared infrastructure for all MiM agents."""

    def __init__(self, agent_name: str):
        self.agent_name = agent_name
        self.records_processed = 0
        self.records_updated = 0

        if not SUPABASE_KEY:
            raise RuntimeError("SUPABASE_SERVICE_KEY environment variable not set")

        self.sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

        # Claude client (optional — some agents don't need it)
        self.claude = None
        if ANTHROPIC_KEY and anthropic:
            self.claude = anthropic.Anthropic(api_key=ANTHROPIC_KEY)

        # Start agent run
        self.run_id = None
        self._start_run()
        print(f"[{self.agent_name}] Started run {self.run_id}")

    def _start_run(self):
        """Insert agent_runs row with status=running."""
        result = self.sb.table("agent_runs").insert({
            "agent_name": self.agent_name,
            "status": "running",
        }).execute()
        if result.data:
            self.run_id = result.data[0]["id"]

    def complete_run(self, records_processed: Optional[int] = None, records_updated: Optional[int] = None):
        """Mark the agent run as completed."""
        if not self.run_id:
            return
        self.sb.table("agent_runs").update({
            "status": "completed",
            "completed_at": datetime.now().isoformat(),
            "records_processed": records_processed or self.records_processed,
            "records_updated": records_updated or self.records_updated,
        }).eq("id", self.run_id).execute()
        print(f"[{self.agent_name}] Completed — processed: {records_processed or self.records_processed}, updated: {records_updated or self.records_updated}")

    def fail_run(self, error_message: str):
        """Mark the agent run as failed."""
        if not self.run_id:
            return
        self.sb.table("agent_runs").update({
            "status": "failed",
            "completed_at": datetime.now().isoformat(),
            "error_message": error_message,
        }).eq("id", self.run_id).execute()
        print(f"[{self.agent_name}] FAILED: {error_message}")

    def log_activity(self, action_type: str, entity_type: Optional[str], entity_id: Optional[str],
                     summary: str, raw_data: Optional[dict] = None, source_id: Optional[str] = None):
        """Insert an activity_log entry."""
        payload = {
            "agent_name": self.agent_name,
            "action_type": action_type,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "summary": summary,
        }
        if raw_data:
            payload["raw_data"] = raw_data
        if source_id:
            payload["source_id"] = source_id
        self.sb.table("activity_log").insert(payload).execute()

    def create_task(self, title: str, description: Optional[str] = None,
                    summary: Optional[str] = None,
                    recommended_action: Optional[str] = None,
                    entity_type: Optional[str] = None, entity_id: Optional[str] = None,
                    priority: str = "medium", due_date: Optional[str] = None,
                    goal_relevance_score: Optional[int] = None,
                    gmail_thread_id: Optional[str] = None,
                    gmail_message_id: Optional[str] = None):
        """Insert a task with enriched fields."""
        payload = {
            "title": title,
            "priority": priority,
            "source": self.agent_name,
        }
        if description:
            payload["description"] = description
        if summary:
            payload["summary"] = summary
        if recommended_action:
            payload["recommended_action"] = recommended_action
        if entity_type:
            payload["entity_type"] = entity_type
        if entity_id:
            payload["entity_id"] = entity_id
        if due_date:
            payload["due_date"] = due_date
        if goal_relevance_score is not None:
            payload["goal_relevance_score"] = goal_relevance_score
        if gmail_thread_id:
            payload["gmail_thread_id"] = gmail_thread_id
        if gmail_message_id:
            payload["gmail_message_id"] = gmail_message_id
        self.sb.table("tasks").insert(payload).execute()
        print(f"  Task created [{priority}]: {title[:80]}")

    def log_correspondence(self, entity_type: str, entity_id: str, direction: str,
                           subject: Optional[str], snippet: Optional[str],
                           sender_email: Optional[str], sender_name: Optional[str],
                           recipient_email: Optional[str], email_date: Optional[str],
                           message_id: Optional[str] = None, source: str = "gmail"):
        """Insert a correspondence entry."""
        payload = {
            "entity_type": entity_type,
            "entity_id": entity_id,
            "direction": direction,
            "subject": subject,
            "snippet": snippet,
            "sender_email": sender_email,
            "sender_name": sender_name,
            "recipient_email": recipient_email,
            "email_date": email_date,
            "source": source,
        }
        if message_id:
            payload["gmail_message_id"] = message_id
            payload["source_message_id"] = message_id
        self.sb.table("correspondence").insert(payload).execute()

    def get_config(self, key: str, default: Optional[str] = None) -> Optional[str]:
        """Read a value from agent_config."""
        result = self.sb.table("agent_config").select("value").eq("key", key).execute()
        if result.data:
            return result.data[0]["value"]
        return default

    def set_config(self, key: str, value: str):
        """Write a value to agent_config (upsert)."""
        self.sb.table("agent_config").upsert({
            "key": key,
            "value": value,
            "updated_at": datetime.now().isoformat(),
        }).execute()

    def is_correspondence_duplicate(self, message_id: str) -> bool:
        """Check if a correspondence entry already exists for this message ID."""
        result = (self.sb.table("correspondence")
                  .select("id")
                  .eq("gmail_message_id", message_id)
                  .execute())
        return len(result.data) > 0
