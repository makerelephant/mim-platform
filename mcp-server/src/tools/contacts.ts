/**
 * Contact tools for MiM MCP Server
 *
 * search_contacts — Search by name, email, or org
 * get_contact     — Full contact with linked orgs, tasks, correspondence
 * create_contact  — Add contact, optionally link to org
 * update_contact  — Modify contact fields
 */
import { z } from "zod";
import { supabase } from "../supabase.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerContactTools(server: McpServer) {

  // ── search_contacts ──
  server.tool(
    "search_contacts",
    "Search contacts by name, email, or linked organization. Returns contacts with their org links.",
    {
      query: z.string().optional().describe("Search by name or email (partial, case-insensitive)"),
      org_id: z.string().optional().describe("Filter contacts linked to this organization"),
      limit: z.number().optional().default(50).describe("Max results (default 50)"),
    },
    async ({ query, org_id, limit }) => {
      // If filtering by org_id, get contact IDs from relationships first
      let contactIdFilter: string[] | null = null;
      if (org_id) {
        const { data: rels } = await supabase.schema("core").from("relationships")
          .select("contact_id").eq("org_id", org_id);
        contactIdFilter = (rels ?? []).map((r: { contact_id: string }) => r.contact_id);
        if (contactIdFilter.length === 0) {
          return { content: [{ type: "text" as const, text: "No contacts linked to this organization." }] };
        }
      }

      // Build contact query
      let contactQuery = supabase.schema("core").from("contacts")
        .select("id, first_name, last_name, email, phone, role, created_at")
        .order("last_name")
        .limit(limit ?? 50);

      if (query) {
        contactQuery = contactQuery.or(
          `first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`
        );
      }

      if (contactIdFilter) {
        contactQuery = contactQuery.in("id", contactIdFilter);
      }

      const { data: contacts, error } = await contactQuery;
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };
      if (!contacts || contacts.length === 0) return { content: [{ type: "text" as const, text: "No contacts found." }] };

      // Fetch org links
      const contactIds = contacts.map((c: { id: string }) => c.id);
      const { data: rels } = await supabase.schema("core").from("relationships")
        .select("contact_id, org_id, relationship_type").in("contact_id", contactIds);

      const orgIds = [...new Set((rels ?? []).map((r: { org_id: string }) => r.org_id))];
      let orgMap = new Map<string, string>();
      if (orgIds.length > 0) {
        const { data: orgs } = await supabase.schema("core").from("organizations")
          .select("id, name").in("id", orgIds);
        orgMap = new Map((orgs ?? []).map((o: { id: string; name: string }) => [o.id, o.name]));
      }

      // Build contact → orgs map
      const contactOrgMap = new Map<string, { org_name: string; relationship_type: string | null }[]>();
      for (const r of rels ?? []) {
        const existing = contactOrgMap.get(r.contact_id) ?? [];
        existing.push({ org_name: orgMap.get(r.org_id) ?? "Unknown", relationship_type: r.relationship_type });
        contactOrgMap.set(r.contact_id, existing);
      }

      const lines = contacts.map((c: { id: string; first_name: string | null; last_name: string | null; email: string | null; role: string | null }) => {
        const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unknown";
        const orgLinks = contactOrgMap.get(c.id) ?? [];
        const orgStr = orgLinks.length > 0
          ? ` @ ${orgLinks.map(o => o.org_name).join(", ")}`
          : "";
        return `• ${name}${c.email ? ` (${c.email})` : ""}${c.role ? ` — ${c.role}` : ""}${orgStr} (id: ${c.id})`;
      });

      return {
        content: [{
          type: "text" as const,
          text: `Found ${contacts.length} contact(s):\n\n${lines.join("\n")}`,
        }],
      };
    }
  );

  // ── get_contact ──
  server.tool(
    "get_contact",
    "Get full details for a contact including linked organizations, tasks, and correspondence.",
    {
      contact_id: z.string().describe("Contact UUID"),
    },
    async ({ contact_id }) => {
      const [contactResult, relsResult, tasksResult, correspondenceResult] = await Promise.all([
        supabase.schema("core").from("contacts").select("*").eq("id", contact_id).single(),
        supabase.schema("core").from("relationships").select("org_id, relationship_type").eq("contact_id", contact_id),
        supabase.schema("brain").from("tasks").select("id, title, status, priority, created_at, due_date, is_starred").eq("entity_id", contact_id).order("created_at", { ascending: false }).limit(10),
        supabase.schema("brain").from("correspondence").select("id, direction, subject, channel, sent_at").eq("entity_id", contact_id).order("sent_at", { ascending: false }).limit(10),
      ]);

      if (contactResult.error) return { content: [{ type: "text" as const, text: `Error: ${contactResult.error.message}` }] };
      if (!contactResult.data) return { content: [{ type: "text" as const, text: `Contact ${contact_id} not found.` }] };

      const contact = contactResult.data;
      const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Unknown";

      // Get org details for linked orgs
      let orgDetails: { name: string; types: string[]; relationship_type: string | null }[] = [];
      if (relsResult.data && relsResult.data.length > 0) {
        const orgIds = relsResult.data.map((r: { org_id: string }) => r.org_id);
        const [orgsData, orgTypesData] = await Promise.all([
          supabase.schema("core").from("organizations").select("id, name").in("id", orgIds),
          supabase.schema("core").from("org_types").select("org_id, type").in("org_id", orgIds),
        ]);
        const orgNameMap = new Map((orgsData.data ?? []).map((o: { id: string; name: string }) => [o.id, o.name]));
        const orgTypeMap = new Map<string, string[]>();
        for (const t of orgTypesData.data ?? []) {
          const existing = orgTypeMap.get(t.org_id) ?? [];
          existing.push(t.type);
          orgTypeMap.set(t.org_id, existing);
        }
        const relMap = new Map(relsResult.data.map((r: { org_id: string; relationship_type: string | null }) => [r.org_id, r.relationship_type]));
        orgDetails = orgIds.map((id: string) => ({
          name: orgNameMap.get(id) ?? "Unknown",
          types: orgTypeMap.get(id) ?? [],
          relationship_type: relMap.get(id) ?? null,
        }));
      }

      const tasks = tasksResult.data ?? [];
      const correspondence = correspondenceResult.data ?? [];

      const sections: string[] = [];
      sections.push(`# ${name}`);
      sections.push(`**ID:** ${contact.id}`);
      if (contact.email) sections.push(`**Email:** ${contact.email}`);
      if (contact.phone) sections.push(`**Phone:** ${contact.phone}`);
      if (contact.role) sections.push(`**Role:** ${contact.role}`);
      if (contact.notes) sections.push(`**Notes:** ${contact.notes}`);

      if (orgDetails.length > 0) {
        sections.push("\n## Organizations");
        for (const o of orgDetails) {
          sections.push(`• ${o.name} [${o.types.join(", ") || "Untyped"}]${o.relationship_type ? ` — ${o.relationship_type}` : ""}`);
        }
      }

      if (tasks.length > 0) {
        sections.push("\n## Recent Tasks");
        for (const t of tasks) {
          const star = t.is_starred ? "⭐ " : "";
          sections.push(`• ${star}[${t.priority}] ${t.title} — ${t.status}`);
        }
      }

      if (correspondence.length > 0) {
        sections.push("\n## Recent Correspondence");
        for (const c of correspondence) {
          const dir = c.direction === "outbound" ? "→" : "←";
          sections.push(`• ${dir} [${c.channel}] ${c.subject || "(no subject)"} — ${c.sent_at}`);
        }
      }

      return { content: [{ type: "text" as const, text: sections.join("\n") }] };
    }
  );

  // ── create_contact ──
  server.tool(
    "create_contact",
    "Create a new contact and optionally link to an organization.",
    {
      first_name: z.string().describe("First name"),
      last_name: z.string().optional().describe("Last name"),
      email: z.string().optional().describe("Email address"),
      phone: z.string().optional().describe("Phone number"),
      role: z.string().optional().describe("Job title / role"),
      notes: z.string().optional().describe("Notes"),
      org_id: z.string().optional().describe("Link to this organization UUID"),
      relationship_type: z.string().optional().describe("Relationship type (e.g., primary_contact, investor, partner)"),
    },
    async ({ first_name, last_name, email, phone, role, notes, org_id, relationship_type }) => {
      const { data: contact, error } = await supabase.schema("core").from("contacts").insert({
        first_name,
        last_name: last_name ?? null,
        email: email ?? null,
        phone: phone ?? null,
        role: role ?? null,
        notes: notes ?? null,
      }).select("id").single();

      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      const results: string[] = [`Created contact: ${first_name}${last_name ? ` ${last_name}` : ""} (id: ${contact.id})`];

      // Link to org if specified
      if (org_id) {
        const { error: relError } = await supabase.schema("core").from("relationships").insert({
          contact_id: contact.id,
          org_id,
          relationship_type: relationship_type ?? null,
        });
        if (relError) results.push(`Warning: Failed to link org: ${relError.message}`);
        else results.push(`Linked to org: ${org_id}${relationship_type ? ` (${relationship_type})` : ""}`);
      }

      return { content: [{ type: "text" as const, text: results.join("\n") }] };
    }
  );

  // ── update_contact ──
  server.tool(
    "update_contact",
    "Update a contact's fields.",
    {
      contact_id: z.string().describe("Contact UUID"),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      role: z.string().optional(),
      notes: z.string().optional(),
    },
    async ({ contact_id, first_name, last_name, email, phone, role, notes }) => {
      const updates: Record<string, unknown> = {};
      if (first_name !== undefined) updates.first_name = first_name;
      if (last_name !== undefined) updates.last_name = last_name;
      if (email !== undefined) updates.email = email;
      if (phone !== undefined) updates.phone = phone;
      if (role !== undefined) updates.role = role;
      if (notes !== undefined) updates.notes = notes;

      if (Object.keys(updates).length === 0) {
        return { content: [{ type: "text" as const, text: "No fields to update." }] };
      }

      const { error } = await supabase.schema("core").from("contacts").update(updates).eq("id", contact_id);
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      return { content: [{ type: "text" as const, text: `Updated contact ${contact_id}: ${Object.keys(updates).join(", ")}` }] };
    }
  );
}
