"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, ExternalLink } from "lucide-react";
import Link from "next/link";

interface Program {
  id: string;
  league: string;
  program_name: string;
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
  website: string | null;
  merch_link: string | null;
  store_status: string | null;
  outreach_status: string | null;
  last_outreach_date: string | null;
  outreach_notes: string | null;
}

interface LinkedContact {
  contact_id: string;
  role: string | null;
  contacts: { id: string; name: string; email: string | null };
}

const OUTREACH_STATUSES = ["Not Contacted", "Contacted", "Meeting Scheduled", "Active Partner", "Not Interested"];

export default function MarketMapDetail() {
  const params = useParams();
  const router = useRouter();
  const [program, setProgram] = useState<Program | null>(null);
  const [linkedContacts, setLinkedContacts] = useState<LinkedContact[]>([]);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Program>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const id = params.id as string;
      const { data } = await supabase.from("market_map").select("*").eq("id", id).single();
      if (data) { setProgram(data); setEditData(data); }

      const { data: contacts } = await supabase
        .from("market_map_contacts")
        .select("contact_id, role, contacts(id, name, email)")
        .eq("market_map_id", id);
      if (contacts) setLinkedContacts(contacts as unknown as LinkedContact[]);
    }
    load();
  }, [params.id]);

  const handleSave = async () => {
    if (!program) return;
    setSaving(true);
    await supabase.from("market_map").update({
      outreach_status: editData.outreach_status,
      outreach_notes: editData.outreach_notes,
      last_outreach_date: editData.outreach_status !== program.outreach_status ? new Date().toISOString().split("T")[0] : program.last_outreach_date,
    }).eq("id", program.id);
    setProgram({ ...program, ...editData });
    setEditing(false);
    setSaving(false);
  };

  if (!program) {
    return <div className="p-8"><div className="animate-pulse h-64 bg-gray-200 rounded" /></div>;
  }

  const fmt = (n: number | null) => n != null ? `$${n.toLocaleString()}` : "—";

  return (
    <div className="p-8 max-w-4xl">
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{program.program_name}</h1>
          <div className="flex gap-2 mt-2">
            <Badge variant="secondary">{program.league}</Badge>
            <Badge className={program.outreach_status === "Active Partner" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
              {program.outreach_status || "Not Contacted"}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {program.website && (
            <a href={program.website.startsWith("http") ? program.website : `https://${program.website}`} target="_blank" rel="noopener noreferrer">
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
          <CardHeader><CardTitle className="text-base">Program Info</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-xs text-gray-500">Players</span><p className="font-medium">{program.players?.toLocaleString() || "—"}</p></div>
              <div><span className="text-xs text-gray-500">Travel Teams</span><p className="font-medium">{program.travel_teams || "—"}</p></div>
              <div><span className="text-xs text-gray-500">Dues/Season</span><p className="font-medium">{fmt(program.dues_per_season)}</p></div>
              <div><span className="text-xs text-gray-500">Uniform Cost</span><p className="font-medium">{fmt(program.uniform_cost)}</p></div>
              <div><span className="text-xs text-gray-500">Total Revenue</span><p className="font-medium">{fmt(program.total_revenue)}</p></div>
              <div><span className="text-xs text-gray-500">Dues Revenue</span><p className="font-medium">{fmt(program.dues_revenue)}</p></div>
              <div><span className="text-xs text-gray-500">Yearly Cost/Player</span><p className="font-medium">{fmt(program.yearly_cost_player)}</p></div>
              <div><span className="text-xs text-gray-500">Primary Contact</span><p className="font-medium">{program.primary_contact || "—"}</p></div>
            </div>
            {program.merch_link && (
              <div>
                <span className="text-xs text-gray-500">Merch Link</span>
                <a href={program.merch_link} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline block">{program.merch_link}</a>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Outreach Tracking</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {editing ? (
                <>
                  <div>
                    <label className="text-xs text-gray-500">Status</label>
                    <select className="w-full border rounded-md px-2 py-1.5 text-sm" value={editData.outreach_status || ""} onChange={(e) => setEditData({ ...editData, outreach_status: e.target.value })}>
                      {OUTREACH_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Notes</label>
                    <Textarea rows={4} value={editData.outreach_notes || ""} onChange={(e) => setEditData({ ...editData, outreach_notes: e.target.value })} />
                  </div>
                </>
              ) : (
                <>
                  <div><span className="text-xs text-gray-500">Last Outreach</span><p className="text-sm">{program.last_outreach_date || "Never"}</p></div>
                  <div><span className="text-xs text-gray-500">Notes</span><p className="text-sm whitespace-pre-wrap">{program.outreach_notes || "No notes."}</p></div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Linked Contacts</CardTitle></CardHeader>
            <CardContent>
              {linkedContacts.length === 0 ? (
                <p className="text-sm text-gray-400">No linked contacts</p>
              ) : (
                <div className="space-y-2">
                  {linkedContacts.map((lc) => (
                    <Link key={lc.contact_id} href={`/contacts/${lc.contacts.id}`} className="block text-sm text-blue-600 hover:underline">
                      {lc.contacts.name} {lc.contacts.email && <span className="text-gray-400 ml-1">{lc.contacts.email}</span>}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
