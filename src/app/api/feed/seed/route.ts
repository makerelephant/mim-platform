/**
 * GET /api/feed/seed
 * Inserts sample feed cards so the Motion feed can be previewed.
 * Safe to call multiple times — uses upsert-style insert.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase config");
  return createClient(url, key, { db: { schema: "brain" } });
}

const SAMPLE_CARDS = [
  {
    card_type: "decision",
    title: "Kenny Loggins wants to partner up on a youth sports activation tour across 12 cities this summer.",
    body: "His team reached out via email proposing a co-branded event series. They have venue partnerships in 8 of the 12 markets already. Asking for a response by end of week.",
    reasoning: "High-profile partnership opportunity with established brand. Aligns with community growth strategy. Time-sensitive.",
    source_type: "email",
    priority: "high",
    entity_name: "Kenny Loggins",
    entity_type: "contact",
    acumen_family: "Partnership",
    acumen_category: "Inbound Partnership Request",
    visibility_scope: "personal",
  },
  {
    card_type: "decision",
    title: "Approve Q2 marketing budget increase of $15k for social media campaigns.",
    body: "Marketing team is requesting additional budget to capitalize on viral momentum from the spring showcase. ROI on last campaign was 3.2x.",
    reasoning: "Previous campaigns have shown strong returns. The spring showcase generated organic buzz that paid campaigns could amplify.",
    source_type: "email",
    priority: "medium",
    entity_name: "Marketing Team",
    entity_type: "organization",
    acumen_family: "Finance",
    acumen_category: "Budget Approval",
    visibility_scope: "personal",
  },
  {
    card_type: "action",
    title: "Follow up with Boston Parks Department on summer field permits.",
    body: "Permit applications were submitted March 1st. Standard processing is 2-3 weeks. No confirmation received yet.",
    source_type: "email",
    priority: "medium",
    entity_name: "Boston Parks Department",
    entity_type: "organization",
    acumen_family: "Operations",
    acumen_category: "Vendor Follow-up",
    visibility_scope: "personal",
  },
  {
    card_type: "signal",
    title: "Competitor 'YouthPlay' just raised a $4M Series A.",
    body: "Announced on TechCrunch this morning. They're focused on the same 8-14 age demo in the northeast corridor.",
    source_type: "synthesis",
    priority: "low",
    acumen_family: "Competitive Intelligence",
    acumen_category: "Competitor Funding",
    visibility_scope: "personal",
  },
  {
    card_type: "intelligence",
    title: "3 new inbound investor inquiries this week — up from 0 last week.",
    body: "All three referenced the Boston Globe feature from last Tuesday. Two are seed-stage funds, one is a family office.",
    reasoning: "Media coverage is driving investor interest. Consider a targeted outreach campaign while momentum is high.",
    source_type: "synthesis",
    priority: "high",
    acumen_family: "Fundraising",
    acumen_category: "Investor Signal",
    visibility_scope: "personal",
  },
  {
    card_type: "decision",
    title: "Update the onboarding flow to include parent consent digital signature.",
    body: "Legal has flagged that the current paper-based consent process creates compliance risk. Digital signature integration estimated at 2 dev days.",
    reasoning: "Compliance requirement with legal risk if not addressed. Low effort relative to risk reduction.",
    source_type: "email",
    priority: "critical",
    entity_name: "Legal Team",
    entity_type: "organization",
    acumen_family: "Product",
    acumen_category: "Compliance Requirement",
    visibility_scope: "personal",
  },
];

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("feed_cards")
      .insert(SAMPLE_CARDS)
      .select("id, card_type, title, priority");

    if (error) {
      return NextResponse.json({ error: error.message, hint: error.hint }, { status: 500 });
    }

    return NextResponse.json({
      message: `Seeded ${data.length} sample cards`,
      cards: data,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
