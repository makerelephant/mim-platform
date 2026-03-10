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
import { CHECK_SIZE_OPTIONS, CHECK_SIZE_COLORS } from "@/config/investor-constants";

interface Investor {
  id: string;
  name: string;
  description: string | null;
  fund_type: string | null;
  investor_type: string | null;
  geography: string | null;
  location: string | null;
  sector_focus: string | null;
  check_size: string | null;
  portfolio_url: string | null;
  website: string | null;
  notable_investments: string | null;
  connection_status: string | null;
  pipeline_status: string | null;
  likelihood_score: number | null;
  source: string | null;
  notes: string | null;
  last_contact_date: string | null;
  next_action: string | null;
  next_action_date: string | null;
  avatar_url: string | null;
}

interface LinkedContact {
  contact_id: string;
  relationship_type: string | null;
  contacts: { id: string; first_name: string | null; last_name: string | null; email: string | null; role: string | null };
}

const PIPELINE_STATUSES = ["Prospect", "Qualified", "Engaged", "First Meeting", "In Closing", "Closed", "Passed"];
const CONNECTION_STATUSES = ["Active", "Stale", "Need Introduction", "Warm Intro", "Cold"];

/** Fields stored in intel.investor_profile */
const PROFILE_FIELDS = new Set(["investor_type", "fund_type", "geography", "location", "sector_focus", "check_size", "portfolio_url", "notable_investments", "connection_status", "likelihood_score", "last_contact_date"]);
/** Fields stored in core.organizations */
const ORG_FIELDS = new Set(["name", "description", "website", "avatar_url", "source", "notes"]);

/*
 * Field components use UNCONTROLLED inputs (defaultValue + onChange → ref).
 * Typing updates a ref in the parent — no setState, no re-render, no DOM destruction.
 */

function DetailField({
  label,
  field,
  type = "text",
  editing,
  investor,
  setField,
}: {
  label: string;
  field: keyof Investor;
  type?: "text" | "textarea" | "number" | "date" | "url";
  editing: boolean;
  investor: Investor;
  setField: (field: keyof Investor, value: string | number | null) => void;
}) {
  if (editing) {
    const defVal = String(investor[field] ?? "");
    if (type === "textarea") {
      return (
        <div>
          {label && <label className="text-xs text-gray-500">{label}</label>}
          <Textarea
            rows={3}
            defaultValue={defVal}
            onChange={(e) => setField(field, e.target.value)}
            className="mt-0.5"
          />
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

  const val = investor[field];
  const display = val != null && val !== "" ? String(val) : "—";
  return (
    <div>
      {label && <span className="text-xs text-gray-500">{label}</span>}
      {type === "url" && val ? (
        <p className="text-sm">
          <a
            href={String(val).startsWith("http") ? String(val) : `https://${val}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            {String(val)}
          </a>
        </p>
      ) : (
        <p className={`text-sm ${display === "—" ? "text-gray-300" : ""}`}>{display}</p>
      )}
    </div>
  );
}

function DetailSelect({
  label,
  field,
  options,
  editing,
  investor,
  setField,
}: {
  label: string;
  field: keyof Investor;
  options: string[];
  editing: boolean;
  investor: Investor;
  setField: (field: keyof Investor, value: string | number | null) => void;
}) {
  if (editing) {
    return (
      <div>
        <label className="text-xs text-gray-500">{label}</label>
        <select
          className="w-full border rounded-md px-2 py-1.5 text-sm mt-0.5"
          defaultValue={String(investor[field] ?? "")}
          onChange={(e) => setField(field, e.target.value || null)}
        >
          <option value="">—</option>
          {options.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
    );
  }

  const val = investor[field];
  const display = val != null && val !== "" ? String(val) : "—";
  return (
    <div>
      <span className="text-xs text-gray-500">{label}</span>
      <p className={`text-sm ${display === "—" ? "text-gray-300" : ""}`}>{display}</p>
    </div>
  );
}

/* ── Avatar upload component ── */

function AvatarUpload({
  currentUrl,
  name,
  onUpload,
}: {
  currentUrl: string | null;
  name: string;
  onUpload: (dataUrl: string | null) => void;
}) {
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

  const handleRemove = () => {
    setPreview(null);
    onUpload(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-20 w-20 rounded-full overflow-hidden bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center shrink-0">
        {preview ? (
          <Image src={preview} alt={name} fill className="object-cover" unoptimized />
        ) : (
          <span className="text-2xl font-bold text-gray-400">
            {name?.charAt(0)?.toUpperCase() || "?"}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5 mr-1" />
          {preview ? "Change Photo" : "Upload Photo"}
        </Button>
        {preview && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-700"
            onClick={handleRemove}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
          </Button>
        )}
      </div>
    </div>
  );
}

/* ── Helper: assemble contact display name ── */
function contactName(c: { first_name: string | null; last_name: string | null }): string {
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "(unnamed)";
}

/* ── Main component ── */

export default function InvestorDetail() {
  const params = useParams();
  const router = useRouter();
  const [investor, setInvestor] = useState<Investor | null>(null);
  const [linkedContacts, setLinkedContacts] = useState<LinkedContact[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const investorId = params.id as string;

  // Edit data stored in a ref — mutations never trigger re-renders.
  const editDataRef = useRef<Record<string, unknown>>({});

  const loadLinks = useCallback(async () => {
    const { data: contacts } = await supabase
      .schema('core').from("relationships")
      .select("contact_id, relationship_type, contacts(id, first_name, last_name, email, role)")
      .eq("org_id", investorId);
    if (contacts) setLinkedContacts(contacts as unknown as LinkedContact[]);
  }, [investorId]);

  useEffect(() => {
    async function load() {
      // Load org + profile + pipeline in parallel
      const [orgResult, profileResult, pipelineResult] = await Promise.all([
        supabase.schema('core').from("organizations").select("*").eq("id", investorId).single(),
        supabase.schema('intel').from("investor_profile").select("*").eq("org_id", investorId).maybeSingle(),
        supabase.schema('crm').from("pipeline").select("*").eq("org_id", investorId).maybeSingle(),
      ]);

      if (orgResult.data) {
        const org = orgResult.data;
        const profile = profileResult.data || {};
        const pipeline = pipelineResult.data;

        const assembled: Investor = {
          id: org.id,
          name: org.name,
          description: org.description || null,
          fund_type: profile.fund_type || null,
          investor_type: profile.investor_type || null,
          geography: profile.geography || null,
          location: profile.location || null,
          sector_focus: profile.sector_focus || null,
          check_size: profile.check_size || null,
          portfolio_url: profile.portfolio_url || null,
          website: org.website || null,
          notable_investments: profile.notable_investments || null,
          connection_status: profile.connection_status || null,
          pipeline_status: pipeline?.status || null,
          likelihood_score: profile.likelihood_score || null,
          source: org.source || profile.source || null,
          notes: org.notes || null,
          last_contact_date: profile.last_contact_date || null,
          next_action: pipeline?.next_action || null,
          next_action_date: pipeline?.next_action_date || null,
          avatar_url: org.avatar_url || null,
        };
        setInvestor(assembled);
      }
    }
    load();
    loadLinks();
  }, [investorId, loadLinks]);

  // --- Contact link / unlink handlers ---

  const searchContacts = useCallback(async (q: string) => {
    const { data } = await supabase
      .schema('core').from("contacts")
      .select("id, first_name, last_name, email")
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(10);
    return (data || []).map((c) => ({
      id: c.id,
      label: contactName(c),
      sub: c.email || undefined,
    }));
  }, []);

  const linkContact = useCallback(async (contactId: string) => {
    await supabase.schema('core').from("relationships").insert({ org_id: investorId, contact_id: contactId });
    await loadLinks();
  }, [investorId, loadLinks]);

  const unlinkContact = useCallback(async (contactId: string) => {
    await supabase.schema('core').from("relationships").delete().eq("org_id", investorId).eq("contact_id", contactId);
    await loadLinks();
  }, [investorId, loadLinks]);

  // setField writes to the ref — no setState, no re-render
  const setField = useCallback((field: keyof Investor, value: string | number | null) => {
    editDataRef.current[field] = value;
  }, []);

  const startEditing = useCallback(() => {
    if (investor) {
      editDataRef.current = { ...investor };
      setEditing(true);
    }
  }, [investor]);

  const handleSave = async () => {
    if (!investor) return;
    setSaving(true);
    const d = editDataRef.current;

    // Route fields to correct tables
    const orgPayload: Record<string, unknown> = {};
    const profilePayload: Record<string, unknown> = {};
    const pipelineStatus = d.pipeline_status as string | null;
    const nextAction = d.next_action as string | null;
    const nextActionDate = d.next_action_date as string | null;

    for (const [key, val] of Object.entries(d)) {
      if (ORG_FIELDS.has(key)) orgPayload[key] = val || null;
      else if (PROFILE_FIELDS.has(key)) {
        profilePayload[key] = key === "likelihood_score"
          ? (val != null && String(val) !== "" ? Number(val) : null)
          : (val || null);
      }
    }

    // Update all tables in parallel
    const promises: PromiseLike<unknown>[] = [];

    if (Object.keys(orgPayload).length > 0) {
      promises.push(supabase.schema('core').from("organizations").update(orgPayload).eq("id", investor.id));
    }

    if (Object.keys(profilePayload).length > 0) {
      promises.push(supabase.schema('intel').from("investor_profile").update(profilePayload).eq("org_id", investor.id));
    }

    // Pipeline: upsert or delete
    if (pipelineStatus !== investor.pipeline_status || nextAction !== investor.next_action || nextActionDate !== investor.next_action_date) {
      await supabase.schema('crm').from("pipeline").delete().eq("org_id", investor.id);
      if (pipelineStatus) {
        promises.push(supabase.schema('crm').from("pipeline").insert({
          org_id: investor.id,
          status: pipelineStatus,
          next_action: nextAction || null,
          next_action_date: nextActionDate || null,
        }));
      }
    }

    await Promise.all(promises);

    // Calendar reminder — non-blocking
    const newDate = nextActionDate;
    const oldDate = investor.next_action_date;
    if (newDate && newDate !== oldDate) {
      fetch("/api/calendar/create-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `[MiM] Follow up: ${(d.name as string) || investor.name}`,
          date: newDate,
          description: `Next action: ${nextAction || investor.next_action || ""}\nFirm: ${(d.name as string) || investor.name}`,
        }),
      }).catch(() => {});
    }

    const updated = {
      ...investor,
      ...d,
      likelihood_score: d.likelihood_score != null && String(d.likelihood_score) !== "" ? Number(d.likelihood_score) : null,
    };
    setInvestor(updated as Investor);
    setEditing(false);
    setSaving(false);
  };

  const handleCancel = () => {
    setEditing(false);
  };

  if (!investor) {
    return <div><div className="animate-pulse h-64 bg-gray-200 rounded" /></div>;
  }

  const fp = { editing, investor, setField };

  return (
    <div className="max-w-4xl">
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Avatar src={investor.avatar_url} name={investor.name} size="lg" />
          <div>
            {editing ? (
              <Input
                defaultValue={investor.name || ""}
                onChange={(e) => setField("name", e.target.value)}
                className="text-2xl font-bold h-auto py-1 px-2 -ml-2"
              />
            ) : (
              <h1 className="text-2xl font-bold text-gray-900">{investor.name}</h1>
            )}
            <div className="flex gap-2 mt-2 flex-wrap">
              <Badge variant="secondary">{investor.pipeline_status || "Not in Pipeline"}</Badge>
              {investor.connection_status && <Badge variant="outline">{investor.connection_status}</Badge>}
              {investor.investor_type && <Badge variant="outline">{investor.investor_type}</Badge>}
              {investor.check_size && (
                <Badge className={`${CHECK_SIZE_COLORS[investor.check_size] || "bg-gray-100 text-gray-800"} border-0`}>
                  {investor.check_size}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {!editing && investor.website && (
            <a href={investor.website.startsWith("http") ? investor.website : `https://${investor.website}`} target="_blank" rel="noopener noreferrer">
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
            <AvatarUpload
              currentUrl={investor.avatar_url}
              name={investor.name}
              onUpload={(dataUrl) => setField("avatar_url", dataUrl)}
            />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Firm Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <DetailField label="Investor Type" field="investor_type" {...fp} />
            <DetailField label="Fund Type" field="fund_type" {...fp} />
            <DetailField label="Geography" field="geography" {...fp} />
            <DetailField label="Location" field="location" {...fp} />
            <DetailField label="Sector Focus" field="sector_focus" {...fp} />
            <DetailSelect label="Check Size" field="check_size" options={CHECK_SIZE_OPTIONS} {...fp} />
            <DetailField label="Notable Investments" field="notable_investments" type="textarea" {...fp} />
            <DetailField label="Likelihood Score" field="likelihood_score" type="number" {...fp} />
            <DetailField label="Source" field="source" {...fp} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Pipeline & Status</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <DetailSelect label="Pipeline Status" field="pipeline_status" options={PIPELINE_STATUSES} {...fp} />
              <DetailSelect label="Connection Status" field="connection_status" options={CONNECTION_STATUSES} {...fp} />
              <DetailField label="Last Contact Date" field="last_contact_date" type="date" {...fp} />
              <DetailField label="Next Action" field="next_action" {...fp} />
              <DetailField label="By When" field="next_action_date" type="date" {...fp} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Links</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <DetailField label="Website" field="website" type="url" {...fp} />
              <DetailField label="Portfolio URL" field="portfolio_url" type="url" {...fp} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader>
            <CardContent>
              <DetailField label="" field="description" type="textarea" {...fp} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
            <CardContent>
              <DetailField label="" field="notes" type="textarea" {...fp} />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <CorrespondenceSection entityType="organizations" entityId={investorId} />
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
