"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { labels } from "@/config/labels";
import { timeAgo } from "@/lib/timeAgo";
import Link from "next/link";
import {
  Search, X, Mail, ArrowUpRight, ArrowDownLeft, MessageSquare,
  CheckSquare, Filter, Building2, Calendar,
} from "lucide-react";

/* ── Types ── */

interface ActivityItem {
  id: string;
  type: "email" | "task";
  date: string;
  title: string;
  snippet: string | null;
  direction: string | null;
  source: string | null;
  sender: string | null;
  recipient: string | null;
  org_id: string;
  org_name: string;
  priority: string | null;
  status: string | null;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-gray-100 text-gray-600",
};

/* ── Page ── */

export default function FundraisingActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterOrg, setFilterOrg] = useState<string>("");
  const [investorOrgs, setInvestorOrgs] = useState<{ id: string; name: string }[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);

    // 1. Get all investor org IDs
    const { data: orgs } = await supabase
      .from("organizations")
      .select("id, name")
      .contains("org_type", ["Investor"])
      .order("name");

    if (!orgs || orgs.length === 0) {
      setInvestorOrgs([]);
      setItems([]);
      setLoading(false);
      return;
    }

    setInvestorOrgs(orgs);
    const orgIds = orgs.map((o) => o.id);
    const orgMap = new Map(orgs.map((o) => [o.id, o.name]));

    // 2. Fetch correspondence for these orgs
    const { data: corr } = await supabase
      .from("correspondence")
      .select("id, direction, subject, snippet, sender_email, sender_name, recipient_email, email_date, source, entity_id")
      .eq("entity_type", "organizations")
      .in("entity_id", orgIds)
      .order("email_date", { ascending: false })
      .limit(300);

    // 3. Fetch tasks for these orgs
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, summary, description, priority, status, created_at, entity_id")
      .eq("entity_type", "organizations")
      .in("entity_id", orgIds)
      .order("created_at", { ascending: false })
      .limit(200);

    // 4. Build unified items
    const all: ActivityItem[] = [];

    (corr || []).forEach((c: any) => {
      all.push({
        id: `corr-${c.id}`,
        type: "email",
        date: c.email_date || "",
        title: c.subject || "(no subject)",
        snippet: c.snippet,
        direction: c.direction,
        source: c.source,
        sender: c.sender_name || c.sender_email,
        recipient: c.recipient_email,
        org_id: c.entity_id,
        org_name: orgMap.get(c.entity_id) || "—",
        priority: null,
        status: null,
      });
    });

    (tasks || []).forEach((t: any) => {
      all.push({
        id: `task-${t.id}`,
        type: "task",
        date: t.created_at || "",
        title: t.title || "Untitled task",
        snippet: t.summary || t.description,
        direction: null,
        source: null,
        sender: null,
        recipient: null,
        org_id: t.entity_id,
        org_name: orgMap.get(t.entity_id) || "—",
        priority: t.priority,
        status: t.status,
      });
    });

    // Sort by date descending
    all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setItems(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtering
  const filtered = items.filter((item) => {
    if (filterType && item.type !== filterType) return false;
    if (filterOrg && item.org_id !== filterOrg) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.snippet?.toLowerCase().includes(q) ||
        item.org_name.toLowerCase().includes(q) ||
        item.sender?.toLowerCase().includes(q) ||
        item.recipient?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Stats
  const emailCount = items.filter((i) => i.type === "email").length;
  const taskCount = items.filter((i) => i.type === "task").length;

  // Group by date
  const groupByDate = (list: ActivityItem[]) => {
    const groups: { label: string; items: ActivityItem[] }[] = [];
    let currentLabel = "";
    for (const item of list) {
      const d = new Date(item.date);
      const label = isNaN(d.getTime())
        ? "Unknown"
        : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
      if (label !== currentLabel) {
        groups.push({ label, items: [] });
        currentLabel = label;
      }
      groups[groups.length - 1].items.push(item);
    }
    return groups;
  };

  const grouped = groupByDate(filtered);

  const getIcon = (item: ActivityItem) => {
    if (item.type === "task") return <CheckSquare className="h-4 w-4 text-amber-500" />;
    if (item.source === "slack") return <MessageSquare className="h-4 w-4 text-indigo-500" />;
    if (item.direction === "outbound") return <ArrowUpRight className="h-4 w-4 text-blue-500" />;
    return <ArrowDownLeft className="h-4 w-4 text-green-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Fundraising {labels.fundraisingActivity}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Emails, tasks, and notes related to investor engagements
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm">
            <Mail className="h-3 w-3 mr-1" /> {emailCount} emails
          </Badge>
          <Badge variant="secondary" className="text-sm">
            <CheckSquare className="h-3 w-3 mr-1" /> {taskCount} tasks
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search emails, tasks, contacts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-8"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
        <select
          className="border rounded-md px-3 py-1.5 text-sm"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">All types</option>
          <option value="email">Emails only</option>
          <option value="task">Tasks only</option>
        </select>
        <select
          className="border rounded-md px-3 py-1.5 text-sm"
          value={filterOrg}
          onChange={(e) => setFilterOrg(e.target.value)}
        >
          <option value="">All investors</option>
          {investorOrgs.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        {(filterType || filterOrg) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setFilterType(""); setFilterOrg(""); }}
          >
            <X className="h-3.5 w-3.5 mr-1" /> Clear filters
          </Button>
        )}
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse h-20 bg-gray-100 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Mail className="h-12 w-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No fundraising activity yet</p>
            <p className="text-sm text-gray-400 mt-1">
              {items.length === 0
                ? "Run the Gmail scanner from the Activity page to import investor correspondence."
                : "Try adjusting your filters to see more results."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.label}>
              {/* Date header */}
              <div className="flex items-center gap-2 mb-2 sticky top-0 bg-gray-50/90 backdrop-blur-sm py-1.5 -mx-1 px-1 z-10">
                <Calendar className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{group.label}</span>
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">{group.items.length}</span>
              </div>

              <div className="space-y-2">
                {group.items.map((item) => (
                  <Card key={item.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="py-3 px-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 shrink-0">{getIcon(item)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium text-gray-900 truncate">
                              {item.title}
                            </span>
                            {item.priority && (
                              <Badge className={`text-[10px] ${PRIORITY_COLORS[item.priority] || ""}`}>
                                {item.priority}
                              </Badge>
                            )}
                            {item.status && item.type === "task" && (
                              <Badge variant="outline" className="text-[10px]">{item.status}</Badge>
                            )}
                          </div>

                          {item.snippet && (
                            <p className="text-xs text-gray-500 line-clamp-2 mb-1">{item.snippet}</p>
                          )}

                          <div className="flex items-center gap-3 text-[11px] text-gray-400">
                            {/* Investor org */}
                            <Link
                              href={`/investors/${item.org_id}`}
                              className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                            >
                              <Building2 className="h-3 w-3" />
                              {item.org_name}
                            </Link>

                            {/* Email metadata */}
                            {item.type === "email" && item.direction === "outbound" && item.recipient && (
                              <span>To: {item.recipient}</span>
                            )}
                            {item.type === "email" && item.direction === "inbound" && item.sender && (
                              <span>From: {item.sender}</span>
                            )}
                            {item.source && (
                              <Badge variant="outline" className="text-[10px] h-4">
                                {item.source}
                              </Badge>
                            )}

                            {/* Time */}
                            <span className="ml-auto shrink-0">{timeAgo(item.date)}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
