"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { labels } from "@/config/labels";
import { Bot, Mail, Webhook, Clock, Play, AlertCircle, CheckCircle2, Copy } from "lucide-react";
import { timeAgo } from "@/lib/timeAgo";
import Link from "next/link";

interface Agent {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  agent_type: string;
  status: string;
  created_at: string;
}

interface AgentRun {
  id: string;
  agent_name: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  records_processed: number | null;
  records_updated: number | null;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  email: <Mail className="h-4 w-4" />,
  webhook: <Webhook className="h-4 w-4" />,
  scheduled: <Clock className="h-4 w-4" />,
};

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  draft: "bg-gray-100 text-gray-600",
};

const RUN_STATUS_ICONS: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  running: <Play className="h-3.5 w-3.5 text-blue-500" />,
  failed: <AlertCircle className="h-3.5 w-3.5 text-red-500" />,
};

export default function ApplicationsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [lastRuns, setLastRuns] = useState<Map<string, AgentRun>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: agentData } = await supabase
        .from("agents")
        .select("id, name, slug, description, agent_type, status, created_at")
        .order("created_at", { ascending: true });

      if (agentData) {
        setAgents(agentData);

        // Get latest run per agent slug
        const slugs = agentData.map((a: Agent) => a.slug);
        if (slugs.length > 0) {
          const { data: runs } = await supabase
            .from("agent_runs")
            .select("id, agent_name, status, started_at, completed_at, records_processed, records_updated")
            .in("agent_name", slugs)
            .order("started_at", { ascending: false });

          if (runs) {
            const runMap = new Map<string, AgentRun>();
            for (const run of runs) {
              if (!runMap.has(run.agent_name)) {
                runMap.set(run.agent_name, run);
              }
            }
            setLastRuns(runMap);
          }
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  const deleteAgent = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this agent? This cannot be undone.")) return;
    const { error } = await supabase.from("agents").delete().eq("id", id);
    if (!error) {
      setAgents((prev) => prev.filter((a) => a.id !== id));
    }
  };

  if (loading) {
    return <div className="p-8"><div className="animate-pulse h-64 bg-gray-200 rounded" /></div>;
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{labels.applicationsPageTitle}</h1>
          <p className="text-gray-500 text-sm mt-1">{agents.length} agent{agents.length !== 1 ? "s" : ""} configured</p>
        </div>
      </div>

      {agents.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Bot className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">No agents configured yet.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map((agent) => {
          const lastRun = lastRuns.get(agent.slug);
          return (
            <Link key={agent.id} href={`/applications/${agent.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        {TYPE_ICONS[agent.agent_type] || <Bot className="h-4 w-4" />}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{agent.name}</h3>
                        <span className="text-xs text-gray-400">{agent.agent_type}</span>
                      </div>
                    </div>
                    <Badge className={STATUS_STYLES[agent.status] || STATUS_STYLES.draft}>
                      {agent.status}
                    </Badge>
                  </div>

                  {/* Description */}
                  {agent.description && (
                    <p className="text-sm text-gray-500 mb-4 line-clamp-2">{agent.description}</p>
                  )}

                  {/* Last run info */}
                  {lastRun && (
                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-4 p-2 bg-gray-50 rounded">
                      {RUN_STATUS_ICONS[lastRun.status] || RUN_STATUS_ICONS.completed}
                      <span>Last run {timeAgo(lastRun.started_at)}</span>
                      {lastRun.records_processed != null && (
                        <span className="text-gray-300">|</span>
                      )}
                      {lastRun.records_processed != null && (
                        <span>{lastRun.records_processed} processed</span>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" asChild>
                      <span>Edit</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-500 hover:text-red-700"
                      onClick={(e) => deleteAgent(agent.id, e)}
                    >
                      Delete
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled
                      title="Coming soon — duplicate this agent for another email or config"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
