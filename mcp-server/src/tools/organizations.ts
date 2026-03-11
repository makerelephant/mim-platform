/**
 * Organization tools for MiM MCP Server
 *
 * search_organizations — Search/filter by name, type, pipeline status
 * get_organization     — Full details + contacts, tasks, correspondence, pipeline
 * create_organization  — Add new org with type classification
 * update_organization  — Modify org fields
 */
import { z } from "zod";
import { supabase } from "../supabase.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerOrganizationTools(server: McpServer) {

  // ── search_organizations ──
  server.tool(
    "search_organizations",
    "Search organizations by name, type (Investor/Partner/Customer/Vendor), or pipeline status. Returns up to 50 results with org types and pipeline info.",
    {
      query: z.string().optional().describe("Name search (case-insensitive, partial match)"),
      type: z.string().optional().describe("Filter by org type: Investor, Partner, Customer, Vendor"),
      pipeline_status: z.string().optional().describe("Filter by pipeline status"),
      limit: z.number().optional().default(50).describe("Max results (default 50)"),
    },
    async ({ query, type, pipeline_status, limit }) => {
      // 1. Build org query
      let orgQuery = supabase.schema("core").from("organizations")
        .select("id, name, website, description, notes, created_at, updated_at")
        .order("name")
        .limit(limit ?? 50);

      if (query) {
        orgQuery = orgQuery.ilike("name", `%${query}%`);
      }

      const { data: orgs, error: orgError } = await orgQuery;
      if (orgError) return { content: [{ type: "text" as const, text: `Error: ${orgError.message}` }] };
      if (!orgs || orgs.length === 0) return { content: [{ type: "text" as const, text: "No organizations found." }] };

      const orgIds = orgs.map((o: { id: string }) => o.id);

      // 2. Fetch types + pipeline in parallel
      const [typesResult, pipelineResult] = await Promise.all([
        supabase.schema("core").from("org_types").select("org_id, type").in("org_id", orgIds),
        supabase.schema("crm").from("pipeline").select("org_id, status, pipeline_type").in("org_id", orgIds),
      ]);

      // Build lookup maps
      const typeMap = new Map<string, string[]>();
      for (const t of typesResult.data ?? []) {
        const existing = typeMap.get(t.org_id) ?? [];
        existing.push(t.type);
        typeMap.set(t.org_id, existing);
      }

      const pipelineMap = new Map<string, { status: string | null; pipeline_type: string }[]>();
      for (const p of pipelineResult.data ?? []) {
        const existing = pipelineMap.get(p.org_id) ?? [];
        existing.push({ status: p.status, pipeline_type: p.pipeline_type });
        pipelineMap.set(p.org_id, existing);
      }

      // 3. Filter by type/pipeline_status if requested
      let results = orgs.map((o: { id: string; name: string; website: string | null; description: string | null; notes: string | null; created_at: string; updated_at: string | null }) => ({
        ...o,
        types: typeMap.get(o.id) ?? [],
        pipeline: pipelineMap.get(o.id) ?? [],
      }));

      if (type) {
        results = results.filter((o: { types: string[] }) => o.types.some((t: string) => t.toLowerCase() === type.toLowerCase()));
      }
      if (pipeline_status) {
        results = results.filter((o: { pipeline: { status: string | null }[] }) =>
          o.pipeline.some((p: { status: string | null }) => p.status?.toLowerCase() === pipeline_status.toLowerCase())
        );
      }

      // 4. Format output
      const lines = results.map((o: { name: string; types: string[]; pipeline: { status: string | null; pipeline_type: string }[]; id: string }) => {
        const typeStr = o.types.length > 0 ? `[${o.types.join(", ")}]` : "[Untyped]";
        const pipeStr = o.pipeline.map((p: { pipeline_type: string; status: string | null }) => `${p.pipeline_type}: ${p.status ?? "none"}`).join(", ");
        return `• ${o.name} ${typeStr}${pipeStr ? ` — Pipeline: ${pipeStr}` : ""} (id: ${o.id})`;
      });

      return {
        content: [{
          type: "text" as const,
          text: `Found ${results.length} organization(s):\n\n${lines.join("\n")}`,
        }],
      };
    }
  );

  // ── get_organization ──
  server.tool(
    "get_organization",
    "Get full details for an organization including types, pipeline, contacts, recent tasks, and correspondence. Use this to build a complete picture of any org.",
    {
      org_id: z.string().describe("Organization UUID"),
    },
    async ({ org_id }) => {
      // Run all queries in parallel
      const [orgResult, typesResult, pipelineResult, contactsResult, tasksResult, correspondenceResult, partnerResult] = await Promise.all([
        supabase.schema("core").from("organizations").select("*").eq("id", org_id).single(),
        supabase.schema("core").from("org_types").select("type, status").eq("org_id", org_id),
        supabase.schema("crm").from("pipeline").select("*").eq("org_id", org_id),
        supabase.schema("core").from("relationships").select("contact_id, relationship_type").eq("org_id", org_id),
        supabase.schema("brain").from("tasks").select("id, title, status, priority, created_at, due_date, is_starred").eq("entity_id", org_id).order("created_at", { ascending: false }).limit(10),
        supabase.schema("brain").from("correspondence").select("id, direction, subject, channel, sent_at").eq("entity_id", org_id).order("sent_at", { ascending: false }).limit(10),
        supabase.schema("intel").from("partner_profile").select("*").eq("org_id", org_id).maybeSingle(),
      ]);

      if (orgResult.error) return { content: [{ type: "text" as const, text: `Error: ${orgResult.error.message}` }] };
      if (!orgResult.data) return { content: [{ type: "text" as const, text: `Organization ${org_id} not found.` }] };

      const org = orgResult.data;

      // Fetch contact names if we have relationships
      let contactDetails: { id: string; name: string; email: string | null; relationship_type: string | null }[] = [];
      if (contactsResult.data && contactsResult.data.length > 0) {
        const contactIds = contactsResult.data.map((c: { contact_id: string }) => c.contact_id);
        const { data: contacts } = await supabase.schema("core").from("contacts").select("id, first_name, last_name, email").in("id", contactIds);
        const relMap = new Map(contactsResult.data.map((c: { contact_id: string; relationship_type: string | null }) => [c.contact_id, c.relationship_type]));
        contactDetails = (contacts ?? []).map((c: { id: string; first_name: string | null; last_name: string | null; email: string | null }) => ({
          id: c.id,
          name: [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unknown",
          email: c.email,
          relationship_type: relMap.get(c.id) ?? null,
        }));
      }

      // Build response
      const types = (typesResult.data ?? []).map((t: { type: string }) => t.type);
      const pipeline = pipelineResult.data ?? [];
      const tasks = tasksResult.data ?? [];
      const correspondence = correspondenceResult.data ?? [];

      const sections: string[] = [];

      sections.push(`# ${org.name}`);
      sections.push(`**ID:** ${org.id}`);
      sections.push(`**Types:** ${types.join(", ") || "None"}`);
      if (org.website) sections.push(`**Website:** ${org.website}`);
      if (org.description) sections.push(`**Description:** ${org.description}`);
      if (org.notes) sections.push(`**Notes:** ${org.notes}`);

      // Pipeline
      if (pipeline.length > 0) {
        sections.push("\n## Pipeline");
        for (const p of pipeline) {
          const parts = [`Status: ${p.status ?? "none"}`, `Type: ${p.pipeline_type}`];
          if (p.connection_status) parts.push(`Connection: ${p.connection_status}`);
          if (p.lifecycle_status) parts.push(`Lifecycle: ${p.lifecycle_status}`);
          if (p.next_action) parts.push(`Next action: ${p.next_action}`);
          if (p.next_action_date) parts.push(`Due: ${p.next_action_date}`);
          if (p.likelihood_score) parts.push(`Likelihood: ${p.likelihood_score}%`);
          sections.push(`• ${parts.join(" | ")}`);
        }
      }

      // Partner profile
      if (partnerResult.data) {
        sections.push("\n## Partner Profile");
        const pp = partnerResult.data;
        if (pp.partner_status) sections.push(`Status: ${pp.partner_status}`);
        if (pp.partner_type) sections.push(`Type: ${pp.partner_type}`);
        if (pp.partnership_model) sections.push(`Model: ${pp.partnership_model}`);
      }

      // Contacts
      if (contactDetails.length > 0) {
        sections.push("\n## Contacts");
        for (const c of contactDetails) {
          sections.push(`• ${c.name}${c.email ? ` (${c.email})` : ""}${c.relationship_type ? ` — ${c.relationship_type}` : ""}`);
        }
      }

      // Tasks
      if (tasks.length > 0) {
        sections.push("\n## Recent Tasks");
        for (const t of tasks) {
          const star = t.is_starred ? "⭐ " : "";
          sections.push(`• ${star}[${t.priority}] ${t.title} — ${t.status}${t.due_date ? ` (due: ${t.due_date})` : ""}`);
        }
      }

      // Correspondence
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

  // ── create_organization ──
  server.tool(
    "create_organization",
    "Create a new organization with type classification and optional pipeline entry. Types: Investor, Partner, Customer, Vendor.",
    {
      name: z.string().describe("Organization name"),
      types: z.array(z.string()).optional().describe("Org types: Investor, Partner, Customer, Vendor"),
      website: z.string().optional().describe("Website URL"),
      description: z.string().optional().describe("Organization description"),
      notes: z.string().optional().describe("Notes about the organization"),
      pipeline_type: z.string().optional().describe("If set, creates a pipeline entry. Values: investor, customer"),
      pipeline_status: z.string().optional().describe("Initial pipeline status (e.g., First Meeting, Engaged)"),
    },
    async ({ name, types, website, description, notes, pipeline_type, pipeline_status }) => {
      // 1. Create org
      const { data: org, error } = await supabase.schema("core").from("organizations").insert({
        name,
        website: website ?? null,
        description: description ?? null,
        notes: notes ?? null,
      }).select("id").single();

      if (error) return { content: [{ type: "text" as const, text: `Error creating org: ${error.message}` }] };

      const orgId = org.id;
      const results: string[] = [`Created organization: ${name} (id: ${orgId})`];

      // 2. Add types
      if (types && types.length > 0) {
        const typeRows = types.map(t => ({ org_id: orgId, type: t }));
        const { error: typeError } = await supabase.schema("core").from("org_types").insert(typeRows);
        if (typeError) results.push(`Warning: Failed to add types: ${typeError.message}`);
        else results.push(`Types: ${types.join(", ")}`);
      }

      // 3. Create pipeline entry if requested
      if (pipeline_type) {
        const { error: pipeError } = await supabase.schema("crm").from("pipeline").insert({
          org_id: orgId,
          pipeline_type,
          status: pipeline_status ?? null,
        });
        if (pipeError) results.push(`Warning: Failed to create pipeline: ${pipeError.message}`);
        else results.push(`Pipeline: ${pipeline_type} — ${pipeline_status ?? "no status"}`);
      }

      return { content: [{ type: "text" as const, text: results.join("\n") }] };
    }
  );

  // ── update_organization ──
  server.tool(
    "update_organization",
    "Update an organization's fields (name, domain, website, notes).",
    {
      org_id: z.string().describe("Organization UUID"),
      name: z.string().optional().describe("New name"),
      website: z.string().optional().describe("New website"),
      description: z.string().optional().describe("New description"),
      notes: z.string().optional().describe("New notes"),
    },
    async ({ org_id, name, website, description, notes }) => {
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (website !== undefined) updates.website = website;
      if (description !== undefined) updates.description = description;
      if (notes !== undefined) updates.notes = notes;

      if (Object.keys(updates).length === 0) {
        return { content: [{ type: "text" as const, text: "No fields to update." }] };
      }

      const { error } = await supabase.schema("core").from("organizations").update(updates).eq("id", org_id);
      if (error) return { content: [{ type: "text" as const, text: `Error: ${error.message}` }] };

      return { content: [{ type: "text" as const, text: `Updated organization ${org_id}: ${Object.keys(updates).join(", ")}` }] };
    }
  );
}
