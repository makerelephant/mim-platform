"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EditableCell } from "@/components/EditableCell";
import { Avatar } from "@/components/Avatar";
import { useResizableColumns } from "@/hooks/useResizableColumns";
import Link from "next/link";
import { labels } from "@/config/labels";
import { ORG_TYPE_OPTIONS } from "@/config/organization-constants";
import { Search, X, Plus, Trash2, CheckSquare, Square, ChevronUp, ChevronDown } from "lucide-react";

const TABLE_COLS = [
  { key: "name", label: "Organization", width: 170 },
  { key: "org_type", label: "Type", width: 110 },
  { key: "leagues", label: "Leagues", width: 150 },
  { key: "players", label: "Players", width: 65 },
  { key: "outreach_status", label: "Outreach", width: 100 },
  { key: "partner_status", label: "Activity", width: 100 },
  { key: "contacts_col", label: "Contacts", width: 130 },
  { key: "website", label: "Website", width: 80 },
];

interface SoccerOrg {
  id: string;
  name: string;
  org_type: string[];
  website: string | null;
  avatar_url: string | null;
  players: number | null;
  outreach_status: string | null;
  partner_status: string | null;
  leagues: string[];
  updated_at: string | null;
}

type SortField = "name";
type SortDir = "asc" | "desc";

interface LeagueRow { id: string; name: string }

const ORG_TYPES = [...ORG_TYPE_OPTIONS];

export default function SoccerOrgsPage() {
  const [orgs, setOrgs] = useState<SoccerOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStructure, setFilterStructure] = useState("");
  const [filterLeague, setFilterLeague] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("");
  const [newWebsite, setNewWebsite] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [bulkField, setBulkField] = useState("");
  const [bulkValue, setBulkValue] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [orgContactsMap, setOrgContactsMap] = useState<Map<string, string[]>>(new Map());
  const [leagueNames, setLeagueNames] = useState<LeagueRow[]>([]);

  const { colWidths, startResize, totalWidth } = useResizableColumns(TABLE_COLS);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  const load = useCallback(async () => {
    // 1. Get Customer org IDs
    const { data: typeRows } = await supabase
      .schema('core').from("org_types").select("org_id").ilike("type", "Customer");
    const customerIds = (typeRows || []).map((r) => r.org_id);
    if (customerIds.length === 0) { setOrgs([]); setLoading(false); return; }

    // 2. Parallel load from multiple schema tables
    const [orgResult, allTypeResult, memberResult, leagueResult, financialResult, outreachResult, partnerResult, relResult] = await Promise.all([
      supabase.schema('core').from("organizations").select("id, name, website, avatar_url, updated_at").in("id", customerIds).order("name"),
      supabase.schema('core').from("org_types").select("org_id, type").in("org_id", customerIds),
      supabase.schema('platform').from("memberships").select("org_id, league_id").in("org_id", customerIds),
      supabase.from("leagues").select("id, name"),
      supabase.schema('intel').from("org_financials").select("org_id, players").in("org_id", customerIds),
      supabase.schema('crm').from("outreach").select("org_id, status").in("org_id", customerIds),
      supabase.schema('intel').from("partner_profile").select("org_id, partner_status").in("org_id", customerIds),
      supabase.schema('core').from("relationships").select("org_id, contacts(first_name, last_name)").in("org_id", customerIds),
    ]);

    // Store league names for filters
    const leagueList = (leagueResult.data || []) as LeagueRow[];
    setLeagueNames(leagueList);
    const leagueMap = new Map<string, string>();
    for (const l of leagueList) leagueMap.set(l.id, l.name);

    // Build maps
    const typeMap = new Map<string, string[]>();
    for (const t of allTypeResult.data || []) {
      if (!typeMap.has(t.org_id)) typeMap.set(t.org_id, []);
      typeMap.get(t.org_id)!.push(t.type);
    }

    const membershipMap = new Map<string, string[]>();
    for (const m of memberResult.data || []) {
      const leagueName = leagueMap.get(m.league_id);
      if (leagueName) {
        if (!membershipMap.has(m.org_id)) membershipMap.set(m.org_id, []);
        membershipMap.get(m.org_id)!.push(leagueName);
      }
    }

    const financialMap = new Map<string, number | null>();
    for (const f of financialResult.data || []) financialMap.set(f.org_id, f.players);

    const outreachMap = new Map<string, string>();
    for (const o of outreachResult.data || []) if (o.status) outreachMap.set(o.org_id, o.status);

    const partnerMap = new Map<string, string>();
    for (const p of partnerResult.data || []) if (p.partner_status) partnerMap.set(p.org_id, p.partner_status);

    const contactMap = new Map<string, string[]>();
    for (const r of relResult.data || []) {
      const c = r.contacts as unknown as { first_name: string | null; last_name: string | null };
      const name = [c?.first_name, c?.last_name].filter(Boolean).join(" ");
      if (name) {
        if (!contactMap.has(r.org_id)) contactMap.set(r.org_id, []);
        contactMap.get(r.org_id)!.push(name);
      }
    }

    // Assemble
    const assembled: SoccerOrg[] = (orgResult.data || []).map((o) => ({
      id: o.id,
      name: o.name,
      website: o.website,
      avatar_url: o.avatar_url,
      updated_at: o.updated_at,
      org_type: typeMap.get(o.id) || [],
      leagues: membershipMap.get(o.id) || [],
      players: financialMap.get(o.id) ?? null,
      outreach_status: outreachMap.get(o.id) || null,
      partner_status: partnerMap.get(o.id) || null,
    }));

    setOrgs(assembled);
    setOrgContactsMap(contactMap);
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

  const createOrg = async () => {
    if (!newName.trim()) return;
    const { data, error } = await supabase.schema('core').from("organizations").insert({
      name: newName, website: newWebsite || null,
    }).select().single();
    if (!error && data) {
      // Add Customer type (and optional extra type)
      const types = newType ? ["Customer", newType] : ["Customer"];
      const uniqueTypes = [...new Set(types)];
      await supabase.schema('core').from("org_types").insert(uniqueTypes.map((t) => ({ org_id: data.id, type: t })));
      setOrgs((prev) => [...prev, {
        id: data.id, name: data.name, website: data.website, avatar_url: data.avatar_url,
        updated_at: data.updated_at, org_type: uniqueTypes,
        leagues: [], players: null, outreach_status: null, partner_status: null,
      }]);
      setNewName(""); setNewType(""); setNewWebsite(""); setShowNew(false);
    }
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    await Promise.all([
      supabase.schema('core').from("org_types").delete().in("org_id", ids),
      supabase.schema('crm').from("outreach").delete().in("org_id", ids),
      supabase.schema('intel').from("partner_profile").delete().in("org_id", ids),
      supabase.schema('intel').from("org_financials").delete().in("org_id", ids),
      supabase.schema('platform').from("memberships").delete().in("org_id", ids),
      supabase.schema('platform').from("store").delete().in("org_id", ids),
      supabase.schema('core').from("relationships").delete().in("org_id", ids),
    ]);
    const { error } = await supabase.schema('core').from("organizations").delete().in("id", ids);
    if (!error) { setOrgs((prev) => prev.filter((o) => !selected.has(o.id))); setSelected(new Set()); }
  };

  const bulkUpdate = async () => {
    if (!bulkField || selected.size === 0) return;
    const ids = Array.from(selected);
    if (bulkField === "org_type") {
      const types = bulkValue ? bulkValue.split(",").map((v) => v.trim()).filter(Boolean) : [];
      await supabase.schema('core').from("org_types").delete().in("org_id", ids);
      if (types.length > 0) {
        const rows = ids.flatMap((id) => types.map((t) => ({ org_id: id, type: t })));
        await supabase.schema('core').from("org_types").insert(rows);
      }
      setOrgs((prev) => prev.map((o) => selected.has(o.id) ? { ...o, org_type: types } : o));
    } else {
      // Direct org fields (name, website, etc.)
      const { error } = await supabase.schema('core').from("organizations").update({ [bulkField]: bulkValue || null }).in("id", ids);
      if (!error) setOrgs((prev) => prev.map((o) => selected.has(o.id) ? { ...o, [bulkField]: bulkValue || null } : o));
    }
    setSelected(new Set()); setShowBulk(false);
  };

  const toggleSelect = (id: string) => { setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const toggleSelectAll = () => { if (selected.size === filtered.length) setSelected(new Set()); else setSelected(new Set(filtered.map((o) => o.id))); };

  const filtered = orgs.filter((o) => {
    if (search && !o.name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType && !o.org_type.includes(filterType)) return false;
    if (filterLeague && !o.leagues.includes(filterLeague)) return false;
    return true;
  }).sort((a, b) => {
    const aVal = (a[sortField] || "").toLowerCase();
    const bVal = (b[sortField] || "").toLowerCase();
    return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
  });

  if (loading) return <div><div className="animate-pulse h-64 bg-gray-200 rounded" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">{labels.soccerOrgsPageTitle}</h1><p className="text-gray-500 text-sm mt-1">{filtered.length} of {orgs.length} communities</p></div>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add Community</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Organization</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><label className="text-xs text-gray-500">Name *</label><Input value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500">Type</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={newType} onChange={(e) => setNewType(e.target.value)}><option value="">—</option>{ORG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
                <div><label className="text-xs text-gray-500">Website</label><Input value={newWebsite} onChange={(e) => setNewWebsite(e.target.value)} /></div>
              </div>
              <Button onClick={createOrg} className="w-full" disabled={!newName.trim()}>Create Organization</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <span className="text-sm font-medium text-blue-700">{selected.size} selected</span>
          <Dialog open={showBulk} onOpenChange={setShowBulk}>
            <DialogTrigger asChild><Button size="sm" variant="outline">Bulk Update</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Bulk Update {selected.size} Orgs</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><label className="text-xs text-gray-500">Field</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={bulkField} onChange={(e) => { setBulkField(e.target.value); setBulkValue(""); }}><option value="">Select...</option><option value="org_type">Type</option></select></div>
                {bulkField === "org_type" && <div><label className="text-xs text-gray-500">Value</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}><option value="">—</option>{ORG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>}
                <Button onClick={bulkUpdate} className="w-full" disabled={!bulkField}>Update {selected.size} Records</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button size="sm" variant="destructive" onClick={deleteSelected}><Trash2 className="h-3 w-3 mr-1" /> Delete</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="Search organizations..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
        <Button variant={showFilters ? "default" : "outline"} onClick={() => setShowFilters(!showFilters)}>Filters</Button>
      </div>

      {showFilters && (
        <Card className="mb-4"><CardContent className="pt-4 pb-4"><div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="text-xs font-medium text-gray-500 mb-1 block">Type</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={filterType} onChange={(e) => setFilterType(e.target.value)}><option value="">All</option>{ORG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label className="text-xs font-medium text-gray-500 mb-1 block">League</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={filterLeague} onChange={(e) => setFilterLeague(e.target.value)}><option value="">All</option>{leagueNames.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}</select></div>
          <div className="flex items-end"><Button variant="ghost" size="sm" onClick={() => { setFilterType(""); setFilterStructure(""); setFilterLeague(""); }}><X className="h-3 w-3 mr-1" /> Clear</Button></div>
        </div></CardContent></Card>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="text-sm w-full" style={{ tableLayout: "fixed" }}>
            {(() => { const fw = 76 + totalWidth; const p = (w: number) => `${((w / fw) * 100).toFixed(1)}%`; return (
            <colgroup>
              <col style={{ width: p(40) }} />
              <col style={{ width: p(36) }} />
              {TABLE_COLS.map((c) => <col key={c.key} style={{ width: p(colWidths[c.key]) }} />)}
            </colgroup>
            ); })()}
            <thead><tr className="border-b bg-gray-50">
              <th className="px-3 py-3"><button onClick={toggleSelectAll}>{selected.size === filtered.length && filtered.length > 0 ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-gray-300" />}</button></th>
              <th className="px-2 py-3"></th>
              {TABLE_COLS.map((c) => {
                const sortable = c.key === "name";
                const sf = sortable ? (c.key as SortField) : null;
                return (
                  <th key={c.key} className={`text-left px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide relative whitespace-nowrap overflow-hidden ${sortable ? "cursor-pointer" : ""}`} onClick={sf ? () => toggleSort(sf) : undefined}>
                    <span className="flex items-center gap-1">{c.label} {sf && <SortIcon field={sf} />}</span>
                    <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-500" onMouseDown={(e) => startResize(c.key, e)} />
                  </th>
                );
              })}
            </tr></thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className={`border-b hover:bg-gray-50 ${selected.has(o.id) ? "bg-blue-50" : ""}`}>
                  <td className="px-3 py-2"><button onClick={() => toggleSelect(o.id)}>{selected.has(o.id) ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-gray-300" />}</button></td>
                  <td className="px-2 py-2"><Avatar src={o.avatar_url} name={o.name} size="sm" /></td>
                  <td className="px-3 py-2 overflow-hidden"><div className="flex items-center gap-1.5 min-w-0"><Link href={`/soccer-orgs/${o.id}`} className="text-blue-600 hover:underline shrink-0 text-xs">↗</Link><div className="min-w-0 flex-1"><EditableCell value={o.name} onSave={(v) => updateCell(o.id, "name", v)} /></div></div></td>
                  <td className="px-3 py-2 overflow-hidden"><EditableCell value={o.org_type.join(", ") || null} onSave={(v) => updateCell(o.id, "org_type", v)} type="multi-select" options={ORG_TYPES} /></td>
                  <td className="px-3 py-2 overflow-hidden"><div className="flex flex-wrap gap-0.5 overflow-hidden max-h-[2rem]">{o.leagues.map((l) => <Badge key={l} variant="outline" className="text-[10px] px-1 py-0">{l}</Badge>)}</div></td>
                  <td className="px-3 py-2 overflow-hidden text-gray-600 text-xs">{o.players ?? "—"}</td>
                  <td className="px-3 py-2 overflow-hidden">{o.outreach_status && o.outreach_status !== "Not Contacted" ? <Badge variant="secondary" className="text-[10px]">{o.outreach_status}</Badge> : <span className="text-xs text-gray-300">—</span>}</td>
                  <td className="px-3 py-2 overflow-hidden">{o.partner_status ? <Badge className="text-[10px] bg-green-100 text-green-800">{o.partner_status}</Badge> : <span className="text-xs text-gray-300">—</span>}</td>
                  <td className="px-3 py-2 overflow-hidden"><span className="text-xs text-gray-600 truncate block" title={orgContactsMap.get(o.id)?.join(", ")}>{orgContactsMap.get(o.id)?.join(", ") || <span className="text-gray-300">—</span>}</span></td>
                  <td className="px-3 py-2 overflow-hidden">{o.website ? <a href={o.website.startsWith("http") ? o.website : `https://${o.website}`} target="_blank" rel="noopener noreferrer"><Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-blue-50">Link ↗</Badge></a> : <span className="text-xs text-gray-300">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
