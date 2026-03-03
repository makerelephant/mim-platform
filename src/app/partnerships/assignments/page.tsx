"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { labels } from "@/config/labels";
import { Search, X, Plus } from "lucide-react";

interface Assignment {
  id: string;
  organization_id: string;
  org_name: string;
  category_name: string;
  geography_name: string | null;
  status: string;
  tier: string | null;
  owner: string | null;
  start_date: string | null;
}

export default function CategoryGeoAssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchAssignments = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("org_community_relationships")
      .select(`
        id,
        organization_id,
        status,
        tier,
        owner,
        start_date,
        organization:organizations!inner(name),
        category:community_categories!inner(name),
        geography:geographies(name)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching assignments:", error);
      setLoading(false);
      return;
    }

    const mapped: Assignment[] = (data || []).map((r: any) => ({
      id: r.id,
      organization_id: r.organization_id,
      org_name: r.organization?.name || "—",
      category_name: r.category?.name || "—",
      geography_name: r.geography?.name || null,
      status: r.status || "target",
      tier: r.tier,
      owner: r.owner,
      start_date: r.start_date,
    }));

    setAssignments(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const filtered = assignments.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.org_name.toLowerCase().includes(q) ||
      a.category_name.toLowerCase().includes(q) ||
      a.geography_name?.toLowerCase().includes(q) ||
      a.status.toLowerCase().includes(q) ||
      a.owner?.toLowerCase().includes(q)
    );
  });

  const statusColor = (s: string) => {
    switch (s) {
      case "active": return "bg-green-100 text-green-800";
      case "inactive": return "bg-gray-100 text-gray-600";
      default: return "bg-yellow-100 text-yellow-800";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {labels.categoryGeoPageTitle}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Organization assignments by community category and geography
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {filtered.length} assignments
        </Badge>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search by org, category, geography…"
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

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No assignments found. Run the migration to populate category × geo data.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Organization</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Geography</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Tier</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    <tr key={a.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium">{a.org_name}</td>
                      <td className="px-4 py-3">{a.category_name}</td>
                      <td className="px-4 py-3 text-gray-600">{a.geography_name || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(a.status)}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{a.tier || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{a.owner || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
