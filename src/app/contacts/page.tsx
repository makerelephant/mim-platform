"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EditableCell } from "@/components/EditableCell";
import { Avatar } from "@/components/Avatar";
import Link from "next/link";
import { labels } from "@/config/labels";
import { timeAgo } from "@/lib/timeAgo";
import { getGravatarUrl } from "@/lib/gravatar";
import { Search, X, ChevronUp, ChevronDown, Plus, Trash2, CheckSquare, Square, LayoutGrid, List } from "lucide-react";

interface InteractionInfo {
  date: string;
  subject: string | null;
  body: string | null;
}

interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  avatar_url: string | null;
  updated_at: string | null;
}

type SortField = "name" | "last_interaction";
type SortDir = "asc" | "desc";

/** Assemble full name from first + last */
function fullName(c: Contact): string {
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "(unnamed)";
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterHasEmail, setFilterHasEmail] = useState(false);
  const [filterHasPhone, setFilterHasPhone] = useState(false);
  const [sortField, setSortField] = useState<SortField>("last_interaction");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showNew, setShowNew] = useState(false);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRole, setNewRole] = useState("");
  const [bulkField, setBulkField] = useState("");
  const [bulkValue, setBulkValue] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [view, setView] = useState<"table" | "tiles">("table");

  // Last interaction map: contactId -> interaction info
  const [interactionMap, setInteractionMap] = useState<Map<string, InteractionInfo>>(new Map());
  // Org enhancement map: contactId -> org name from junction tables
  const [junctionOrgMap, setJunctionOrgMap] = useState<Map<string, string>>(new Map());

  // Column resize state
  const COL_KEYS = ["name", "organization", "email", "phone", "role", "last_interaction"] as const;
  const DEFAULT_WIDTHS: Record<string, number> = {
    name: 160, organization: 140, email: 170, phone: 110, role: 130, last_interaction: 170,
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
      .schema('core').from("contacts")
      .select("id, first_name, last_name, email, phone, role, avatar_url, updated_at")
      .order("first_name");
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

  // Load latest correspondence per contact (with subject + body preview)
  const loadLastInteractions = async (contactIds: string[]) => {
    if (contactIds.length === 0) return;
    const { data: interactions } = await supabase
      .schema('brain').from("correspondence")
      .select("entity_id, sent_at, subject, body")
      .eq("entity_type", "contacts")
      .in("entity_id", contactIds)
      .order("sent_at", { ascending: false });

    if (interactions) {
      const map = new Map<string, InteractionInfo>();
      for (const row of interactions) {
        if (row.entity_id && row.sent_at && !map.has(row.entity_id)) {
          map.set(row.entity_id, {
            date: row.sent_at,
            subject: row.subject || null,
            body: row.body || null,
          });
        }
      }
      setInteractionMap(map);
    }
  };

  // Load org names from core.relationships junction (same schema — embed works)
  const loadJunctionOrgs = async (contactIds: string[]) => {
    if (contactIds.length === 0) return;
    const map = new Map<string, string>();

    const { data: orgLinks } = await supabase
      .schema('core').from("relationships")
      .select("contact_id, organizations(name)")
      .in("contact_id", contactIds);

    if (orgLinks) {
      for (const link of orgLinks) {
        const org = link.organizations as unknown as { name: string } | null;
        if (org?.name && link.contact_id && !map.has(link.contact_id)) {
          map.set(link.contact_id, org.name);
        }
      }
    }

    setJunctionOrgMap(map);
  };

  useEffect(() => { loadContacts(); }, [loadContacts]);

  const updateCell = async (id: string, field: string, value: string) => {
    const { error } = await supabase.schema('core').from("contacts").update({ [field]: value || null }).eq("id", id);
    if (!error) {
      setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value || null, updated_at: new Date().toISOString() } : c)));
    }
  };

  const createContact = async () => {
    if (!newFirstName.trim()) return;
    const { data, error } = await supabase.schema('core').from("contacts").insert({
      first_name: newFirstName, last_name: newLastName || null,
      email: newEmail || null, phone: newPhone || null,
      role: newRole || null, source: "manual",
    }).select().single();
    if (!error && data) {
      setContacts((prev) => [...prev, data]);
      setNewFirstName(""); setNewLastName(""); setNewEmail(""); setNewPhone(""); setNewRole("");
      setShowNew(false);
    }
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await supabase.schema('core').from("contacts").delete().in("id", ids);
    if (!error) {
      setContacts((prev) => prev.filter((c) => !selected.has(c.id)));
      setSelected(new Set());
    }
  };

  const bulkUpdate = async () => {
    if (!bulkField || selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await supabase.schema('core').from("contacts").update({ [bulkField]: bulkValue || null }).in("id", ids);
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

  // Helper to get display org from junction
  const getDisplayOrg = (c: Contact): string | null => {
    return junctionOrgMap.get(c.id) || null;
  };

  const filtered = contacts
    .filter((c) => {
      if (search) {
        const s = search.toLowerCase();
        const name = fullName(c).toLowerCase();
        const org = (junctionOrgMap.get(c.id) || "").toLowerCase();
        if (!name.includes(s) && !org.includes(s) && !c.email?.toLowerCase().includes(s) && !c.role?.toLowerCase().includes(s)) return false;
      }
      if (filterHasEmail && !c.email) return false;
      if (filterHasPhone && !c.phone) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortField === "last_interaction") {
        const aT = interactionMap.get(a.id) ? new Date(interactionMap.get(a.id)!.date).getTime() : 0;
        const bT = interactionMap.get(b.id) ? new Date(interactionMap.get(b.id)!.date).getTime() : 0;
        return sortDir === "asc" ? aT - bT : bT - aT;
      }
      const aVal = fullName(a).toLowerCase();
      const bVal = fullName(b).toLowerCase();
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });

  const activeFilters = [filterHasEmail, filterHasPhone].filter(Boolean).length;

  if (loading) {
    return <div><div className="animate-pulse space-y-4"><div className="h-8 bg-gray-200 rounded w-48" /><div className="h-10 bg-gray-200 rounded" />{[1,2,3,4,5].map((i) => <div key={i} className="h-12 bg-gray-200 rounded" />)}</div></div>;
  }

  return (
    <div>
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
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-500">First Name *</label><Input value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} placeholder="First name" /></div>
                  <div><label className="text-xs text-gray-500">Last Name</label><Input value={newLastName} onChange={(e) => setNewLastName(e.target.value)} placeholder="Last name" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-500">Email</label><Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div>
                  <div><label className="text-xs text-gray-500">Phone</label><Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} /></div>
                </div>
                <div><label className="text-xs text-gray-500">Role / Title</label><Input value={newRole} onChange={(e) => setNewRole(e.target.value)} /></div>
                <Button onClick={createContact} className="w-full" disabled={!newFirstName.trim()}>Create Contact</Button>
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
                <div><label className="text-xs text-gray-500">Field to update</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={bulkField} onChange={(e) => { setBulkField(e.target.value); setBulkValue(""); }}><option value="">Select field...</option><option value="role">Role / Title</option><option value="phone">Phone</option></select></div>
                {bulkField && <div><label className="text-xs text-gray-500">New value</label><Input value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} /></div>}
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
          <Input placeholder="Search by name, organization, email, or role..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant={showFilters ? "default" : "outline"} onClick={() => setShowFilters(!showFilters)}>Filters {activeFilters > 0 && `(${activeFilters})`}</Button>
      </div>

      {showFilters && (
        <Card className="mb-4">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={filterHasEmail} onChange={(e) => setFilterHasEmail(e.target.checked)} />Has Email</label>
              <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={filterHasPhone} onChange={(e) => setFilterHasPhone(e.target.checked)} />Has Phone</label>
              <Button variant="ghost" size="sm" onClick={() => { setFilterHasEmail(false); setFilterHasPhone(false); }}><X className="h-3 w-3 mr-1" /> Clear</Button>
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
                  <Avatar src={c.avatar_url || getGravatarUrl(c.email)} name={fullName(c)} size="lg" />
                  <div className="min-w-0 w-full">
                    <p className="text-sm font-medium text-gray-900 truncate">{fullName(c)}</p>
                    {c.email && <p className="text-xs text-gray-500 truncate">{c.email}</p>}
                    {c.role && <p className="text-xs text-gray-400 truncate mt-0.5">{c.role}</p>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="text-sm w-full" style={{ tableLayout: "fixed" }}>
              {(() => { const tw = COL_KEYS.reduce((s, k) => s + colWidths[k], 0) + 76; const p = (w: number) => `${((w / tw) * 100).toFixed(1)}%`; return (
              <colgroup>
                <col style={{ width: p(40) }} />
                <col style={{ width: p(36) }} />
                {COL_KEYS.map((k) => <col key={k} style={{ width: p(colWidths[k]) }} />)}
              </colgroup>
              ); })()}
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-3 py-3"><button onClick={toggleSelectAll}>{selected.size === filtered.length && filtered.length > 0 ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-gray-300" />}</button></th>
                  <th className="px-2 py-3"></th>
                  <th className="text-left px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide relative whitespace-nowrap overflow-hidden cursor-pointer" onClick={() => toggleSort("name")}>
                    <span className="flex items-center gap-1">Name <SortIcon field="name" /></span>
                    <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-500" onMouseDown={(e) => startResize("name", e)} />
                  </th>
                  <th className="text-left px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide relative whitespace-nowrap overflow-hidden">
                    Organization
                    <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-500" onMouseDown={(e) => startResize("organization", e)} />
                  </th>
                  <th className="text-left px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide relative whitespace-nowrap overflow-hidden">
                    Email
                    <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-500" onMouseDown={(e) => startResize("email", e)} />
                  </th>
                  <th className="text-left px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide relative whitespace-nowrap overflow-hidden">
                    Phone
                    <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-500" onMouseDown={(e) => startResize("phone", e)} />
                  </th>
                  <th className="text-left px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide relative whitespace-nowrap overflow-hidden">
                    Role
                    <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-500" onMouseDown={(e) => startResize("role", e)} />
                  </th>
                  <th className="text-left px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide relative whitespace-nowrap overflow-hidden cursor-pointer" onClick={() => toggleSort("last_interaction")}>
                    <span className="flex items-center gap-1">{labels.contactLastInteraction} <SortIcon field="last_interaction" /></span>
                    <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-500" onMouseDown={(e) => startResize("last_interaction", e)} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const displayOrg = getDisplayOrg(c);
                  const interaction = interactionMap.get(c.id);
                  return (
                    <tr key={c.id} className={`border-b hover:bg-gray-50 ${selected.has(c.id) ? "bg-blue-50" : ""}`}>
                      <td className="px-3 py-2"><button onClick={() => toggleSelect(c.id)}>{selected.has(c.id) ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-gray-300" />}</button></td>
                      <td className="px-2 py-2"><Avatar src={c.avatar_url || getGravatarUrl(c.email)} name={fullName(c)} size="sm" /></td>
                      <td className="px-3 py-2 overflow-hidden">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Link href={`/contacts/${c.id}`} className="text-blue-600 hover:underline shrink-0 text-xs">↗</Link>
                          <div className="min-w-0 flex-1">
                            <EditableCell value={fullName(c)} onSave={async (v) => {
                              const parts = v.split(" ");
                              const first = parts[0] || "";
                              const last = parts.slice(1).join(" ") || "";
                              await updateCell(c.id, "first_name", first);
                              if (last) await updateCell(c.id, "last_name", last);
                            }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 overflow-hidden">
                        {displayOrg ? (
                          <span className="text-xs text-gray-500 truncate block">{displayOrg}</span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 overflow-hidden"><EditableCell value={c.email} onSave={(v) => updateCell(c.id, "email", v)} /></td>
                      <td className="px-3 py-2 overflow-hidden"><EditableCell value={c.phone} onSave={(v) => updateCell(c.id, "phone", v)} /></td>
                      <td className="px-3 py-2 overflow-hidden"><EditableCell value={c.role} onSave={(v) => updateCell(c.id, "role", v)} /></td>
                      <td className="px-3 py-2 overflow-hidden">
                        {interaction ? (
                          <div title={`${interaction.subject || "(no subject)"}\n${interaction.body || ""}`}>
                            <p className="text-xs text-gray-600 truncate leading-snug">{interaction.subject || "(no subject)"}</p>
                            {interaction.body && <p className="text-[11px] text-gray-400 truncate leading-snug">{interaction.body}</p>}
                            <span className="text-[10px] text-gray-300">{timeAgo(interaction.date)}</span>
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
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
