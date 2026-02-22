"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
}

interface LinkedContact {
  contact_id: string;
  role: string | null;
  contacts: { id: string; name: string; email: string | null; title: string | null };
}

const PIPELINE_STATUSES = ["Prospect", "Qualified", "Engaged", "First Meeting", "In Closing", "Closed", "Passed"];
const CONNECTION_STATUSES = ["Active", "Stale", "Need Introduction", "Warm Intro", "Cold"];

export default function InvestorDetail() {
  const params = useParams();
  const router = useRouter();
  const [investor, setInvestor] = useState<Investor | null>(null);
  const [linkedContacts, setLinkedContacts] = useState<LinkedContact[]>([]);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Investor>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const id = params.id as string;
      const { data: inv } = await supabase.from("investors").select("*").eq("id", id).single();
      if (inv) { setInvestor(inv); setEditData(inv); }

      const { data: contacts } = await supabase
        .from("investor_contacts")
        .select("contact_id, role, contacts(id, name, email, title)")
        .eq("investor_id", id);
      if (contacts) setLinkedContacts(contacts as unknown as LinkedContact[]);
    }
    load();
  }, [params.id]);

  const handleSave = async () => {
    if (!investor) return;
    setSaving(true);
    const { error } = await supabase.from("investors").update({
      firm_name: editData.firm_name,
      description: editData.description || null,
      fund_type: editData.fund_type || null,
      investor_type: editData.investor_type || null,
      geography: editData.geography || null,
      location: editData.location || null,
      sector_focus: editData.sector_focus || null,
      check_size: editData.check_size || null,
      portfolio_url: editData.portfolio_url || null,
      website: editData.website || null,
      notable_investments: editData.notable_investments || null,
      connection_status: editData.connection_status || null,
      pipeline_status: editData.pipeline_status || null,
      likelihood_score: editData.likelihood_score != null && String(editData.likelihood_score) !== "" ? Number(editData.likelihood_score) : null,
      source: editData.source || null,
      notes: editData.notes || null,
      last_contact_date: editData.last_contact_date || null,
      next_action: editData.next_action || null,
    }).eq("id", investor.id);
    if (!error) {
      const updated = { ...investor, ...editData, likelihood_score: editData.likelihood_score != null && String(editData.likelihood_score) !== "" ? Number(editData.likelihood_score) : null };
      setInvestor(updated as Investor);
      setEditing(false);
    }
    setSaving(false);
  };

  const handleCancel = () => {
    if (investor) setEditData(investor);
    setEditing(false);
  };

  const setField = (field: keyof Investor, value: string | number | null) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  if (!investor) {
    return <div className="p-8"><div className="animate-pulse h-64 bg-gray-200 rounded" /></div>;
  }

  const Field = ({ label, field, type = "text" }: { label: string; field: keyof Investor; type?: "text" | "textarea" | "number" | "date" | "url" }) => {
    const val = editing ? editData[field] : investor[field];
    if (editing) {
      if (type === "textarea") {
        return (
          <div>
            <label className="text-xs text-gray-500">{label}</label>
            <Textarea rows={3} value={String(val ?? "")} onChange={(e) => setField(field, e.target.value)} className="mt-0.5" />
          </div>
        );
      }
      return (
        <div>
          <label className="text-xs text-gray-500">{label}</label>
          <Input
            type={type === "number" ? "number" : type === "date" ? "date" : "text"}
            value={String(val ?? "")}
            onChange={(e) => setField(field, type === "number" ? (e.target.value ? Number(e.target.value) : null) : e.target.value)}
            className="mt-0.5"
          />
        </div>
      );
    }
    const display = val != null && val !== "" ? String(val) : "—";
    return (
      <div>
        <span className="text-xs text-gray-500">{label}</span>
        {type === "url" && val ? (
          <p className="text-sm"><a href={String(val).startsWith("http") ? String(val) : `https://${val}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{String(val)}</a></p>
        ) : (
          <p className={`text-sm ${display === "—" ? "text-gray-300" : ""}`}>{display}</p>
        )}
      </div>
    );
  };

  const SelectField = ({ label, field, options }: { label: string; field: keyof Investor; options: string[] }) => {
    const val = editing ? editData[field] : investor[field];
    if (editing) {
      return (
        <div>
          <label className="text-xs text-gray-500">{label}</label>
          <select
            className="w-full border rounded-md px-2 py-1.5 text-sm mt-0.5"
            value={String(val ?? "")}
            onChange={(e) => setField(field, e.target.value || null)}
          >
            <option value="">—</option>
            {options.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      );
    }
    const display = val != null && val !== "" ? String(val) : "—";
    return (
      <div>
        <span className="text-xs text-gray-500">{label}</span>
        <p className={`text-sm ${display === "—" ? "text-gray-300" : ""}`}>{display}</p>
      </div>
    );
  };

  return (
    <div className="p-8 max-w-4xl">
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <div className="flex items-center justify-between mb-6">
        <div>
          {editing ? (
            <Input
              value={editData.firm_name || ""}
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
            <Button variant="outline" onClick={() => setEditing(true)}>Edit</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Firm Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Field label="Investor Type" field="investor_type" />
            <Field label="Fund Type" field="fund_type" />
            <Field label="Geography" field="geography" />
            <Field label="Location" field="location" />
            <Field label="Sector Focus" field="sector_focus" />
            <Field label="Check Size" field="check_size" />
            <Field label="Notable Investments" field="notable_investments" type="textarea" />
            <Field label="Likelihood Score" field="likelihood_score" type="number" />
            <Field label="Source" field="source" />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Pipeline & Status</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <SelectField label="Pipeline Status" field="pipeline_status" options={PIPELINE_STATUSES} />
              <SelectField label="Connection Status" field="connection_status" options={CONNECTION_STATUSES} />
              <Field label="Last Contact Date" field="last_contact_date" type="date" />
              <Field label="Next Action" field="next_action" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Links</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Field label="Website" field="website" type="url" />
              <Field label="Portfolio URL" field="portfolio_url" type="url" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader>
            <CardContent>
              <Field label="" field="description" type="textarea" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
            <CardContent>
              <Field label="" field="notes" type="textarea" />
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
