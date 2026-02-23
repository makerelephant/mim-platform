"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EditableCell } from "@/components/EditableCell";
import { Search, Plus, Trash2, CheckSquare, Square, X, Clock, AlertCircle, CheckCircle2, XCircle } from "lucide-react";

interface SupportIssue {
  id: string;
  subject: string;
  description: string | null;
  submitter_name: string | null;
  submitter_email: string | null;
  category: string | null;
  priority: string | null;
  status: string | null;
  assigned_to: string | null;
  resolution: string | null;
  source: string | null;
  created_at: string | null;
  updated_at: string | null;
}

const STATUSES = ["Open", "In Progress", "Waiting", "Resolved", "Closed"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const CATEGORIES = ["Bug", "Feature Request", "Account", "Billing", "General", "Technical"];

const STATUS_COLORS: Record<string, string> = {
  Open: "bg-blue-100 text-blue-800",
  "In Progress": "bg-yellow-100 text-yellow-800",
  Waiting: "bg-orange-100 text-orange-800",
  Resolved: "bg-green-100 text-green-800",
  Closed: "bg-gray-100 text-gray-700",
};

const PRIORITY_COLORS: Record<string, string> = {
  Low: "bg-gray-100 text-gray-700",
  Medium: "bg-blue-100 text-blue-800",
  High: "bg-orange-100 text-orange-800",
  Urgent: "bg-red-100 text-red-800",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  Open: <AlertCircle className="h-3.5 w-3.5" />,
  "In Progress": <Clock className="h-3.5 w-3.5" />,
  Waiting: <Clock className="h-3.5 w-3.5" />,
  Resolved: <CheckCircle2 className="h-3.5 w-3.5" />,
  Closed: <XCircle className="h-3.5 w-3.5" />,
};

export default function SupportIssuesPage() {
  const [issues, setIssues] = useState<SupportIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showNew, setShowNew] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newPriority, setNewPriority] = useState("Medium");
  const [showBulk, setShowBulk] = useState(false);
  const [bulkField, setBulkField] = useState("");
  const [bulkValue, setBulkValue] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("support_issues").select("*").order("created_at", { ascending: false });
    if (data) setIssues(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateCell = async (id: string, field: string, value: string) => {
    const { error } = await supabase.from("support_issues").update({ [field]: value || null, updated_at: new Date().toISOString() }).eq("id", id);
    if (!error) setIssues((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value || null, updated_at: new Date().toISOString() } : i)));
  };

  const createIssue = async () => {
    if (!newSubject.trim()) return;
    const { data, error } = await supabase.from("support_issues").insert({
      subject: newSubject,
      description: newDescription || null,
      submitter_name: newName || null,
      submitter_email: newEmail || null,
      category: newCategory || null,
      priority: newPriority || "Medium",
      source: "manual",
    }).select().single();
    if (!error && data) {
      setIssues((prev) => [data, ...prev]);
      setNewSubject(""); setNewDescription(""); setNewName(""); setNewEmail(""); setNewCategory(""); setNewPriority("Medium");
      setShowNew(false);
    }
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    const { error } = await supabase.from("support_issues").delete().in("id", Array.from(selected));
    if (!error) { setIssues((prev) => prev.filter((i) => !selected.has(i.id))); setSelected(new Set()); }
  };

  const bulkUpdate = async () => {
    if (!bulkField || selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from("support_issues").update({ [bulkField]: bulkValue || null, updated_at: new Date().toISOString() }).in("id", ids);
    if (!error) {
      setIssues((prev) => prev.map((i) => selected.has(i.id) ? { ...i, [bulkField]: bulkValue || null } : i));
      setSelected(new Set()); setShowBulk(false); setBulkField(""); setBulkValue("");
    }
  };

  const toggleSelect = (id: string) => { setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const toggleSelectAll = () => { if (selected.size === filtered.length) setSelected(new Set()); else setSelected(new Set(filtered.map((i) => i.id))); };

  const filtered = issues.filter((i) => {
    if (search) {
      const s = search.toLowerCase();
      if (!i.subject?.toLowerCase().includes(s) && !i.submitter_name?.toLowerCase().includes(s) && !i.submitter_email?.toLowerCase().includes(s) && !i.description?.toLowerCase().includes(s)) return false;
    }
    if (filterStatus && i.status !== filterStatus) return false;
    if (filterPriority && i.priority !== filterPriority) return false;
    if (filterCategory && i.category !== filterCategory) return false;
    return true;
  });

  const openCount = issues.filter((i) => i.status === "Open").length;
  const inProgressCount = issues.filter((i) => i.status === "In Progress").length;
  const activeFilters = [filterStatus, filterPriority, filterCategory].filter(Boolean).length;

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  };

  if (loading) return <div className="p-8"><div className="animate-pulse h-64 bg-gray-200 rounded" /></div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support Issues</h1>
          <p className="text-gray-500 text-sm mt-1">
            {filtered.length} of {issues.length} issues · {openCount} open · {inProgressCount} in progress
          </p>
        </div>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New Issue</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New Support Issue</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><label className="text-xs text-gray-500">Subject *</label><Input value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="Brief summary of the issue" /></div>
              <div><label className="text-xs text-gray-500">Description</label><Textarea rows={3} value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Detailed description..." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500">Submitter Name</label><Input value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
                <div><label className="text-xs text-gray-500">Submitter Email</label><Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} type="email" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500">Category</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={newCategory} onChange={(e) => setNewCategory(e.target.value)}><option value="">—</option>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
                <div><label className="text-xs text-gray-500">Priority</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={newPriority} onChange={(e) => setNewPriority(e.target.value)}>{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
              </div>
              <Button onClick={createIssue} className="w-full" disabled={!newSubject.trim()}>Create Issue</Button>
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
              <DialogHeader><DialogTitle>Bulk Update {selected.size} Issues</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><label className="text-xs text-gray-500">Field</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={bulkField} onChange={(e) => { setBulkField(e.target.value); setBulkValue(""); }}><option value="">Select...</option><option value="status">Status</option><option value="priority">Priority</option><option value="category">Category</option><option value="assigned_to">Assigned To</option></select></div>
                {bulkField === "status" && <div><label className="text-xs text-gray-500">Value</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}><option value="">—</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>}
                {bulkField === "priority" && <div><label className="text-xs text-gray-500">Value</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}><option value="">—</option>{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>}
                {bulkField === "category" && <div><label className="text-xs text-gray-500">Value</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}><option value="">—</option>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>}
                {bulkField && !["status", "priority", "category"].includes(bulkField) && <div><label className="text-xs text-gray-500">Value</label><Input value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} /></div>}
                <Button onClick={bulkUpdate} className="w-full" disabled={!bulkField}>Update {selected.size} Records</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button size="sm" variant="destructive" onClick={deleteSelected}><Trash2 className="h-3 w-3 mr-1" /> Delete</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="Search issues..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
        <Button variant={showFilters ? "default" : "outline"} onClick={() => setShowFilters(!showFilters)}>Filters {activeFilters > 0 && `(${activeFilters})`}</Button>
      </div>

      {showFilters && (
        <Card className="mb-4"><CardContent className="pt-4 pb-4"><div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="text-xs font-medium text-gray-500 mb-1 block">Status</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}><option value="">All</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
          <div><label className="text-xs font-medium text-gray-500 mb-1 block">Priority</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}><option value="">All</option>{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
          <div><label className="text-xs font-medium text-gray-500 mb-1 block">Category</label><select className="w-full border rounded-md px-2 py-1.5 text-sm" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}><option value="">All</option>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <div className="flex items-end"><Button variant="ghost" size="sm" onClick={() => { setFilterStatus(""); setFilterPriority(""); setFilterCategory(""); }}><X className="h-3 w-3 mr-1" /> Clear</Button></div>
        </div></CardContent></Card>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="w-10 px-3 py-3"><button onClick={toggleSelectAll}>{selected.size === filtered.length && filtered.length > 0 ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-gray-300" />}</button></th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Subject</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Submitter</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Category</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Priority</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Assigned To</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((issue) => (
                <>
                  <tr key={issue.id} className={`border-b hover:bg-gray-50 cursor-pointer ${selected.has(issue.id) ? "bg-blue-50" : ""}`} onClick={() => setExpandedId(expandedId === issue.id ? null : issue.id)}>
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}><button onClick={() => toggleSelect(issue.id)}>{selected.has(issue.id) ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-gray-300" />}</button></td>
                    <td className="px-4 py-2 font-medium">{issue.subject}</td>
                    <td className="px-4 py-2">
                      <div>
                        {issue.submitter_name && <span className="block text-sm">{issue.submitter_name}</span>}
                        {issue.submitter_email && <span className="block text-xs text-gray-400">{issue.submitter_email}</span>}
                        {!issue.submitter_name && !issue.submitter_email && <span className="text-gray-300">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}><EditableCell value={issue.category} onSave={(v) => updateCell(issue.id, "category", v)} type="select" options={CATEGORIES} /></td>
                    <td className="px-4 py-2">
                      {issue.priority ? (
                        <Badge className={`text-xs ${PRIORITY_COLORS[issue.priority] || ""}`}>{issue.priority}</Badge>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2">
                      {issue.status ? (
                        <Badge className={`text-xs inline-flex items-center gap-1 ${STATUS_COLORS[issue.status] || ""}`}>
                          {STATUS_ICONS[issue.status]} {issue.status}
                        </Badge>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}><EditableCell value={issue.assigned_to} onSave={(v) => updateCell(issue.id, "assigned_to", v)} /></td>
                    <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">{formatDate(issue.created_at)}</td>
                  </tr>
                  {expandedId === issue.id && (
                    <tr key={`${issue.id}-detail`} className="bg-gray-50 border-b">
                      <td colSpan={8} className="px-8 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Description</label>
                            <div onClick={(e) => e.stopPropagation()}>
                              <EditableCell value={issue.description} onSave={(v) => updateCell(issue.id, "description", v)} placeholder="No description" />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Resolution</label>
                            <div onClick={(e) => e.stopPropagation()}>
                              <EditableCell value={issue.resolution} onSave={(v) => updateCell(issue.id, "resolution", v)} placeholder="No resolution yet" />
                            </div>
                          </div>
                          <div className="flex gap-4" onClick={(e) => e.stopPropagation()}>
                            <div>
                              <label className="text-xs text-gray-500 block mb-1">Status</label>
                              <EditableCell value={issue.status} onSave={(v) => updateCell(issue.id, "status", v)} type="select" options={STATUSES} />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 block mb-1">Priority</label>
                              <EditableCell value={issue.priority} onSave={(v) => updateCell(issue.id, "priority", v)} type="select" options={PRIORITIES} />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 block mb-1">Source</label>
                              <span className="text-sm text-gray-600">{issue.source || "—"}</span>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Submitter</label>
                            <div className="flex gap-4" onClick={(e) => e.stopPropagation()}>
                              <div><span className="text-xs text-gray-400">Name: </span><EditableCell value={issue.submitter_name} onSave={(v) => updateCell(issue.id, "submitter_name", v)} /></div>
                              <div><span className="text-xs text-gray-400">Email: </span><EditableCell value={issue.submitter_email} onSave={(v) => updateCell(issue.id, "submitter_email", v)} /></div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">No support issues found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
