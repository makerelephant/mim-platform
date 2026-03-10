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

interface PipelineOrg {
  id: string;
  name: string;
  org_type: string[];
  website: string | null;
  players: number | null;
  total_revenue: number | null;
  outreach_status: string | null;
  partner_status: string | null;
  leagues: string[];
}

const PARTNER_STATUSES = ["Prospect", "Meeting", "Contract", "Onboarding", "Pilot", "Active Partner"];
const OUTREACH_STATUSES = ["Not Contacted", "Contacted", "Meeting Scheduled", "Active Partner", "Not Interested"];

const STATUS_HEADER_COLORS: Record<string, string> = {
  Prospect: "bg-gray-200", Meeting: "bg-yellow-200", Contract: "bg-blue-200",
  Onboarding: "bg-indigo-200", Pilot: "bg-purple-200", "Active Partner": "bg-green-200",
};
const STATUS_COLORS: Record<string, string> = {
  Prospect: "bg-gray-100 border-gray-300", Meeting: "bg-yellow-50 border-yellow-300",
  Contract: "bg-blue-50 border-blue-300", Onboarding: "bg-indigo-50 border-indigo-300",
  Pilot: "bg-purple-50 border-purple-300", "Active Partner": "bg-green-50 border-green-300",
};

export default function PartnershipPipelinePage() {
  const [pipelineOrgs, setPipelineOrgs] = useState<PipelineOrg[]>([]);
  const [allPartnerOrgs, setAllPartnerOrgs] = useState<PipelineOrg[]>([]);
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
    // 1. Get Partner org IDs
    const { data: typeRows } = await supabase
      .schema('core').from("org_types").select("org_id").eq("type", "Partner");
    const partnerIds = (typeRows || []).map((r) => r.org_id);
    if (partnerIds.length === 0) { setAllPartnerOrgs([]); setPipelineOrgs([]); setLoading(false); return; }

    // 2. Parallel load
    const [orgResult, allTypeResult, partnerResult, outreachResult, memberResult, leagueResult, financialResult] = await Promise.all([
      supabase.schema('core').from("organizations").select("id, name, website").in("id", partnerIds).order("name"),
      supabase.schema('core').from("org_types").select("org_id, type").in("org_id", partnerIds),
      supabase.schema('intel').from("partner_profile").select("org_id, partner_status").in("org_id", partnerIds),
      supabase.schema('crm').from("outreach").select("org_id, status").in("org_id", partnerIds),
      supabase.schema('platform').from("memberships").select("org_id, league_id").in("org_id", partnerIds),
      supabase.from("leagues").select("id, name"),
      supabase.schema('intel').from("org_financials").select("org_id, players, total_revenue").in("org_id", partnerIds),
    ]);

    // Build maps
    const leagueNameMap = new Map<string, string>();
    for (const l of leagueResult.data || []) leagueNameMap.set(l.id, l.name);

    const typeMap = new Map<string, string[]>();
    for (const t of allTypeResult.data || []) {
      if (!typeMap.has(t.org_id)) typeMap.set(t.org_id, []);
      typeMap.get(t.org_id)!.push(t.type);
    }

    const partnerMap = new Map<string, string>();
    for (const p of partnerResult.data || []) if (p.partner_status) partnerMap.set(p.org_id, p.partner_status);

    const outreachMap = new Map<string, string>();
    for (const o of outreachResult.data || []) if (o.status) outreachMap.set(o.org_id, o.status);

    const membershipMap = new Map<string, string[]>();
    for (const m of memberResult.data || []) {
      const lName = leagueNameMap.get(m.league_id);
      if (lName) {
        if (!membershipMap.has(m.org_id)) membershipMap.set(m.org_id, []);
        membershipMap.get(m.org_id)!.push(lName);
      }
    }

    const financialMap = new Map<string, { players: number | null; total_revenue: number | null }>();
    for (const f of financialResult.data || []) financialMap.set(f.org_id, { players: f.players, total_revenue: f.total_revenue });

    // Assemble
    const assembled: PipelineOrg[] = (orgResult.data || []).map((o) => {
      const fin = financialMap.get(o.id);
      return {
        id: o.id,
        name: o.name,
        website: o.website,
        org_type: typeMap.get(o.id) || [],
        partner_status: partnerMap.get(o.id) || null,
        outreach_status: outreachMap.get(o.id) || null,
        leagues: membershipMap.get(o.id) || [],
        players: fin?.players ?? null,
        total_revenue: fin?.total_revenue ?? null,
      };
    });

    setAllPartnerOrgs(assembled);
    setPipelineOrgs(assembled.filter((c) => c.partner_status != null));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateCell = async (id: string, field: string, value: string) => {
    if (field === "partner_status") {
      await supabase.schema('intel').from("partner_profile").delete().eq("org_id", id);
      if (value) {
        await supabase.schema('intel').from("partner_profile").insert({ org_id: id, partner_status: value });
      }
      setPipelineOrgs((prev) => prev.map((c) => (c.id === id ? { ...c, partner_status: value || null } : c)));
      setAllPartnerOrgs((prev) => prev.map((c) => (c.id === id ? { ...c, partner_status: value || null } : c)));
    } else if (field === "outreach_status") {
      await supabase.schema('crm').from("outreach").delete().eq("org_id", id);
      if (value) {
        await supabase.schema('crm').from("outreach").insert({ org_id: id, status: value });
      }
      setPipelineOrgs((prev) => prev.map((c) => (c.id === id ? { ...c, outreach_status: value || null } : c)));
      setAllPartnerOrgs((prev) => prev.map((c) => (c.id === id ? { ...c, outreach_status: value || null } : c)));
    } else {
      const { error } = await supabase.schema('core').from("organizations").update({ [field]: value || null }).eq("id", id);
      if (!error) {
        setPipelineOrgs((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value || null } : c)));
        setAllPartnerOrgs((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value || null } : c)));
      }
    }
  };

  const removeFromPipeline = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    await supabase.schema('intel').from("partner_profile").delete().in("org_id", ids);
    setPipelineOrgs((prev) => prev.filter((c) => !selected.has(c.id)));
    setAllPartnerOrgs((prev) => prev.map((c) => selected.has(c.id) ? { ...c, partner_status: null } : c));
    setSelected(new Set());
  };

  const removeOneFromPipeline = async (id: string) => {
    await supabase.schema('intel').from("partner_profile").delete().eq("org_id", id);
    setPipelineOrgs((prev) => prev.filter((c) => c.id !== id));
    setAllPartnerOrgs((prev) => prev.map((c) => c.id === id ? { ...c, partner_status: null } : c));
  };

  const deleteOne = async (id: string) => {
    await Promise.all([
      supabase.schema('core').from("org_types").delete().eq("org_id", id),
      supabase.schema('intel').from("partner_profile").delete().eq("org_id", id),
      supabase.schema('crm').from("outreach").delete().eq("org_id", id),
      supabase.schema('intel').from("org_financials").delete().eq("org_id", id),
      supabase.schema('platform').from("memberships").delete().eq("org_id", id),
      supabase.schema('platform').from("store").delete().eq("org_id", id),
      supabase.schema('core').from("relationships").delete().eq("org_id", id),
    ]);
    const { error } = await supabase.schema('core').from("organizations").delete().eq("id", id);
    if (!error) {
      setPipelineOrgs((prev) => prev.filter((c) => c.id !== id));
      setAllPartnerOrgs((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    await Promise.all([
      supabase.schema('core').from("org_types").delete().in("org_id", ids),
      supabase.schema('intel').from("partner_profile").delete().in("org_id", ids),
      supabase.schema('crm').from("outreach").delete().in("org_id", ids),
      supabase.schema('intel').from("org_financials").delete().in("org_id", ids),
      supabase.schema('platform').from("memberships").delete().in("org_id", ids),
      supabase.schema('platform').from("store").delete().in("org_id", ids),
      supabase.schema('core').from("relationships").delete().in("org_id", ids),
    ]);
    const { error } = await supabase.schema('core').from("organizations").delete().in("id", ids);
    if (!error) {
      setPipelineOrgs((prev) => prev.filter((c) => !selected.has(c.id)));
      setAllPartnerOrgs((prev) => prev.filter((c) => !selected.has(c.id)));
      setSelected(new Set());
    }
  };

  const bulkUpdate = async () => {
    if (!bulkField || selected.size === 0) return;
    const ids = Array.from(selected);
    if (bulkField === "partner_status") {
      await supabase.schema('intel').from("partner_profile").delete().in("org_id", ids);
      if (bulkValue) {
        await supabase.schema('intel').from("partner_profile").insert(ids.map((id) => ({ org_id: id, partner_status: bulkValue })));
      }
      setPipelineOrgs((prev) => prev.map((c) => selected.has(c.id) ? { ...c, partner_status: bulkValue || null } : c));
      setAllPartnerOrgs((prev) => prev.map((c) => selected.has(c.id) ? { ...c, partner_status: bulkValue || null } : c));
    } else if (bulkField === "outreach_status") {
      await supabase.schema('crm').from("outreach").delete().in("org_id", ids);
      if (bulkValue) {
        await supabase.schema('crm').from("outreach").insert(ids.map((id) => ({ org_id: id, status: bulkValue })));
      }
      setPipelineOrgs((prev) => prev.map((c) => selected.has(c.id) ? { ...c, outreach_status: bulkValue || null } : c));
      setAllPartnerOrgs((prev) => prev.map((c) => selected.has(c.id) ? { ...c, outreach_status: bulkValue || null } : c));
    }
    setSelected(new Set()); setShowBulk(false); setBulkField(""); setBulkValue("");
  };

  const addToPipeline = async () => {
    if (addSelected.size === 0) return;
    const ids = Array.from(addSelected);
    // Insert partner_profile with Prospect status
    await supabase.schema('intel').from("partner_profile").insert(ids.map((id) => ({ org_id: id, partner_status: "Prospect" })));
    setAllPartnerOrgs((prev) => prev.map((c) => addSelected.has(c.id) ? { ...c, partner_status: "Prospect" } : c));
    setPipelineOrgs((prev) => {
      const newOrgs = allPartnerOrgs.filter((c) => addSelected.has(c.id)).map((c) => ({ ...c, partner_status: "Prospect" }));
      return [...prev, ...newOrgs];
    });
    setAddSelected(new Set());
    setShowAddDialog(false);
    setAddSearch("");
  };

  const toggleSelect = (id: string) => { setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const toggleSelectAll = () => { if (selected.size === filtered.length) setSelected(new Set()); else setSelected(new Set(filtered.map((c) => c.id))); };

  const filtered = pipelineOrgs.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.name?.toLowerCase().includes(s) || c.org_type?.some((t) => t.toLowerCase().includes(s));
  });

  const notInPipeline = allPartnerOrgs.filter((c) => !c.partner_status);
  const filteredNotInPipeline = notInPipeline.filter((c) => {
    if (!addSearch) return true;
    const s = addSearch.toLowerCase();
    return c.name?.toLowerCase().includes(s) || c.org_type?.some((t) => t.toLowerCase().includes(s));
  });

  const handleDragStart = (e: React.DragEvent, id: string) => { setDraggedId(id); e.dataTransfer.effectAllowed = "move"; };
  const handleDrop = async (e: React.DragEvent, status: string) => {
    e.preventDefault();
    if (!draggedId) return;
    // Update partner_profile
    await supabase.schema('intel').from("partner_profile").delete().eq("org_id", draggedId);
    await supabase.schema('intel').from("partner_profile").insert({ org_id: draggedId, partner_status: status });
    setPipelineOrgs((prev) => prev.map((c) => (c.id === draggedId ? { ...c, partner_status: status } : c)));
    setAllPartnerOrgs((prev) => prev.map((c) => (c.id === draggedId ? { ...c, partner_status: status } : c)));
    setDraggedId(null);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };

  if (loading) return <div><div className="animate-pulse"><div className="flex gap-4">{[1,2,3,4].map((i) => <div key={i} className="h-96 bg-gray-200 rounded flex-1" />)}</div></div></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{labels.partnershipPipelinePageTitle}</h1>
          <p className="text-gray-500 text-sm mt-1">{pipelineOrgs.length} in pipeline · {notInPipeline.length} partner orgs not yet added</p>
        </div>
        <div className="flex gap-2">
          <Button variant={view === "kanban" ? "default" : "outline"} size="sm" onClick={() => setView("kanban")}><Columns3 className="h-4 w-4 mr-1" /> Kanban</Button>
          <Button variant={view === "table" ? "default" : "outline"} size="sm" onClick={() => setView("table")}><List className="h-4 w-4 mr-1" /> Table</Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Add to Pipeline</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Add Partner Orgs to Pipeline</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input placeholder="Search partner organizations..." value={addSearch} onChange={(e) => setAddSearch(e.target.value)} className="pl-9" />
                </div>
                <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                  {filteredNotInPipeline.length === 0 ? (
                    <div className="p-4 text-center text-gray-400 text-sm">
                      {notInPipeline.length === 0 ? "All partner orgs are already in the pipeline" : "No matching partner organizations"}
                    </div>
                  ) : (
                    filteredNotInPipeline.map((c) => (
                      <label key={c.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={addSelected.has(c.id)}
                          onChange={() => { setAddSelected((prev) => { const n = new Set(prev); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; }); }}
                          className="rounded border-gray-300"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{c.name}</div>
                          <div className="text-xs text-gray-500 truncate">
                            {[c.org_type?.join(", "), c.leagues.length > 0 ? c.leagues.join(", ") : null, c.players ? `${c.players} players` : null].filter(Boolean).join(" · ") || "No details"}
                          </div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
                {addSelected.size > 0 && (
                  <Button onClick={addToPipeline} className="w-full">
                    Add {addSelected.size} Org{addSelected.size > 1 ? "s" : ""} to Pipeline
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
              <DialogHeader><DialogTitle>Bulk Update {selected.size} Orgs</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><label className="text-xs text-gray-500">Field</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={bulkField} onChange={(e) => { setBulkField(e.target.value); setBulkValue(""); }}><option value="">Select...</option><option value="partner_status">Partner Status</option><option value="outreach_status">Outreach Status</option></select></div>
                {bulkField === "partner_status" && <div><label className="text-xs text-gray-500">Value</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}><option value="">---</option>{PARTNER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>}
                {bulkField === "outreach_status" && <div><label className="text-xs text-gray-500">Value</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}><option value="">---</option>{OUTREACH_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>}
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
                <div className={`rounded-t-lg px-3 py-2 ${STATUS_HEADER_COLORS[status]}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{status}</span>
                    <Badge variant="secondary" className="text-xs">{cards.length}</Badge>
                  </div>
                </div>
                <div className={`rounded-b-lg border-2 ${STATUS_COLORS[status]} min-h-[200px] p-2 space-y-2`}>
                  {cards.map((c) => (
                    <div key={c.id} draggable onDragStart={(e) => handleDragStart(e, c.id)} className="group bg-white rounded-lg border shadow-sm p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow relative">
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                        <button onClick={(e) => { e.stopPropagation(); removeOneFromPipeline(c.id); }} className="p-0.5 rounded hover:bg-orange-50 text-gray-300 hover:text-orange-500" title="Remove from pipeline"><X className="h-3.5 w-3.5" /></button>
                        <button onClick={(e) => { e.stopPropagation(); deleteOne(c.id); }} className="p-0.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500" title="Delete org"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                      <Link href={`/soccer-orgs/${c.id}`}><h3 className="text-sm font-medium text-gray-900 hover:text-blue-600 pr-10">{c.name}</h3></Link>
                      {c.org_type.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {c.org_type.map((t) => <Badge key={t} variant="outline" className="text-[9px] px-1 py-0">{t}</Badge>)}
                        </div>
                      )}
                      {c.leagues.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {c.leagues.slice(0, 3).map((l) => <Badge key={l} variant="secondary" className="text-[10px] px-1.5 py-0">{l}</Badge>)}
                          {c.leagues.length > 3 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">+{c.leagues.length - 3}</Badge>}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        {c.players != null && c.players > 0 && <span className="text-xs text-gray-400">{c.players} players</span>}
                        {c.outreach_status && c.outreach_status !== "Not Contacted" && <Badge variant="outline" className="text-xs">{c.outreach_status}</Badge>}
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
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Organization</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Types</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Players</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Revenue</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Partner Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Outreach</th>
                  <th className="w-10 px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className={`border-b hover:bg-gray-50 ${selected.has(c.id) ? "bg-blue-50" : ""}`}>
                    <td className="px-3 py-3"><button onClick={() => toggleSelect(c.id)}>{selected.has(c.id) ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-gray-300" />}</button></td>
                    <td className="px-4 py-2"><div className="flex items-center gap-2"><Link href={`/soccer-orgs/${c.id}`} className="text-blue-600 hover:underline shrink-0">↗</Link><EditableCell value={c.name} onSave={(v) => updateCell(c.id, "name", v)} /></div></td>
                    <td className="px-4 py-2 text-xs">{c.org_type.join(", ") || "—"}</td>
                    <td className="px-4 py-2 text-gray-600">{c.players ?? "—"}</td>
                    <td className="px-4 py-2 text-gray-600">{c.total_revenue ? `$${Number(c.total_revenue).toLocaleString()}` : "—"}</td>
                    <td className="px-4 py-2"><EditableCell value={c.partner_status} onSave={(v) => updateCell(c.id, "partner_status", v)} type="select" options={PARTNER_STATUSES} /></td>
                    <td className="px-4 py-2"><EditableCell value={c.outreach_status} onSave={(v) => updateCell(c.id, "outreach_status", v)} type="select" options={OUTREACH_STATUSES} /></td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button onClick={() => removeOneFromPipeline(c.id)} className="p-1 rounded hover:bg-orange-50 text-gray-300 hover:text-orange-500" title="Remove from pipeline"><X className="h-3.5 w-3.5" /></button>
                      <button onClick={() => deleteOne(c.id)} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                    </td>
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
