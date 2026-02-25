"""
Gmail Scanner Agent — Inbox Intelligence for MiM Platform
Scans Gmail for new messages, routes them to the correct entity silo
(Investors, Communities, Contacts), logs correspondence, and generates
prioritized tasks.

Prerequisites:
  pip install -r requirements.txt

Setup:
  1. Create OAuth2 credentials in Google Cloud Console (Desktop app)
  2. Download credentials.json to this directory
  3. Run once locally to authorize and create token.json
  4. Set env vars: SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY

For CI (GitHub Actions):
  Set GOOGLE_CREDENTIALS and GOOGLE_TOKEN secrets (base64-encoded JSON)
"""

import os
import sys
import json
import base64
from datetime import datetime, timedelta, timezone
from typing import Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# Add this directory to path for local imports
sys.path.insert(0, os.path.dirname(__file__))

from agent_base import AgentBase
from entity_resolver import EntityResolver
from classifier import MessageClassifier

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
AGENT_NAME = "gmail-scanner"

# The user's own email(s) — used to determine inbound vs outbound direction
USER_EMAILS = {"mark@madeinmotion.co", "mark@mim.co", "markslater9@gmail.com"}


def get_gmail_service():
    """Authenticate and return Gmail API service.
    Supports both local (file-based) and CI (env-var-based) authentication.
    """
    creds = None
    token_path = os.path.join(os.path.dirname(__file__), "token.json")
    creds_path = os.path.join(os.path.dirname(__file__), "credentials.json")

    # CI mode: read credentials from environment variables
    if os.environ.get("GOOGLE_TOKEN"):
        try:
            token_data = json.loads(base64.b64decode(os.environ["GOOGLE_TOKEN"]))
            creds = Credentials.from_authorized_user_info(token_data, SCOPES)
        except Exception as e:
            print(f"  Error loading token from env: {e}")

    # Local mode: read from file
    elif os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
            # Save refreshed token locally
            if not os.environ.get("GOOGLE_TOKEN"):
                with open(token_path, "w") as f:
                    f.write(creds.to_json())
        else:
            # Need interactive auth (local only)
            if os.environ.get("GOOGLE_CREDENTIALS"):
                creds_data = json.loads(base64.b64decode(os.environ["GOOGLE_CREDENTIALS"]))
                import tempfile
                with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
                    json.dump(creds_data, f)
                    tmp_creds = f.name
                flow = InstalledAppFlow.from_client_secrets_file(tmp_creds, SCOPES)
                os.unlink(tmp_creds)
            elif os.path.exists(creds_path):
                flow = InstalledAppFlow.from_client_secrets_file(creds_path, SCOPES)
            else:
                print("ERROR: No credentials found. Download credentials.json from Google Cloud Console.")
                return None
            creds = flow.run_local_server(port=0)
            with open(token_path, "w") as f:
                f.write(creds.to_json())

    return build("gmail", "v1", credentials=creds)


def get_recent_messages(service, hours: int = 24, max_results: int = 100):
    """Fetch messages from the last N hours."""
    after = int((datetime.now(timezone.utc) - timedelta(hours=hours)).timestamp())
    query = f"after:{after}"
    results = service.users().messages().list(
        userId="me", q=query, maxResults=max_results
    ).execute()
    return results.get("messages", [])


def get_message_details(service, msg_id: str) -> dict:
    """Get full message details including headers and body."""
    msg = service.users().messages().get(userId="me", id=msg_id, format="full").execute()
    headers = {
        h["name"].lower(): h["value"]
        for h in msg.get("payload", {}).get("headers", [])
    }

    # Extract body text
    body = ""
    payload = msg.get("payload", {})
    if "body" in payload and payload["body"].get("data"):
        body = base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="ignore")
    elif "parts" in payload:
        for part in payload["parts"]:
            if part.get("mimeType") == "text/plain" and part.get("body", {}).get("data"):
                body = base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="ignore")
                break
            # Check nested parts (for multipart/alternative inside multipart/mixed)
            if "parts" in part:
                for sub in part["parts"]:
                    if sub.get("mimeType") == "text/plain" and sub.get("body", {}).get("data"):
                        body = base64.urlsafe_b64decode(sub["body"]["data"]).decode("utf-8", errors="ignore")
                        break
                if body:
                    break

    return {
        "id": msg_id,
        "gmail_id": msg.get("id"),
        "thread_id": msg.get("threadId"),
        "from": headers.get("from", ""),
        "to": headers.get("to", ""),
        "cc": headers.get("cc", ""),
        "subject": headers.get("subject", ""),
        "date": headers.get("date", ""),
        "body": body[:2000],  # Truncate for API calls
        "internal_date": msg.get("internalDate"),
    }


def extract_email_address(header_value: str) -> str:
    """Extract email address from header like 'Name <email@example.com>'."""
    if "<" in header_value:
        return header_value.split("<")[1].split(">")[0].lower().strip()
    return header_value.strip().lower()


def extract_name(header_value: str) -> Optional[str]:
    """Extract display name from header like 'John Doe <john@example.com>'."""
    if "<" in header_value:
        name = header_value.split("<")[0].strip().strip('"')
        return name if name else None
    return None


def parse_email_list(header_value: str) -> list[str]:
    """Parse comma-separated email header into list of addresses."""
    if not header_value:
        return []
    return [extract_email_address(e.strip()) for e in header_value.split(",") if e.strip()]


def determine_direction(from_email: str) -> str:
    """Determine if the email is inbound or outbound based on sender."""
    return "outbound" if from_email in USER_EMAILS else "inbound"


def run():
    """Main agent run — scan Gmail, classify, route, and create tasks."""
    agent = AgentBase(AGENT_NAME)

    try:
        # Initialize Gmail service
        service = get_gmail_service()
        if not service:
            agent.fail_run("Gmail authentication failed")
            return

        # Initialize entity resolver and classifier
        resolver = EntityResolver(agent.sb)
        classifier = None
        if agent.claude:
            classifier = MessageClassifier(agent.claude)
        else:
            print("  WARNING: No Anthropic API key — skipping classification")

        # Fetch recent messages
        scan_hours = int(os.environ.get("SCAN_HOURS", "24"))
        messages = get_recent_messages(service, hours=scan_hours)
        print(f"  Found {len(messages)} messages in the last {scan_hours} hours")

        records_processed = 0
        records_updated = 0
        skipped_dupes = 0

        for msg_ref in messages:
            records_processed += 1
            msg_id = msg_ref["id"]

            # Deduplication check
            if agent.is_correspondence_duplicate(msg_id):
                skipped_dupes += 1
                continue

            # Get full message details
            details = get_message_details(service, msg_id)

            # Parse participants
            from_email = extract_email_address(details["from"])
            from_name = extract_name(details["from"])
            to_emails = parse_email_list(details["to"])
            cc_emails = parse_email_list(details["cc"])
            all_participant_emails = [from_email] + to_emails + cc_emails

            # Resolve all participants to entities
            all_matches = resolver.resolve_multiple(all_participant_emails)

            if not all_matches:
                # No known entities involved — skip (reduces noise)
                continue

            # Classify the message
            if classifier:
                result = classifier.classify(
                    message={
                        "subject": details["subject"],
                        "body": details["body"],
                        "from": details["from"],
                    },
                    resolved_entities=all_matches,
                    source_type="email",
                )
            else:
                # Fallback: use the first resolved entity
                first = all_matches[0]
                from classifier import ClassificationResult
                result = ClassificationResult(
                    primary_silo=first.entity_type,
                    primary_entity_id=first.entity_id,
                    primary_entity_name=first.entity_name,
                    summary=f"Email: {details['subject'][:80]}",
                )

            # Determine direction
            direction = determine_direction(from_email)

            # Parse email date
            email_date = None
            if details.get("internal_date"):
                try:
                    ts = int(details["internal_date"]) / 1000  # Gmail uses milliseconds
                    email_date = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
                except (ValueError, OSError):
                    pass

            # Log correspondence (against primary entity)
            entity_type = result.primary_silo
            entity_id = result.primary_entity_id

            if entity_id:
                agent.log_correspondence(
                    entity_type=entity_type,
                    entity_id=entity_id,
                    direction=direction,
                    subject=details["subject"],
                    snippet=details["body"][:200] if details["body"] else None,
                    sender_email=from_email,
                    sender_name=from_name,
                    recipient_email=to_emails[0] if to_emails else None,
                    email_date=email_date,
                    message_id=msg_id,
                    source="gmail",
                )

            # Create tasks from classifier action items
            for action in result.action_items:
                agent.create_task(
                    title=action.title,
                    summary=action.summary,
                    recommended_action=action.recommended_action,
                    description=action.description,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    priority=action.priority,
                    due_date=action.due_date,
                    goal_relevance_score=action.goal_relevance_score,
                    gmail_thread_id=details["thread_id"],
                    gmail_message_id=msg_id,
                )

            # Log activity
            agent.log_activity(
                action_type="email_scanned",
                entity_type=entity_type,
                entity_id=entity_id,
                summary=result.summary,
                raw_data={
                    "subject": details["subject"],
                    "from": details["from"],
                    "direction": direction,
                    "tags": result.tags,
                    "sentiment": result.sentiment,
                    "action_count": len(result.action_items),
                },
                source_id=f"gmail_{msg_id}",
            )

            records_updated += 1
            entity_label = f" → [{entity_type}] {result.primary_entity_name}" if result.primary_entity_name else ""
            print(f"  Processed: {details['subject'][:60]}{entity_label} ({len(result.action_items)} tasks)")

        agent.records_processed = records_processed
        agent.records_updated = records_updated
        agent.complete_run()
        print(f"  Skipped {skipped_dupes} duplicates")

    except Exception as e:
        agent.fail_run(str(e))
        raise


if __name__ == "__main__":
    run()
