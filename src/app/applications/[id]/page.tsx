"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { labels } from "@/config/labels";
import { timeAgo } from "@/lib/timeAgo";
import {
  ArrowLeft,
  Save,
  X,
  Bot,
  Mail,
  Webhook,
  Clock,
  CheckCircle2,
  Play,
  AlertCircle,
  Target,
  Plus,
  Trash2,
  MessageSquare,
  Database,
} from "lucide-react";

/* ── Types ── */

interface Gopher {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  agent_type: string;
  system_prompt: string | null;
  config: Record<string, unknown>;
  status: string;
  created_at: string;
  updated_at: string;
}

interface GopherRun {
  id: string;
  agent_name: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  records_processed: number | null;
  records_updated: number | null;
  error_message: string | null;
}

/* ── Constants ── */

const STATUS_OPTIONS = ["active", "paused", "draft"];
const TYPE_OPTIONS = ["email", "webhook", "scheduled", "messaging", "data-sync"];

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  draft: "bg-gray-100 text-gray-600",
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  email: <Mail className="h-4 w-4" />,
  webhook: <Webhook className="h-4 w-4" />,
  scheduled: <Clock className="h-4 w-4" />,
  messaging: <MessageSquare className="h-4 w-4" />,
  "data-sync": <Database className="h-4 w-4" />,
};

const RUN_STATUS_ICONS: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  running: <Play className="h-4 w-4 text-blue-500" />,
  failed: <AlertCircle className="h-4 w-4 text-red-500" />,
};

/* ── Main component ── */

export default function GopherDetail() {
  const params = useParams();
  const router = useRouter();
  const [gopher, setGopher] = useState<Gopher | null>(null);
  const [runs, setRuns] = useState<GopherRun[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editGoals, setEditGoals] = useState<string[]>([]);

  const gopherId = params.id as string;
  const editDataRef = useRef<Record<string, unknown>>({});

  /* ── Load data ── */

  const loadRuns = useCallback(async (slug: string) => {
    const { data } = await supabase
      .from("agent_runs")
      .select("id, agent_name, status, started_at, completed_at, records_processed, records_updated, error_message")
      .eq("agent_name", slug)
      .order("started_at", { ascending: false })
      .limit(10);
    if (data) setRuns(data);
  }, []);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("agents").select("*").eq("id", gopherId).single();
      if (data) {
        setGopher(data);
        loadRuns(data.slug);
      }
    }
    load();
  }, [gopherId, loadRuns]);

  /* ── Edit helpers ── */

  const setField = useCallback((field: string, value: unknown) => {
    editDataRef.current[field] = value;
  }, []);

  const startEditing = useCallback(() => {
    if (gopher) {
      // Extract goals from config
      const existingGoals = (gopher.config?.goals_90day as string[]) || [];
      setEditGoals(existingGoals.length > 0 ? [...existingGoals] : [""]);

      // Build config WITHOUT goals_90day for the JSON editor
      const configForEditor = { ...gopher.config };
      delete configForEditor.goals_90day;

      editDataRef.current = {
        name: gopher.name,
        description: gopher.description || "",
        system_prompt: gopher.system_prompt || "",
        status: gopher.status,
        agent_type: gopher.agent_type,
        config: JSON.stringify(configForEditor, null, 2),
      };
      setEditing(true);
    }
  }, [gopher]);

  const handleSave = async () => {
    if (!gopher) return;
    setSaving(true);
    const d = editDataRef.current;

    // Parse config JSON
    let configObj: Record<string, unknown> = { ...gopher.config };
    try {
      if (typeof d.config === "string" && d.config) {
        configObj = JSON.parse(d.config as string);
      }
    } catch {
      // Keep existing config if JSON is invalid
    }

    // Merge goals back into config
    const cleanGoals = editGoals.filter((g) => g.trim().length > 0);
    if (cleanGoals.length > 0) {
      configObj.goals_90day = cleanGoals;
    } else {
      delete configObj.goals_90day;
    }

    const { error } = await supabase.from("agents").update({
      name: (d.name as string) || gopher.name,
      description: (d.description as string) || null,
      system_prompt: (d.system_prompt as string) || null,
      status: (d.status as string) || gopher.status,
      agent_type: (d.agent_type as string) || gopher.agent_type,
      config: configObj,
      updated_at: new Date().toISOString(),
    }).eq("id", gopher.id);

    if (!error) {
      setGopher({
        ...gopher,
        name: (d.name as string) || gopher.name,
        description: (d.description as string) || null,
        system_prompt: (d.system_prompt as string) || null,
        status: (d.status as string) || gopher.status,
        agent_type: (d.agent_type as string) || gopher.agent_type,
        config: configObj,
        updated_at: new Date().toISOString(),
      });
      setEditing(false);
    }
    setSaving(false);
  };

  const handleCancel = () => setEditing(false);

  /* ── Goal editing helpers ── */

  const addGoal = () => setEditGoals((prev) => [...prev, ""]);

  const removeGoal = (index: number) => {
    setEditGoals((prev) => prev.filter((_, i) => i !== index));
  };

  const updateGoal = (index: number, value: string) => {
    setEditGoals((prev) => prev.map((g, i) => (i === index ? value : g)));
  };

  /* ── Render ── */

  if (!gopher) {
    return <div><div className="animate-pulse h-64 bg-gray-200 rounded" /></div>;
  }

  // Build config string WITHOUT goals for display
  const configForDisplay = { ...gopher.config };
  delete configForDisplay.goals_90day;
  const configStr = JSON.stringify(configForDisplay, null, 2);
  const monitoredEmails = (gopher.config?.monitored_emails as string[]) || [];
  const goals = (gopher.config?.goals_90day as string[]) || [];

  return (
    <div className="max-w-5xl">
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => router.push("/applications")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Gophers
      </Button>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gray-100 rounded-lg">
            {TYPE_ICONS[gopher.agent_type] || <Bot className="h-5 w-5" />}
          </div>
          <div>
            {editing ? (
              <Input
                defaultValue={gopher.name}
                onChange={(e) => setField("name", e.target.value)}
                className="text-2xl font-bold h-auto py-1 px-2"
              />
            ) : (
              <h1 className="text-2xl font-bold text-gray-900">{gopher.name}</h1>
            )}
            <div className="flex gap-2 mt-1">
              <Badge className={STATUS_STYLES[gopher.status] || STATUS_STYLES.draft}>{gopher.status}</Badge>
              <Badge variant="outline">{gopher.agent_type}</Badge>
              <span className="text-xs text-gray-400">Created {new Date(gopher.created_at).toLocaleDateString()}</span>
            </div>
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
            <CardHeader><CardTitle className="text-base">{labels.gopherDescription}</CardTitle></CardHeader>
            <CardContent>
              {editing ? (
                <Textarea
                  rows={4}
                  defaultValue={gopher.description || ""}
                  onChange={(e) => setField("description", e.target.value)}
                />
              ) : (
                <p className={`text-sm ${gopher.description ? "whitespace-pre-wrap" : "text-gray-300"}`}>
                  {gopher.description || "—"}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Goals — first-class editable field */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-500" />
                {labels.gopherGoals}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {editing ? (
                <div className="space-y-2">
                  {editGoals.map((goal, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={goal}
                        placeholder="Enter a goal..."
                        onChange={(e) => updateGoal(i, e.target.value)}
                        className="text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-red-400 hover:text-red-600"
                        onClick={() => removeGoal(i)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addGoal} className="mt-1">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Goal
                  </Button>
                </div>
              ) : goals.length > 0 ? (
                <ul className="space-y-1.5">
                  {goals.map((goal, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-blue-400 mt-0.5">•</span>
                      <span>{goal}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-300">No goals configured yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">{labels.gopherInstructions}</CardTitle></CardHeader>
            <CardContent>
              {editing ? (
                <Textarea
                  rows={16}
                  defaultValue={gopher.system_prompt || ""}
                  onChange={(e) => setField("system_prompt", e.target.value)}
                  className="font-mono text-xs"
                />
              ) : (
                <pre className={`text-xs whitespace-pre-wrap max-h-96 overflow-y-auto ${gopher.system_prompt ? "font-mono bg-gray-50 p-3 rounded" : "text-gray-300"}`}>
                  {gopher.system_prompt || "Using default instructions from code"}
                </pre>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">{labels.gopherConfig}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {editing ? (
                <>
                  <div>
                    <label className="text-xs text-gray-500">Status</label>
                    <select
                      className="w-full border rounded-md px-2 py-1.5 text-sm mt-0.5"
                      defaultValue={gopher.status}
                      onChange={(e) => setField("status", e.target.value)}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Gopher Type</label>
                    <select
                      className="w-full border rounded-md px-2 py-1.5 text-sm mt-0.5"
                      defaultValue={gopher.agent_type}
                      onChange={(e) => setField("agent_type", e.target.value)}
                    >
                      {TYPE_OPTIONS.map((t) => (
                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Config (JSON)</label>
                    <p className="text-[10px] text-gray-400 mt-0.5 mb-1">
                      goals_90day is managed above — changes here won&apos;t affect goals.
                    </p>
                    <Textarea
                      rows={8}
                      defaultValue={configStr}
                      onChange={(e) => setField("config", e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span className="text-xs text-gray-500">Scan Hours</span>
                    <p className="text-sm">{(gopher.config?.scan_hours as number) || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">AI Model</span>
                    <p className="text-sm font-mono text-xs">{(gopher.config?.model as string) || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Max Tokens</span>
                    <p className="text-sm">{(gopher.config?.max_tokens as number) || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Slug</span>
                    <p className="text-sm font-mono">{gopher.slug}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Monitored Emails (read-only, from config) */}
          {!editing && monitoredEmails.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">{labels.gopherMonitoredEmails}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {monitoredEmails.map((email) => (
                    <div key={email} className="flex items-center gap-2 text-sm">
                      <Mail className="h-3.5 w-3.5 text-gray-400" />
                      <span>{email}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Recent Runs */}
      <div className="mt-6">
        <Card>
          <CardHeader><CardTitle className="text-base">{labels.gopherRecentRuns}</CardTitle></CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No runs recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Status</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Started</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Duration</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Processed</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Updated</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => {
                      let duration = "—";
                      if (run.completed_at && run.started_at) {
                        const ms = new Date(run.completed_at).getTime() - new Date(run.started_at).getTime();
                        duration = ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
                      }
                      return (
                        <tr key={run.id} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <span className="flex items-center gap-1.5">
                              {RUN_STATUS_ICONS[run.status] || RUN_STATUS_ICONS.completed}
                              {run.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-500">{timeAgo(run.started_at)}</td>
                          <td className="px-3 py-2 text-gray-500">{duration}</td>
                          <td className="px-3 py-2">{run.records_processed ?? "—"}</td>
                          <td className="px-3 py-2">{run.records_updated ?? "—"}</td>
                          <td className="px-3 py-2 text-red-500 text-xs truncate max-w-[200px]">{run.error_message || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
