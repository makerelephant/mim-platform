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
import { ArrowLeft, Save, ExternalLink, X } from "lucide-react";
import Link from "next/link";

interface Investor {
  id: string;
  firm_name: string;
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
  avatar_url: string | null;
}

interface LinkedContact {
  contact_id: string;
  role: string | null;
  contacts: { id: string; name: string; email: string | null; title: string | null };
}

const PIPELINE_STATUSES = ["Prospect", "Qualified", "Engaged", "First Meeting", "In Closing", "Closed", "Passed"];
const CONNECTION_STATUSES = ["Active", "Stale", "Need Introduction", "Warm Intro", "Cold"];

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

/* ── Main component ── */

export default function InvestorDetail() {
  const params = useParams();
  const router = useRouter();
  const [investor, setInvestor] = useState<Investor | null>(null);
  const [linkedContacts, setLinkedContacts] = useState<LinkedContact[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit data stored in a ref — mutations never trigger re-renders.
  // This is the core fix: typing updates the ref silently, so the parent
  // never re-renders and child components are never destroyed.
  const editDataRef = useRef<Record<string, unknown>>({});

  useEffect(() => {
    async function load() {
      const id = params.id as string;
      const { data: inv } = await supabase.from("investors").select("*").eq("id", id).single();
      if (inv) setInvestor(inv);

      const { data: contacts } = await supabase
        .from("investor_contacts")
        .select("contact_id, role, contacts(id, name, email, title)")
        .eq("investor_id", id);
      if (contacts) setLinkedContacts(contacts as unknown as LinkedContact[]);
    }
    load();
  }, [params.id]);

  // setField writes to the ref — no setState, no re-render
  const setField = useCallback((field: keyof Investor, value: string | number | null) => {
    editDataRef.current[field] = value;
  }, []);

  const startEditing = useCallback(() => {
    if (investor) {
      // Snapshot current investor data into the ref
      editDataRef.current = { ...investor };
      setEditing(true);
    }
  }, [investor]);

  const handleSave = async () => {
    if (!investor) return;
    setSaving(true);
    const d = editDataRef.current;
    const { error } = await supabase.from("investors").update({
      firm_name: (d.firm_name as string) || investor.firm_name,
      description: (d.description as string) || null,
      fund_type: (d.fund_type as string) || null,
      investor_type: (d.investor_type as string) || null,
      geography: (d.geography as string) || null,
      location: (d.location as string) || null,
      sector_focus: (d.sector_focus as string) || null,
      check_size: (d.check_size as string) || null,
      portfolio_url: (d.portfolio_url as string) || null,
      website: (d.website as string) || null,
      notable_investments: (d.notable_investments as string) || null,
      connection_status: (d.connection_status as string) || null,
      pipeline_status: (d.pipeline_status as string) || null,
      likelihood_score: d.likelihood_score != null && String(d.likelihood_score) !== "" ? Number(d.likelihood_score) : null,
      source: (d.source as string) || null,
      notes: (d.notes as string) || null,
      last_contact_date: (d.last_contact_date as string) || null,
      next_action: (d.next_action as string) || null,
      avatar_url: (d.avatar_url as string) || null,
    }).eq("id", investor.id);

    if (!error) {
      const updated = {
        ...investor,
        ...d,
        likelihood_score: d.likelihood_score != null && String(d.likelihood_score) !== "" ? Number(d.likelihood_score) : null,
      };
      setInvestor(updated as Investor);
      setEditing(false);
    }
    setSaving(false);
  };

  const handleCancel = () => {
    setEditing(false);
  };

  if (!investor) {
    return <div className="p-8"><div className="animate-pulse h-64 bg-gray-200 rounded" /></div>;
  }

  const fp = { editing, investor, setField };

  return (
    <div className="p-8 max-w-4xl">
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Avatar src={investor.avatar_url} name={investor.firm_name} size="lg" />
          <div>
            {editing ? (
              <Input
                defaultValue={investor.firm_name || ""}
                onChange={(e) => setField("firm_name", e.target.value)}
                className="text-2xl font-bold h-auto py-1 px-2 -ml-2"
              />
            ) : (
              <h1 className="text-2xl font-bold text-gray-900">{investor.firm_name}</h1>
            )}
            <div className="flex gap-2 mt-2">
              <Badge variant="secondary">{investor.pipeline_status || "Not in Pipeline"}</Badge>
              {investor.connection_status && <Badge variant="outline">{investor.connection_status}</Badge>}
              {investor.investor_type && <Badge variant="outline">{investor.investor_type}</Badge>}
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
            <DetailField label="Avatar URL" field="avatar_url" type="url" {...fp} />
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
            <DetailField label="Check Size" field="check_size" {...fp} />
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

      <Card className="mt-6">
        <CardHeader><CardTitle className="text-base">Linked Contacts</CardTitle></CardHeader>
        <CardContent>
          {linkedContacts.length === 0 ? (
            <p className="text-sm text-gray-400">No linked contacts</p>
          ) : (
            <div className="space-y-2">
              {linkedContacts.map((lc) => (
                <div key={lc.contact_id} className="flex items-center justify-between py-1">
                  <Link href={`/contacts/${lc.contacts.id}`} className="text-sm text-blue-600 hover:underline">
                    {lc.contacts.name}
                  </Link>
                  <div className="flex items-center gap-2">
                    {lc.contacts.email && <span className="text-xs text-gray-400">{lc.contacts.email}</span>}
                    {lc.role && <Badge variant="outline" className="text-xs">{lc.role}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
