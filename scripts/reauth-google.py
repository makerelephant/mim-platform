"""
Re-authorize Google OAuth with expanded scopes.

Prerequisites:
  pip install google-auth-oauthlib

Usage:
  GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... python3 scripts/reauth-google.py

Or decode them from your existing GOOGLE_TOKEN env var:
  python3 -c "import json,base64,os; d=json.loads(base64.b64decode(os.environ['GOOGLE_TOKEN'])); print(f'GOOGLE_CLIENT_ID={d[\"client_id\"]}'); print(f'GOOGLE_CLIENT_SECRET={d[\"client_secret\"]}')"
"""
import json, base64, os, sys

from google_auth_oauthlib.flow import InstalledAppFlow

CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")

if not CLIENT_ID or not CLIENT_SECRET:
    print("ERROR: Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.")
    print("See usage instructions at the top of this script.")
    sys.exit(1)

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/documents.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/calendar.readonly",
]

client_config = {
    "installed": {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "redirect_uris": ["urn:ietf:wg:oauth:2.0:oob", "http://localhost"],
    }
}

flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
creds = flow.run_local_server(port=8099)

token_data = {
    "token": creds.token,
    "refresh_token": creds.refresh_token,
    "token_uri": creds.token_uri,
    "client_id": creds.client_id,
    "client_secret": creds.client_secret,
    "scopes": list(creds.scopes),
    "universe_domain": "googleapis.com",
    "account": "",
    "expiry": creds.expiry.isoformat() + "Z" if creds.expiry else None,
}

token_json = json.dumps(token_data)
token_b64 = base64.b64encode(token_json.encode()).decode()

print("\n✅ Authorization successful!")
print(f"\nScopes: {', '.join(creds.scopes)}")
print(f"\nBase64 token (set as GOOGLE_TOKEN in Vercel):\n")
print(token_b64)
print(f"\nToken length: {len(token_b64)} chars")
