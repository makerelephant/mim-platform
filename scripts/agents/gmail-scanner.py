"""
Gmail Scanner Agent
Scans Gmail for threads involving known contacts and investors.
Extracts action items, updates last contact dates, logs activity.

Prerequisites:
  pip install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client anthropic supabase

Setup:
  1. Create OAuth2 credentials in Google Cloud Console
  2. Download credentials.json to this directory
  3. Run once to authorize and create token.json
  4. Set environment variables: SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY
"""

import os
import json
import base64
from datetime import datetime, timedelta
from typing import Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

import anthropic
from supabase import create_client

# Config
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://smychxtekmfzezirpubp.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
AGENT_NAME = "gmail-scanner"


def get_gmail_service():
    """Authenticate and return Gmail API service."""
    creds = None
    token_path = os.path.join(os.path.dirname(__file__), "token.json")
    creds_path = os.path.join(os.path.dirname(__file__), "credentials.json")

    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(creds_path):
                print("ERROR: credentials.json not found. Download from Google Cloud Console.")
                return None
            flow = InstalledAppFlow.from_client_secrets_file(creds_path, SCOPES)
            creds = flow.run_local_server(port=0)

        with open(token_path, "w") as f:
            f.write(creds.to_json())

    return build("gmail", "v1", credentials=creds)


def get_recent_messages(service, hours=24):
    """Fetch messages from the last N hours."""
    after = int((datetime.now() - timedelta(hours=hours)).timestamp())
    query = f"after:{after}"

    results = service.users().messages().list(userId="me", q=query, maxResults=50).execute()
    messages = results.get("messages", [])
    return messages


def get_message_details(service, msg_id):
    """Get full message details."""
    msg = service.users().messages().get(userId="me", id=msg_id, format="full").execute()

    headers = {h["name"].lower(): h["value"] for h in msg.get("payload", {}).get("headers", [])}

    # Extract body
    body = ""
    payload = msg.get("payload", {})
    if "body" in payload and payload["body"].get("data"):
        body = base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="ignore")
    elif "parts" in payload:
        for part in payload["parts"]:
            if part.get("mimeType") == "text/plain" and part.get("body", {}).get("data"):
                body = base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="ignore")
                break

    return {
        "id": msg_id,
        "from": headers.get("from", ""),
        "to": headers.get("to", ""),
        "subject": headers.get("subject", ""),
        "date": headers.get("date", ""),
        "body": body[:2000],  # Truncate for API calls
    }


def extract_email_address(header_value):
    """Extract email address from header like 'Name <email@example.com>'."""
    if "<" in header_value:
        return header_value.split("<")[1].split(">")[0].lower()
    return header_value.strip().lower()


def extract_action_items(client, subject, body):
    """Use Claude to extract action items from an email."""
    if not body.strip():
        return []

    try:
        response = client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=500,
            messages=[{
                "role": "user",
                "content": f"""Extract any action items or follow-ups from this email. Return as a JSON array of strings.
If there are no action items, return an empty array [].

Subject: {subject}
Body: {body[:1500]}

Return ONLY a JSON array, nothing else."""
            }]
        )
        text = response.content[0].text.strip()
        if text.startswith("["):
            return json.loads(text)
    except Exception as e:
        print(f"  Error extracting actions: {e}")
    return []


def run():
    """Main agent run."""
    print(f"[{AGENT_NAME}] Starting scan...")

    if not SUPABASE_KEY:
        print("ERROR: Set SUPABASE_SERVICE_KEY environment variable")
        return

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    claude = anthropic.Anthropic(api_key=ANTHROPIC_KEY) if ANTHROPIC_KEY else None

    # Log run start
    run_data = sb.table("agent_runs").insert({
        "agent_name": AGENT_NAME,
        "status": "running",
    }).execute()
    run_id = run_data.data[0]["id"] if run_data.data else None

    # Get Gmail service
    service = get_gmail_service()
    if not service:
        if run_id:
            sb.table("agent_runs").update({"status": "failed", "error_message": "Gmail auth failed"}).eq("id", run_id).execute()
        return

    # Fetch known contacts and their emails
    contacts_data = sb.table("contacts").select("id, name, email").not_.is_("email", "null").execute()
    contact_emails = {c["email"].lower(): c for c in contacts_data.data if c.get("email")}

    # Fetch investor firms
    investors_data = sb.table("investors").select("id, firm_name").execute()

    records_processed = 0
    records_updated = 0

    try:
        messages = get_recent_messages(service)
        print(f"  Found {len(messages)} recent messages")

        for msg_ref in messages:
            records_processed += 1
            details = get_message_details(service, msg_ref["id"])

            from_email = extract_email_address(details["from"])
            to_emails = [extract_email_address(e.strip()) for e in details["to"].split(",")]

            # Check if any known contacts are involved
            all_emails = [from_email] + to_emails
            matched_contacts = [contact_emails[e] for e in all_emails if e in contact_emails]

            if not matched_contacts:
                continue

            for contact in matched_contacts:
                # Log activity
                sb.table("activity_log").insert({
                    "agent_name": AGENT_NAME,
                    "action_type": "email_detected",
                    "entity_type": "contacts",
                    "entity_id": contact["id"],
                    "summary": f"Email thread with {contact['name']} re: {details['subject']}",
                    "raw_data": {"subject": details["subject"], "from": details["from"], "date": details["date"]},
                }).execute()
                records_updated += 1

            # Extract action items if Claude is available
            if claude:
                actions = extract_action_items(claude, details["subject"], details["body"])
                for action in actions:
                    sb.table("tasks").insert({
                        "title": action,
                        "entity_type": "contacts",
                        "entity_id": matched_contacts[0]["id"],
                        "priority": "medium",
                        "source": AGENT_NAME,
                    }).execute()
                    print(f"  Created task: {action[:60]}")

        # Update run record
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
