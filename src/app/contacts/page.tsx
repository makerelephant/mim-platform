"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EditableCell } from "@/components/EditableCell";
import { Avatar } from "@/components/Avatar";
import Link from "next/link";
import { labels } from "@/config/labels";
import { timeAgo } from "@/lib/timeAgo";
import { Search, X, ChevronUp, ChevronDown, Plus, Trash2, CheckSquare, Square, LayoutGrid, List } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  organization: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  segment: string | null;
  primary_category: string | null;
  subcategory: string | null;
  region: string | null;
  avatar_url: string | null;
  updated_at: string | null;
}

type SortField = "name" | "segment" | "primary_category" | "region" | "last_interaction";
type SortDir = "asc" | "desc";

const SEGMENTS = ["Youth Soccer", "Investor", "Employee", "Vendor", "Partner", "Other"];
const CATEGORIES = ["Youth Sports", "MiM", "Eleph Digital"];

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSegment, setFilterSegment] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterRegion, setFilterRegion] = useState("");
  const [filterHasEmail, setFilterHasEmail] = useState(false);
  const [filterHasPhone, setFilterHasPhone] = useState(false);
  const [sortField, setSortField] = useState<SortField>("last_interaction");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newSegment, setNewSegment] = useState("");
  const [newOrg, setNewOrg] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [bulkField, setBulkField] = useState("");
  const [bulkValue, setBulkValue] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [view, setView] = useState<"table" | "tiles">("table");

  // Last interaction map: contactId -> latest date string
  const [interactionMap, setInteractionMap] = useState<Map<string, string>>(new Map());
  // Org enhancement map: contactId -> org name from junction tables
  const [junctionOrgMap, setJunctionOrgMap] = useState<Map<string, string>>(new Map());

  // Column resize state
  const COL_KEYS = ["name", "organization", "email", "phone", "title", "segment", "category", "last_interaction"] as const;
  const DEFAULT_WIDTHS: Record<string, number> = {
    name: 160, organization: 140, email: 170, phone: 110, title: 130, segment: 110, category: 110, last_interaction: 110,
  };
  const [colWidths, setColWidths] = useState<Record<string, number>>(DEFAULT_WIDTHS);
  const dragRef = useRef<{ col: string; startX: number; startW: number } | null>(null);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const diff = e.clientX - dragRef.current.startX;
      const newW = Math.max(60, dragRef.current.startW + diff);
      setColWidths((prev) => ({ ...prev, [dragRef.current!.col]: newW }));
    };
    const onMouseUp = () => { dragRef.current = null; document.body.style.cursor = ""; document.body.style.userSelect = ""; };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
  }, []);

  const startResize = (col: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { col, startX: e.clientX, startW: colWidths[col] };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const loadContacts = useCallback(async () => {
    const { data } = await supabase
      .from("contacts")
      .select("id, name, organization, email, phone, title, segment, primary_category, subcategory, region, avatar_url, updated_at")
      .order("name");
    if (data) {
      setContacts(data);
      // Load last interaction and org junction data
      const contactIds = data.map((c: Contact) => c.id);
      await Promise.all([
        loadLastInteractions(contactIds),
        loadJunctionOrgs(contactIds),
      ]);
    }
    setLoading(false);
  }, []);

  // Load latest correspondence date per contact
  const loadLastInteractions = async (contactIds: string[]) => {
    if (contactIds.length === 0) return;
    const { data: interactions } = await supabase
      .from("correspondence")
      .select("entity_id, date")
      .eq("entity_type", "contacts")
      .in("entity_id", contactIds)
      .order("date", { ascending: false });

    if (interactions) {
      const map = new Map<string, string>();
      for (const row of interactions) {
        // Take first occurrence per entity_id (most recent since sorted DESC)
        if (row.entity_id && row.date && !map.has(row.entity_id)) {
          map.set(row.entity_id, row.date);
        }
      }
      setInteractionMap(map);
    }
  };

  // Load org names from junction tables for contacts with empty org
  const loadJunctionOrgs = async (contactIds: string[]) => {
    if (contactIds.length === 0) return;
    const map = new Map<string, string>();

    // Soccer org contacts
    const { data: soccerLinks } = await supabase
      .from("soccer_org_contacts")
      .select("contact_id, soccer_orgs(org_name)")
      .in("contact_id", contactIds);

    if (soccerLinks) {
      for (const link of soccerLinks) {
        const org = link.soccer_orgs as unknown as { org_name: string } | null;
        if (org?.org_name && link.contact_id && !map.has(link.contact_id)) {
          map.set(link.contact_id, org.org_name);
        }
      }
    }

    // Investor contacts
    const { data: investorLinks } = await supabase
      .from("investor_contacts")
      .select("contact_id, investors(firm_name)")
      .in("contact_id", contactIds);

    if (investorLinks) {
      for (const link of investorLinks) {
        const inv = link.investors as unknown as { firm_name: string } | null;
        if (inv?.firm_name && link.contact_id && !map.has(link.contact_id)) {
          map.set(link.contact_id, inv.firm_name);
        }
      }
    }

    setJunctionOrgMap(map);
  };

  useEffect(() => { loadContacts(); }, [loadContacts]);

  const updateCell = async (id: string, field: string, value: string) => {
    const { error } = await supabase.from("contacts").update({ [field]: value || null }).eq("id", id);
    if (!error) {
      setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value || null, updated_at: new Date().toISOString() } : c)));
    }
  };

  const createContact = async () => {
    if (!newName.trim()) return;
    const { data, error } = await supabase.from("contacts").insert({
      name: newName, organization: newOrg || null, email: newEmail || null, phone: newPhone || null,
      title: newTitle || null, segment: newSegment || null,
      primary_category: newCategory || null, source: "manual",
    }).select().single();
    if (!error && data) {
      setContacts((prev) => [...prev, data]);
      setNewName(""); setNewOrg(""); setNewEmail(""); setNewPhone(""); setNewTitle(""); setNewSegment(""); setNewCategory("");
      setShowNew(false);
    }
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from("contacts").delete().in("id", ids);
    if (!error) {
      setContacts((prev) => prev.filter((c) => !selected.has(c.id)));
      setSelected(new Set());
    }
  };

  const bulkUpdate = async () => {
    if (!bulkField || selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from("contacts").update({ [bulkField]: bulkValue || null }).in("id", ids);
    if (!error) {
      setContacts((prev) => prev.map((c) => selected.has(c.id) ? { ...c, [bulkField]: bulkValue || null } : c));
      setSelected(new Set()); setShowBulk(false); setBulkField(""); setBulkValue("");
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((c) => c.id)));
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  // Helper to get display org: own org or junction org
  const getDisplayOrg = (c: Contact): string | null => {
    return c.organization || junctionOrgMap.get(c.id) || null;
  };

  const segments = [...new Set(contacts.map((c) => c.segment).filter(Boolean))] as string[];
  const categories = [...new Set(contacts.map((c) => c.primary_category).filter(Boolean))] as string[];

  const filtered = contacts
    .filter((c) => {
      if (search) { const s = search.toLowerCase(); if (!c.name?.toLowerCase().includes(s) && !c.organization?.toLowerCase().includes(s) && !c.email?.toLowerCase().includes(s) && !c.title?.toLowerCase().includes(s)) return false; }
      if (filterSegment && c.segment !== filterSegment) return false;
      if (filterCategory && c.primary_category !== filterCategory) return false;
      if (filterRegion && c.region !== filterRegion) return false;
      if (filterHasEmail && !c.email) return false;
      if (filterHasPhone && !c.phone) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortField === "last_interaction") {
        const aT = interactionMap.get(a.id) ? new Date(interactionMap.get(a.id)!).getTime() : 0;
        const bT = interactionMap.get(b.id) ? new Date(interactionMap.get(b.id)!).getTime() : 0;
        return sortDir === "asc" ? aT - bT : bT - aT;
      }
      const aVal = (a[sortField] || "").toLowerCase();
      const bVal = (b[sortField] || "").toLowerCase();
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });

  const activeFilters = [filterSegment, filterCategory, filterRegion, filterHasEmail, filterHasPhone].filter(Boolean).length;

  if (loading) {
    return <div className="p-8"><div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-48" /><div className="h-10 bg-gray-200 rounded" />{[1,2,3,4,5].map((i) => <div key={i} className="h-12 bg-gray-200 rounded" />)}</div></div>;
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{labels.contactsPageTitle}</h1>
          <p className="text-gray-500 text-sm mt-1">{filtered.length} of {contacts.length} contacts</p>
        </div>
        <div className="flex gap-2">
          <Button variant={view === "tiles" ? "default" : "outline"} size="sm" onClick={() => setView("tiles")}><LayoutGrid className="h-4 w-4 mr-1" /> Tiles</Button>
          <Button variant={view === "table" ? "default" : "outline"} size="sm" onClick={() => setView("table")}><List className="h-4 w-4 mr-1" /> Table</Button>
          <Dialog open={showNew} onOpenChange={setShowNew}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add Contact</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Contact</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><label className="text-xs text-gray-500">Name *</label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name" /></div>
                <div><label className="text-xs text-gray-500">Organization</label><Input value={newOrg} onChange={(e) => setNewOrg(e.target.value)} placeholder="Company or org name" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-500">Email</label><Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div>
                  <div><label className="text-xs text-gray-500">Phone</label><Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} /></div>
                </div>
                <div><label className="text-xs text-gray-500">Title</label><Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-500">Segment</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={newSegment} onChange={(e) => setNewSegment(e.target.value)}><option value="">—</option>{SEGMENTS.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
                  <div><label className="text-xs text-gray-500">Category</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={newCategory} onChange={(e) => setNewCategory(e.target.value)}><option value="">—</option>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
                </div>
                <Button onClick={createContact} className="w-full" disabled={!newName.trim()}>Create Contact</Button>
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
              <DialogHeader><DialogTitle>Bulk Update {selected.size} Contacts</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><label className="text-xs text-gray-500">Field to update</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={bulkField} onChange={(e) => { setBulkField(e.target.value); setBulkValue(""); }}><option value="">Select field...</option><option value="organization">Organization</option><option value="segment">Segment</option><option value="primary_category">Category</option><option value="region">Region</option><option value="title">Title</option></select></div>
                {bulkField === "segment" && <div><label className="text-xs text-gray-500">New value</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}><option value="">—</option>{SEGMENTS.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>}
                {bulkField === "primary_category" && <div><label className="text-xs text-gray-500">New value</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}><option value="">—</option>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>}
                {bulkField && bulkField !== "segment" && bulkField !== "primary_category" && <div><label className="text-xs text-gray-500">New value</label><Input value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} /></div>}
                <Button onClick={bulkUpdate} className="w-full" disabled={!bulkField}>Update {selected.size} Records</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button size="sm" variant="destructive" onClick={deleteSelected}><Trash2 className="h-3 w-3 mr-1" /> Delete</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search by name, organization, email, or title..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant={showFilters ? "default" : "outline"} onClick={() => setShowFilters(!showFilters)}>Filters {activeFilters > 0 && `(${activeFilters})`}</Button>
      </div>

      {showFilters && (
        <Card className="mb-4">
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div><label className="text-xs font-medium text-gray-500 mb-1 block">Segment</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={filterSegment} onChange={(e) => setFilterSegment(e.target.value)}><option value="">All</option>{segments.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
              <div><label className="text-xs font-medium text-gray-500 mb-1 block">Category</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}><option value="">All</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
              <div><label className="text-xs font-medium text-gray-500 mb-1 block">Region</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)}><option value="">All</option><option value="Massachusetts">Massachusetts</option></select></div>
              <div className="flex items-end gap-3"><label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={filterHasEmail} onChange={(e) => setFilterHasEmail(e.target.checked)} />Has Email</label><label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={filterHasPhone} onChange={(e) => setFilterHasPhone(e.target.checked)} />Has Phone</label></div>
              <div className="flex items-end"><Button variant="ghost" size="sm" onClick={() => { setFilterSegment(""); setFilterCategory(""); setFilterRegion(""); setFilterHasEmail(false); setFilterHasPhone(false); }}><X className="h-3 w-3 mr-1" /> Clear</Button></div>
            </div>
          </CardContent>
        </Card>
      )}

      {view === "tiles" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filtered.map((c) => (
            <Link key={c.id} href={`/contacts/${c.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                  <Avatar src={c.avatar_url} name={c.name} size="lg" />
                  <div className="min-w-0 w-full">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                    {c.email && <p className="text-xs text-gray-500 truncate">{c.email}</p>}
                    {c.primary_category && (
                      <Badge variant="secondary" className="text-xs mt-1">{c.primary_category}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="text-sm" style={{ tableLayout: "fixed", width: 40 + 40 + COL_KEYS.reduce((s, k) => s + colWidths[k], 0) }}>
              <colgroup>
                <col style={{ width: 40 }} />
                <col style={{ width: 40 }} />
                {COL_KEYS.map((k) => <col key={k} style={{ width: colWidths[k] }} />)}
              </colgroup>
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-3 py-3"><button onClick={toggleSelectAll}>{selected.size === filtered.length && filtered.length > 0 ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-gray-300" />}</button></th>
                  <th className="px-2 py-3"></th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 relative cursor-pointer" onClick={() => toggleSort("name")}>
                    <span className="flex items-center gap-1">Name <SortIcon field="name" /></span>
                    <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-500" onMouseDown={(e) => startResize("name", e)} />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 relative">
                    Organization
                    <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-500" onMouseDown={(e) => startResize("organization", e)} />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 relative">
                    Email
                    <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-500" onMouseDown={(e) => startResize("email", e)} />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 relative">
                    Phone
                    <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-500" onMouseDown={(e) => startResize("phone", e)} />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 relative">
                    Title
                    <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-500" onMouseDown={(e) => startResize("title", e)} />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 relative cursor-pointer" onClick={() => toggleSort("segment")}>
                    <span className="flex items-center gap-1">Segment <SortIcon field="segment" /></span>
                    <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-500" onMouseDown={(e) => startResize("segment", e)} />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 relative cursor-pointer" onClick={() => toggleSort("primary_category")}>
                    <span className="flex items-center gap-1">Category <SortIcon field="primary_category" /></span>
                    <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-500" onMouseDown={(e) => startResize("category", e)} />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 relative cursor-pointer" onClick={() => toggleSort("last_interaction")}>
                    <span className="flex items-center gap-1">{labels.contactLastInteraction} <SortIcon field="last_interaction" /></span>
                    <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-500" onMouseDown={(e) => startResize("last_interaction", e)} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const displayOrg = getDisplayOrg(c);
                  const isJunctionOrg = !c.organization && junctionOrgMap.has(c.id);
                  const lastInteraction = interactionMap.get(c.id);
                  return (
                    <tr key={c.id} className={`border-b hover:bg-gray-50 ${selected.has(c.id) ? "bg-blue-50" : ""}`}>
                      <td className="px-3 py-3"><button onClick={() => toggleSelect(c.id)}>{selected.has(c.id) ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-gray-300" />}</button></td>
                      <td className="px-2 py-2"><Avatar src={c.avatar_url} name={c.name} size="sm" /></td>
                      <td className="px-4 py-2 overflow-hidden">
                        <div className="flex items-center gap-2">
                          <Link href={`/contacts/${c.id}`} className="text-blue-600 hover:underline font-medium shrink-0">↗</Link>
                          <EditableCell value={c.name} onSave={(v) => updateCell(c.id, "name", v)} />
                        </div>
                      </td>
                      <td className="px-4 py-2 overflow-hidden">
                        {c.organization ? (
                          <EditableCell value={c.organization} onSave={(v) => updateCell(c.id, "organization", v)} />
                        ) : isJunctionOrg ? (
                          <span className="text-xs text-gray-400 italic">{displayOrg}</span>
                        ) : (
                          <EditableCell value={null} onSave={(v) => updateCell(c.id, "organization", v)} />
                        )}
                      </td>
                      <td className="px-4 py-2 overflow-hidden"><EditableCell value={c.email} onSave={(v) => updateCell(c.id, "email", v)} /></td>
                      <td className="px-4 py-2 overflow-hidden"><EditableCell value={c.phone} onSave={(v) => updateCell(c.id, "phone", v)} /></td>
                      <td className="px-4 py-2 overflow-hidden"><EditableCell value={c.title} onSave={(v) => updateCell(c.id, "title", v)} /></td>
                      <td className="px-4 py-2 overflow-hidden"><EditableCell value={c.segment} onSave={(v) => updateCell(c.id, "segment", v)} type="select" options={SEGMENTS} /></td>
                      <td className="px-4 py-2 overflow-hidden"><EditableCell value={c.primary_category} onSave={(v) => updateCell(c.id, "primary_category", v)} type="select" options={CATEGORIES} /></td>
                      <td className="px-4 py-2 overflow-hidden text-gray-400 text-xs whitespace-nowrap">
                        {lastInteraction ? timeAgo(lastInteraction) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
