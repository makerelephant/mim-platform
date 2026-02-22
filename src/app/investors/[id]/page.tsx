"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, ExternalLink } from "lucide-react";
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
      description: editData.description,
      notes: editData.notes,
      pipeline_status: editData.pipeline_status,
      connection_status: editData.connection_status,
      next_action: editData.next_action,
    }).eq("id", investor.id);
    if (!error) {
      setInvestor({ ...investor, ...editData });
      setEditing(false);
    }
    setSaving(false);
  };

  if (!investor) {
    return <div className="p-8"><div className="animate-pulse h-64 bg-gray-200 rounded" /></div>;
  }

  return (
    <div className="p-8 max-w-4xl">
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{investor.firm_name}</h1>
          <div className="flex gap-2 mt-2">
            <Badge variant="secondary">{investor.pipeline_status || "Prospect"}</Badge>
            {investor.connection_status && <Badge variant="outline">{investor.connection_status}</Badge>}
            {investor.investor_type && <Badge variant="outline">{investor.investor_type}</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          {investor.website && (
            <a href={investor.website.startsWith("http") ? investor.website : `https://${investor.website}`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm"><ExternalLink className="h-4 w-4 mr-1" /> Website</Button>
            </a>
          )}
          <Button variant={editing ? "default" : "outline"} onClick={editing ? handleSave : () => setEditing(true)} disabled={saving}>
            {editing ? <><Save className="h-4 w-4 mr-1" /> Save</> : "Edit"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Firm Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><span className="text-xs text-gray-500">Geography</span><p>{investor.geography || "—"}</p></div>
            <div><span className="text-xs text-gray-500">Location</span><p>{investor.location || "—"}</p></div>
            <div><span className="text-xs text-gray-500">Sector Focus</span><p>{investor.sector_focus || "—"}</p></div>
            <div><span className="text-xs text-gray-500">Check Size</span><p>{investor.check_size || "—"}</p></div>
            <div><span className="text-xs text-gray-500">Fund Type</span><p>{investor.fund_type || "—"}</p></div>
            <div><span className="text-xs text-gray-500">Notable Investments</span><p>{investor.notable_investments || "—"}</p></div>
            <div><span className="text-xs text-gray-500">Likelihood Score</span><p>{investor.likelihood_score ?? "—"}</p></div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Pipeline & Status</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {editing ? (
                <>
                  <div>
                    <label className="text-xs text-gray-500">Pipeline Status</label>
                    <select className="w-full border rounded-md px-2 py-1.5 text-sm" value={editData.pipeline_status || ""} onChange={(e) => setEditData({ ...editData, pipeline_status: e.target.value })}>
                      {PIPELINE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Connection Status</label>
                    <Input value={editData.connection_status || ""} onChange={(e) => setEditData({ ...editData, connection_status: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Next Action</label>
                    <Input value={editData.next_action || ""} onChange={(e) => setEditData({ ...editData, next_action: e.target.value })} />
                  </div>
                </>
              ) : (
                <>
                  <div><span className="text-xs text-gray-500">Last Contact</span><p className="text-sm">{investor.last_contact_date || "—"}</p></div>
                  <div><span className="text-xs text-gray-500">Next Action</span><p className="text-sm">{investor.next_action || "—"}</p></div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
            <CardContent>
              {editing ? (
                <Textarea rows={4} value={editData.notes || ""} onChange={(e) => setEditData({ ...editData, notes: e.target.value })} />
              ) : (
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{investor.notes || "No notes."}</p>
              )}
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
