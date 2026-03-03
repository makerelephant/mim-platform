"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { labels } from "@/config/labels";
import { OPPORTUNITY_STAGES } from "@/config/organization-constants";
import { Search, X } from "lucide-react";

interface Opportunity {
  id: string;
  name: string;
  stage: string;
  value: number | null;
  probability: number | null;
  expected_close_date: string | null;
  owner: string | null;
  org_name: string | null;
  organization_id: string;
}

export default function PartnershipPipelinePage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchOpportunities = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("opportunities")
      .select(`
        id, name, stage, value, probability, expected_close_date, owner, organization_id,
        organization:organizations!inner(name)
      `)
      .eq("deal_type", "partnership")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching partnership pipeline:", error);
      setLoading(false);
      return;
    }

    const mapped: Opportunity[] = (data || []).map((o: any) => ({
      id: o.id,
      name: o.name,
      stage: o.stage,
      value: o.value,
      probability: o.probability,
      expected_close_date: o.expected_close_date,
      owner: o.owner,
      org_name: o.organization?.name || "—",
      organization_id: o.organization_id,
    }));

    setOpportunities(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  const filtered = opportunities.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.name.toLowerCase().includes(q) ||
      o.org_name?.toLowerCase().includes(q) ||
      o.stage.toLowerCase().includes(q)
    );
  });

  const stageColor = (stage: string) => {
    switch (stage) {
      case "Closed Won": return "bg-green-100 text-green-800";
      case "Closed Lost": return "bg-red-100 text-red-800";
      case "In Closing": return "bg-blue-100 text-blue-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {labels.partnershipPipelinePageTitle}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Partnership deals and opportunities
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {filtered.length} opportunities
        </Badge>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search by name, org, stage…"
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
              No partnership opportunities yet. They&apos;ll appear here when created.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Deal Name</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Organization</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Stage</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Value</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Probability</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Expected Close</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o) => (
                    <tr key={o.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium">{o.name}</td>
                      <td className="px-4 py-3 text-blue-600">{o.org_name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${stageColor(o.stage)}`}>
                          {o.stage}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {o.value ? `$${o.value.toLocaleString()}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {o.probability != null ? `${o.probability}%` : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {o.expected_close_date || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{o.owner || "—"}</td>
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
