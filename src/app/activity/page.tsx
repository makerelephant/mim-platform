"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow, format } from "date-fns";
import { labels } from "@/config/labels";
import { Activity, Search, Play, Loader2, Mail, MessageSquare, CheckCircle2, XCircle, Filter, GitBranch, Brain, BarChart3 } from "lucide-react";

interface ActivityEntry {
  id: string;
  actor: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface AgentRun {
  id: string;
  agent_name: string;
  status: string;
  output: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

const AGENT_COLORS: Record<string, string> = {
  "gmail-scanner": "bg-red-100 text-red-700",
  "slack-scanner": "bg-indigo-100 text-indigo-700",
  "investor-enrich": "bg-purple-100 text-purple-700",
  "stale-detector": "bg-yellow-100 text-yellow-700",
  "outreach-tracker": "bg-green-100 text-green-700",
  "weekly-report": "bg-teal-100 text-teal-700",
  manual: "bg-blue-100 text-blue-700",
  system: "bg-gray-100 text-gray-700",
};

const RUN_STATUS_ICONS: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  failed: <XCircle className="h-4 w-4 text-red-500" />,
  running: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
};

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAgent, setFilterAgent] = useState("");
  const [filterEntity, setFilterEntity] = useState("");
  const [search, setSearch] = useState("");
  const [scannerRunning, setScannerRunning] = useState(false);
  const [scannerResult, setScannerResult] = useState<{
    success: boolean;
    messagesFound?: number;
    processed?: number;
    tasksCreated?: number;
    skippedDupes?: number;
    preFiltered?: number;
    threadSkipped?: number;
    contactsCreated?: number;
    log?: string[];
    error?: string;
  } | null>(null);
  const [scanHours, setScanHours] = useState("24");
  const [slackRunning, setSlackRunning] = useState(false);
  const [slackResult, setSlackResult] = useState<{
    success: boolean;
    channelsScanned?: number;
    messagesFound?: number;
    processed?: number;
    tasksCreated?: number;
    preFiltered?: number;
    threadSkipped?: number;
    log?: string[];
    error?: string;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [activityRes, runsRes] = await Promise.all([
      supabase.schema('brain').from("activity").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.schema('brain').from("agent_runs").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    if (activityRes.data) setActivities(activityRes.data);
    if (runsRes.data) setAgentRuns(runsRes.data);
    setLoading(false);
  }

  const runGmailScanner = async () => {
    setScannerRunning(true);
    setScannerResult(null);
    try {
      const res = await fetch("/api/agents/gmail-scanner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanHours: Number(scanHours) }),
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { success: false, error: `Server returned (${res.status}): ${text.slice(0, 300)}` };
      }
      setScannerResult(data);
      await loadData();
    } catch (err) {
      setScannerResult({ success: false, error: String(err) });
    } finally {
      setScannerRunning(false);
    }
  };

  const runSlackScanner = async () => {
    setSlackRunning(true);
    setSlackResult(null);
    try {
      const res = await fetch("/api/agents/slack-scanner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanHours: Number(scanHours) }),
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { success: false, error: `Server returned (${res.status}): ${text.slice(0, 300)}` };
      }
      setSlackResult(data);
      await loadData();
    } catch (err) {
      setSlackResult({ success: false, error: String(err) });
    } finally {
      setSlackRunning(false);
    }
  };

  const agents = [...new Set(activities.map((a) => a.actor))];
  const entityTypes = [...new Set(activities.map((a) => a.entity_type).filter(Boolean))] as string[];

  const filtered = activities.filter((a) => {
    if (filterAgent && a.actor !== filterAgent) return false;
    if (filterEntity && a.entity_type !== filterEntity) return false;
    const summary = (a.metadata?.summary as string) || "";
    if (search && !summary.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return <div><div className="animate-pulse h-64 bg-gray-200 rounded" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{labels.activityLogPageTitle}</h1>
          <p className="text-gray-500 text-sm mt-1">{activities.length} entries</p>
        </div>
      </div>

      {/* Gopher Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Gmail Scanner */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-red-500" /> Gmail Gopher
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500">Scan last</label>
                <Input
                  type="number"
                  value={scanHours}
                  onChange={(e) => setScanHours(e.target.value)}
                  className="w-20"
                  min="1"
                  max="168"
                />
                <label className="text-sm text-gray-500">hours</label>
              </div>
              <Button onClick={runGmailScanner} disabled={scannerRunning || slackRunning} size="sm">
                {scannerRunning ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Running...</>
                ) : (
                  <><Play className="h-4 w-4 mr-1" /> Run</>
                )}
              </Button>
            </div>

            {scannerResult && (
              <div className={`mt-3 p-3 rounded-lg text-sm ${scannerResult.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                {scannerResult.success ? (
                  <div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-2 text-xs">
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {scannerResult.messagesFound ?? 0} messages found</span>
                      <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {scannerResult.processed ?? 0} processed</span>
                      <span className="flex items-center gap-1 font-medium"><BarChart3 className="h-3 w-3" /> {scannerResult.tasksCreated ?? 0} tasks created</span>
                      {(scannerResult.skippedDupes ?? 0) > 0 && <span className="flex items-center gap-1"><XCircle className="h-3 w-3" /> {scannerResult.skippedDupes} dupes skipped</span>}
                    </div>
                    {((scannerResult.preFiltered ?? 0) > 0 || (scannerResult.threadSkipped ?? 0) > 0) && (
                      <div className="border-t border-green-200 pt-2 mt-2">
                        <p className="text-xs font-medium text-green-700 mb-1 flex items-center gap-1"><Brain className="h-3 w-3" /> Intelligence Layer</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          {(scannerResult.preFiltered ?? 0) > 0 && <span className="flex items-center gap-1"><Filter className="h-3 w-3" /> {scannerResult.preFiltered} pre-filtered (junk)</span>}
                          {(scannerResult.threadSkipped ?? 0) > 0 && <span className="flex items-center gap-1"><GitBranch className="h-3 w-3" /> {scannerResult.threadSkipped} thread dupes blocked</span>}
                        </div>
                      </div>
                    )}
                    {scannerResult.log && scannerResult.log.length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-green-600">Show log ({scannerResult.log.length} lines)</summary>
                        <pre className="whitespace-pre-wrap font-mono text-xs mt-1 max-h-48 overflow-y-auto">{scannerResult.log.join("\n")}</pre>
                      </details>
                    )}
                  </div>
                ) : (
                  <p>Error: {scannerResult.error}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Slack Scanner */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-indigo-500" /> Slack Gopher
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">Uses same scan window</span>
              <Button onClick={runSlackScanner} disabled={slackRunning || scannerRunning} size="sm">
                {slackRunning ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Running...</>
                ) : (
                  <><Play className="h-4 w-4 mr-1" /> Run</>
                )}
              </Button>
            </div>

            {slackResult && (
              <div className={`mt-3 p-3 rounded-lg text-sm ${slackResult.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                {slackResult.success ? (
                  <div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-2 text-xs">
                      <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {slackResult.channelsScanned ?? 0} channels scanned</span>
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {slackResult.messagesFound ?? 0} messages found</span>
                      <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {slackResult.processed ?? 0} processed</span>
                      <span className="flex items-center gap-1 font-medium"><BarChart3 className="h-3 w-3" /> {slackResult.tasksCreated ?? 0} tasks created</span>
                    </div>
                    {((slackResult.preFiltered ?? 0) > 0 || (slackResult.threadSkipped ?? 0) > 0) && (
                      <div className="border-t border-green-200 pt-2 mt-2">
                        <p className="text-xs font-medium text-green-700 mb-1 flex items-center gap-1"><Brain className="h-3 w-3" /> Intelligence Layer</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          {(slackResult.preFiltered ?? 0) > 0 && <span className="flex items-center gap-1"><Filter className="h-3 w-3" /> {slackResult.preFiltered} pre-filtered (junk)</span>}
                          {(slackResult.threadSkipped ?? 0) > 0 && <span className="flex items-center gap-1"><GitBranch className="h-3 w-3" /> {slackResult.threadSkipped} thread dupes blocked</span>}
                        </div>
                      </div>
                    )}
                    {slackResult.log && slackResult.log.length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-indigo-600">Show log ({slackResult.log.length} lines)</summary>
                        <pre className="whitespace-pre-wrap font-mono text-xs mt-1 max-h-48 overflow-y-auto">{slackResult.log.join("\n")}</pre>
                      </details>
                    )}
                  </div>
                ) : (
                  <p>Error: {slackResult.error}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Runs */}
      {agentRuns.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {agentRuns.slice(0, 8).map((run) => (
                <div key={run.id} className="flex items-center gap-2 text-xs">
                  {RUN_STATUS_ICONS[run.status] || <Activity className="h-4 w-4 text-gray-400" />}
                  <Badge className={AGENT_COLORS[run.agent_name] || "bg-gray-100 text-gray-700"} >
                    {run.agent_name}
                  </Badge>
                  <span className="text-gray-500">
                    {run.output && (run.output as Record<string, unknown>).records_processed != null ? `${(run.output as Record<string, unknown>).records_processed} processed` : ""}
                    {run.output && (run.output as Record<string, unknown>).records_updated != null ? `, ${(run.output as Record<string, unknown>).records_updated} updated` : ""}
                  </span>
                  {run.error && <span className="text-red-500 truncate max-w-xs">{run.error}</span>}
                  <span className="text-gray-400 ml-auto">
                    {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity Log */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search activity..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select className="border rounded-md px-2 py-1.5 text-sm" value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)}>
          <option value="">All Agents</option>
          {agents.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="border rounded-md px-2 py-1.5 text-sm" value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)}>
          <option value="">All Entities</option>
          {entityTypes.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">No activity logged yet.</p>
            <p className="text-gray-400 text-sm mt-1">Agent actions and manual updates will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <Card key={a.id}>
              <CardContent className="py-3 flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">{(a.metadata?.summary as string) || a.action}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={AGENT_COLORS[a.actor] || "bg-gray-100 text-gray-700"} >{a.actor}</Badge>
                    {a.entity_type && <Badge variant="outline" className="text-xs">{a.entity_type}</Badge>}
                    <span className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </span>
                    <span className="text-xs text-gray-300">
                      {format(new Date(a.created_at), "MMM d, yyyy HH:mm")}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
