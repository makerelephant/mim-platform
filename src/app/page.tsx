"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Users, TrendingUp, Map, CheckSquare, Plus, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Stats {
  contacts: number;
  investors: number;
  programs: number;
  openTasks: number;
}

interface ActivityEntry {
  id: string;
  agent_name: string;
  action_type: string;
  summary: string;
  created_at: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ contacts: 0, investors: 0, programs: 0, openTasks: 0 });
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [
        { count: contacts },
        { count: investors },
        { count: programs },
        { count: openTasks },
        { data: activityData },
      ] = await Promise.all([
        supabase.from("contacts").select("*", { count: "exact", head: true }),
        supabase.from("investors").select("*", { count: "exact", head: true }),
        supabase.from("market_map").select("*", { count: "exact", head: true }),
        supabase.from("tasks").select("*", { count: "exact", head: true }).in("status", ["todo", "in_progress"]),
        supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(20),
      ]);

      setStats({
        contacts: contacts ?? 0,
        investors: investors ?? 0,
        programs: programs ?? 0,
        openTasks: openTasks ?? 0,
      });
      setActivities(activityData ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const cards = [
    { label: "Contacts", value: stats.contacts, icon: Users, href: "/contacts", color: "text-blue-600" },
    { label: "Investors", value: stats.investors, icon: TrendingUp, href: "/investors", color: "text-green-600" },
    { label: "Market Map Programs", value: stats.programs, icon: Map, href: "/market-map", color: "text-orange-600" },
    { label: "Open Tasks", value: stats.openTasks, icon: CheckSquare, href: "/tasks", color: "text-purple-600" },
  ];

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Welcome back, Mark</p>
        </div>
        <div className="flex gap-2">
          <Link href="/contacts?new=true">
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" /> Add Contact
            </Button>
          </Link>
          <Link href="/tasks?new=true">
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" /> Add Task
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(({ label, value, icon: Icon, href, color }) => (
          <Link key={label} href={href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">{label}</CardTitle>
                <Icon className={`h-5 w-5 ${color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{value.toLocaleString()}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Activity</CardTitle>
          <Link href="/activity">
            <Button variant="ghost" size="sm">View All</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Activity className="h-8 w-8 mx-auto mb-2" />
              <p>No activity yet. Agents will log actions here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((a) => (
                <div key={a.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">{a.summary}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {a.agent_name} &middot; {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
