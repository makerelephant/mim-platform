import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function POST(request: Request) {
  try {
    const { title, date, description } = await request.json();

    if (!title || !date) {
      return NextResponse.json({ error: "title and date are required" }, { status: 400 });
    }

    const tokenJson = process.env.GOOGLE_TOKEN;
    if (!tokenJson) {
      return NextResponse.json({ error: "GOOGLE_TOKEN not configured" }, { status: 500 });
    }

    // Same OAuth2 pattern as gmail-scanner
    const tokenData = JSON.parse(Buffer.from(tokenJson, "base64").toString("utf-8"));
    const oauth2Client = new google.auth.OAuth2(
      tokenData.client_id,
      tokenData.client_secret,
      "urn:ietf:wg:oauth:2.0:oob",
    );
    oauth2Client.setCredentials({
      access_token: tokenData.token,
      refresh_token: tokenData.refresh_token,
      token_type: "Bearer",
      expiry_date: tokenData.expiry ? new Date(tokenData.expiry).getTime() : undefined,
    });

    // Refresh token
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    // Create all-day event
    const event = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: title,
        description: description || "",
        start: { date },
        end: { date },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 60 * 24 }, // 1 day before
          ],
        },
      },
    });

    return NextResponse.json({ success: true, eventId: event.data.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Calendar event creation failed:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
