"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Building2, Map, TrendingUp } from "lucide-react";
import Link from "next/link";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  address: string | null;
  segment: string | null;
  primary_category: string | null;
  subcategory: string | null;
  region: string | null;
  business_type: string | null;
  notes: string | null;
  source: string | null;
}

interface LinkedInvestor {
  investor_id: string;
  role: string | null;
  investors: { id: string; firm_name: string; pipeline_status: string | null };
}

interface LinkedOrg {
  soccer_org_id: string;
  role: string | null;
  soccer_orgs: { id: string; org_name: string; org_type: string | null };
}

interface LinkedProgram {
  market_map_id: string;
  role: string | null;
  market_map: { id: string; program_name: string; league: string };
}

export default function ContactDetail() {
  const params = useParams();
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [linkedInvestors, setLinkedInvestors] = useState<LinkedInvestor[]>([]);
  const [linkedOrgs, setLinkedOrgs] = useState<LinkedOrg[]>([]);
  const [linkedPrograms, setLinkedPrograms] = useState<LinkedProgram[]>([]);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Contact>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const id = params.id as string;
      const { data: c } = await supabase.from("contacts").select("*").eq("id", id).single();
      if (c) {
        setContact(c);
        setEditData(c);
      }

      const { data: inv } = await supabase
        .from("investor_contacts")
        .select("investor_id, role, investors(id, firm_name, pipeline_status)")
        .eq("contact_id", id);
      if (inv) setLinkedInvestors(inv as unknown as LinkedInvestor[]);

      const { data: orgs } = await supabase
        .from("soccer_org_contacts")
        .select("soccer_org_id, role, soccer_orgs(id, org_name, org_type)")
        .eq("contact_id", id);
      if (orgs) setLinkedOrgs(orgs as unknown as LinkedOrg[]);

      const { data: progs } = await supabase
        .from("market_map_contacts")
        .select("market_map_id, role, market_map(id, program_name, league)")
        .eq("contact_id", id);
      if (progs) setLinkedPrograms(progs as unknown as LinkedProgram[]);
    }
    load();
  }, [params.id]);

  const handleSave = async () => {
    if (!contact) return;
    setSaving(true);
    await supabase.from("contacts").update({
      name: editData.name,
      email: editData.email,
      phone: editData.phone,
      title: editData.title,
      address: editData.address,
      notes: editData.notes,
    }).eq("id", contact.id);
    setContact({ ...contact, ...editData });
    setEditing(false);
    setSaving(false);
  };

  if (!contact) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{contact.name}</h1>
          <div className="flex gap-2 mt-2">
            {contact.primary_category && (
              <Badge className={
                contact.primary_category === "Youth Sports" ? "bg-green-100 text-green-800" :
                contact.primary_category === "MiM" ? "bg-blue-100 text-blue-800" :
                "bg-orange-100 text-orange-800"
              }>
                {contact.primary_category}
              </Badge>
            )}
            {contact.segment && <Badge variant="secondary">{contact.segment}</Badge>}
          </div>
        </div>
        <Button variant={editing ? "default" : "outline"} onClick={editing ? handleSave : () => setEditing(true)} disabled={saving}>
          {editing ? <><Save className="h-4 w-4 mr-1" /> Save</> : "Edit"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Contact Info</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {editing ? (
              <>
                <div><label className="text-xs text-gray-500">Name</label><Input value={editData.name || ""} onChange={(e) => setEditData({ ...editData, name: e.target.value })} /></div>
                <div><label className="text-xs text-gray-500">Email</label><Input value={editData.email || ""} onChange={(e) => setEditData({ ...editData, email: e.target.value })} /></div>
                <div><label className="text-xs text-gray-500">Phone</label><Input value={editData.phone || ""} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} /></div>
                <div><label className="text-xs text-gray-500">Title</label><Input value={editData.title || ""} onChange={(e) => setEditData({ ...editData, title: e.target.value })} /></div>
                <div><label className="text-xs text-gray-500">Address</label><Input value={editData.address || ""} onChange={(e) => setEditData({ ...editData, address: e.target.value })} /></div>
              </>
            ) : (
              <>
                <div><span className="text-xs text-gray-500">Email</span><p className="text-sm">{contact.email || "—"}</p></div>
                <div><span className="text-xs text-gray-500">Phone</span><p className="text-sm">{contact.phone || "—"}</p></div>
                <div><span className="text-xs text-gray-500">Title</span><p className="text-sm">{contact.title || "—"}</p></div>
                <div><span className="text-xs text-gray-500">Address</span><p className="text-sm">{contact.address || "—"}</p></div>
                <div><span className="text-xs text-gray-500">Region</span><p className="text-sm">{contact.region || "—"}</p></div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
          <CardContent>
            {editing ? (
              <Textarea rows={6} value={editData.notes || ""} onChange={(e) => setEditData({ ...editData, notes: e.target.value })} />
            ) : (
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{contact.notes || "No notes yet."}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Linked Investors
            </CardTitle>
          </CardHeader>
          <CardContent>
            {linkedInvestors.length === 0 ? (
              <p className="text-sm text-gray-400">None</p>
            ) : (
              <div className="space-y-2">
                {linkedInvestors.map((li) => (
                  <Link key={li.investor_id} href={`/investors/${li.investors.id}`} className="block text-sm text-blue-600 hover:underline">
                    {li.investors.firm_name}
                    {li.role && <span className="text-gray-400 ml-1">({li.role})</span>}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Linked Soccer Orgs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {linkedOrgs.length === 0 ? (
              <p className="text-sm text-gray-400">None</p>
            ) : (
              <div className="space-y-2">
                {linkedOrgs.map((lo) => (
                  <Link key={lo.soccer_org_id} href={`/soccer-orgs/${lo.soccer_orgs.id}`} className="block text-sm text-blue-600 hover:underline">
                    {lo.soccer_orgs.org_name}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Map className="h-4 w-4" /> Linked Programs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {linkedPrograms.length === 0 ? (
              <p className="text-sm text-gray-400">None</p>
            ) : (
              <div className="space-y-2">
                {linkedPrograms.map((lp) => (
                  <Link key={lp.market_map_id} href={`/market-map/${lp.market_map.id}`} className="block text-sm text-blue-600 hover:underline">
                    {lp.market_map.program_name} <span className="text-gray-400">({lp.market_map.league})</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
