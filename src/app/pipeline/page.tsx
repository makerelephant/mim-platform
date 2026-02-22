"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EditableCell } from "@/components/EditableCell";
import Link from "next/link";
import { Search, List, Columns3, Trash2, CheckSquare, Square, X, Plus } from "lucide-react";

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
}

const PIPELINE_STATUSES = ["Prospect", "Qualified", "Engaged", "First Meeting", "In Closing", "Closed", "Passed"];
const CONNECTION_STATUSES = ["Active", "Stale", "Need Introduction", "Warm Intro", "Cold"];

const STATUS_HEADER_COLORS: Record<string, string> = {
  Prospect: "bg-gray-200", Qualified: "bg-yellow-200", Engaged: "bg-blue-200",
  "First Meeting": "bg-indigo-200", "In Closing": "bg-green-200", Closed: "bg-green-300", Passed: "bg-red-200",
};
const STATUS_COLORS: Record<string, string> = {
  Prospect: "bg-gray-100 border-gray-300", Qualified: "bg-yellow-50 border-yellow-300", Engaged: "bg-blue-50 border-blue-300",
  "First Meeting": "bg-indigo-50 border-indigo-300", "In Closing": "bg-green-50 border-green-300", Closed: "bg-green-100 border-green-400", Passed: "bg-red-50 border-red-300",
};

export default function PipelinePage() {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [allInvestors, setAllInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulk, setShowBulk] = useState(false);
  const [bulkField, setBulkField] = useState("");
  const [bulkValue, setBulkValue] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [addSelected, setAddSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const { data } = await supabase.from("investors").select("*").order("firm_name");
    if (data) {
      setAllInvestors(data);
      setInvestors(data.filter((inv) => inv.pipeline_status != null));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateCell = async (id: string, field: string, value: string) => {
    const { error } = await supabase.from("investors").update({ [field]: value || null }).eq("id", id);
    if (!error) {
      setInvestors((prev) => prev.map((inv) => (inv.id === id ? { ...inv, [field]: value || null } : inv)));
      setAllInvestors((prev) => prev.map((inv) => (inv.id === id ? { ...inv, [field]: value || null } : inv)));
    }
  };

  const removeFromPipeline = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from("investors").update({ pipeline_status: null }).in("id", ids);
    if (!error) {
      setInvestors((prev) => prev.filter((inv) => !selected.has(inv.id)));
      setAllInvestors((prev) => prev.map((inv) => selected.has(inv.id) ? { ...inv, pipeline_status: null } : inv));
      setSelected(new Set());
    }
  };

  const removeOneFromPipeline = async (id: string) => {
    const { error } = await supabase.from("investors").update({ pipeline_status: null }).eq("id", id);
    if (!error) {
      setInvestors((prev) => prev.filter((inv) => inv.id !== id));
      setAllInvestors((prev) => prev.map((inv) => inv.id === id ? { ...inv, pipeline_status: null } : inv));
    }
  };

  const deleteOne = async (id: string) => {
    const { error } = await supabase.from("investors").delete().eq("id", id);
    if (!error) {
      setInvestors((prev) => prev.filter((inv) => inv.id !== id));
      setAllInvestors((prev) => prev.filter((inv) => inv.id !== id));
    }
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from("investors").delete().in("id", ids);
    if (!error) {
      setInvestors((prev) => prev.filter((inv) => !selected.has(inv.id)));
      setAllInvestors((prev) => prev.filter((inv) => !selected.has(inv.id)));
      setSelected(new Set());
    }
  };

  const bulkUpdate = async () => {
    if (!bulkField || selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from("investors").update({ [bulkField]: bulkValue || null }).in("id", ids);
    if (!error) {
      setInvestors((prev) => prev.map((inv) => selected.has(inv.id) ? { ...inv, [bulkField]: bulkValue || null } : inv));
      setAllInvestors((prev) => prev.map((inv) => selected.has(inv.id) ? { ...inv, [bulkField]: bulkValue || null } : inv));
      setSelected(new Set()); setShowBulk(false); setBulkField(""); setBulkValue("");
    }
  };

  const addToPipeline = async () => {
    if (addSelected.size === 0) return;
    const ids = Array.from(addSelected);
    const { error } = await supabase.from("investors").update({ pipeline_status: "Prospect" }).in("id", ids);
    if (!error) {
      setAllInvestors((prev) => prev.map((inv) => addSelected.has(inv.id) ? { ...inv, pipeline_status: "Prospect" } : inv));
      setInvestors((prev) => {
        const newPipelineInvestors = allInvestors.filter((inv) => addSelected.has(inv.id)).map((inv) => ({ ...inv, pipeline_status: "Prospect" }));
        return [...prev, ...newPipelineInvestors];
      });
      setAddSelected(new Set());
      setShowAddDialog(false);
      setAddSearch("");
    }
  };

  const toggleSelect = (id: string) => { setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const toggleSelectAll = () => { if (selected.size === filtered.length) setSelected(new Set()); else setSelected(new Set(filtered.map((inv) => inv.id))); };

  const filtered = investors.filter((inv) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return inv.firm_name?.toLowerCase().includes(s) || inv.sector_focus?.toLowerCase().includes(s) || inv.geography?.toLowerCase().includes(s);
  });

  const notInPipeline = allInvestors.filter((inv) => !inv.pipeline_status);
  const filteredNotInPipeline = notInPipeline.filter((inv) => {
    if (!addSearch) return true;
    const s = addSearch.toLowerCase();
    return inv.firm_name?.toLowerCase().includes(s) || inv.sector_focus?.toLowerCase().includes(s);
  });

  const handleDragStart = (e: React.DragEvent, id: string) => { setDraggedId(id); e.dataTransfer.effectAllowed = "move"; };
  const handleDrop = async (e: React.DragEvent, status: string) => {
    e.preventDefault();
    if (!draggedId) return;
    await supabase.from("investors").update({ pipeline_status: status }).eq("id", draggedId);
    setInvestors((prev) => prev.map((inv) => (inv.id === draggedId ? { ...inv, pipeline_status: status } : inv)));
    setAllInvestors((prev) => prev.map((inv) => (inv.id === draggedId ? { ...inv, pipeline_status: status } : inv)));
    setDraggedId(null);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };

  if (loading) return <div className="p-8"><div className="animate-pulse"><div className="flex gap-4">{[1,2,3,4].map((i) => <div key={i} className="h-96 bg-gray-200 rounded flex-1" />)}</div></div></div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Investor Pipeline</h1>
          <p className="text-gray-500 text-sm mt-1">{investors.length} firms in pipeline · {notInPipeline.length} not yet added</p>
        </div>
        <div className="flex gap-2">
          <Button variant={view === "kanban" ? "default" : "outline"} size="sm" onClick={() => setView("kanban")}><Columns3 className="h-4 w-4 mr-1" /> Kanban</Button>
          <Button variant={view === "table" ? "default" : "outline"} size="sm" onClick={() => setView("table")}><List className="h-4 w-4 mr-1" /> Table</Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Add to Pipeline</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Add Investors to Pipeline</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input placeholder="Search investors..." value={addSearch} onChange={(e) => setAddSearch(e.target.value)} className="pl-9" />
                </div>
                <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                  {filteredNotInPipeline.length === 0 ? (
                    <div className="p-4 text-center text-gray-400 text-sm">
                      {notInPipeline.length === 0 ? "All investors are already in the pipeline" : "No matching investors"}
                    </div>
                  ) : (
                    filteredNotInPipeline.map((inv) => (
                      <label key={inv.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={addSelected.has(inv.id)}
                          onChange={() => { setAddSelected((prev) => { const n = new Set(prev); n.has(inv.id) ? n.delete(inv.id) : n.add(inv.id); return n; }); }}
                          className="rounded border-gray-300"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{inv.firm_name}</div>
                          <div className="text-xs text-gray-500 truncate">{[inv.investor_type, inv.geography, inv.sector_focus].filter(Boolean).join(" · ") || "No details"}</div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
                {addSelected.size > 0 && (
                  <Button onClick={addToPipeline} className="w-full">
                    Add {addSelected.size} Investor{addSelected.size > 1 ? "s" : ""} to Pipeline
                  </Button>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <span className="text-sm font-medium text-blue-700">{selected.size} selected</span>
          <Dialog open={showBulk} onOpenChange={setShowBulk}>
            <DialogTrigger asChild><Button size="sm" variant="outline">Bulk Update</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Bulk Update {selected.size} Investors</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><label className="text-xs text-gray-500">Field</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={bulkField} onChange={(e) => { setBulkField(e.target.value); setBulkValue(""); }}><option value="">Select...</option><option value="pipeline_status">Pipeline Status</option><option value="connection_status">Connection Status</option><option value="geography">Geography</option><option value="sector_focus">Sector Focus</option></select></div>
                {bulkField === "pipeline_status" && <div><label className="text-xs text-gray-500">Value</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}><option value="">—</option>{PIPELINE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>}
                {bulkField === "connection_status" && <div><label className="text-xs text-gray-500">Value</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}><option value="">—</option>{CONNECTION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>}
                {bulkField && !["pipeline_status", "connection_status"].includes(bulkField) && <div><label className="text-xs text-gray-500">Value</label><Input value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} /></div>}
                <Button onClick={bulkUpdate} className="w-full" disabled={!bulkField}>Update {selected.size} Records</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button size="sm" variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-50" onClick={removeFromPipeline}>
            <X className="h-3 w-3 mr-1" /> Remove from Pipeline
          </Button>
          <Button size="sm" variant="destructive" onClick={deleteSelected}><Trash2 className="h-3 w-3 mr-1" /> Delete</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search pipeline..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {view === "kanban" ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {PIPELINE_STATUSES.map((status) => {
            const cards = filtered.filter((inv) => (inv.pipeline_status || "Prospect") === status);
            return (
              <div key={status} className="flex-shrink-0 w-64" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, status)}>
                <div className={`rounded-t-lg px-3 py-2 ${STATUS_HEADER_COLORS[status]}`}><div className="flex items-center justify-between"><span className="text-sm font-semibold">{status}</span><Badge variant="secondary" className="text-xs">{cards.length}</Badge></div></div>
                <div className={`rounded-b-lg border-2 ${STATUS_COLORS[status]} min-h-[200px] p-2 space-y-2`}>
                  {cards.map((inv) => (
                    <div key={inv.id} draggable onDragStart={(e) => handleDragStart(e, inv.id)} className="group bg-white rounded-lg border shadow-sm p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow relative">
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); removeOneFromPipeline(inv.id); }}
                          className="p-0.5 rounded hover:bg-orange-50 text-gray-300 hover:text-orange-500"
                          title="Remove from pipeline"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteOne(inv.id); }}
                          className="p-0.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500"
                          title="Delete investor"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <Link href={`/investors/${inv.id}`}><h3 className="text-sm font-medium text-gray-900 hover:text-blue-600">{inv.firm_name}</h3></Link>
                      {inv.sector_focus && <p className="text-xs text-gray-500 mt-1 line-clamp-1">{inv.sector_focus}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        {inv.connection_status && <Badge variant="outline" className="text-xs">{inv.connection_status}</Badge>}
                        {inv.likelihood_score != null && inv.likelihood_score > 0 && <span className="text-xs text-gray-400">Score: {inv.likelihood_score}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="w-10 px-3 py-3"><button onClick={toggleSelectAll}>{selected.size === filtered.length && filtered.length > 0 ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-gray-300" />}</button></th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Firm</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Geography</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Sector Focus</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Pipeline</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Connection</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Score</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Last Contact</th>
                  <th className="w-10 px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr key={inv.id} className={`border-b hover:bg-gray-50 ${selected.has(inv.id) ? "bg-blue-50" : ""}`}>
                    <td className="px-3 py-3"><button onClick={() => toggleSelect(inv.id)}>{selected.has(inv.id) ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-gray-300" />}</button></td>
                    <td className="px-4 py-2"><div className="flex items-center gap-2"><Link href={`/investors/${inv.id}`} className="text-blue-600 hover:underline shrink-0">↗</Link><EditableCell value={inv.firm_name} onSave={(v) => updateCell(inv.id, "firm_name", v)} /></div></td>
                    <td className="px-4 py-2"><EditableCell value={inv.investor_type} onSave={(v) => updateCell(inv.id, "investor_type", v)} /></td>
                    <td className="px-4 py-2"><EditableCell value={inv.geography} onSave={(v) => updateCell(inv.id, "geography", v)} /></td>
                    <td className="px-4 py-2"><EditableCell value={inv.sector_focus} onSave={(v) => updateCell(inv.id, "sector_focus", v)} /></td>
                    <td className="px-4 py-2"><EditableCell value={inv.pipeline_status} onSave={(v) => updateCell(inv.id, "pipeline_status", v)} type="select" options={PIPELINE_STATUSES} /></td>
                    <td className="px-4 py-2"><EditableCell value={inv.connection_status} onSave={(v) => updateCell(inv.id, "connection_status", v)} type="select" options={CONNECTION_STATUSES} /></td>
                    <td className="px-4 py-2"><EditableCell value={inv.likelihood_score} onSave={(v) => updateCell(inv.id, "likelihood_score", v)} type="number" /></td>
                    <td className="px-4 py-2"><EditableCell value={inv.last_contact_date} onSave={(v) => updateCell(inv.id, "last_contact_date", v)} type="date" /></td>
                    <td className="px-3 py-2 whitespace-nowrap"><button onClick={() => removeOneFromPipeline(inv.id)} className="p-1 rounded hover:bg-orange-50 text-gray-300 hover:text-orange-500 transition-colors" title="Remove from pipeline"><X className="h-3.5 w-3.5" /></button><button onClick={() => deleteOne(inv.id)} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors" title="Delete investor"><Trash2 className="h-3.5 w-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
