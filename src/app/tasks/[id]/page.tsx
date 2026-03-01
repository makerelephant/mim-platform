"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EntityLinker } from "@/components/EntityLinker";
import { CorrespondenceSection } from "@/components/CorrespondenceSection";
import { labels } from "@/config/labels";
import {
  ArrowLeft,
  Save,
  X,
  Check,
  Circle,
  Clock,
  AlertCircle,
  Target,
  Users,
  TrendingUp,
  Building2,
  Star,
} from "lucide-react";
import Link from "next/link";

/* ── Types ── */

interface Task {
  id: string;
  title: string;
  description: string | null;
  summary: string | null;
  recommended_action: string | null;
  entity_type: string | null;
  entity_id: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  assigned_to: string | null;
  source: string | null;
  goal_relevance_score: number | null;
  goal_relevance_note: string | null;
  gmail_thread_id: string | null;
  gmail_message_id: string | null;
  is_starred: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface RelatedTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
}

interface LinkedContact {
  contact_id: string;
  role: string | null;
  contacts: { id: string; name: string; email: string | null; title: string | null };
}

interface LinkedInvestor {
  investor_id: string;
  role: string | null;
  investors: { id: string; firm_name: string; investor_type: string | null };
}

interface LinkedSoccerOrg {
  soccer_org_id: string;
  role: string | null;
  soccer_orgs: { id: string; team_name: string; league: string | null };
}

/* ── Constants ── */

const PRIORITY_OPTIONS = ["low", "medium", "high", "critical"];
const STATUS_OPTIONS = ["todo", "in_progress", "done", "blocked"];

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  todo: <Circle className="h-4 w-4 text-gray-400" />,
  in_progress: <Clock className="h-4 w-4 text-blue-500" />,
  done: <Check className="h-4 w-4 text-green-500" />,
  blocked: <AlertCircle className="h-4 w-4 text-red-500" />,
};

const STATUS_LABELS: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
  blocked: "Blocked",
};

const GOAL_COLORS = (score: number): string => {
  if (score >= 10) return "bg-red-100 text-red-700";
  if (score >= 7) return "bg-orange-100 text-orange-700";
  if (score >= 4) return "bg-blue-100 text-blue-700";
  return "bg-gray-100 text-gray-600";
};

/* ── Field components (same pattern as investor detail) ── */

function DetailField({
  label,
  field,
  type = "text",
  editing,
  task,
  setField,
}: {
  label: string;
  field: keyof Task;
  type?: "text" | "textarea" | "number" | "date";
  editing: boolean;
  task: Task;
  setField: (field: keyof Task, value: string | number | null) => void;
}) {
  if (editing) {
    const defVal = String(task[field] ?? "");
    if (type === "textarea") {
      return (
        <div>
          {label && <label className="text-xs text-gray-500">{label}</label>}
          <Textarea
            rows={3}
            defaultValue={defVal}
            onChange={(e) => setField(field, e.target.value)}
            className="mt-0.5"
          />
        </div>
      );
    }
    return (
      <div>
        {label && <label className="text-xs text-gray-500">{label}</label>}
        <Input
          type={type === "number" ? "number" : type === "date" ? "date" : "text"}
          defaultValue={defVal}
          onChange={(e) => {
            const v = e.target.value;
            setField(field, type === "number" ? (v ? Number(v) : null) : v);
          }}
          className="mt-0.5"
        />
      </div>
    );
  }

  const val = task[field];
  const display = val != null && val !== "" ? String(val) : "—";
  return (
    <div>
      {label && <span className="text-xs text-gray-500">{label}</span>}
      <p className={`text-sm ${display === "—" ? "text-gray-300" : "whitespace-pre-wrap"}`}>{display}</p>
    </div>
  );
}

function DetailSelect({
  label,
  field,
  options,
  optionLabels,
  editing,
  task,
  setField,
}: {
  label: string;
  field: keyof Task;
  options: string[];
  optionLabels?: Record<string, string>;
  editing: boolean;
  task: Task;
  setField: (field: keyof Task, value: string | number | null) => void;
}) {
  if (editing) {
    return (
      <div>
        <label className="text-xs text-gray-500">{label}</label>
        <select
          className="w-full border rounded-md px-2 py-1.5 text-sm mt-0.5"
          defaultValue={String(task[field] ?? "")}
          onChange={(e) => setField(field, e.target.value || null)}
        >
          <option value="">—</option>
          {options.map((s) => (
            <option key={s} value={s}>{optionLabels?.[s] || s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>
    );
  }

  const val = task[field];
  const display = val != null && val !== "" ? (optionLabels?.[String(val)] || String(val)) : "—";
  return (
    <div>
      <span className="text-xs text-gray-500">{label}</span>
      <p className={`text-sm ${display === "—" ? "text-gray-300" : ""}`}>{display}</p>
    </div>
  );
}

/* ── Main component ── */

export default function TaskDetail() {
  const params = useParams();
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [relatedTasks, setRelatedTasks] = useState<RelatedTask[]>([]);
  const [linkedContacts, setLinkedContacts] = useState<LinkedContact[]>([]);
  const [linkedInvestors, setLinkedInvestors] = useState<LinkedInvestor[]>([]);
  const [linkedSoccerOrgs, setLinkedSoccerOrgs] = useState<LinkedSoccerOrg[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const taskId = params.id as string;
  const editDataRef = useRef<Record<string, unknown>>({});

  /* ── Data loading ── */

  const loadLinks = useCallback(async () => {
    const [contactRes, investorRes, orgRes] = await Promise.all([
      supabase
        .from("task_contacts")
        .select("contact_id, role, contacts(id, name, email, title)")
        .eq("task_id", taskId),
      supabase
        .from("task_investors")
        .select("investor_id, role, investors(id, firm_name, investor_type)")
        .eq("task_id", taskId),
      supabase
        .from("task_soccer_orgs")
        .select("soccer_org_id, role, soccer_orgs(id, team_name, league)")
        .eq("task_id", taskId),
    ]);
    if (contactRes.data) setLinkedContacts(contactRes.data as unknown as LinkedContact[]);
    if (investorRes.data) setLinkedInvestors(investorRes.data as unknown as LinkedInvestor[]);
    if (orgRes.data) setLinkedSoccerOrgs(orgRes.data as unknown as LinkedSoccerOrg[]);
  }, [taskId]);

  const loadRelatedTasks = useCallback(async (threadId: string | null) => {
    if (!threadId) {
      setRelatedTasks([]);
      return;
    }
    const { data } = await supabase
      .from("tasks")
      .select("id, title, status, priority, created_at")
      .eq("gmail_thread_id", threadId)
      .neq("id", taskId)
      .order("created_at", { ascending: false });
    if (data) setRelatedTasks(data);
  }, [taskId]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("tasks").select("*").eq("id", taskId).single();
      if (data) {
        setTask(data);
        loadRelatedTasks(data.gmail_thread_id);
      }
    }
    load();
    loadLinks();
  }, [taskId, loadLinks, loadRelatedTasks]);

  /* ── Star toggle ── */

  const toggleStar = async () => {
    if (!task) return;
    const newStarred = !task.is_starred;
    setTask((prev) => prev ? { ...prev, is_starred: newStarred } : prev);
    const { error } = await supabase.from("tasks").update({ is_starred: newStarred }).eq("id", task.id);
    if (error) {
      setTask((prev) => prev ? { ...prev, is_starred: !newStarred } : prev);
    }
  };

  /* ── Entity link/unlink handlers ── */

  const searchContacts = useCallback(async (q: string) => {
    const { data } = await supabase.from("contacts").select("id, name, email, organization").ilike("name", `%${q}%`).limit(10);
    return (data || []).map((c) => ({ id: c.id, label: c.name, sub: c.organization || c.email || undefined }));
  }, []);

  const searchInvestors = useCallback(async (q: string) => {
    const { data } = await supabase.from("investors").select("id, firm_name, investor_type").ilike("firm_name", `%${q}%`).limit(10);
    return (data || []).map((i) => ({ id: i.id, label: i.firm_name, sub: i.investor_type || undefined }));
  }, []);

  const searchSoccerOrgs = useCallback(async (q: string) => {
    const { data } = await supabase.from("soccer_orgs").select("id, team_name, league").ilike("team_name", `%${q}%`).limit(10);
    return (data || []).map((o) => ({ id: o.id, label: o.team_name, sub: o.league || undefined }));
  }, []);

  const linkContact = useCallback(async (contactId: string) => {
    await supabase.from("task_contacts").insert({ task_id: taskId, contact_id: contactId });
    await loadLinks();
  }, [taskId, loadLinks]);

  const unlinkContact = useCallback(async (contactId: string) => {
    await supabase.from("task_contacts").delete().eq("task_id", taskId).eq("contact_id", contactId);
    await loadLinks();
  }, [taskId, loadLinks]);

  const linkInvestor = useCallback(async (investorId: string) => {
    await supabase.from("task_investors").insert({ task_id: taskId, investor_id: investorId });
    await loadLinks();
  }, [taskId, loadLinks]);

  const unlinkInvestor = useCallback(async (investorId: string) => {
    await supabase.from("task_investors").delete().eq("task_id", taskId).eq("investor_id", investorId);
    await loadLinks();
  }, [taskId, loadLinks]);

  const linkSoccerOrg = useCallback(async (orgId: string) => {
    await supabase.from("task_soccer_orgs").insert({ task_id: taskId, soccer_org_id: orgId });
    await loadLinks();
  }, [taskId, loadLinks]);

  const unlinkSoccerOrg = useCallback(async (orgId: string) => {
    await supabase.from("task_soccer_orgs").delete().eq("task_id", taskId).eq("soccer_org_id", orgId);
    await loadLinks();
  }, [taskId, loadLinks]);

  /* ── Edit helpers ── */

  const setField = useCallback((field: keyof Task, value: string | number | null) => {
    editDataRef.current[field] = value;
  }, []);

  const startEditing = useCallback(() => {
    if (task) {
      editDataRef.current = { ...task };
      setEditing(true);
    }
  }, [task]);

  const handleSave = async () => {
    if (!task) return;
    setSaving(true);
    const d = editDataRef.current;
    const { error } = await supabase.from("tasks").update({
      title: (d.title as string) || task.title,
      summary: (d.summary as string) || null,
      recommended_action: (d.recommended_action as string) || null,
      description: (d.description as string) || null,
      status: (d.status as string) || task.status,
      priority: (d.priority as string) || task.priority,
      due_date: (d.due_date as string) || null,
      assigned_to: (d.assigned_to as string) || null,
      goal_relevance_score: d.goal_relevance_score != null && String(d.goal_relevance_score) !== "" ? Number(d.goal_relevance_score) : null,
      goal_relevance_note: (d.goal_relevance_note as string) || null,
    }).eq("id", task.id);

    if (!error) {
      const updated = {
        ...task,
        ...d,
        goal_relevance_score: d.goal_relevance_score != null && String(d.goal_relevance_score) !== "" ? Number(d.goal_relevance_score) : null,
      };
      setTask(updated as Task);
      setEditing(false);
    }
    setSaving(false);
  };

  const handleCancel = () => setEditing(false);

  /* ── Render ── */

  if (!task) {
    return <div className="p-8"><div className="animate-pulse h-64 bg-gray-200 rounded" /></div>;
  }

  const fp = { editing, task, setField };

  return (
    <div className="p-8 max-w-4xl">
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => router.push("/tasks")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Tasks
      </Button>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {/* Star toggle */}
            <button onClick={toggleStar} className="shrink-0" title={task.is_starred ? "Unstar" : "Star"}>
              <Star
                className={`h-5 w-5 ${task.is_starred ? "fill-yellow-400 text-yellow-400" : "text-gray-300 hover:text-yellow-400"}`}
              />
            </button>
            {editing ? (
              <Input
                defaultValue={task.title}
                onChange={(e) => setField("title", e.target.value)}
                className="text-2xl font-bold h-auto py-1 px-2 flex-1"
              />
            ) : (
              <h1 className="text-2xl font-bold text-gray-900">{task.title}</h1>
            )}
          </div>
          <div className="flex gap-2 mt-2 flex-wrap">
            <Badge className="flex items-center gap-1">
              {STATUS_ICONS[task.status]}
              {STATUS_LABELS[task.status] || task.status}
            </Badge>
            <Badge className={PRIORITY_COLORS[task.priority]}>{task.priority}</Badge>
            {task.source && <Badge variant="outline">{task.source}</Badge>}
            {task.goal_relevance_score != null && (
              <Badge className={GOAL_COLORS(task.goal_relevance_score)}>
                <Target className="h-3 w-3 mr-0.5" /> Goal: {task.goal_relevance_score}/10
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {editing ? (
            <>
              <Button variant="ghost" onClick={handleCancel}><X className="h-4 w-4 mr-1" /> Cancel</Button>
              <Button onClick={handleSave} disabled={saving}><Save className="h-4 w-4 mr-1" /> Save</Button>
            </>
          ) : (
            <Button variant="outline" onClick={startEditing}>Edit</Button>
          )}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">{labels.taskSummary}</CardTitle></CardHeader>
            <CardContent>
              <DetailField label="" field="summary" type="textarea" {...fp} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">{labels.taskRecommendedAction}</CardTitle></CardHeader>
            <CardContent>
              <DetailField label="" field="recommended_action" type="textarea" {...fp} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">{labels.taskNotes}</CardTitle></CardHeader>
            <CardContent>
              <DetailField label="" field="description" type="textarea" {...fp} />
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">{labels.taskDetails}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <DetailSelect label="Status" field="status" options={STATUS_OPTIONS} optionLabels={STATUS_LABELS} {...fp} />
              <DetailSelect label="Priority" field="priority" options={PRIORITY_OPTIONS} {...fp} />
              <DetailField label="Due Date" field="due_date" type="date" {...fp} />
              <DetailField label="Assigned To" field="assigned_to" {...fp} />
              {!editing && (
                <div>
                  <span className="text-xs text-gray-500">{labels.taskSourceInfo}</span>
                  <p className="text-sm">{task.source || "—"}</p>
                </div>
              )}
              {!editing && (
                <div>
                  <span className="text-xs text-gray-500">Created</span>
                  <p className="text-sm">{new Date(task.created_at).toLocaleString()}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">{labels.taskGoalRelevance}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <DetailField label="Score (1-10)" field="goal_relevance_score" type="number" {...fp} />
              <DetailField label="Note" field="goal_relevance_note" type="textarea" {...fp} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Correspondence (from primary entity) */}
      {task.entity_type && task.entity_id && (
        <div className="mt-6">
          <CorrespondenceSection entityType={task.entity_type} entityId={task.entity_id} />
        </div>
      )}

      {/* Related Tasks (from same Gmail thread) */}
      {relatedTasks.length > 0 && (
        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{labels.taskRelatedTasks}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {relatedTasks.map((rt) => (
                <Link key={rt.id} href={`/tasks/${rt.id}`}>
                  <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <span className="shrink-0">{STATUS_ICONS[rt.status]}</span>
                    <span className="text-sm text-gray-900 flex-1 truncate">{rt.title}</span>
                    <Badge className={`${PRIORITY_COLORS[rt.priority]} text-xs`}>{rt.priority}</Badge>
                    <span className="text-xs text-gray-400">{new Date(rt.created_at).toLocaleDateString()}</span>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Entity linkers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <Card>
          <CardContent className="pt-5">
            <EntityLinker
              title="Contacts"
              icon={<Users className="h-4 w-4" />}
              items={linkedContacts.map((lc) => ({
                id: lc.contacts.id,
                label: lc.contacts.name,
                sub: lc.contacts.email || lc.contacts.title || undefined,
                href: `/contacts/${lc.contacts.id}`,
                role: lc.role,
                linkId: lc.contact_id,
              }))}
              onLink={linkContact}
              onUnlink={unlinkContact}
              onSearch={searchContacts}
              existingIds={new Set(linkedContacts.map((lc) => lc.contact_id))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <EntityLinker
              title="Investors"
              icon={<TrendingUp className="h-4 w-4" />}
              items={linkedInvestors.map((li) => ({
                id: li.investors.id,
                label: li.investors.firm_name,
                sub: li.investors.investor_type || undefined,
                href: `/investors/${li.investors.id}`,
                role: li.role,
                linkId: li.investor_id,
              }))}
              onLink={linkInvestor}
              onUnlink={unlinkInvestor}
              onSearch={searchInvestors}
              existingIds={new Set(linkedInvestors.map((li) => li.investor_id))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <EntityLinker
              title="Communities"
              icon={<Building2 className="h-4 w-4" />}
              items={linkedSoccerOrgs.map((lo) => ({
                id: lo.soccer_orgs.id,
                label: lo.soccer_orgs.team_name,
                sub: lo.soccer_orgs.league || undefined,
                href: `/soccer-orgs/${lo.soccer_orgs.id}`,
                role: lo.role,
                linkId: lo.soccer_org_id,
              }))}
              onLink={linkSoccerOrg}
              onUnlink={unlinkSoccerOrg}
              onSearch={searchSoccerOrgs}
              existingIds={new Set(linkedSoccerOrgs.map((lo) => lo.soccer_org_id))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
