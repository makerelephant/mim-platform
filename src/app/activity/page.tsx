"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow, format } from "date-fns";
import { Activity, Search } from "lucide-react";

interface ActivityEntry {
  id: string;
  agent_name: string;
  action_type: string;
  entity_type: string | null;
  entity_id: string | null;
  summary: string;
  raw_data: Record<string, unknown> | null;
  created_at: string;
}

const AGENT_COLORS: Record<string, string> = {
  "gmail-scanner": "bg-red-100 text-red-700",
  "investor-enrich": "bg-purple-100 text-purple-700",
  "stale-detector": "bg-yellow-100 text-yellow-700",
  "outreach-tracker": "bg-green-100 text-green-700",
  manual: "bg-blue-100 text-blue-700",
  system: "bg-gray-100 text-gray-700",
};

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAgent, setFilterAgent] = useState("");
  const [filterEntity, setFilterEntity] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(200);
      if (data) setActivities(data);
      setLoading(false);
    }
    load();
  }, []);

  const agents = [...new Set(activities.map((a) => a.agent_name))];
  const entityTypes = [...new Set(activities.map((a) => a.entity_type).filter(Boolean))] as string[];

  const filtered = activities.filter((a) => {
    if (filterAgent && a.agent_name !== filterAgent) return false;
    if (filterEntity && a.entity_type !== filterEntity) return false;
    if (search && !a.summary?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return <div className="p-8"><div className="animate-pulse h-64 bg-gray-200 rounded" /></div>;
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
          <p className="text-gray-500 text-sm mt-1">{activities.length} entries</p>
        </div>
      </div>

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
                  <p className="text-sm text-gray-800">{a.summary}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={AGENT_COLORS[a.agent_name] || "bg-gray-100 text-gray-700"} >{a.agent_name}</Badge>
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
