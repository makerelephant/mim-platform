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
import { ArrowLeft, Save, ExternalLink, X, Upload, Trash2, Users } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface SoccerOrg {
  id: string;
  name: string;
  org_type: string | null;
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
  primary_contact: string | null;
  outreach_status: string | null;
  last_outreach_date: string | null;
  outreach_notes: string | null;
  partner_status: string | null;
  partner_since: string | null;
  notes: string | null;
  in_bays: boolean; in_cmysl: boolean; in_cysl: boolean; in_ecnl: boolean; in_ecysa: boolean;
  in_mysl: boolean; in_nashoba: boolean; in_necsl: boolean; in_roots: boolean; in_south_coast: boolean; in_south_shore: boolean;
}

interface LinkedContact {
  contact_id: string;
  role: string | null;
  contacts: { id: string; name: string; email: string | null; title: string | null };
}

const LEAGUE_MAP: Record<string, string> = {
  in_bays: "BAYS", in_cmysl: "CMYSL", in_cysl: "CYSL", in_ecnl: "ECNL",
  in_ecysa: "ECYSA", in_mysl: "MYSL", in_nashoba: "Nashoba", in_necsl: "NECSL",
  in_roots: "Roots", in_south_coast: "South Coast", in_south_shore: "South Shore",
};

const ORG_TYPES = ["Soccer Program Or Club", "Soccer League"];
const STRUCTURES = ["501c3", "LLC", "Corporation", "Partnership"];
const OUTREACH_STATUSES = ["Not Contacted", "Initial Outreach", "In Conversation", "Meeting Scheduled", "Proposal Sent", "Negotiating", "Closed"];
const PARTNER_STATUSES = ["Prospect", "Active Partner", "Inactive", "Churned"];
const STORE_STATUSES = ["No Store", "Setting Up", "Live", "Paused"];

/*
 * Field components use UNCONTROLLED inputs (defaultValue + onChange → ref).
 * Typing updates a ref in the parent — no setState, no re-render, no DOM destruction.
 */

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
        <p className="text-sm">{field.includes("cost") || field.includes("revenue") || field.includes("dues") || field.includes("uniform") ? `$${Number(val).toLocaleString()}` : String(val)}</p>
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
  if (editing) {
    return (
      <div>
        <label className="text-xs text-gray-500">{label}</label>
        <select className="w-full border rounded-md px-2 py-1.5 text-sm mt-0.5" defaultValue={String(org[field] ?? "")} onChange={(e) => setField(field, e.target.value || null)}>
          <option value="">—</option>
          {options.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    );
  }
  const val = org[field];
  const display = val != null && val !== "" ? String(val) : "—";
  return (
    <div>
      <span className="text-xs text-gray-500">{label}</span>
      <p className={`text-sm ${display === "—" ? "text-gray-300" : ""}`}>{display}</p>
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

  const loadLinks = useCallback(async () => {
    const { data: contacts } = await supabase
      .from("organization_contacts")
      .select("contact_id, role, contacts(id, name, email, title)")
      .eq("organization_id", orgId);
    if (contacts) setLinkedContacts(contacts as unknown as LinkedContact[]);
  }, [orgId]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("organizations").select("*").eq("id", orgId).single();
      if (data) setOrg(data);
    }
    load();
    loadLinks();
  }, [orgId, loadLinks]);

  // --- Contact link / unlink ---
  const searchContacts = useCallback(async (q: string) => {
    const { data } = await supabase.from("contacts").select("id, name, email, organization").ilike("name", `%${q}%`).limit(10);
    return (data || []).map((c) => ({ id: c.id, label: c.name, sub: c.organization || c.email || undefined }));
  }, []);

  const linkContact = useCallback(async (contactId: string) => {
    await supabase.from("organization_contacts").insert({ organization_id: orgId, contact_id: contactId });
    await loadLinks();
  }, [orgId, loadLinks]);

  const unlinkContact = useCallback(async (contactId: string) => {
    await supabase.from("organization_contacts").delete().eq("organization_id", orgId).eq("contact_id", contactId);
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

    const { error } = await supabase.from("organizations").update({
      name: (d.name as string) || org.name,
      org_type: (d.org_type as string) || null,
      corporate_structure: (d.corporate_structure as string) || null,
      address: (d.address as string) || null,
      website: (d.website as string) || null,
      merch_link: (d.merch_link as string) || null,
      store_status: (d.store_status as string) || null,
      store_provider: (d.store_provider as string) || null,
      outreach_status: (d.outreach_status as string) || null,
      last_outreach_date: (d.last_outreach_date as string) || null,
      outreach_notes: (d.outreach_notes as string) || null,
      partner_status: (d.partner_status as string) || null,
      partner_since: (d.partner_since as string) || null,
      primary_contact: (d.primary_contact as string) || null,
      notes: (d.notes as string) || null,
      avatar_url: (d.avatar_url as string) || null,
      players: num("players"),
      travel_teams: num("travel_teams"),
      dues_per_season: num("dues_per_season"),
      dues_revenue: num("dues_revenue"),
      uniform_cost: num("uniform_cost"),
      total_revenue: num("total_revenue"),
      gross_revenue: num("gross_revenue"),
      total_costs: num("total_costs"),
      yearly_cost_player: num("yearly_cost_player"),
    }).eq("id", org.id);

    if (!error) {
      const updated = { ...org, ...d };
      // Normalize numeric fields
      for (const k of ["players", "travel_teams", "dues_per_season", "dues_revenue", "uniform_cost", "total_revenue", "gross_revenue", "total_costs", "yearly_cost_player"]) {
        (updated as Record<string, unknown>)[k] = num(k);
      }
      setOrg(updated as SoccerOrg);
      setEditing(false);
    }
    setSaving(false);
  };

  const handleCancel = () => { setEditing(false); };

  if (!org) {
    return <div className="p-8"><div className="animate-pulse h-64 bg-gray-200 rounded" /></div>;
  }

  const fp = { editing, org, setField };
  const leagues = Object.entries(LEAGUE_MAP).filter(([key]) => org[key as keyof SoccerOrg]).map(([, label]) => label);

  return (
    <div className="p-8 max-w-4xl">
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
              {org.org_type && <Badge variant="secondary">{org.org_type}</Badge>}
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
              {leagues.length === 0 ? (
                <p className="text-sm text-gray-400">No league affiliations</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {leagues.map((l) => <Badge key={l} variant="secondary">{l}</Badge>)}
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
            <DetailField label="Primary Contact" field="primary_contact" {...fp} />
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
              label: lc.contacts.name,
              sub: lc.contacts.email || lc.contacts.title || undefined,
              href: `/contacts/${lc.contacts.id}`,
              role: lc.role,
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
