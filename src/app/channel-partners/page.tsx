"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EditableCell } from "@/components/EditableCell";
import { ORG_TYPE_OPTIONS } from "@/config/organization-constants";
import Link from "next/link";
import { labels } from "@/config/labels";
import { Search, CheckSquare, Square, ChevronUp, ChevronDown, ArrowRight } from "lucide-react";

const ORG_TYPES = [...ORG_TYPE_OPTIONS];

const OUTREACH_STATUSES = ["Not Contacted", "Contacted", "Meeting Scheduled", "Active Partner", "Not Interested"];

interface PartnerOrg {
  id: string;
  name: string;
  org_type: string[];
  website: string | null;
  players: number | null;
  outreach_status: string | null;
  partner_status: string | null;
  leagues: string[];
  updated_at: string | null;
}

type SortField = "name";
type SortDir = "asc" | "desc";

export default function PartnerOrgsPage() {
  const [orgs, setOrgs] = useState<PartnerOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  const load = useCallback(async () => {
    // 1. Get Partner org IDs
    const { data: typeRows } = await supabase
      .schema('core').from("org_types").select("org_id").eq("type", "Partner");
    const partnerIds = (typeRows || []).map((r) => r.org_id);
    if (partnerIds.length === 0) { setOrgs([]); setLoading(false); return; }

    // 2. Parallel load
    const [orgResult, allTypeResult, memberResult, leagueResult, financialResult, outreachResult, partnerResult] = await Promise.all([
      supabase.schema('core').from("organizations").select("id, name, website, updated_at").in("id", partnerIds).order("name"),
      supabase.schema('core').from("org_types").select("org_id, type").in("org_id", partnerIds),
      supabase.schema('platform').from("memberships").select("org_id, league_id").in("org_id", partnerIds),
      supabase.from("leagues").select("id, name"),
      supabase.schema('intel').from("org_financials").select("org_id, players").in("org_id", partnerIds),
      supabase.schema('crm').from("outreach").select("org_id, status").in("org_id", partnerIds),
      supabase.schema('intel').from("partner_profile").select("org_id, partner_status").in("org_id", partnerIds),
    ]);

    // Build maps
    const leagueMap = new Map<string, string>();
    for (const l of leagueResult.data || []) leagueMap.set(l.id, l.name);

    const typeMap = new Map<string, string[]>();
    for (const t of allTypeResult.data || []) {
      if (!typeMap.has(t.org_id)) typeMap.set(t.org_id, []);
      typeMap.get(t.org_id)!.push(t.type);
    }

    const membershipMap = new Map<string, string[]>();
    for (const m of memberResult.data || []) {
      const lName = leagueMap.get(m.league_id);
      if (lName) {
        if (!membershipMap.has(m.org_id)) membershipMap.set(m.org_id, []);
        membershipMap.get(m.org_id)!.push(lName);
      }
    }

    const financialMap = new Map<string, number | null>();
    for (const f of financialResult.data || []) financialMap.set(f.org_id, f.players);

    const outreachMap = new Map<string, string>();
    for (const o of outreachResult.data || []) if (o.status) outreachMap.set(o.org_id, o.status);

    const partnerMap = new Map<string, string>();
    for (const p of partnerResult.data || []) if (p.partner_status) partnerMap.set(p.org_id, p.partner_status);

    // Assemble
    const assembled: PartnerOrg[] = (orgResult.data || []).map((o) => ({
      id: o.id,
      name: o.name,
      website: o.website,
      updated_at: o.updated_at,
      org_type: typeMap.get(o.id) || [],
      leagues: membershipMap.get(o.id) || [],
      players: financialMap.get(o.id) ?? null,
      outreach_status: outreachMap.get(o.id) || null,
      partner_status: partnerMap.get(o.id) || null,
    }));

    setOrgs(assembled);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateCell = async (id: string, field: string, value: string) => {
    if (field === "org_type") {
      const types = value ? value.split(",").map((v) => v.trim()).filter(Boolean) : [];
      await supabase.schema('core').from("org_types").delete().eq("org_id", id);
      if (types.length > 0) {
        await supabase.schema('core').from("org_types").insert(types.map((t) => ({ org_id: id, type: t })));
      }
      setOrgs((prev) => prev.map((o) => (o.id === id ? { ...o, org_type: types } : o)));
    } else if (field === "outreach_status") {
      await supabase.schema('crm').from("outreach").delete().eq("org_id", id);
      if (value) {
        await supabase.schema('crm').from("outreach").insert({ org_id: id, status: value });
      }
      setOrgs((prev) => prev.map((o) => (o.id === id ? { ...o, outreach_status: value || null } : o)));
    } else {
      const { error } = await supabase.schema('core').from("organizations").update({ [field]: value || null }).eq("id", id);
      if (!error) setOrgs((prev) => prev.map((o) => (o.id === id ? { ...o, [field]: value || null, updated_at: new Date().toISOString() } : o)));
    }
  };

  const toggleSelect = (id: string) => { setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const toggleSelectAll = () => { if (selected.size === filtered.length) setSelected(new Set()); else setSelected(new Set(filtered.map((o) => o.id))); };

  const inPipeline = orgs.filter((o) => o.partner_status);

  const filtered = orgs.filter((o) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return o.name?.toLowerCase().includes(s) || o.org_type?.some((t) => t.toLowerCase().includes(s));
  }).sort((a, b) => {
    const aVal = (a[sortField] || "").toLowerCase();
    const bVal = (b[sortField] || "").toLowerCase();
    return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
  });

  if (loading) return <div><div className="animate-pulse h-64 bg-gray-200 rounded" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{labels.channelPartnersPageTitle}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {filtered.length} of {orgs.length} partner organizations · {inPipeline.length} in pipeline
          </p>
        </div>
        <Link href="/partnerships/pipeline">
          <Button variant="outline" size="sm"><ArrowRight className="h-4 w-4 mr-1" /> Partnership Pipeline</Button>
        </Link>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search partner organizations..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="w-10 px-3 py-3">
                  <button onClick={toggleSelectAll}>{selected.size === filtered.length && filtered.length > 0 ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-gray-300" />}</button>
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide cursor-pointer" onClick={() => toggleSort("name")}>
                  <span className="flex items-center gap-1">Organization <SortIcon field="name" /></span>
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Types</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Leagues</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Players</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Outreach</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Pipeline Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Website</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className={`border-b hover:bg-gray-50 ${selected.has(o.id) ? "bg-blue-50" : ""}`}>
                  <td className="px-3 py-2">
                    <button onClick={() => toggleSelect(o.id)}>{selected.has(o.id) ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-gray-300" />}</button>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Link href={`/soccer-orgs/${o.id}`} className="text-blue-600 hover:underline shrink-0 text-xs">↗</Link>
                      <EditableCell value={o.name} onSave={(v) => updateCell(o.id, "name", v)} />
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <EditableCell
                      value={o.org_type.join(", ") || null}
                      onSave={(v) => updateCell(o.id, "org_type", v)}
                      type="multi-select"
                      options={ORG_TYPES}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-0.5">
                      {o.leagues.length > 0 ? o.leagues.map((l) => (
                        <Badge key={l} variant="outline" className="text-[10px] px-1 py-0">{l}</Badge>
                      )) : <span className="text-xs text-gray-300">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-600 text-xs">{o.players ?? "—"}</td>
                  <td className="px-4 py-2">
                    <EditableCell value={o.outreach_status} onSave={(v) => updateCell(o.id, "outreach_status", v)} type="select" options={OUTREACH_STATUSES} />
                  </td>
                  <td className="px-4 py-2">
                    {o.partner_status ? (
                      <Badge className="text-[10px] bg-green-100 text-green-800">{o.partner_status}</Badge>
                    ) : (
                      <span className="text-xs text-gray-300">Not in pipeline</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {o.website ? (
                      <a href={o.website.startsWith("http") ? o.website : `https://${o.website}`} target="_blank" rel="noopener noreferrer">
                        <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-blue-50">Link ↗</Badge>
                      </a>
                    ) : <span className="text-xs text-gray-300">—</span>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No organizations with &quot;Partner&quot; type found. Assign the Partner type to organizations in All Communities.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
