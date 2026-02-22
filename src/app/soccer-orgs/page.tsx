"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Search, X } from "lucide-react";

interface SoccerOrg {
  id: string;
  org_name: string;
  org_type: string | null;
  corporate_structure: string | null;
  address: string | null;
  website: string | null;
  merch_link: string | null;
  store_status: string | null;
  store_provider: string | null;
  in_bays: boolean;
  in_cmysl: boolean;
  in_cysl: boolean;
  in_ecnl: boolean;
  in_ecysa: boolean;
  in_mysl: boolean;
  in_nashoba: boolean;
  in_necsl: boolean;
  in_roots: boolean;
  in_south_coast: boolean;
  in_south_shore: boolean;
}

const LEAGUE_FIELDS = [
  { key: "in_cmysl", label: "CMYSL" },
  { key: "in_cysl", label: "CYSL" },
  { key: "in_ecnl", label: "ECNL" },
  { key: "in_ecysa", label: "ECYSA" },
  { key: "in_mysl", label: "MYSL" },
  { key: "in_nashoba", label: "Nashoba" },
  { key: "in_necsl", label: "NECSL" },
  { key: "in_roots", label: "Roots" },
  { key: "in_south_coast", label: "South Coast" },
  { key: "in_south_shore", label: "South Shore" },
] as const;

export default function SoccerOrgsPage() {
  const [orgs, setOrgs] = useState<SoccerOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStructure, setFilterStructure] = useState("");
  const [filterLeague, setFilterLeague] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("soccer_orgs").select("*").order("org_name");
      if (data) setOrgs(data);
      setLoading(false);
    }
    load();
  }, []);

  const types = [...new Set(orgs.map((o) => o.org_type).filter(Boolean))] as string[];
  const structures = [...new Set(orgs.map((o) => o.corporate_structure).filter(Boolean))] as string[];

  const filtered = orgs.filter((o) => {
    if (search && !o.org_name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType && o.org_type !== filterType) return false;
    if (filterStructure && o.corporate_structure !== filterStructure) return false;
    if (filterLeague) {
      const key = `in_${filterLeague.toLowerCase().replace(/ /g, "_")}` as keyof SoccerOrg;
      if (!o[key]) return false;
    }
    return true;
  });

  const getLeagues = (o: SoccerOrg) => {
    return LEAGUE_FIELDS.filter((lf) => o[lf.key]).map((lf) => lf.label);
  };

  if (loading) {
    return <div className="p-8"><div className="animate-pulse h-64 bg-gray-200 rounded" /></div>;
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Soccer Organizations</h1>
          <p className="text-gray-500 text-sm mt-1">{filtered.length} of {orgs.length} organizations</p>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search organizations..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant={showFilters ? "default" : "outline"} onClick={() => setShowFilters(!showFilters)}>Filters</Button>
      </div>

      {showFilters && (
        <Card className="mb-4">
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Type</label>
                <select className="w-full border rounded-md px-2 py-1.5 text-sm" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                  <option value="">All</option>
                  {types.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Structure</label>
                <select className="w-full border rounded-md px-2 py-1.5 text-sm" value={filterStructure} onChange={(e) => setFilterStructure(e.target.value)}>
                  <option value="">All</option>
                  {structures.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">League</label>
                <select className="w-full border rounded-md px-2 py-1.5 text-sm" value={filterLeague} onChange={(e) => setFilterLeague(e.target.value)}>
                  <option value="">All</option>
                  {LEAGUE_FIELDS.map((lf) => <option key={lf.key} value={lf.key.replace("in_", "")}>{lf.label}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <Button variant="ghost" size="sm" onClick={() => { setFilterType(""); setFilterStructure(""); setFilterLeague(""); }}>
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
                <th className="text-left px-4 py-3 font-medium text-gray-500">Organization</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Structure</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Website</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Leagues</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/soccer-orgs/${o.id}`} className="text-blue-600 hover:underline font-medium">{o.org_name}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{o.org_type || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{o.corporate_structure || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {o.website ? (
                      <a href={o.website.startsWith("http") ? o.website : `https://${o.website}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline truncate block max-w-[200px]">
                        {o.website}
                      </a>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {getLeagues(o).map((l) => <Badge key={l} variant="outline" className="text-xs">{l}</Badge>)}
                    </div>
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
