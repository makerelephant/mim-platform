"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/Avatar";
import { EntityLinker } from "@/components/EntityLinker";
import { CorrespondenceSection } from "@/components/CorrespondenceSection";
import { ArrowLeft, Save, ExternalLink, X, Upload, Trash2, Users, Grid3X3, Check, Plus } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { ORG_TYPE_OPTIONS } from "@/config/organization-constants";

interface SoccerOrg {
  id: string;
  name: string;
  org_type: string[];
  corporate_structure: string | null;
  address: string | null;
  website: string | null;
  merch_link: string | null;
  store_status: string | null;
  store_provider: string | null;
  avatar_url: string | null;
  players: number | null;
  travel_teams: number | null;
  dues_per_season: number | null;
  dues_revenue: number | null;
  uniform_cost: number | null;
  total_revenue: number | null;
  gross_revenue: number | null;
  total_costs: number | null;
  yearly_cost_player: number | null;
  outreach_status: string | null;
  last_outreach_date: string | null;
  outreach_notes: string | null;
  partner_status: string | null;
  partner_since: string | null;
  notes: string | null;
  leagues: string[];
}

interface LinkedContact {
  contact_id: string;
  relationship_type: string | null;
  contacts: { id: string; first_name: string | null; last_name: string | null; email: string | null; role: string | null };
}

interface CategoryNode {
  id: string;
  name: string;
  parent_id: string | null;
  children: CategoryNode[];
}

interface OrgCategoryLink {
  id: string;
  category_id: string;
  category_name: string;
  status: string;
}

const ORG_TYPES = [...ORG_TYPE_OPTIONS];
const STRUCTURES = ["501c3", "LLC", "Corporation", "Partnership"];
const OUTREACH_STATUSES = ["Not Contacted", "Initial Outreach", "In Conversation", "Meeting Scheduled", "Proposal Sent", "Negotiating", "Closed"];
const PARTNER_STATUSES = ["Prospect", "Active Partner", "Inactive", "Churned"];
const STORE_STATUSES = ["No Store", "Setting Up", "Live", "Paused"];

const FINANCIAL_FIELDS = new Set(["players", "travel_teams", "dues_per_season", "dues_revenue", "uniform_cost", "total_revenue", "gross_revenue", "total_costs", "yearly_cost_player"]);
const STORE_FIELDS = new Set(["store_status", "store_provider", "merch_link"]);
const OUTREACH_KEYS = new Set(["outreach_status", "last_outreach_date", "outreach_notes"]);
const PARTNER_KEYS = new Set(["partner_status", "partner_since"]);

function contactName(c: { first_name: string | null; last_name: string | null }): string {
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "(unnamed)";
}

/* ── Uncontrolled field components ── */

function DetailField({
  label, field, type = "text", editing, org, setField,
}: {
  label: string; field: keyof SoccerOrg; type?: "text" | "textarea" | "number" | "date" | "url";
  editing: boolean; org: SoccerOrg; setField: (field: keyof SoccerOrg, value: string | number | null) => void;
}) {
  if (editing) {
    const defVal = String(org[field] ?? "");
    if (type === "textarea") {
      return (
        <div>
          {label && <label className="text-xs text-gray-500">{label}</label>}
          <Textarea rows={3} defaultValue={defVal} onChange={(e) => setField(field, e.target.value)} className="mt-0.5" />
        </div>
      );
    }
    return (
      <div>
        {label && <label className="text-xs text-gray-500">{label}</label>}
        <Input
          type={type === "number" ? "number" : type === "date" ? "date" : "text"}
          defaultValue={defVal}
          onChange={(e) => {
            const v = e.target.value;
            setField(field, type === "number" ? (v ? Number(v) : null) : v);
          }}
          className="mt-0.5"
        />
      </div>
    );
  }

  const val = org[field];
  const display = val != null && val !== "" ? String(val) : "—";
  return (
    <div>
      {label && <span className="text-xs text-gray-500">{label}</span>}
      {type === "url" && val ? (
        <p className="text-sm">
          <a href={String(val).startsWith("http") ? String(val) : `https://${val}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{String(val)}</a>
        </p>
      ) : type === "number" && val != null && val !== "" ? (
        <p className="text-sm">{String(field).includes("cost") || String(field).includes("revenue") || String(field).includes("dues") || String(field).includes("uniform") ? `$${Number(val).toLocaleString()}` : String(val)}</p>
      ) : (
        <p className={`text-sm ${display === "—" ? "text-gray-300" : ""}`}>{display}</p>
      )}
    </div>
  );
}

function DetailSelect({
  label, field, options, editing, org, setField,
}: {
  label: string; field: keyof SoccerOrg; options: string[];
  editing: boolean; org: SoccerOrg; setField: (field: keyof SoccerOrg, value: string | number | null) => void;
}) {
  const rawVal = org[field];
  const displayVal = Array.isArray(rawVal) ? rawVal.join(", ") : (rawVal != null && rawVal !== "" ? String(rawVal) : "—");
  const defaultVal = Array.isArray(rawVal) ? (rawVal[0] ?? "") : String(rawVal ?? "");

  if (editing) {
    return (
      <div>
        <label className="text-xs text-gray-500">{label}</label>
        <select className="w-full border rounded-md px-2 py-1.5 text-sm mt-0.5" defaultValue={defaultVal} onChange={(e) => setField(field, e.target.value || null)}>
          <option value="">—</option>
          {options.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    );
  }
  return (
    <div>
      <span className="text-xs text-gray-500">{label}</span>
      <p className={`text-sm ${displayVal === "—" ? "text-gray-300" : ""}`}>{displayVal}</p>
    </div>
  );
}

/* ── Avatar upload component ── */

function AvatarUpload({ currentUrl, name, onUpload }: { currentUrl: string | null; name: string; onUpload: (dataUrl: string | null) => void }) {
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = document.createElement("img");
      img.onload = () => {
        const size = 200;
        const canvas = document.createElement("canvas");
        const scale = Math.min(size / img.width, size / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        setPreview(dataUrl);
        onUpload(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = () => { setPreview(null); onUpload(null); if (fileRef.current) fileRef.current.value = ""; };

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-20 w-20 rounded-full overflow-hidden bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center shrink-0">
        {preview ? (
          <Image src={preview} alt={name} fill className="object-cover" unoptimized />
        ) : (
          <span className="text-2xl font-bold text-gray-400">{name?.charAt(0)?.toUpperCase() || "?"}</span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="h-3.5 w-3.5 mr-1" /> {preview ? "Change Photo" : "Upload Photo"}
        </Button>
        {preview && (
          <Button type="button" variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={handleRemove}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
          </Button>
        )}
      </div>
    </div>
  );
}

/* ── Main component ── */

export default function SoccerOrgDetail() {
  const params = useParams();
  const router = useRouter();
  const [org, setOrg] = useState<SoccerOrg | null>(null);
  const [linkedContacts, setLinkedContacts] = useState<LinkedContact[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const orgId = params.id as string;
  const editDataRef = useRef<Record<string, unknown>>({});
  const [allCategories, setAllCategories] = useState<CategoryNode[]>([]);
  const [orgCategories, setOrgCategories] = useState<OrgCategoryLink[]>([]);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [catSaving, setCatSaving] = useState(false);

  const loadLinks = useCallback(async () => {
    const { data: contacts } = await supabase
      .schema('core').from("relationships")
      .select("contact_id, relationship_type, contacts(id, first_name, last_name, email, role)")
      .eq("org_id", orgId);
    if (contacts) setLinkedContacts(contacts as unknown as LinkedContact[]);
  }, [orgId]);

  const loadCategories = useCallback(async () => {
    // community_categories stays in public schema
    const { data: cats } = await supabase
      .from("community_categories")
      .select("id, name, parent_id, sort_order")
      .order("sort_order", { ascending: true });

    if (cats) {
      const byId = new Map<string, CategoryNode>();
      const roots: CategoryNode[] = [];
      cats.forEach((c: any) => byId.set(c.id, { id: c.id, name: c.name, parent_id: c.parent_id, children: [] }));
      cats.forEach((c: any) => {
        const node = byId.get(c.id)!;
        if (c.parent_id && byId.has(c.parent_id)) {
          byId.get(c.parent_id)!.children.push(node);
        } else {
          roots.push(node);
        }
      });
      setAllCategories(roots);
    }

    // org_community_relationships stays in public schema
    const { data: links } = await supabase
      .from("org_community_relationships")
      .select("id, category_id, status, category:community_categories!inner(name)")
      .eq("organization_id", orgId);

    if (links) {
      setOrgCategories(links.map((l: any) => ({
        id: l.id,
        category_id: l.category_id,
        category_name: l.category?.name || "—",
        status: l.status || "active",
      })));
    }
  }, [orgId]);

  const assignCategory = async (categoryId: string) => {
    setCatSaving(true);
    const { error } = await supabase.from("org_community_relationships").insert({
      organization_id: orgId,
      category_id: categoryId,
      status: "active",
    });
    if (!error) await loadCategories();
    setCatSaving(false);
  };

  const unassignCategory = async (linkId: string) => {
    setCatSaving(true);
    const { error } = await supabase.from("org_community_relationships").delete().eq("id", linkId);
    if (!error) await loadCategories();
    setCatSaving(false);
  };

  useEffect(() => {
    async function load() {
      // Parallel load from multiple schema tables
      const [orgResult, typeResult, financialResult, storeResult, memberResult, leagueResult, outreachResult, partnerResult] = await Promise.all([
        supabase.schema('core').from("organizations").select("*").eq("id", orgId).single(),
        supabase.schema('core').from("org_types").select("type").eq("org_id", orgId),
        supabase.schema('intel').from("org_financials").select("*").eq("org_id", orgId).maybeSingle(),
        supabase.schema('platform').from("store").select("*").eq("org_id", orgId).maybeSingle(),
        supabase.schema('platform').from("memberships").select("league_id").eq("org_id", orgId),
        supabase.from("leagues").select("id, name"),
        supabase.schema('crm').from("outreach").select("status, outreach_date, notes").eq("org_id", orgId).order("outreach_date", { ascending: false }).limit(1).maybeSingle(),
        supabase.schema('intel').from("partner_profile").select("partner_status, partner_since").eq("org_id", orgId).maybeSingle(),
      ]);

      if (!orgResult.data) return;

      // Build league names
      const leagueMap = new Map<string, string>();
      for (const l of leagueResult.data || []) leagueMap.set(l.id, l.name);
      const leagues = (memberResult.data || []).map((m) => leagueMap.get(m.league_id)).filter(Boolean) as string[];

      // Assemble SoccerOrg
      const o = orgResult.data;
      const fin = financialResult.data;
      const store = storeResult.data;
      const outreach = outreachResult.data;
      const partner = partnerResult.data;

      const assembled: SoccerOrg = {
        id: o.id,
        name: o.name,
        org_type: (typeResult.data || []).map((t) => t.type),
        corporate_structure: o.corporate_structure,
        address: o.address,
        website: o.website,
        avatar_url: o.avatar_url,
        notes: o.notes,
        // Financials
        players: fin?.players ?? null,
        travel_teams: fin?.travel_teams ?? null,
        dues_per_season: fin?.dues_per_season ?? null,
        dues_revenue: fin?.dues_revenue ?? null,
        uniform_cost: fin?.uniform_cost ?? null,
        total_revenue: fin?.total_revenue ?? null,
        gross_revenue: fin?.gross_revenue ?? null,
        total_costs: fin?.total_costs ?? null,
        yearly_cost_player: fin?.yearly_cost_player ?? null,
        // Store
        merch_link: store?.merch_link ?? null,
        store_status: store?.store_status ?? null,
        store_provider: store?.store_provider ?? null,
        // Outreach
        outreach_status: outreach?.status ?? null,
        last_outreach_date: outreach?.outreach_date ?? null,
        outreach_notes: outreach?.notes ?? null,
        // Partner
        partner_status: partner?.partner_status ?? null,
        partner_since: partner?.partner_since ?? null,
        // Leagues
        leagues,
      };

      setOrg(assembled);
    }
    load();
    loadLinks();
    loadCategories();
  }, [orgId, loadLinks, loadCategories]);

  // --- Contact link / unlink ---
  const searchContacts = useCallback(async (q: string) => {
    const { data } = await supabase
      .schema('core').from("contacts")
      .select("id, first_name, last_name, email, role")
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(10);
    return (data || []).map((c) => ({
      id: c.id,
      label: contactName(c),
      sub: c.email || c.role || undefined,
    }));
  }, []);

  const linkContact = useCallback(async (contactId: string) => {
    await supabase.schema('core').from("relationships").insert({ org_id: orgId, contact_id: contactId });
    await loadLinks();
  }, [orgId, loadLinks]);

  const unlinkContact = useCallback(async (contactId: string) => {
    await supabase.schema('core').from("relationships").delete().eq("org_id", orgId).eq("contact_id", contactId);
    await loadLinks();
  }, [orgId, loadLinks]);

  const setField = useCallback((field: keyof SoccerOrg, value: string | number | null) => {
    editDataRef.current[field] = value;
  }, []);

  const startEditing = useCallback(() => {
    if (org) { editDataRef.current = { ...org }; setEditing(true); }
  }, [org]);

  const handleSave = async () => {
    if (!org) return;
    setSaving(true);
    const d = editDataRef.current;
    const num = (k: string) => d[k] != null && String(d[k]) !== "" ? Number(d[k]) : null;

    // org_type — wrap selected value in an array
    const orgTypeVal = d.org_type;
    const orgTypeArray = Array.isArray(orgTypeVal) ? orgTypeVal
      : (orgTypeVal ? [orgTypeVal as string] : []);

    // 1. Update core.organizations
    await supabase.schema('core').from("organizations").update({
      name: (d.name as string) || org.name,
      corporate_structure: (d.corporate_structure as string) || null,
      address: (d.address as string) || null,
      website: (d.website as string) || null,
      avatar_url: (d.avatar_url as string) || null,
      notes: (d.notes as string) || null,
    }).eq("id", org.id);

    // 2. Update org_types (delete + insert)
    await supabase.schema('core').from("org_types").delete().eq("org_id", org.id);
    if (orgTypeArray.length > 0) {
      await supabase.schema('core').from("org_types").insert(orgTypeArray.map((t) => ({ org_id: org.id, type: t })));
    }

    // 3. Upsert intel.org_financials (delete + insert since org_id is UNIQUE)
    await supabase.schema('intel').from("org_financials").delete().eq("org_id", org.id);
    await supabase.schema('intel').from("org_financials").insert({
      org_id: org.id,
      players: num("players"),
      travel_teams: num("travel_teams"),
      dues_per_season: num("dues_per_season"),
      dues_revenue: num("dues_revenue"),
      uniform_cost: num("uniform_cost"),
      total_revenue: num("total_revenue"),
      gross_revenue: num("gross_revenue"),
      total_costs: num("total_costs"),
      yearly_cost_player: num("yearly_cost_player"),
    });

    // 4. Upsert platform.store (delete + insert since org_id is UNIQUE)
    await supabase.schema('platform').from("store").delete().eq("org_id", org.id);
    const storeVals = {
      org_id: org.id,
      store_status: (d.store_status as string) || null,
      store_provider: (d.store_provider as string) || null,
      merch_link: (d.merch_link as string) || null,
    };
    if (storeVals.store_status || storeVals.store_provider || storeVals.merch_link) {
      await supabase.schema('platform').from("store").insert(storeVals);
    }

    // 5. Upsert crm.outreach (delete + insert)
    await supabase.schema('crm').from("outreach").delete().eq("org_id", org.id);
    const outreachStatus = (d.outreach_status as string) || null;
    if (outreachStatus) {
      await supabase.schema('crm').from("outreach").insert({
        org_id: org.id,
        status: outreachStatus,
        outreach_date: (d.last_outreach_date as string) || null,
        notes: (d.outreach_notes as string) || null,
      });
    }

    // 6. Upsert intel.partner_profile (delete + insert since org_id is UNIQUE)
    await supabase.schema('intel').from("partner_profile").delete().eq("org_id", org.id);
    const partnerStatus = (d.partner_status as string) || null;
    if (partnerStatus) {
      await supabase.schema('intel').from("partner_profile").insert({
        org_id: org.id,
        partner_status: partnerStatus,
        partner_since: (d.partner_since as string) || null,
      });
    }

    // Update local state
    const updated = { ...org, ...d };
    for (const k of [...FINANCIAL_FIELDS]) {
      (updated as Record<string, unknown>)[k] = num(k);
    }
    updated.org_type = orgTypeArray;
    setOrg(updated as SoccerOrg);
    setEditing(false);
    setSaving(false);
  };

  const handleCancel = () => { setEditing(false); };

  if (!org) {
    return <div><div className="animate-pulse h-64 bg-gray-200 rounded" /></div>;
  }

  const fp = { editing, org, setField };

  return (
    <div className="max-w-4xl">
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Avatar src={org.avatar_url} name={org.name} size="lg" />
          <div>
            {editing ? (
              <Input
                defaultValue={org.name || ""}
                onChange={(e) => setField("name", e.target.value)}
                className="text-2xl font-bold h-auto py-1 px-2 -ml-2"
              />
            ) : (
              <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
            )}
            <div className="flex gap-2 mt-2 flex-wrap">
              {org.org_type.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
              {org.corporate_structure && <Badge variant="outline">{org.corporate_structure}</Badge>}
              {org.partner_status && <Badge className="bg-green-100 text-green-800 border-0">{org.partner_status}</Badge>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {!editing && org.website && (
            <a href={org.website.startsWith("http") ? org.website : `https://${org.website}`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm"><ExternalLink className="h-4 w-4 mr-1" /> Website</Button>
            </a>
          )}
          {editing ? (
            <>
              <Button variant="ghost" onClick={handleCancel}><X className="h-4 w-4 mr-1" /> Cancel</Button>
              <Button onClick={handleSave} disabled={saving}><Save className="h-4 w-4 mr-1" /> Save</Button>
            </>
          ) : (
            <Button variant="outline" onClick={startEditing}>Edit</Button>
          )}
        </div>
      </div>

      {editing && (
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-base">Avatar</CardTitle></CardHeader>
          <CardContent>
            <AvatarUpload currentUrl={org.avatar_url} name={org.name} onUpload={(dataUrl) => setField("avatar_url", dataUrl)} />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <DetailSelect label="Type" field="org_type" options={ORG_TYPES} {...fp} />
            <DetailSelect label="Structure" field="corporate_structure" options={STRUCTURES} {...fp} />
            <DetailField label="Address" field="address" {...fp} />
            <DetailField label="Website" field="website" type="url" {...fp} />
            <DetailField label="Merch Link" field="merch_link" type="url" {...fp} />
            <DetailSelect label="Store Status" field="store_status" options={STORE_STATUSES} {...fp} />
            <DetailField label="Store Provider" field="store_provider" {...fp} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">League Affiliations</CardTitle></CardHeader>
            <CardContent>
              {org.leagues.length === 0 ? (
                <p className="text-sm text-gray-400">No league affiliations</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {org.leagues.map((l) => <Badge key={l} variant="secondary">{l}</Badge>)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Grid3X3 className="h-4 w-4" /> Categories
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => setShowCatPicker(!showCatPicker)}
                >
                  {showCatPicker ? <X className="h-3.5 w-3.5" /> : <><Plus className="h-3.5 w-3.5 mr-1" /> Assign</>}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {orgCategories.length === 0 && !showCatPicker ? (
                <p className="text-sm text-gray-400">No categories assigned</p>
              ) : (
                <div className="flex flex-wrap gap-2 mb-3">
                  {orgCategories.map((oc) => (
                    <Badge key={oc.id} variant="secondary" className="flex items-center gap-1 pr-1">
                      {oc.category_name}
                      <button
                        onClick={() => unassignCategory(oc.id)}
                        className="ml-1 text-gray-400 hover:text-red-500 transition-colors"
                        disabled={catSaving}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {showCatPicker && (
                <div className="border rounded-lg p-3 bg-gray-50 space-y-2 max-h-64 overflow-y-auto">
                  {allCategories.map((parent) => {
                    const assignedIds = new Set(orgCategories.map((oc) => oc.category_id));
                    const hasChildren = parent.children.length > 0;

                    return (
                      <div key={parent.id}>
                        <button
                          className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-sm font-medium transition-colors ${
                            hasChildren
                              ? "text-gray-500 cursor-default"
                              : assignedIds.has(parent.id)
                              ? "bg-blue-100 text-blue-800"
                              : "hover:bg-gray-100 text-gray-700"
                          }`}
                          onClick={() => {
                            if (hasChildren || catSaving) return;
                            if (assignedIds.has(parent.id)) {
                              const link = orgCategories.find((oc) => oc.category_id === parent.id);
                              if (link) unassignCategory(link.id);
                            } else {
                              assignCategory(parent.id);
                            }
                          }}
                          disabled={catSaving || hasChildren}
                        >
                          {!hasChildren && (
                            <span className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${
                              assignedIds.has(parent.id) ? "bg-blue-600 border-blue-600 text-white" : "border-gray-300"
                            }`}>
                              {assignedIds.has(parent.id) && <Check className="h-3 w-3" />}
                            </span>
                          )}
                          {parent.name}
                        </button>

                        {hasChildren && (
                          <div className="ml-4 space-y-0.5">
                            {parent.children.map((child) => (
                              <button
                                key={child.id}
                                className={`flex items-center gap-2 w-full text-left px-2 py-1 rounded text-sm transition-colors ${
                                  assignedIds.has(child.id)
                                    ? "bg-blue-100 text-blue-800"
                                    : "hover:bg-gray-100 text-gray-600"
                                }`}
                                onClick={() => {
                                  if (catSaving) return;
                                  if (assignedIds.has(child.id)) {
                                    const link = orgCategories.find((oc) => oc.category_id === child.id);
                                    if (link) unassignCategory(link.id);
                                  } else {
                                    assignCategory(child.id);
                                  }
                                }}
                                disabled={catSaving}
                              >
                                <span className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${
                                  assignedIds.has(child.id) ? "bg-blue-600 border-blue-600 text-white" : "border-gray-300"
                                }`}>
                                  {assignedIds.has(child.id) && <Check className="h-3 w-3" />}
                                </span>
                                {child.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Outreach Tracking</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <DetailSelect label="Outreach Status" field="outreach_status" options={OUTREACH_STATUSES} {...fp} />
              <DetailField label="Last Outreach Date" field="last_outreach_date" type="date" {...fp} />
              <DetailField label="Outreach Notes" field="outreach_notes" type="textarea" {...fp} />
              <DetailSelect label="Activity Status" field="partner_status" options={PARTNER_STATUSES} {...fp} />
              <DetailField label="Partner Since" field="partner_since" type="date" {...fp} />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Program Financials</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <DetailField label="Players" field="players" type="number" {...fp} />
              <DetailField label="Travel Teams" field="travel_teams" type="number" {...fp} />
              <DetailField label="Dues / Season" field="dues_per_season" type="number" {...fp} />
              <DetailField label="Uniform Cost" field="uniform_cost" type="number" {...fp} />
              <DetailField label="Total Revenue" field="total_revenue" type="number" {...fp} />
              <DetailField label="Dues Revenue" field="dues_revenue" type="number" {...fp} />
              <DetailField label="Total Costs" field="total_costs" type="number" {...fp} />
              <DetailField label="Yearly Cost / Player" field="yearly_cost_player" type="number" {...fp} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
          <CardContent>
            <DetailField label="" field="notes" type="textarea" {...fp} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <CorrespondenceSection entityType="organizations" entityId={orgId} />
      </div>

      <Card className="mt-6">
        <CardContent className="pt-5">
          <EntityLinker
            title="Contacts"
            icon={<Users className="h-4 w-4" />}
            items={linkedContacts.map((lc) => ({
              id: lc.contacts.id,
              label: contactName(lc.contacts),
              sub: lc.contacts.email || lc.contacts.role || undefined,
              href: `/contacts/${lc.contacts.id}`,
              role: lc.relationship_type,
              linkId: lc.contact_id,
            }))}
            onLink={linkContact}
            onUnlink={unlinkContact}
            onSearch={searchContacts}
            existingIds={new Set(linkedContacts.map((lc) => lc.contact_id))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
