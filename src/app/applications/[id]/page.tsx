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
} from "lucide-react";

/* ── Types ── */

interface Agent {
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

interface AgentRun {
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
const TYPE_OPTIONS = ["email", "webhook", "scheduled"];

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  draft: "bg-gray-100 text-gray-600",
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  email: <Mail className="h-4 w-4" />,
  webhook: <Webhook className="h-4 w-4" />,
  scheduled: <Clock className="h-4 w-4" />,
};

const RUN_STATUS_ICONS: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  running: <Play className="h-4 w-4 text-blue-500" />,
  failed: <AlertCircle className="h-4 w-4 text-red-500" />,
};

/* ── Main component ── */

export default function AgentDetail() {
  const params = useParams();
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const agentId = params.id as string;
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
      const { data } = await supabase.from("agents").select("*").eq("id", agentId).single();
      if (data) {
        setAgent(data);
        loadRuns(data.slug);
      }
    }
    load();
  }, [agentId, loadRuns]);

  /* ── Edit helpers ── */

  const setField = useCallback((field: string, value: unknown) => {
    editDataRef.current[field] = value;
  }, []);

  const startEditing = useCallback(() => {
    if (agent) {
      editDataRef.current = {
        name: agent.name,
        description: agent.description || "",
        system_prompt: agent.system_prompt || "",
        status: agent.status,
        agent_type: agent.agent_type,
        config: JSON.stringify(agent.config || {}, null, 2),
      };
      setEditing(true);
    }
  }, [agent]);

  const handleSave = async () => {
    if (!agent) return;
    setSaving(true);
    const d = editDataRef.current;

    // Parse config JSON
    let configObj = agent.config;
    try {
      if (typeof d.config === "string" && d.config) {
        configObj = JSON.parse(d.config as string);
      }
    } catch {
      // Keep existing config if JSON is invalid
    }

    const { error } = await supabase.from("agents").update({
      name: (d.name as string) || agent.name,
      description: (d.description as string) || null,
      system_prompt: (d.system_prompt as string) || null,
      status: (d.status as string) || agent.status,
      agent_type: (d.agent_type as string) || agent.agent_type,
      config: configObj,
      updated_at: new Date().toISOString(),
    }).eq("id", agent.id);

    if (!error) {
      setAgent({
        ...agent,
        name: (d.name as string) || agent.name,
        description: (d.description as string) || null,
        system_prompt: (d.system_prompt as string) || null,
        status: (d.status as string) || agent.status,
        agent_type: (d.agent_type as string) || agent.agent_type,
        config: configObj,
        updated_at: new Date().toISOString(),
      });
      setEditing(false);
    }
    setSaving(false);
  };

  const handleCancel = () => setEditing(false);

  /* ── Render ── */

  if (!agent) {
    return <div className="p-8"><div className="animate-pulse h-64 bg-gray-200 rounded" /></div>;
  }

  const configStr = JSON.stringify(agent.config || {}, null, 2);
  const monitoredEmails = (agent.config?.monitored_emails as string[]) || [];

  return (
    <div className="p-8 max-w-5xl">
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => router.push("/applications")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Applications
      </Button>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gray-100 rounded-lg">
            {TYPE_ICONS[agent.agent_type] || <Bot className="h-5 w-5" />}
          </div>
          <div>
            {editing ? (
              <Input
                defaultValue={agent.name}
                onChange={(e) => setField("name", e.target.value)}
                className="text-2xl font-bold h-auto py-1 px-2"
              />
            ) : (
              <h1 className="text-2xl font-bold text-gray-900">{agent.name}</h1>
            )}
            <div className="flex gap-2 mt-1">
              <Badge className={STATUS_STYLES[agent.status] || STATUS_STYLES.draft}>{agent.status}</Badge>
              <Badge variant="outline">{agent.agent_type}</Badge>
              <span className="text-xs text-gray-400">Created {new Date(agent.created_at).toLocaleDateString()}</span>
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
            <CardHeader><CardTitle className="text-base">{labels.agentDescription}</CardTitle></CardHeader>
            <CardContent>
              {editing ? (
                <Textarea
                  rows={4}
                  defaultValue={agent.description || ""}
                  onChange={(e) => setField("description", e.target.value)}
                />
              ) : (
                <p className={`text-sm ${agent.description ? "whitespace-pre-wrap" : "text-gray-300"}`}>
                  {agent.description || "—"}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">{labels.agentSystemPrompt}</CardTitle></CardHeader>
            <CardContent>
              {editing ? (
                <Textarea
                  rows={16}
                  defaultValue={agent.system_prompt || ""}
                  onChange={(e) => setField("system_prompt", e.target.value)}
                  className="font-mono text-xs"
                />
              ) : (
                <pre className={`text-xs whitespace-pre-wrap max-h-96 overflow-y-auto ${agent.system_prompt ? "font-mono bg-gray-50 p-3 rounded" : "text-gray-300"}`}>
                  {agent.system_prompt || "— No system prompt configured —"}
                </pre>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">{labels.agentConfig}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {editing ? (
                <>
                  <div>
                    <label className="text-xs text-gray-500">Status</label>
                    <select
                      className="w-full border rounded-md px-2 py-1.5 text-sm mt-0.5"
                      defaultValue={agent.status}
                      onChange={(e) => setField("status", e.target.value)}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Agent Type</label>
                    <select
                      className="w-full border rounded-md px-2 py-1.5 text-sm mt-0.5"
                      defaultValue={agent.agent_type}
                      onChange={(e) => setField("agent_type", e.target.value)}
                    >
                      {TYPE_OPTIONS.map((t) => (
                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Config (JSON)</label>
                    <Textarea
                      rows={8}
                      defaultValue={configStr}
                      onChange={(e) => setField("config", e.target.value)}
                      className="font-mono text-xs mt-0.5"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span className="text-xs text-gray-500">Scan Hours</span>
                    <p className="text-sm">{(agent.config?.scan_hours as number) || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">AI Model</span>
                    <p className="text-sm font-mono text-xs">{(agent.config?.model as string) || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Max Tokens</span>
                    <p className="text-sm">{(agent.config?.max_tokens as number) || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Slug</span>
                    <p className="text-sm font-mono">{agent.slug}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Monitored Emails (read-only, from config) */}
          {!editing && monitoredEmails.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">{labels.agentMonitoredEmails}</CardTitle></CardHeader>
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
          <CardHeader><CardTitle className="text-base">{labels.agentRecentRuns}</CardTitle></CardHeader>
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
