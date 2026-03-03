"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Search, X, Users, DollarSign, Map as MapIcon, Target } from "lucide-react";

interface Program {
  id: string;
  league: string;
  program_name: string;
  players: number | null;
  travel_teams: number | null;
  dues_per_season: number | null;
  total_revenue: number | null;
  primary_contact: string | null;
  website: string | null;
  merch_link: string | null;
  outreach_status: string | null;
  last_outreach_date: string | null;
}

const LEAGUES = ["BAYS", "CMYSL", "CYSL", "ECYSA", "MYSL", "Nashoba", "NECSL", "Roots", "South Coast", "South Shore"];

const OUTREACH_STATUSES = ["Not Contacted", "Contacted", "Meeting Scheduled", "Active Partner", "Not Interested"];

const OUTREACH_COLORS: Record<string, string> = {
  "Not Contacted": "bg-gray-100 text-gray-700",
  Contacted: "bg-blue-100 text-blue-700",
  "Meeting Scheduled": "bg-yellow-100 text-yellow-700",
  "Active Partner": "bg-green-100 text-green-700",
  "Not Interested": "bg-red-100 text-red-700",
};

export default function MarketMapPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterLeague, setFilterLeague] = useState("");
  const [filterOutreach, setFilterOutreach] = useState("");
  const [filterHasMerch, setFilterHasMerch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("market_map").select("*").order("league").order("program_name");
      if (data) setPrograms(data);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = programs.filter((p) => {
    if (search) {
      const s = search.toLowerCase();
      if (!p.program_name?.toLowerCase().includes(s) && !p.league?.toLowerCase().includes(s) && !p.primary_contact?.toLowerCase().includes(s)) return false;
    }
    if (filterLeague && p.league !== filterLeague) return false;
    if (filterOutreach && p.outreach_status !== filterOutreach) return false;
    if (filterHasMerch && !p.merch_link) return false;
    return true;
  });

  const totalPlayers = filtered.reduce((sum, p) => sum + (p.players || 0), 0);
  const totalRevenue = filtered.reduce((sum, p) => sum + (p.total_revenue || 0), 0);
  const contacted = filtered.filter((p) => p.outreach_status && p.outreach_status !== "Not Contacted").length;

  if (loading) {
    return <div className="p-8"><div className="animate-pulse h-64 bg-gray-200 rounded" /></div>;
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">MA Market Map</h1>
          <p className="text-gray-500 text-sm mt-1">{filtered.length} programs across {LEAGUES.length} leagues</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-gray-500"><MapIcon className="h-4 w-4" /> Programs</div>
            <p className="text-2xl font-bold mt-1">{filtered.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-gray-500"><Users className="h-4 w-4" /> Players</div>
            <p className="text-2xl font-bold mt-1">{totalPlayers.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-gray-500"><DollarSign className="h-4 w-4" /> Revenue</div>
            <p className="text-2xl font-bold mt-1">${(totalRevenue / 1000000).toFixed(1)}M</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-gray-500"><Target className="h-4 w-4" /> Contacted</div>
            <p className="text-2xl font-bold mt-1">{contacted > 0 ? `${Math.round((contacted / filtered.length) * 100)}%` : "0%"}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search programs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant={showFilters ? "default" : "outline"} onClick={() => setShowFilters(!showFilters)}>
          Filters
        </Button>
      </div>

      {showFilters && (
        <Card className="mb-4">
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">League</label>
                <select className="w-full border rounded-md px-2 py-1.5 text-sm" value={filterLeague} onChange={(e) => setFilterLeague(e.target.value)}>
                  <option value="">All</option>
                  {LEAGUES.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Outreach Status</label>
                <select className="w-full border rounded-md px-2 py-1.5 text-sm" value={filterOutreach} onChange={(e) => setFilterOutreach(e.target.value)}>
                  <option value="">All</option>
                  {OUTREACH_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={filterHasMerch} onChange={(e) => setFilterHasMerch(e.target.checked)} />
                  Has Merch Link
                </label>
              </div>
              <div className="flex items-end">
                <Button variant="ghost" size="sm" onClick={() => { setFilterLeague(""); setFilterOutreach(""); setFilterHasMerch(false); }}>
                  <X className="h-3 w-3 mr-1" /> Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">League</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Program</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Players</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Teams</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Dues</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Revenue</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Contact</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Outreach</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3"><Badge variant="secondary">{p.league}</Badge></td>
                  <td className="px-4 py-3">
                    <Link href={`/market-map/${p.id}`} className="text-blue-600 hover:underline font-medium">{p.program_name}</Link>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{p.players?.toLocaleString() || "—"}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{p.travel_teams || "—"}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{p.dues_per_season ? `$${p.dues_per_season}` : "—"}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{p.total_revenue ? `$${p.total_revenue.toLocaleString()}` : "—"}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[150px] truncate">{p.primary_contact || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge className={OUTREACH_COLORS[p.outreach_status || "Not Contacted"]}>{p.outreach_status || "Not Contacted"}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
