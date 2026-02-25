"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { CorrespondenceSection } from "@/components/CorrespondenceSection";
import Link from "next/link";

interface SoccerOrg {
  id: string;
  org_name: string;
  org_type: string | null;
  corporate_structure: string | null;
  address: string | null;
  website: string | null;
  merch_link: string | null;
  store_status: string | null;
  store_provider: string | null;
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
  in_bays: boolean;
  in_cmysl: boolean;
  in_cysl: boolean;
  in_ecnl: boolean;
  in_ecysa: boolean;
  in_mysl: boolean;
  in_nashoba: boolean;
  in_necsl: boolean;
  in_roots: boolean;
  in_south_coast: boolean;
  in_south_shore: boolean;
  notes: string | null;
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

export default function SoccerOrgDetail() {
  const params = useParams();
  const router = useRouter();
  const [org, setOrg] = useState<SoccerOrg | null>(null);
  const [linkedContacts, setLinkedContacts] = useState<LinkedContact[]>([]);

  useEffect(() => {
    async function load() {
      const id = params.id as string;
      const { data } = await supabase.from("soccer_orgs").select("*").eq("id", id).single();
      if (data) setOrg(data);

      const { data: contacts } = await supabase
        .from("soccer_org_contacts")
        .select("contact_id, role, contacts(id, name, email, title)")
        .eq("soccer_org_id", id);
      if (contacts) setLinkedContacts(contacts as unknown as LinkedContact[]);
    }
    load();
  }, [params.id]);

  if (!org) {
    return <div className="p-8"><div className="animate-pulse h-64 bg-gray-200 rounded" /></div>;
  }

  const leagues = Object.entries(LEAGUE_MAP).filter(([key]) => org[key as keyof SoccerOrg]).map(([, label]) => label);

  return (
    <div className="p-8 max-w-4xl">
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{org.org_name}</h1>
          <div className="flex gap-2 mt-2">
            {org.org_type && <Badge variant="secondary">{org.org_type}</Badge>}
            {org.corporate_structure && <Badge variant="outline">{org.corporate_structure}</Badge>}
            {org.partner_status && <Badge className="bg-green-100 text-green-800">{org.partner_status}</Badge>}
          </div>
        </div>
        {org.website && (
          <a href={org.website.startsWith("http") ? org.website : `https://${org.website}`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm"><ExternalLink className="h-4 w-4 mr-1" /> Website</Button>
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><span className="text-xs text-gray-500">Address</span><p>{org.address || "—"}</p></div>
            <div><span className="text-xs text-gray-500">Store Status</span><p>{org.store_status || "—"}</p></div>
            <div><span className="text-xs text-gray-500">Store Provider</span><p>{org.store_provider || "—"}</p></div>
            {org.merch_link && (
              <div>
                <span className="text-xs text-gray-500">Merch Link</span>
                <a href={org.merch_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline block text-sm">{org.merch_link}</a>
              </div>
            )}
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
            <CardHeader><CardTitle className="text-base">Linked Contacts</CardTitle></CardHeader>
            <CardContent>
              {linkedContacts.length === 0 ? (
                <p className="text-sm text-gray-400">No linked contacts</p>
              ) : (
                <div className="space-y-2">
                  {linkedContacts.map((lc) => (
                    <div key={lc.contact_id} className="flex items-center justify-between py-1">
                      <Link href={`/contacts/${lc.contacts.id}`} className="text-sm text-blue-600 hover:underline">{lc.contacts.name}</Link>
                      <span className="text-xs text-gray-400">{lc.contacts.email || ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Program Financials</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-xs text-gray-500">Players</span><p>{org.players ?? "---"}</p></div>
              <div><span className="text-xs text-gray-500">Travel Teams</span><p>{org.travel_teams ?? "---"}</p></div>
              <div><span className="text-xs text-gray-500">Dues / Season</span><p>{org.dues_per_season ? `$${Number(org.dues_per_season).toLocaleString()}` : "---"}</p></div>
              <div><span className="text-xs text-gray-500">Uniform Cost</span><p>{org.uniform_cost ? `$${Number(org.uniform_cost).toLocaleString()}` : "---"}</p></div>
              <div><span className="text-xs text-gray-500">Total Revenue</span><p>{org.total_revenue ? `$${Number(org.total_revenue).toLocaleString()}` : "---"}</p></div>
              <div><span className="text-xs text-gray-500">Dues Revenue</span><p>{org.dues_revenue ? `$${Number(org.dues_revenue).toLocaleString()}` : "---"}</p></div>
              <div><span className="text-xs text-gray-500">Total Costs</span><p>{org.total_costs ? `$${Number(org.total_costs).toLocaleString()}` : "---"}</p></div>
              <div><span className="text-xs text-gray-500">Yearly Cost / Player</span><p>{org.yearly_cost_player ? `$${Number(org.yearly_cost_player).toLocaleString()}` : "---"}</p></div>
            </div>
            {org.primary_contact && <div className="pt-2 border-t"><span className="text-xs text-gray-500">Primary Contact</span><p>{org.primary_contact}</p></div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Outreach Tracking</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div><span className="text-xs text-gray-500">Outreach Status</span><p>{org.outreach_status || "Not Contacted"}</p></div>
            <div><span className="text-xs text-gray-500">Last Outreach Date</span><p>{org.last_outreach_date || "---"}</p></div>
            {org.outreach_notes && <div><span className="text-xs text-gray-500">Outreach Notes</span><p className="whitespace-pre-wrap">{org.outreach_notes}</p></div>}
            {org.partner_status && (
              <div className="pt-2 border-t">
                <span className="text-xs text-gray-500">Partner Status</span>
                <p className="font-medium text-green-700">{org.partner_status}</p>
                {org.partner_since && <p className="text-xs text-gray-400 mt-0.5">Since {org.partner_since}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{org.notes || "No notes yet."}</p>
        </CardContent>
      </Card>

      <div className="mt-6">
        <CorrespondenceSection entityType="soccer_orgs" entityId={params.id as string} />
      </div>
    </div>
  );
}
