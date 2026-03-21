import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateApiAuth } from "@/lib/auth";

/**
 * Helper: build a Supabase client for core/brain schemas
 */
function getSb() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Helper: format a raw DB contact row into the shape the frontend expects.
 * DB has first_name/last_name/role → frontend expects name/title.
 */
function formatContact(row: Record<string, unknown>) {
  const first = (row.first_name as string) || "";
  const last = (row.last_name as string) || "";
  const name = [first, last].filter(Boolean).join(" ") || null;
  return {
    ...row,
    name,
    title: row.role || null,
  };
}

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

  const sb = getSb();
  if (!sb) {
    return NextResponse.json({ error: "Missing Supabase config" }, { status: 500 });
  }

  // Fetch contact
  const { data: contact, error: contactError } = await sb
    .schema("core").from("contacts")
    .select("*")
    .eq("id", id)
    .single();

  if (contactError || !contact) {
    console.error(`[contacts/${id}] GET error:`, contactError?.message);
    return NextResponse.json(
      { error: "Contact not found" },
      { status: 404 }
    );
  }

  // Fetch organization via junction table (organization_contacts)
  let organization = null;
  const { data: orgLink } = await sb
    .schema("core").from("organization_contacts")
    .select("organization_id")
    .eq("contact_id", id)
    .limit(1)
    .maybeSingle();

  if (orgLink?.organization_id) {
    const { data: org } = await sb
      .schema("core").from("organizations")
      .select("id, name")
      .eq("id", orgLink.organization_id)
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
    contact: formatContact(contact),
    organization,
    correspondence: correspondence || [],
  });
}

/**
 * PATCH /api/contacts/:id
 * Updates contact fields.
 * Frontend sends: name, title, email, phone, notes, organization_id
 * DB columns:     first_name, last_name, role, email, phone, notes
 * Org link via:   core.organization_contacts junction table
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

  const sb = getSb();
  if (!sb) {
    return NextResponse.json({ error: "Missing Supabase config" }, { status: 500 });
  }

  const body = await request.json();

  // ── Handle organization_id separately (junction table) ──
  if ("organization_id" in body) {
    const orgId = body.organization_id;
    if (orgId === null) {
      // Remove org link
      await sb.schema("core").from("organization_contacts")
        .delete()
        .eq("contact_id", id);
    } else {
      // Upsert org link (delete existing + insert new)
      await sb.schema("core").from("organization_contacts")
        .delete()
        .eq("contact_id", id);
      const { error: linkError } = await sb.schema("core").from("organization_contacts")
        .insert({ organization_id: orgId, contact_id: id });
      if (linkError) {
        console.error(`[contacts/${id}] org link error:`, linkError.message);
      }
    }
    // If organization_id was the only field, return early with refreshed contact
    const otherFields = Object.keys(body).filter(k => k !== "organization_id");
    if (otherFields.length === 0) {
      const { data: refreshed } = await sb.schema("core").from("contacts")
        .select("*").eq("id", id).single();
      return NextResponse.json({ contact: refreshed ? formatContact(refreshed) : null });
    }
  }

  // ── Map frontend field names → DB column names ──
  const dbUpdates: Record<string, unknown> = {};

  if ("name" in body && body.name !== undefined) {
    const nameParts = ((body.name as string) || "").trim().split(/\s+/);
    dbUpdates.first_name = nameParts[0] || "";
    dbUpdates.last_name = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
  }
  if ("title" in body) {
    dbUpdates.role = body.title;
  }
  // Direct-mapped fields
  for (const key of ["email", "phone", "notes"]) {
    if (key in body) {
      dbUpdates[key] = body[key];
    }
  }

  if (Object.keys(dbUpdates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  // Always update updated_at
  dbUpdates.updated_at = new Date().toISOString();

  const { data: contact, error } = await sb
    .schema("core").from("contacts")
    .update(dbUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error(`[contacts/${id}] PATCH error:`, error.message, error.details, error.hint);
    return NextResponse.json(
      { error: `Failed to update contact: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ contact: formatContact(contact) });
}
