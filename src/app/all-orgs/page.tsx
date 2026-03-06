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
import { ORG_TYPE_OPTIONS } from "@/config/organization-constants";
import { Search, X, Plus, Trash2, CheckSquare, Square, ChevronUp, ChevronDown, Building } from "lucide-react";

const TABLE_COLS = [
  { key: "name", label: "Organization", width: 180 },
  { key: "org_type", label: "Type", width: 130 },
  { key: "partner_status", label: "Status", width: 100 },
  { key: "outreach_status", label: "Outreach", width: 100 },
  { key: "pipeline_status", label: "Pipeline", width: 100 },
  { key: "contacts_col", label: "Contacts", width: 130 },
  { key: "website", label: "Website", width: 80 },
];

interface Organization {
  id: string;
  name: string;
  org_type: string[];
  corporate_structure: string | null;
  address: string | null;
  website: string | null;
  avatar_url: string | null;
  players: number | null;
  outreach_status: string | null;
  partner_status: string | null;
  pipeline_status: string | null;
  primary_contact: string | null;
  updated_at: string | null;
}

type SortField = "name" | "updated_at";
type SortDir = "asc" | "desc";

const ORG_TYPES = [...ORG_TYPE_OPTIONS];
const OUTREACH_OPTIONS = ["Not Contacted", "Contacted", "In Discussion", "Signed", "Declined"];
const PIPELINE_OPTIONS = ["Lead", "Contacted", "Meeting", "Due Diligence", "Term Sheet", "Engaged", "Closed"];

export default function AllOrgsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
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
    // Load ALL organizations — no type filter
    const { data } = await supabase
      .from("organizations")
      .select("*")
      .order("name");
    if (data) setOrgs(data);

    // Load contacts mapped to each org
    const { data: orgLinks } = await supabase
      .from("organization_contacts")
      .select("organization_id, contacts(name)");
    if (orgLinks) {
      const map = new Map<string, string[]>();
      for (const link of orgLinks) {
        const id = link.organization_id;
        const name = (link.contacts as unknown as { name: string })?.name;
        if (name) {
          if (!map.has(id)) map.set(id, []);
          map.get(id)!.push(name);
        }
      }
      setOrgContactsMap(map);
    }

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateCell = async (id: string, field: string, value: string) => {
    const dbValue = field === "org_type"
      ? (value ? value.split(",").map((v) => v.trim()).filter(Boolean) : [])
      : (value || null);
    const { error } = await supabase.from("organizations").update({ [field]: dbValue }).eq("id", id);
    if (!error) setOrgs((prev) => prev.map((o) => (o.id === id ? { ...o, [field]: dbValue, updated_at: new Date().toISOString() } : o)));
  };

  const createOrg = async () => {
    if (!newName.trim()) return;
    const { data, error } = await supabase.from("organizations").insert({
      name: newName, org_type: newType ? [newType] : [],
      website: newWebsite || null,
    }).select().single();
    if (!error && data) { setOrgs((prev) => [...prev, data]); setNewName(""); setNewType(""); setNewWebsite(""); setShowNew(false); }
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    const { error } = await supabase.from("organizations").delete().in("id", Array.from(selected));
    if (!error) { setOrgs((prev) => prev.filter((o) => !selected.has(o.id))); setSelected(new Set()); }
  };

  const bulkUpdate = async () => {
    if (!bulkField || selected.size === 0) return;
    const ids = Array.from(selected);
    const dbValue = bulkField === "org_type"
      ? (bulkValue ? bulkValue.split(",").map((v) => v.trim()).filter(Boolean) : [])
      : (bulkValue || null);
    const { error } = await supabase.from("organizations").update({ [bulkField]: dbValue }).in("id", ids);
    if (!error) { setOrgs((prev) => prev.map((o) => selected.has(o.id) ? { ...o, [bulkField]: dbValue } : o)); setSelected(new Set()); setShowBulk(false); }
  };

  const toggleSelect = (id: string) => { setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const toggleSelectAll = () => { if (selected.size === filtered.length) setSelected(new Set()); else setSelected(new Set(filtered.map((o) => o.id))); };

  const types = [...new Set(orgs.flatMap((o) => Array.isArray(o.org_type) ? o.org_type : (o.org_type ? [o.org_type] : [])))] as string[];

  const filtered = orgs.filter((o) => {
    if (search && !o.name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType && !(Array.isArray(o.org_type) ? o.org_type.includes(filterType) : o.org_type === filterType)) return false;
    return true;
  }).sort((a, b) => {
    const aVal = (a[sortField] || "").toLowerCase();
    const bVal = (b[sortField] || "").toLowerCase();
    return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
  });

  // Type counts for badges
  const typeCounts = new Map<string, number>();
  for (const o of orgs) {
    const t = Array.isArray(o.org_type) ? o.org_type : [];
    for (const type of t) {
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    }
  }

  // Orgs with no type set
  const noTypeCount = orgs.filter((o) => !o.org_type || (Array.isArray(o.org_type) && o.org_type.length === 0)).length;

  // Navigate to the right detail page based on org type
  const getDetailHref = (o: Organization) => {
    const types = Array.isArray(o.org_type) ? o.org_type : [];
    if (types.includes("Investor")) return `/investors/${o.id}`;
    return `/soccer-orgs/${o.id}`;
  };

  if (loading) return <div><div className="animate-pulse h-64 bg-gray-200 rounded" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building className="h-6 w-6 text-gray-600" />
            All Organizations
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {filtered.length} of {orgs.length} organizations
          </p>
        </div>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add Organization</Button></DialogTrigger>
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

      {/* Type summary badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setFilterType("")}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            filterType === "" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
          }`}
        >
          All ({orgs.length})
        </button>
        {ORG_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(filterType === type ? "" : type)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filterType === type ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
            }`}
          >
            {type} ({typeCounts.get(type) || 0})
          </button>
        ))}
        {noTypeCount > 0 && (
          <span className="text-xs px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            No type set: {noTypeCount}
          </span>
        )}
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <span className="text-sm font-medium text-blue-700">{selected.size} selected</span>
          <Dialog open={showBulk} onOpenChange={setShowBulk}>
            <DialogTrigger asChild><Button size="sm" variant="outline">Bulk Update</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Bulk Update {selected.size} Organizations</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500">Field</label>
                  <select className="w-full border rounded-md px-2 py-1.5 text-sm" value={bulkField} onChange={(e) => { setBulkField(e.target.value); setBulkValue(""); }}>
                    <option value="">Select...</option>
                    <option value="org_type">Type</option>
                    <option value="outreach_status">Outreach Status</option>
                    <option value="partner_status">Partner Status</option>
                    <option value="pipeline_status">Pipeline Status</option>
                  </select>
                </div>
                {bulkField === "org_type" && <div><label className="text-xs text-gray-500">Value</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}><option value="">—</option>{ORG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>}
                {bulkField === "outreach_status" && <div><label className="text-xs text-gray-500">Value</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}><option value="">—</option>{OUTREACH_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>}
                {bulkField === "partner_status" && <div><label className="text-xs text-gray-500">Value</label><Input value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} placeholder="e.g. Active, Prospect" /></div>}
                {bulkField === "pipeline_status" && <div><label className="text-xs text-gray-500">Value</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}><option value="">—</option>{PIPELINE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>}
                <Button onClick={bulkUpdate} className="w-full" disabled={!bulkField}>Update {selected.size} Records</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button size="sm" variant="destructive" onClick={deleteSelected}><Trash2 className="h-3 w-3 mr-1" /> Delete</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="Search all organizations..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
      </div>

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
                  <td className="px-3 py-2 overflow-hidden"><div className="flex items-center gap-1.5 min-w-0"><Link href={getDetailHref(o)} className="text-blue-600 hover:underline shrink-0 text-xs">↗</Link><div className="min-w-0 flex-1"><EditableCell value={o.name} onSave={(v) => updateCell(o.id, "name", v)} /></div></div></td>
                  <td className="px-3 py-2 overflow-hidden"><EditableCell value={Array.isArray(o.org_type) ? o.org_type.join(", ") : (o.org_type ?? null)} onSave={(v) => updateCell(o.id, "org_type", v)} type="multi-select" options={ORG_TYPES} /></td>
                  <td className="px-3 py-2 overflow-hidden">{o.partner_status ? <Badge className="text-[10px] bg-green-100 text-green-800">{o.partner_status}</Badge> : <span className="text-xs text-gray-300">—</span>}</td>
                  <td className="px-3 py-2 overflow-hidden">{o.outreach_status && o.outreach_status !== "Not Contacted" ? <Badge variant="secondary" className="text-[10px]">{o.outreach_status}</Badge> : <span className="text-xs text-gray-300">—</span>}</td>
                  <td className="px-3 py-2 overflow-hidden">{o.pipeline_status ? <Badge variant="outline" className="text-[10px]">{o.pipeline_status}</Badge> : <span className="text-xs text-gray-300">—</span>}</td>
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
