import { NextResponse } from "next/server";

/**
 * GET /api/engine/integrations — Check which integrations are configured
 * Returns status of each integration based on env var availability
 */
export async function GET() {
  const integrations = [
    {
      name: "Gmail",
      icon: "📧",
      envVars: ["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN"],
      connected: !!(
        process.env.GMAIL_CLIENT_ID &&
        process.env.GMAIL_CLIENT_SECRET &&
        process.env.GMAIL_REFRESH_TOKEN
      ),
      description_connected: "Scanning daily at 6am EST via Vercel cron",
      description_disconnected: "Add Gmail OAuth credentials to connect",
      cron: "/api/agents/gmail-scanner",
    },
    {
      name: "Slack",
      icon: "💬",
      envVars: ["SLACK_BOT_TOKEN"],
      connected: !!process.env.SLACK_BOT_TOKEN,
      description_connected: "Bot token configured — scanner ready",
      description_disconnected: "Add SLACK_BOT_TOKEN to connect",
      cron: "/api/agents/slack-scanner",
    },
    {
      name: "Google Drive",
      icon: "📁",
      envVars: [],
      connected: false,
      description_connected: "Connected",
      description_disconnected: "Not yet integrated",
      cron: null,
    },
    {
      name: "Stripe",
      icon: "💳",
      envVars: ["STRIPE_SECRET_KEY"],
      connected: !!process.env.STRIPE_SECRET_KEY,
      description_connected: "API key configured",
      description_disconnected: "Add STRIPE_SECRET_KEY to connect",
      cron: null,
    },
    {
      name: "Calendar",
      icon: "📅",
      envVars: [],
      connected: false,
      description_connected: "Connected",
      description_disconnected: "Not yet integrated",
      cron: null,
    },
    {
      name: "Notion",
      icon: "📝",
      envVars: [],
      connected: false,
      description_connected: "Connected",
      description_disconnected: "Not yet integrated",
      cron: null,
    },
  ];

  const result = integrations.map((i) => ({
    name: i.name,
    icon: i.icon,
    status: i.connected ? "connected" : "planned",
    description: i.connected ? i.description_connected : i.description_disconnected,
    cron: i.cron,
  }));

  return NextResponse.json({ success: true, integrations: result });
}
