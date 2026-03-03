"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EditableCell } from "@/components/EditableCell";
import { Avatar } from "@/components/Avatar";
import { useResizableColumns } from "@/hooks/useResizableColumns";
import { labels } from "@/config/labels";
import { timeAgo } from "@/lib/timeAgo";
import Link from "next/link";
import { Search, Plus, Trash2, CheckSquare, Square, ArrowRight, X, ChevronUp, ChevronDown, FileDown } from "lucide-react";

const TABLE_COLS = [
  { key: "firm", label: "Firm", width: 180 },
  { key: "type", label: "Type", width: 100 },
  { key: "connection", label: "Connection Status", width: 125 },
  { key: "pipeline", label: "Status", width: 110 },
  { key: "activity", label: "Recent Activity", width: 200 },
  { key: "score", label: "Score", width: 60 },
  { key: "website", label: "Website", width: 120 },
  { key: "updated_at", label: "Updated", width: 80 },
];

interface Investor {
  id: string;
  name: string;
  description: string | null;
  investor_type: string | null;
  geography: string | null;
  location: string | null;
  sector_focus: string | null;
  check_size: string | null;
  connection_status: string | null;
  pipeline_status: string | null;
  likelihood_score: number | null;
  last_contact_date: string | null;
  next_action: string | null;
  website: string | null;
  avatar_url: string | null;
  updated_at: string | null;
}

interface RecentActivity {
  text: string;
  date: string;
  type: "email" | "task";
}

type SortField = "name" | "updated_at";
type SortDir = "asc" | "desc";

const CONNECTION_STATUSES = ["Active", "Stale", "Need Introduction", "Warm Intro", "Cold"];
const PIPELINE_STATUSES = ["Prospect", "Qualified", "Engaged", "First Meeting", "In Closing", "Closed", "Passed", "Not a Fit"];

export default function InvestorsPage() {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterConnection, setFilterConnection] = useState("");
  const [filterPipeline, setFilterPipeline] = useState<"all" | "in" | "not">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showNew, setShowNew] = useState(false);
  const [newFirm, setNewFirm] = useState("");
  const [newType, setNewType] = useState("");
  const [newGeo, setNewGeo] = useState("");
  const [newSector, setNewSector] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [bulkField, setBulkField] = useState("");
  const [bulkValue, setBulkValue] = useState("");
  const [sortField, setSortField] = useState<SortField>("updated_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [activityMap, setActivityMap] = useState<Map<string, RecentActivity>>(new Map());

  const { colWidths, startResize, totalWidth } = useResizableColumns(TABLE_COLS);

  // Percentage-based column widths for responsive layout
  const FIXED_COL_PX = 76; // checkbox(40) + avatar(36)
  const fullWidth = FIXED_COL_PX + totalWidth;
  const pct = (w: number) => `${((w / fullWidth) * 100).toFixed(1)}%`;

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir(field === "updated_at" ? "desc" : "asc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  const loadRecentActivity = useCallback(async (investorIds: string[]) => {
    if (investorIds.length === 0) return;

    const map = new Map<string, RecentActivity>();

    // Load latest correspondence per investor
    const { data: corr } = await supabase
      .from("correspondence")
      .select("entity_id, subject, email_date")
      .eq("entity_type", "organizations")
      .in("entity_id", investorIds)
      .order("email_date", { ascending: false });

    if (corr) {
      for (const row of corr) {
        if (row.entity_id && row.subject && !map.has(row.entity_id)) {
          map.set(row.entity_id, { text: row.subject, date: row.email_date || "", type: "email" });
        }
      }
    }

    // Load latest tasks per investor — if more recent, override
    const { data: tasks } = await supabase
      .from("tasks")
      .select("entity_id, title, summary, created_at")
      .eq("entity_type", "organizations")
      .in("entity_id", investorIds)
      .order("created_at", { ascending: false });

    if (tasks) {
      for (const row of tasks) {
        if (row.entity_id && row.title) {
          const existing = map.get(row.entity_id);
          const taskDate = row.created_at;
          if (!existing || (taskDate && existing.date && new Date(taskDate) > new Date(existing.date))) {
            map.set(row.entity_id, { text: row.summary || row.title, date: taskDate, type: "task" });
          }
        }
      }
    }

    setActivityMap(map);
  }, []);

  const load = useCallback(async () => {
    const { data } = await supabase.from("organizations").select("*").contains("org_type", ["Investor"]).order("name");
    if (data) {
      setInvestors(data);
      loadRecentActivity(data.map((inv: Investor) => inv.id));
    }
    setLoading(false);
  }, [loadRecentActivity]);

  useEffect(() => { load(); }, [load]);

  const updateCell = async (id: string, field: string, value: string) => {
    const { error } = await supabase.from("organizations").update({ [field]: value || null }).eq("id", id);
    if (!error) setInvestors((prev) => prev.map((inv) => (inv.id === id ? { ...inv, [field]: value || null, updated_at: new Date().toISOString() } : inv)));
  };

  const createInvestor = async () => {
    if (!newFirm.trim()) return;
    const { data, error } = await supabase.from("organizations").insert({
      name: newFirm, org_category: "Investment Firm", org_type: ["Investor"],
      investor_type: newType || null, geography: newGeo || null,
      sector_focus: newSector || null, source: "manual",
    }).select().single();
    if (!error && data) {
      setInvestors((prev) => [...prev, data]);
      setNewFirm(""); setNewType(""); setNewGeo(""); setNewSector("");
      setShowNew(false);
    }
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    const { error } = await supabase.from("organizations").delete().in("id", Array.from(selected));
    if (!error) { setInvestors((prev) => prev.filter((inv) => !selected.has(inv.id))); setSelected(new Set()); }
  };

  const addToPipeline = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from("organizations").update({ pipeline_status: "Prospect" }).in("id", ids);
    if (!error) {
      setInvestors((prev) => prev.map((inv) => selected.has(inv.id) && !inv.pipeline_status ? { ...inv, pipeline_status: "Prospect" } : inv));
      setSelected(new Set());
    }
  };

  const removeFromPipeline = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from("organizations").update({ pipeline_status: null }).in("id", ids);
    if (!error) {
      setInvestors((prev) => prev.map((inv) => selected.has(inv.id) ? { ...inv, pipeline_status: null } : inv));
      setSelected(new Set());
    }
  };

  const bulkUpdate = async () => {
    if (!bulkField || selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from("organizations").update({ [bulkField]: bulkValue || null }).in("id", ids);
    if (!error) {
      setInvestors((prev) => prev.map((inv) => selected.has(inv.id) ? { ...inv, [bulkField]: bulkValue || null } : inv));
      setSelected(new Set()); setShowBulk(false); setBulkField(""); setBulkValue("");
    }
  };

  const toggleSelect = (id: string) => { setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const toggleSelectAll = () => { if (selected.size === filtered.length) setSelected(new Set()); else setSelected(new Set(filtered.map((inv) => inv.id))); };

  // ── PDF Export ──
  const exportPDF = () => {
    const sorted = [...filtered].sort((a, b) => {
      const aT = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bT = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return bT - aT;
    });

    const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const rows = sorted.map((inv) => {
      const act = activityMap.get(inv.id);
      return `<tr>
        <td>${escHtml(inv.name)}</td>
        <td>${escHtml(inv.investor_type || "—")}</td>
        <td>${escHtml(inv.connection_status || "—")}</td>
        <td>${escHtml(inv.pipeline_status || "—")}</td>
        <td class="activity">${act ? escHtml(act.text) : "—"}</td>
        <td class="center">${inv.likelihood_score ?? "—"}</td>
        <td class="muted">${inv.updated_at ? timeAgo(inv.updated_at) : "—"}</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Investor Pipeline Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 40px; color: #1a1a1a; }
  .header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; border-bottom: 2px solid #e5e7eb; padding-bottom: 16px; }
  .header img { height: 60px; width: 60px; border-radius: 12px; }
  .header h1 { font-size: 18px; font-weight: 700; }
  .header .meta { font-size: 11px; color: #6b7280; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  th { background: #f9fafb; padding: 8px 10px; text-align: left; border-bottom: 2px solid #d1d5db; font-weight: 600; color: #374151; white-space: nowrap; }
  td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  td.activity { max-width: 220px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.4; }
  td.center { text-align: center; }
  td.muted { color: #9ca3af; font-size: 10px; }
  tr:nth-child(even) { background: #fafafa; }
  @media print { body { padding: 20px; } @page { margin: 0.5in; size: landscape; } }
</style>
</head><body>
  <div class="header">
    <img src="${window.location.origin}/mim-icon.png" alt="MiM" />
    <div><h1>Investor Pipeline Report</h1><div class="meta">${dateStr} &middot; ${sorted.length} investors &middot; Sorted by recency</div></div>
  </div>
  <table>
    <thead><tr><th>Firm</th><th>Type</th><th>Connection</th><th>Status</th><th>Recent Activity</th><th>Score</th><th>Updated</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body></html>`;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => { printWindow.print(); };
    }
  };

  const filtered = investors.filter((inv) => {
    if (search) {
      const s = search.toLowerCase();
      if (!inv.name?.toLowerCase().includes(s) && !inv.investor_type?.toLowerCase().includes(s) && !inv.connection_status?.toLowerCase().includes(s)) return false;
    }
    if (filterConnection && inv.connection_status !== filterConnection) return false;
    if (filterPipeline === "in" && !inv.pipeline_status) return false;
    if (filterPipeline === "not" && inv.pipeline_status) return false;
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

  const inPipelineCount = investors.filter((inv) => inv.pipeline_status).length;

  if (loading) return <div className="p-8"><div className="animate-pulse h-64 bg-gray-200 rounded" /></div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{labels.investorsPageTitle}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {filtered.length} of {investors.length} firms · {inPipelineCount} in pipeline
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportPDF}>
            <FileDown className="h-4 w-4 mr-1" /> Export PDF
          </Button>
          <Link href="/pipeline">
            <Button variant="outline" size="sm"><ArrowRight className="h-4 w-4 mr-1" /> View Pipeline</Button>
          </Link>
          <Dialog open={showNew} onOpenChange={setShowNew}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add Investor</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Investor</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><label className="text-xs text-gray-500">Firm Name *</label><Input value={newFirm} onChange={(e) => setNewFirm(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-500">Type</label><Input value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="e.g. Seed Fund" /></div>
                  <div><label className="text-xs text-gray-500">Geography</label><Input value={newGeo} onChange={(e) => setNewGeo(e.target.value)} /></div>
                </div>
                <div><label className="text-xs text-gray-500">Sector Focus</label><Input value={newSector} onChange={(e) => setNewSector(e.target.value)} /></div>
                <Button onClick={createInvestor} className="w-full" disabled={!newFirm.trim()}>Create Investor</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <span className="text-sm font-medium text-blue-700">{selected.size} selected</span>
          <Button size="sm" variant="outline" className="border-green-300 text-green-700 hover:bg-green-50" onClick={addToPipeline}>
            <ArrowRight className="h-3 w-3 mr-1" /> Add to Pipeline
          </Button>
          <Button size="sm" variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-50" onClick={removeFromPipeline}>
            <X className="h-3 w-3 mr-1" /> Remove from Pipeline
          </Button>
          <Dialog open={showBulk} onOpenChange={setShowBulk}>
            <DialogTrigger asChild><Button size="sm" variant="outline">Bulk Update</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Bulk Update {selected.size} Investors</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><label className="text-xs text-gray-500">Field</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={bulkField} onChange={(e) => { setBulkField(e.target.value); setBulkValue(""); }}><option value="">Select...</option><option value="connection_status">Connection Status</option><option value="geography">Geography</option><option value="sector_focus">Sector Focus</option></select></div>
                {bulkField === "connection_status" && <div><label className="text-xs text-gray-500">Value</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}><option value="">—</option>{CONNECTION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>}
                {bulkField && bulkField !== "connection_status" && <div><label className="text-xs text-gray-500">Value</label><Input value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} /></div>}
                <Button onClick={bulkUpdate} className="w-full" disabled={!bulkField}>Update {selected.size} Records</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button size="sm" variant="destructive" onClick={deleteSelected}><Trash2 className="h-3 w-3 mr-1" /> Delete</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="Search firms..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
        <Button variant={showFilters ? "default" : "outline"} onClick={() => setShowFilters(!showFilters)}>Filters</Button>
      </div>

      {showFilters && (
        <Card className="mb-4"><div className="p-4"><div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="text-xs font-medium text-gray-500 mb-1 block">Connection Status</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={filterConnection} onChange={(e) => setFilterConnection(e.target.value)}><option value="">All</option>{CONNECTION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
          <div><label className="text-xs font-medium text-gray-500 mb-1 block">Status</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={filterPipeline} onChange={(e) => setFilterPipeline(e.target.value as "all" | "in" | "not")}><option value="all">All</option><option value="in">In Pipeline</option><option value="not">Not in Pipeline</option></select></div>
          <div className="flex items-end"><Button variant="ghost" size="sm" onClick={() => { setFilterConnection(""); setFilterPipeline("all"); }}><X className="h-3 w-3 mr-1" /> Clear</Button></div>
        </div></div></Card>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="text-sm w-full" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: pct(40) }} />
              <col style={{ width: pct(36) }} />
              {TABLE_COLS.map((c) => <col key={c.key} style={{ width: pct(colWidths[c.key]) }} />)}
            </colgroup>
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-3 py-3"><button onClick={toggleSelectAll}>{selected.size === filtered.length && filtered.length > 0 ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-gray-300" />}</button></th>
                <th className="px-2 py-3"></th>
                {TABLE_COLS.map((c) => {
                  const sortable = c.key === "firm" || c.key === "updated_at";
                  const sf = c.key === "firm" ? "name" : c.key === "updated_at" ? "updated_at" : null;
                  return (
                    <th key={c.key} className={`text-left px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide relative whitespace-nowrap overflow-hidden ${sortable ? "cursor-pointer" : ""}`} onClick={sortable && sf ? () => toggleSort(sf as SortField) : undefined}>
                      <span className="flex items-center gap-1">{c.label} {sf && <SortIcon field={sf as SortField} />}</span>
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-500" onMouseDown={(e) => startResize(c.key, e)} />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => (
                <tr key={inv.id} className={`border-b hover:bg-gray-50 ${selected.has(inv.id) ? "bg-blue-50" : ""}`}>
                  <td className="px-3 py-2"><button onClick={() => toggleSelect(inv.id)}>{selected.has(inv.id) ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-gray-300" />}</button></td>
                  <td className="px-2 py-2"><Avatar src={inv.avatar_url} name={inv.name} size="sm" /></td>
                  <td className="px-3 py-2 overflow-hidden"><div className="flex items-center gap-1.5 min-w-0"><Link href={`/investors/${inv.id}`} className="text-blue-600 hover:underline shrink-0 text-xs">↗</Link><div className="min-w-0 flex-1"><EditableCell value={inv.name} onSave={(v) => updateCell(inv.id, "name", v)} /></div></div></td>
                  <td className="px-3 py-2 overflow-hidden"><EditableCell value={inv.investor_type} onSave={(v) => updateCell(inv.id, "investor_type", v)} /></td>
                  <td className="px-3 py-2 overflow-hidden"><EditableCell value={inv.connection_status} onSave={(v) => updateCell(inv.id, "connection_status", v)} type="select" options={CONNECTION_STATUSES} /></td>
                  <td className="px-3 py-2 overflow-hidden"><EditableCell value={inv.pipeline_status} onSave={(v) => updateCell(inv.id, "pipeline_status", v)} type="select" options={PIPELINE_STATUSES} /></td>
                  <td className="px-3 py-2 overflow-hidden">
                    {activityMap.has(inv.id) ? (
                      <div title={activityMap.get(inv.id)!.text}>
                        <p className="text-xs text-gray-600 line-clamp-2 leading-snug">{activityMap.get(inv.id)!.text}</p>
                        {activityMap.get(inv.id)!.date && (
                          <span className="text-[10px] text-gray-400">{timeAgo(activityMap.get(inv.id)!.date)}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 overflow-hidden"><EditableCell value={inv.likelihood_score} onSave={(v) => updateCell(inv.id, "likelihood_score", v)} type="number" /></td>
                  <td className="px-3 py-2 overflow-hidden"><EditableCell value={inv.website} onSave={(v) => updateCell(inv.id, "website", v)} /></td>
                  <td className="px-3 py-2 overflow-hidden text-gray-400 text-xs whitespace-nowrap">{timeAgo(inv.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
