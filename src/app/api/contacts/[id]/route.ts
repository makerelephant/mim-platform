import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateApiAuth } from "@/lib/auth";

/**
 * GET /api/contacts/:id
 * Returns contact with org data and recent correspondence
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = validateApiAuth(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const { id } = await params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Missing Supabase config" }, { status: 500 });
  }
  const sb = createClient(supabaseUrl, supabaseKey);

  // Fetch contact
  const { data: contact, error: contactError } = await sb
    .schema("core").from("contacts")
    .select("*")
    .eq("id", id)
    .single();

  if (contactError || !contact) {
    return NextResponse.json(
      { error: "Contact not found" },
      { status: 404 }
    );
  }

  // Fetch organization if linked
  let organization = null;
  if (contact.organization_id) {
    const { data: org } = await sb
      .schema("core").from("organizations")
      .select("*")
      .eq("id", contact.organization_id)
      .single();
    organization = org;
  }

  // Fetch recent correspondence (feed cards where entity_id matches)
  const { data: correspondence } = await sb
    .schema("brain").from("feed_cards")
    .select("id, card_type, title, body, source_type, metadata, created_at")
    .eq("entity_id", id)
    .order("created_at", { ascending: false })
    .limit(5);

  return NextResponse.json({
    contact,
    organization,
    correspondence: correspondence || [],
  });
}

/**
 * PATCH /api/contacts/:id
 * Updates contact fields (name, title, email, phone, notes, organization_id)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = validateApiAuth(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const { id } = await params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Missing Supabase config" }, { status: 500 });
  }
  const sb = createClient(supabaseUrl, supabaseKey);

  const body = await request.json();

  // Whitelist updatable fields
  const allowedFields = [
    "name",
    "title",
    "email",
    "phone",
    "notes",
    "organization_id",
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) {
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  const { data: contact, error } = await sb
    .schema("core").from("contacts")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to update contact" },
      { status: 500 }
    );
  }

  return NextResponse.json({ contact });
}
