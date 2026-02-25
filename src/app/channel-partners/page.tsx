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
import { labels } from "@/config/labels";
import { Search, List, Columns3, Trash2, CheckSquare, Square, X, Plus } from "lucide-react";

interface Community {
  id: string;
  org_name: string;
  org_type: string | null;
  website: string | null;
  players: number | null;
  outreach_status: string | null;
  partner_status: string | null;
  partner_since: string | null;
  primary_contact: string | null;
  total_revenue: number | null;
  store_status: string | null;
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
}

const LEAGUE_MAP: Record<string, string> = {
  in_bays: "BAYS", in_cmysl: "CMYSL", in_cysl: "CYSL", in_ecnl: "ECNL",
  in_ecysa: "ECYSA", in_mysl: "MYSL", in_nashoba: "Nashoba", in_necsl: "NECSL",
  in_roots: "Roots", in_south_coast: "S. Coast", in_south_shore: "S. Shore",
};

const PARTNER_STATUSES = ["Prospect", "Meeting", "Contract", "Onboarding", "Pilot", "Active Partner"];
const OUTREACH_STATUSES = ["Not Contacted", "Contacted", "Meeting Scheduled", "Active Partner", "Not Interested"];

const STATUS_HEADER_COLORS: Record<string, string> = {
  Prospect: "bg-gray-200",
  Meeting: "bg-yellow-200",
  Contract: "bg-blue-200",
  Onboarding: "bg-indigo-200",
  Pilot: "bg-purple-200",
  "Active Partner": "bg-green-200",
};
const STATUS_COLORS: Record<string, string> = {
  Prospect: "bg-gray-100 border-gray-300",
  Meeting: "bg-yellow-50 border-yellow-300",
  Contract: "bg-blue-50 border-blue-300",
  Onboarding: "bg-indigo-50 border-indigo-300",
  Pilot: "bg-purple-50 border-purple-300",
  "Active Partner": "bg-green-50 border-green-300",
};

function getLeagues(c: Community): string[] {
  return Object.entries(LEAGUE_MAP)
    .filter(([key]) => c[key as keyof Community])
    .map(([, label]) => label);
}

export default function ChannelPartnersPage() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [allCommunities, setAllCommunities] = useState<Community[]>([]);
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
    const { data } = await supabase.from("soccer_orgs").select("*").order("org_name");
    if (data) {
      setAllCommunities(data);
      setCommunities(data.filter((c) => c.partner_status != null));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateCell = async (id: string, field: string, value: string) => {
    const { error } = await supabase.from("soccer_orgs").update({ [field]: value || null }).eq("id", id);
    if (!error) {
      setCommunities((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value || null } : c)));
      setAllCommunities((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value || null } : c)));
    }
  };

  const removeFromPipeline = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from("soccer_orgs").update({ partner_status: null }).in("id", ids);
    if (!error) {
      setCommunities((prev) => prev.filter((c) => !selected.has(c.id)));
      setAllCommunities((prev) => prev.map((c) => selected.has(c.id) ? { ...c, partner_status: null } : c));
      setSelected(new Set());
    }
  };

  const removeOneFromPipeline = async (id: string) => {
    const { error } = await supabase.from("soccer_orgs").update({ partner_status: null }).eq("id", id);
    if (!error) {
      setCommunities((prev) => prev.filter((c) => c.id !== id));
      setAllCommunities((prev) => prev.map((c) => c.id === id ? { ...c, partner_status: null } : c));
    }
  };

  const deleteOne = async (id: string) => {
    const { error } = await supabase.from("soccer_orgs").delete().eq("id", id);
    if (!error) {
      setCommunities((prev) => prev.filter((c) => c.id !== id));
      setAllCommunities((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from("soccer_orgs").delete().in("id", ids);
    if (!error) {
      setCommunities((prev) => prev.filter((c) => !selected.has(c.id)));
      setAllCommunities((prev) => prev.filter((c) => !selected.has(c.id)));
      setSelected(new Set());
    }
  };

  const bulkUpdate = async () => {
    if (!bulkField || selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from("soccer_orgs").update({ [bulkField]: bulkValue || null }).in("id", ids);
    if (!error) {
      setCommunities((prev) => prev.map((c) => selected.has(c.id) ? { ...c, [bulkField]: bulkValue || null } : c));
      setAllCommunities((prev) => prev.map((c) => selected.has(c.id) ? { ...c, [bulkField]: bulkValue || null } : c));
      setSelected(new Set()); setShowBulk(false); setBulkField(""); setBulkValue("");
    }
  };

  const addToPipeline = async () => {
    if (addSelected.size === 0) return;
    const ids = Array.from(addSelected);
    const { error } = await supabase.from("soccer_orgs").update({ partner_status: "Prospect" }).in("id", ids);
    if (!error) {
      setAllCommunities((prev) => prev.map((c) => addSelected.has(c.id) ? { ...c, partner_status: "Prospect" } : c));
      setCommunities((prev) => {
        const newPipelineCommunities = allCommunities.filter((c) => addSelected.has(c.id)).map((c) => ({ ...c, partner_status: "Prospect" }));
        return [...prev, ...newPipelineCommunities];
      });
      setAddSelected(new Set());
      setShowAddDialog(false);
      setAddSearch("");
    }
  };

  const toggleSelect = (id: string) => { setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const toggleSelectAll = () => { if (selected.size === filtered.length) setSelected(new Set()); else setSelected(new Set(filtered.map((c) => c.id))); };

  const filtered = communities.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.org_name?.toLowerCase().includes(s) || c.org_type?.toLowerCase().includes(s) || c.primary_contact?.toLowerCase().includes(s);
  });

  const notInPipeline = allCommunities.filter((c) => !c.partner_status);
  const filteredNotInPipeline = notInPipeline.filter((c) => {
    if (!addSearch) return true;
    const s = addSearch.toLowerCase();
    return c.org_name?.toLowerCase().includes(s) || c.org_type?.toLowerCase().includes(s);
  });

  const handleDragStart = (e: React.DragEvent, id: string) => { setDraggedId(id); e.dataTransfer.effectAllowed = "move"; };
  const handleDrop = async (e: React.DragEvent, status: string) => {
    e.preventDefault();
    if (!draggedId) return;
    await supabase.from("soccer_orgs").update({ partner_status: status }).eq("id", draggedId);
    setCommunities((prev) => prev.map((c) => (c.id === draggedId ? { ...c, partner_status: status } : c)));
    setAllCommunities((prev) => prev.map((c) => (c.id === draggedId ? { ...c, partner_status: status } : c)));
    setDraggedId(null);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };

  if (loading) return <div className="p-8"><div className="animate-pulse"><div className="flex gap-4">{[1,2,3,4].map((i) => <div key={i} className="h-96 bg-gray-200 rounded flex-1" />)}</div></div></div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{labels.channelPartnersPageTitle}</h1>
          <p className="text-gray-500 text-sm mt-1">{communities.length} in pipeline · {notInPipeline.length} not yet added</p>
        </div>
        <div className="flex gap-2">
          <Button variant={view === "kanban" ? "default" : "outline"} size="sm" onClick={() => setView("kanban")}><Columns3 className="h-4 w-4 mr-1" /> Kanban</Button>
          <Button variant={view === "table" ? "default" : "outline"} size="sm" onClick={() => setView("table")}><List className="h-4 w-4 mr-1" /> Table</Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Add to Pipeline</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Add Communities to Pipeline</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input placeholder="Search communities..." value={addSearch} onChange={(e) => setAddSearch(e.target.value)} className="pl-9" />
                </div>
                <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                  {filteredNotInPipeline.length === 0 ? (
                    <div className="p-4 text-center text-gray-400 text-sm">
                      {notInPipeline.length === 0 ? "All communities are already in the pipeline" : "No matching communities"}
                    </div>
                  ) : (
                    filteredNotInPipeline.map((c) => {
                      const leagues = getLeagues(c);
                      return (
                        <label key={c.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={addSelected.has(c.id)}
                            onChange={() => { setAddSelected((prev) => { const n = new Set(prev); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; }); }}
                            className="rounded border-gray-300"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{c.org_name}</div>
                            <div className="text-xs text-gray-500 truncate">
                              {[c.org_type, leagues.length > 0 ? leagues.join(", ") : null, c.players ? `${c.players} players` : null].filter(Boolean).join(" · ") || "No details"}
                            </div>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
                {addSelected.size > 0 && (
                  <Button onClick={addToPipeline} className="w-full">
                    Add {addSelected.size} Communit{addSelected.size > 1 ? "ies" : "y"} to Pipeline
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
              <DialogHeader><DialogTitle>Bulk Update {selected.size} Communities</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><label className="text-xs text-gray-500">Field</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={bulkField} onChange={(e) => { setBulkField(e.target.value); setBulkValue(""); }}><option value="">Select...</option><option value="partner_status">Partner Status</option><option value="outreach_status">Outreach Status</option><option value="org_type">Type</option></select></div>
                {bulkField === "partner_status" && <div><label className="text-xs text-gray-500">Value</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}><option value="">---</option>{PARTNER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>}
                {bulkField === "outreach_status" && <div><label className="text-xs text-gray-500">Value</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}><option value="">---</option>{OUTREACH_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>}
                {bulkField && !["partner_status", "outreach_status"].includes(bulkField) && <div><label className="text-xs text-gray-500">Value</label><Input value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} /></div>}
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
          {PARTNER_STATUSES.map((status) => {
            const cards = filtered.filter((c) => (c.partner_status || "Prospect") === status);
            return (
              <div key={status} className="flex-shrink-0 w-64" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, status)}>
                <div className={`rounded-t-lg px-3 py-2 ${STATUS_HEADER_COLORS[status]}`}><div className="flex items-center justify-between"><span className="text-sm font-semibold">{status}</span><Badge variant="secondary" className="text-xs">{cards.length}</Badge></div></div>
                <div className={`rounded-b-lg border-2 ${STATUS_COLORS[status]} min-h-[200px] p-2 space-y-2`}>
                  {cards.map((c) => {
                    const leagues = getLeagues(c);
                    return (
                      <div key={c.id} draggable onDragStart={(e) => handleDragStart(e, c.id)} className="group bg-white rounded-lg border shadow-sm p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow relative">
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); removeOneFromPipeline(c.id); }}
                            className="p-0.5 rounded hover:bg-orange-50 text-gray-300 hover:text-orange-500"
                            title="Remove from pipeline"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteOne(c.id); }}
                            className="p-0.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500"
                            title="Delete community"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <Link href={`/soccer-orgs/${c.id}`}><h3 className="text-sm font-medium text-gray-900 hover:text-blue-600 pr-10">{c.org_name}</h3></Link>
                        {leagues.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {leagues.slice(0, 3).map((l) => <Badge key={l} variant="secondary" className="text-[10px] px-1.5 py-0">{l}</Badge>)}
                            {leagues.length > 3 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">+{leagues.length - 3}</Badge>}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          {c.players != null && c.players > 0 && <span className="text-xs text-gray-400">{c.players} players</span>}
                          {c.outreach_status && c.outreach_status !== "Not Contacted" && <Badge variant="outline" className="text-xs">{c.outreach_status}</Badge>}
                        </div>
                      </div>
                    );
                  })}
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
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Organization</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Players</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Revenue</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Partner Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Outreach</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Primary Contact</th>
                  <th className="w-10 px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className={`border-b hover:bg-gray-50 ${selected.has(c.id) ? "bg-blue-50" : ""}`}>
                    <td className="px-3 py-3"><button onClick={() => toggleSelect(c.id)}>{selected.has(c.id) ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-gray-300" />}</button></td>
                    <td className="px-4 py-2"><div className="flex items-center gap-2"><Link href={`/soccer-orgs/${c.id}`} className="text-blue-600 hover:underline shrink-0">&#8599;</Link><EditableCell value={c.org_name} onSave={(v) => updateCell(c.id, "org_name", v)} /></div></td>
                    <td className="px-4 py-2"><EditableCell value={c.org_type} onSave={(v) => updateCell(c.id, "org_type", v)} /></td>
                    <td className="px-4 py-2 text-gray-600">{c.players ?? "---"}</td>
                    <td className="px-4 py-2 text-gray-600">{c.total_revenue ? `$${Number(c.total_revenue).toLocaleString()}` : "---"}</td>
                    <td className="px-4 py-2"><EditableCell value={c.partner_status} onSave={(v) => updateCell(c.id, "partner_status", v)} type="select" options={PARTNER_STATUSES} /></td>
                    <td className="px-4 py-2"><EditableCell value={c.outreach_status} onSave={(v) => updateCell(c.id, "outreach_status", v)} type="select" options={OUTREACH_STATUSES} /></td>
                    <td className="px-4 py-2"><EditableCell value={c.primary_contact} onSave={(v) => updateCell(c.id, "primary_contact", v)} /></td>
                    <td className="px-3 py-2 whitespace-nowrap"><button onClick={() => removeOneFromPipeline(c.id)} className="p-1 rounded hover:bg-orange-50 text-gray-300 hover:text-orange-500 transition-colors" title="Remove from pipeline"><X className="h-3.5 w-3.5" /></button><button onClick={() => deleteOne(c.id)} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button></td>
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
