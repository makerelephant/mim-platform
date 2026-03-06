"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3, Brain, Filter, Zap, Target, Clock,
  CheckCircle, Star, XCircle, AlertTriangle,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface PreFilterStats {
  passed: number;
  newsletter: number;
  auto_reply: number;
  marketing: number;
  noreply: number;
  thread_update: number;
  total: number;
}

interface EntityScore {
  entity_type: string;
  entity_id: string;
  entity_name: string;
  total_tasks_created: number;
  tasks_starred: number;
  tasks_completed: number;
  tasks_ignored: number;
  usefulness_score: number;
}

interface ClassificationEntry {
  id: string;
  source: string;
  from_email: string | null;
  subject: string | null;
  entity_name: string | null;
  pre_filter_result: string | null;
  classification_result: Record<string, unknown> | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  created_at: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function IntelligencePage() {
  const [filterStats, setFilterStats] = useState<PreFilterStats | null>(null);
  const [entityScores, setEntityScores] = useState<EntityScore[]>([]);
  const [auditTrail, setAuditTrail] = useState<ClassificationEntry[]>([]);
  const [tokenStats, setTokenStats] = useState<{ total_prompt: number; total_completion: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    // 1. Pre-filter effectiveness
    try {
      const { data: classLogs } = await supabase
        .from("classification_log")
        .select("pre_filter_result")
        .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString());

      if (classLogs) {
        const stats: PreFilterStats = { passed: 0, newsletter: 0, auto_reply: 0, marketing: 0, noreply: 0, thread_update: 0, total: classLogs.length };
        for (const row of classLogs) {
          const key = row.pre_filter_result as keyof PreFilterStats;
          if (key && key in stats && key !== "total") {
            stats[key]++;
          } else {
            stats.passed++;
          }
        }
        setFilterStats(stats);
      }
    } catch {
      // classification_log may not exist yet
    }

    // 2. Entity feedback scores
    try {
      const { data: feedback } = await supabase
        .from("entity_feedback")
        .select("*")
        .order("total_tasks_created", { ascending: false })
        .limit(20);

      if (feedback) {
        // Resolve entity names
        const orgIds = feedback.filter((f) => f.entity_type === "organizations").map((f) => f.entity_id);
        const contactIds = feedback.filter((f) => f.entity_type === "contacts").map((f) => f.entity_id);

        const { data: orgs } = orgIds.length > 0
          ? await supabase.from("organizations").select("id, name").in("id", orgIds)
          : { data: [] };
        const { data: contacts } = contactIds.length > 0
          ? await supabase.from("contacts").select("id, first_name, last_name").in("id", contactIds)
          : { data: [] };

        const nameMap = new Map<string, string>();
        for (const o of orgs ?? []) nameMap.set(o.id, o.name);
        for (const c of contacts ?? []) nameMap.set(c.id, `${c.first_name || ""} ${c.last_name || ""}`.trim());

        setEntityScores(
          feedback.map((f) => ({
            entity_type: f.entity_type,
            entity_id: f.entity_id,
            entity_name: nameMap.get(f.entity_id) || "Unknown",
            total_tasks_created: f.total_tasks_created || 0,
            tasks_starred: f.tasks_starred || 0,
            tasks_completed: f.tasks_completed || 0,
            tasks_ignored: f.tasks_ignored || 0,
            usefulness_score: Number(f.usefulness_score) || 0,
          }))
        );
      }
    } catch {
      // entity_feedback may not exist yet
    }

    // 3. Token spend
    try {
      const { data: tokenData } = await supabase
        .from("classification_log")
        .select("prompt_tokens, completion_tokens")
        .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString())
        .not("prompt_tokens", "is", null);

      if (tokenData) {
        let totalPrompt = 0;
        let totalCompletion = 0;
        for (const r of tokenData) {
          totalPrompt += r.prompt_tokens || 0;
          totalCompletion += r.completion_tokens || 0;
        }
        setTokenStats({ total_prompt: totalPrompt, total_completion: totalCompletion });
      }
    } catch {
      // classification_log may not exist yet
    }

    // 4. Recent audit trail
    try {
      const { data: trail } = await supabase
        .from("classification_log")
        .select("id, source, from_email, subject, entity_name, pre_filter_result, classification_result, prompt_tokens, completion_tokens, created_at")
        .order("created_at", { ascending: false })
        .limit(25);

      setAuditTrail(trail ?? []);
    } catch {
      // classification_log may not exist yet
    }

    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Helpers ─────────────────────────────────────────────────────────

  const pct = (n: number, total: number) =>
    total === 0 ? "0%" : `${Math.round((n / total) * 100)}%`;

  const scoreColor = (score: number) => {
    if (score >= 0.7) return "text-green-600 bg-green-50";
    if (score >= 0.4) return "text-amber-600 bg-amber-50";
    return "text-red-600 bg-red-50";
  };

  const scoreBar = (score: number) => {
    const width = Math.round(score * 100);
    const color = score >= 0.7 ? "bg-green-500" : score >= 0.4 ? "bg-amber-500" : "bg-red-500";
    return (
      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${width}%` }} />
      </div>
    );
  };

  const timeAgo = (date: string) => {
    const ms = Date.now() - new Date(date).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-gray-200 rounded" />)}
        </div>
        <div className="h-64 bg-gray-200 rounded" />
      </div>
    );
  }

  const filtered = filterStats
    ? filterStats.newsletter + filterStats.auto_reply + filterStats.marketing + filterStats.noreply + filterStats.thread_update
    : 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-indigo-600" />
          Scanner Intelligence
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          How the brain is learning. Pre-filter effectiveness, entity scores, classification patterns, and token spend.
        </p>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="py-4 px-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500">Pre-filtered (30d)</span>
              <Filter className="h-4 w-4 text-purple-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {filterStats ? filtered : "—"}
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {filterStats ? `${pct(filtered, filterStats.total)} of ${filterStats.total} total scanned` : "No data yet"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 px-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500">AI Classifications (30d)</span>
              <Brain className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {filterStats?.passed ?? "—"}
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">Messages that reached the AI classifier</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 px-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500">Tokens Used (30d)</span>
              <Zap className="h-4 w-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {tokenStats ? `${Math.round((tokenStats.total_prompt + tokenStats.total_completion) / 1000)}K` : "—"}
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {tokenStats
                ? `${Math.round(tokenStats.total_prompt / 1000)}K input + ${Math.round(tokenStats.total_completion / 1000)}K output`
                : "No data yet"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 px-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500">Entities Tracked</span>
              <Target className="h-4 w-4 text-teal-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {entityScores.length || "—"}
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">With feedback scores</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Pre-filter Breakdown + Entity Scores ── */}
      <div className="grid grid-cols-2 gap-4 mb-6">

        {/* Pre-filter breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Filter className="h-4 w-4 text-purple-600" />
              Pre-filter Breakdown (30 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!filterStats || filterStats.total === 0 ? (
              <div className="text-center py-6 text-gray-400">
                <Filter className="h-6 w-6 mx-auto mb-2" />
                <p className="text-sm">No classification data yet. Run a scanner to populate.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {[
                  { label: "Passed to AI", count: filterStats.passed, color: "bg-green-500", icon: CheckCircle },
                  { label: "Newsletters", count: filterStats.newsletter, color: "bg-purple-500", icon: AlertTriangle },
                  { label: "Auto-replies", count: filterStats.auto_reply, color: "bg-blue-500", icon: Clock },
                  { label: "Marketing/Bulk", count: filterStats.marketing, color: "bg-orange-500", icon: XCircle },
                  { label: "Noreply senders", count: filterStats.noreply, color: "bg-red-500", icon: XCircle },
                  { label: "Thread updates", count: filterStats.thread_update, color: "bg-gray-500", icon: Clock },
                ].map(({ label, count, color, icon: Icon }) => (
                  <div key={label} className="flex items-center gap-3">
                    <Icon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span className="text-xs text-gray-600 w-28">{label}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${color} rounded-full`}
                        style={{ width: `${Math.round((count / filterStats.total) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-700 w-12 text-right">{count}</span>
                    <span className="text-[10px] text-gray-400 w-10 text-right">
                      {pct(count, filterStats.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Entity feedback scores */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-teal-600" />
              Entity Intelligence Scores
            </CardTitle>
          </CardHeader>
          <CardContent>
            {entityScores.length === 0 ? (
              <div className="text-center py-6 text-gray-400">
                <Target className="h-6 w-6 mx-auto mb-2" />
                <p className="text-sm">No entity feedback yet. Star or complete tasks to train the system.</p>
              </div>
            ) : (
              <div className="space-y-0">
                {entityScores.slice(0, 10).map((e) => (
                  <div key={e.entity_id} className="flex items-center gap-3 py-2 border-b last:border-0">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-gray-900 truncate block">{e.entity_name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-400">{e.total_tasks_created} tasks</span>
                        <Star className="h-2.5 w-2.5 text-amber-400" />
                        <span className="text-[10px] text-gray-500">{e.tasks_starred}</span>
                        <CheckCircle className="h-2.5 w-2.5 text-green-400" />
                        <span className="text-[10px] text-gray-500">{e.tasks_completed}</span>
                        <XCircle className="h-2.5 w-2.5 text-red-400" />
                        <span className="text-[10px] text-gray-500">{e.tasks_ignored}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {scoreBar(e.usefulness_score)}
                      <Badge className={`text-[10px] ${scoreColor(e.usefulness_score)}`}>
                        {Math.round(e.usefulness_score * 100)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Classification Audit Trail ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-600" />
            Recent Classification Audit Trail
          </CardTitle>
        </CardHeader>
        <CardContent>
          {auditTrail.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Brain className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">No classifications logged yet. Run a scanner to start building the audit trail.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="py-2 pr-3 font-medium">Source</th>
                    <th className="py-2 pr-3 font-medium">From</th>
                    <th className="py-2 pr-3 font-medium">Subject</th>
                    <th className="py-2 pr-3 font-medium">Entity</th>
                    <th className="py-2 pr-3 font-medium">Filter</th>
                    <th className="py-2 pr-3 font-medium">Tags</th>
                    <th className="py-2 pr-3 font-medium">Tokens</th>
                    <th className="py-2 font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {auditTrail.map((entry) => {
                    const tags = (entry.classification_result as { tags?: string[] })?.tags || [];
                    return (
                      <tr key={entry.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-2 pr-3">
                          <Badge variant="outline" className="text-[9px]">
                            {entry.source || "—"}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3 text-gray-700 truncate max-w-[120px]">
                          {entry.from_email || "—"}
                        </td>
                        <td className="py-2 pr-3 text-gray-700 truncate max-w-[180px]">
                          {entry.subject || "—"}
                        </td>
                        <td className="py-2 pr-3 text-gray-700 truncate max-w-[120px]">
                          {entry.entity_name || "—"}
                        </td>
                        <td className="py-2 pr-3">
                          <Badge
                            className={`text-[9px] ${
                              entry.pre_filter_result === "passed"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {entry.pre_filter_result || "passed"}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex gap-1 flex-wrap max-w-[150px]">
                            {tags.slice(0, 3).map((tag: string) => (
                              <Badge key={tag} variant="secondary" className="text-[8px]">{tag}</Badge>
                            ))}
                            {tags.length > 3 && (
                              <span className="text-[9px] text-gray-400">+{tags.length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 pr-3 text-gray-500">
                          {entry.prompt_tokens ? `${entry.prompt_tokens + (entry.completion_tokens || 0)}` : "—"}
                        </td>
                        <td className="py-2 text-gray-400">{timeAgo(entry.created_at)}</td>
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
  );
}
