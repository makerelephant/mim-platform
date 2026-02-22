"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { Search, GripVertical, List, Columns3 } from "lucide-react";

interface Investor {
  id: string;
  firm_name: string;
  description: string | null;
  investor_type: string | null;
  geography: string | null;
  location: string | null;
  sector_focus: string | null;
  check_size: string | null;
  connection_status: string | null;
  pipeline_status: string | null;
  likelihood_score: number | null;
  last_contact_date: string | null;
  next_action: string | null;
  website: string | null;
}

const PIPELINE_STATUSES = [
  "Prospect",
  "Qualified",
  "Engaged",
  "First Meeting",
  "In Closing",
  "Closed",
  "Passed",
];

const STATUS_COLORS: Record<string, string> = {
  Prospect: "bg-gray-100 border-gray-300",
  Qualified: "bg-yellow-50 border-yellow-300",
  Engaged: "bg-blue-50 border-blue-300",
  "First Meeting": "bg-indigo-50 border-indigo-300",
  "In Closing": "bg-green-50 border-green-300",
  Closed: "bg-green-100 border-green-400",
  Passed: "bg-red-50 border-red-300",
};

const STATUS_HEADER_COLORS: Record<string, string> = {
  Prospect: "bg-gray-200",
  Qualified: "bg-yellow-200",
  Engaged: "bg-blue-200",
  "First Meeting": "bg-indigo-200",
  "In Closing": "bg-green-200",
  Closed: "bg-green-300",
  Passed: "bg-red-200",
};

export default function InvestorsPage() {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [draggedId, setDraggedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("investors").select("*").order("firm_name");
      if (data) setInvestors(data);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = investors.filter((inv) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      inv.firm_name?.toLowerCase().includes(s) ||
      inv.sector_focus?.toLowerCase().includes(s) ||
      inv.geography?.toLowerCase().includes(s)
    );
  });

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = async (e: React.DragEvent, status: string) => {
    e.preventDefault();
    if (!draggedId) return;

    await supabase.from("investors").update({ pipeline_status: status }).eq("id", draggedId);
    setInvestors((prev) =>
      prev.map((inv) => (inv.id === draggedId ? { ...inv, pipeline_status: status } : inv))
    );
    setDraggedId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="flex gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-96 bg-gray-200 rounded flex-1" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Investor Pipeline</h1>
          <p className="text-gray-500 text-sm mt-1">{investors.length} firms</p>
        </div>
        <div className="flex gap-2">
          <Button variant={view === "kanban" ? "default" : "outline"} size="sm" onClick={() => setView("kanban")}>
            <Columns3 className="h-4 w-4 mr-1" /> Kanban
          </Button>
          <Button variant={view === "table" ? "default" : "outline"} size="sm" onClick={() => setView("table")}>
            <List className="h-4 w-4 mr-1" /> Table
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search firms..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {view === "kanban" ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {PIPELINE_STATUSES.map((status) => {
            const cards = filtered.filter((inv) => (inv.pipeline_status || "Prospect") === status);
            return (
              <div
                key={status}
                className="flex-shrink-0 w-64"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, status)}
              >
                <div className={`rounded-t-lg px-3 py-2 ${STATUS_HEADER_COLORS[status]}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{status}</span>
                    <Badge variant="secondary" className="text-xs">{cards.length}</Badge>
                  </div>
                </div>
                <div className={`rounded-b-lg border-2 ${STATUS_COLORS[status]} min-h-[200px] p-2 space-y-2`}>
                  {cards.map((inv) => (
                    <div
                      key={inv.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, inv.id)}
                      className="bg-white rounded-lg border shadow-sm p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                    >
                      <Link href={`/investors/${inv.id}`}>
                        <h3 className="text-sm font-medium text-gray-900 hover:text-blue-600">{inv.firm_name}</h3>
                      </Link>
                      {inv.sector_focus && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">{inv.sector_focus}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        {inv.connection_status && (
                          <Badge variant="outline" className="text-xs">{inv.connection_status}</Badge>
                        )}
                        {inv.likelihood_score != null && inv.likelihood_score > 0 && (
                          <span className="text-xs text-gray-400">Score: {inv.likelihood_score}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Firm</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Geography</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Sector Focus</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Pipeline Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Connection</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Score</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr key={inv.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/investors/${inv.id}`} className="text-blue-600 hover:underline font-medium">{inv.firm_name}</Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{inv.investor_type || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{inv.geography || "—"}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{inv.sector_focus || "—"}</td>
                    <td className="px-4 py-3"><Badge variant="secondary">{inv.pipeline_status || "Prospect"}</Badge></td>
                    <td className="px-4 py-3"><Badge variant="outline">{inv.connection_status || "—"}</Badge></td>
                    <td className="px-4 py-3 text-gray-600">{inv.likelihood_score ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
