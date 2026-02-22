"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EditableCell } from "@/components/EditableCell";
import { Avatar } from "@/components/Avatar";
import Link from "next/link";
import { Search, Plus, Trash2, CheckSquare, Square, ArrowRight, X } from "lucide-react";

interface Investor {
  id: string;
  firm_name: string;
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
}

const CONNECTION_STATUSES = ["Active", "Stale", "Need Introduction", "Warm Intro", "Cold"];
const PIPELINE_STATUSES = ["Prospect", "Qualified", "Engaged", "First Meeting", "In Closing", "Closed", "Passed"];

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

  const load = useCallback(async () => {
    const { data } = await supabase.from("investors").select("*").order("firm_name");
    if (data) setInvestors(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateCell = async (id: string, field: string, value: string) => {
    const { error } = await supabase.from("investors").update({ [field]: value || null }).eq("id", id);
    if (!error) setInvestors((prev) => prev.map((inv) => (inv.id === id ? { ...inv, [field]: value || null } : inv)));
  };

  const createInvestor = async () => {
    if (!newFirm.trim()) return;
    const { data, error } = await supabase.from("investors").insert({
      firm_name: newFirm, investor_type: newType || null, geography: newGeo || null,
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
    const { error } = await supabase.from("investors").delete().in("id", Array.from(selected));
    if (!error) { setInvestors((prev) => prev.filter((inv) => !selected.has(inv.id))); setSelected(new Set()); }
  };

  const addToPipeline = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from("investors").update({ pipeline_status: "Prospect" }).in("id", ids);
    if (!error) {
      setInvestors((prev) => prev.map((inv) => selected.has(inv.id) && !inv.pipeline_status ? { ...inv, pipeline_status: "Prospect" } : inv));
      setSelected(new Set());
    }
  };

  const removeFromPipeline = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from("investors").update({ pipeline_status: null }).in("id", ids);
    if (!error) {
      setInvestors((prev) => prev.map((inv) => selected.has(inv.id) ? { ...inv, pipeline_status: null } : inv));
      setSelected(new Set());
    }
  };

  const bulkUpdate = async () => {
    if (!bulkField || selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from("investors").update({ [bulkField]: bulkValue || null }).in("id", ids);
    if (!error) {
      setInvestors((prev) => prev.map((inv) => selected.has(inv.id) ? { ...inv, [bulkField]: bulkValue || null } : inv));
      setSelected(new Set()); setShowBulk(false); setBulkField(""); setBulkValue("");
    }
  };

  const toggleSelect = (id: string) => { setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const toggleSelectAll = () => { if (selected.size === filtered.length) setSelected(new Set()); else setSelected(new Set(filtered.map((inv) => inv.id))); };

  const filtered = investors.filter((inv) => {
    if (search) {
      const s = search.toLowerCase();
      if (!inv.firm_name?.toLowerCase().includes(s) && !inv.sector_focus?.toLowerCase().includes(s) && !inv.geography?.toLowerCase().includes(s)) return false;
    }
    if (filterConnection && inv.connection_status !== filterConnection) return false;
    if (filterPipeline === "in" && !inv.pipeline_status) return false;
    if (filterPipeline === "not" && inv.pipeline_status) return false;
    return true;
  });

  const inPipelineCount = investors.filter((inv) => inv.pipeline_status).length;

  if (loading) return <div className="p-8"><div className="animate-pulse h-64 bg-gray-200 rounded" /></div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Investors</h1>
          <p className="text-gray-500 text-sm mt-1">
            {filtered.length} of {investors.length} firms · {inPipelineCount} in pipeline
          </p>
        </div>
        <div className="flex gap-2">
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
          <div><label className="text-xs font-medium text-gray-500 mb-1 block">Pipeline</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={filterPipeline} onChange={(e) => setFilterPipeline(e.target.value as "all" | "in" | "not")}><option value="all">All</option><option value="in">In Pipeline</option><option value="not">Not in Pipeline</option></select></div>
          <div className="flex items-end"><Button variant="ghost" size="sm" onClick={() => { setFilterConnection(""); setFilterPipeline("all"); }}><X className="h-3 w-3 mr-1" /> Clear</Button></div>
        </div></div></Card>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="w-10 px-3 py-3"><button onClick={toggleSelectAll}>{selected.size === filtered.length && filtered.length > 0 ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-gray-300" />}</button></th>
                <th className="w-10 px-2 py-3"></th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Firm</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Geography</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Sector Focus</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Connection</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Pipeline</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Score</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Website</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => (
                <tr key={inv.id} className={`border-b hover:bg-gray-50 ${selected.has(inv.id) ? "bg-blue-50" : ""}`}>
                  <td className="px-3 py-3"><button onClick={() => toggleSelect(inv.id)}>{selected.has(inv.id) ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-gray-300" />}</button></td>
                  <td className="px-2 py-2"><Avatar src={inv.avatar_url} name={inv.firm_name} size="sm" /></td>
                  <td className="px-4 py-2"><div className="flex items-center gap-2"><Link href={`/investors/${inv.id}`} className="text-blue-600 hover:underline shrink-0">↗</Link><EditableCell value={inv.firm_name} onSave={(v) => updateCell(inv.id, "firm_name", v)} /></div></td>
                  <td className="px-4 py-2"><EditableCell value={inv.investor_type} onSave={(v) => updateCell(inv.id, "investor_type", v)} /></td>
                  <td className="px-4 py-2"><EditableCell value={inv.geography} onSave={(v) => updateCell(inv.id, "geography", v)} /></td>
                  <td className="px-4 py-2"><EditableCell value={inv.sector_focus} onSave={(v) => updateCell(inv.id, "sector_focus", v)} /></td>
                  <td className="px-4 py-2"><EditableCell value={inv.connection_status} onSave={(v) => updateCell(inv.id, "connection_status", v)} type="select" options={CONNECTION_STATUSES} /></td>
                  <td className="px-4 py-2">
                    {inv.pipeline_status ? (
                      <Badge variant="secondary" className="text-xs">{inv.pipeline_status}</Badge>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2"><EditableCell value={inv.likelihood_score} onSave={(v) => updateCell(inv.id, "likelihood_score", v)} type="number" /></td>
                  <td className="px-4 py-2"><EditableCell value={inv.website} onSave={(v) => updateCell(inv.id, "website", v)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
