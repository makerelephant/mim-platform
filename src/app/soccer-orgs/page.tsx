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
import { timeAgo } from "@/lib/timeAgo";
import Link from "next/link";
import { labels } from "@/config/labels";
import { Search, X, Plus, Trash2, CheckSquare, Square, ChevronUp, ChevronDown } from "lucide-react";

const TABLE_COLS = [
  { key: "org_name", label: "Organization", width: 180 },
  { key: "org_type", label: "Type", width: 120 },
  { key: "leagues", label: "Leagues", width: 160 },
  { key: "players", label: "Players", width: 70 },
  { key: "outreach_status", label: "Outreach", width: 110 },
  { key: "partner_status", label: "Partner", width: 110 },
  { key: "website", label: "Website", width: 130 },
  { key: "updated_at", label: "Updated", width: 95 },
];

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
  avatar_url: string | null;
  players: number | null;
  outreach_status: string | null;
  partner_status: string | null;
  primary_contact: string | null;
  total_revenue: number | null;
  in_bays: boolean; in_cmysl: boolean; in_cysl: boolean; in_ecnl: boolean; in_ecysa: boolean;
  in_mysl: boolean; in_nashoba: boolean; in_necsl: boolean; in_roots: boolean; in_south_coast: boolean; in_south_shore: boolean;
  updated_at: string | null;
}

type SortField = "org_name" | "updated_at";
type SortDir = "asc" | "desc";

const LEAGUE_FIELDS = [
  { key: "in_cmysl", label: "CMYSL" }, { key: "in_cysl", label: "CYSL" }, { key: "in_ecnl", label: "ECNL" },
  { key: "in_ecysa", label: "ECYSA" }, { key: "in_mysl", label: "MYSL" }, { key: "in_nashoba", label: "Nashoba" },
  { key: "in_necsl", label: "NECSL" }, { key: "in_roots", label: "Roots" }, { key: "in_south_coast", label: "South Coast" }, { key: "in_south_shore", label: "South Shore" },
] as const;

const ORG_TYPES = ["Soccer Program Or Club", "Soccer League"];
const STRUCTURES = ["501c3", "LLC", "Corporation", "Partnership"];

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
  const [sortField, setSortField] = useState<SortField>("updated_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { colWidths, startResize, totalWidth } = useResizableColumns(TABLE_COLS);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir(field === "updated_at" ? "desc" : "asc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  const load = useCallback(async () => {
    const { data } = await supabase.from("soccer_orgs").select("*").order("org_name");
    if (data) setOrgs(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateCell = async (id: string, field: string, value: string) => {
    const { error } = await supabase.from("soccer_orgs").update({ [field]: value || null }).eq("id", id);
    if (!error) setOrgs((prev) => prev.map((o) => (o.id === id ? { ...o, [field]: value || null, updated_at: new Date().toISOString() } : o)));
  };

  const createOrg = async () => {
    if (!newName.trim()) return;
    const { data, error } = await supabase.from("soccer_orgs").insert({
      org_name: newName, org_type: newType || null, website: newWebsite || null,
    }).select().single();
    if (!error && data) { setOrgs((prev) => [...prev, data]); setNewName(""); setNewType(""); setNewWebsite(""); setShowNew(false); }
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    const { error } = await supabase.from("soccer_orgs").delete().in("id", Array.from(selected));
    if (!error) { setOrgs((prev) => prev.filter((o) => !selected.has(o.id))); setSelected(new Set()); }
  };

  const bulkUpdate = async () => {
    if (!bulkField || selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from("soccer_orgs").update({ [bulkField]: bulkValue || null }).in("id", ids);
    if (!error) { setOrgs((prev) => prev.map((o) => selected.has(o.id) ? { ...o, [bulkField]: bulkValue || null } : o)); setSelected(new Set()); setShowBulk(false); }
  };

  const toggleSelect = (id: string) => { setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const toggleSelectAll = () => { if (selected.size === filtered.length) setSelected(new Set()); else setSelected(new Set(filtered.map((o) => o.id))); };

  const types = [...new Set(orgs.map((o) => o.org_type).filter(Boolean))] as string[];
  const structures = [...new Set(orgs.map((o) => o.corporate_structure).filter(Boolean))] as string[];
  const getLeagues = (o: SoccerOrg) => LEAGUE_FIELDS.filter((lf) => o[lf.key]).map((lf) => lf.label);

  const filtered = orgs.filter((o) => {
    if (search && !o.org_name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType && o.org_type !== filterType) return false;
    if (filterStructure && o.corporate_structure !== filterStructure) return false;
    if (filterLeague) { const key = `in_${filterLeague.toLowerCase().replace(/ /g, "_")}` as keyof SoccerOrg; if (!o[key]) return false; }
    return true;
  }).sort((a, b) => {
    if (sortField === "updated_at") {
      const aT = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bT = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return sortDir === "asc" ? aT - bT : bT - aT;
    }
    const aVal = (a[sortField] || "").toLowerCase();
    const bVal = (b[sortField] || "").toLowerCase();
    return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
  });

  if (loading) return <div className="p-8"><div className="animate-pulse h-64 bg-gray-200 rounded" /></div>;

  return (
    <div className="p-8">
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
                <div><label className="text-xs text-gray-500">Field</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={bulkField} onChange={(e) => { setBulkField(e.target.value); setBulkValue(""); }}><option value="">Select...</option><option value="org_type">Type</option><option value="corporate_structure">Structure</option></select></div>
                {bulkField === "org_type" && <div><label className="text-xs text-gray-500">Value</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}><option value="">—</option>{ORG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>}
                {bulkField === "corporate_structure" && <div><label className="text-xs text-gray-500">Value</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}><option value="">—</option>{STRUCTURES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>}
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
          <div><label className="text-xs font-medium text-gray-500 mb-1 block">Type</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={filterType} onChange={(e) => setFilterType(e.target.value)}><option value="">All</option>{types.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label className="text-xs font-medium text-gray-500 mb-1 block">Structure</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={filterStructure} onChange={(e) => setFilterStructure(e.target.value)}><option value="">All</option>{structures.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
          <div><label className="text-xs font-medium text-gray-500 mb-1 block">League</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={filterLeague} onChange={(e) => setFilterLeague(e.target.value)}><option value="">All</option>{LEAGUE_FIELDS.map((lf) => <option key={lf.key} value={lf.key.replace("in_", "")}>{lf.label}</option>)}</select></div>
          <div className="flex items-end"><Button variant="ghost" size="sm" onClick={() => { setFilterType(""); setFilterStructure(""); setFilterLeague(""); }}><X className="h-3 w-3 mr-1" /> Clear</Button></div>
        </div></CardContent></Card>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="text-sm" style={{ tableLayout: "fixed", width: 40 + 40 + totalWidth }}>
            <colgroup>
              <col style={{ width: 40 }} />
              <col style={{ width: 40 }} />
              {TABLE_COLS.map((c) => <col key={c.key} style={{ width: colWidths[c.key] }} />)}
            </colgroup>
            <thead><tr className="border-b bg-gray-50">
              <th className="px-3 py-3"><button onClick={toggleSelectAll}>{selected.size === filtered.length && filtered.length > 0 ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-gray-300" />}</button></th>
              <th className="px-2 py-3"></th>
              {TABLE_COLS.map((c) => {
                const sortable = c.key === "org_name" || c.key === "updated_at";
                const sf = sortable ? (c.key as SortField) : null;
                return (
                  <th key={c.key} className={`text-left px-4 py-3 font-medium text-gray-500 relative ${sortable ? "cursor-pointer" : ""}`} onClick={sf ? () => toggleSort(sf) : undefined}>
                    <span className="flex items-center gap-1">{c.label} {sf && <SortIcon field={sf} />}</span>
                    <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-500" onMouseDown={(e) => startResize(c.key, e)} />
                  </th>
                );
              })}
            </tr></thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className={`border-b hover:bg-gray-50 ${selected.has(o.id) ? "bg-blue-50" : ""}`}>
                  <td className="px-3 py-3"><button onClick={() => toggleSelect(o.id)}>{selected.has(o.id) ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-gray-300" />}</button></td>
                  <td className="px-2 py-2"><Avatar src={o.avatar_url} name={o.org_name} size="sm" /></td>
                  <td className="px-4 py-2 overflow-hidden"><div className="flex items-center gap-2"><Link href={`/soccer-orgs/${o.id}`} className="text-blue-600 hover:underline shrink-0">&#8599;</Link><EditableCell value={o.org_name} onSave={(v) => updateCell(o.id, "org_name", v)} /></div></td>
                  <td className="px-4 py-2 overflow-hidden"><EditableCell value={o.org_type} onSave={(v) => updateCell(o.id, "org_type", v)} type="select" options={ORG_TYPES} /></td>
                  <td className="px-4 py-2 overflow-hidden"><div className="flex flex-wrap gap-1">{getLeagues(o).map((l) => <Badge key={l} variant="outline" className="text-xs">{l}</Badge>)}</div></td>
                  <td className="px-4 py-2 overflow-hidden text-gray-600 text-xs">{o.players ?? "---"}</td>
                  <td className="px-4 py-2 overflow-hidden">{o.outreach_status && o.outreach_status !== "Not Contacted" ? <Badge variant="secondary" className="text-xs">{o.outreach_status}</Badge> : <span className="text-xs text-gray-300">---</span>}</td>
                  <td className="px-4 py-2 overflow-hidden">{o.partner_status ? <Badge className="text-xs bg-green-100 text-green-800">{o.partner_status}</Badge> : <span className="text-xs text-gray-300">---</span>}</td>
                  <td className="px-4 py-2 overflow-hidden"><EditableCell value={o.website} onSave={(v) => updateCell(o.id, "website", v)} /></td>
                  <td className="px-4 py-2 overflow-hidden text-gray-400 text-xs whitespace-nowrap">{timeAgo(o.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
