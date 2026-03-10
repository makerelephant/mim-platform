"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { labels } from "@/config/labels";
import Link from "next/link";
import { Search, X, Plus, Building2, Trash2 } from "lucide-react";

interface Assignment {
  id: string;
  organization_id: string;
  org_name: string;
  category_id: string;
  category_name: string;
  geography_name: string | null;
  status: string;
  tier: string | null;
  owner: string | null;
  start_date: string | null;
}

interface CategoryOption {
  id: string;
  name: string;
  parent_name: string | null;
}

export default function CategoryGeoAssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  // Add assignment form
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [orgSearch, setOrgSearch] = useState("");
  const [orgResults, setOrgResults] = useState<{ id: string; name: string }[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<{ id: string; name: string } | null>(null);
  const [addStatus, setAddStatus] = useState("active");
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const partnerIdsRef = useRef<string[]>([]);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);

    // org_community_relationships stays in public schema
    const { data, error } = await supabase
      .from("org_community_relationships")
      .select(`
        id,
        organization_id,
        category_id,
        status,
        tier,
        owner,
        start_date,
        category:community_categories!inner(name),
        geography:geographies(name)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching assignments:", error);
      setLoading(false);
      return;
    }

    // Load org names from core.organizations (separate query - cross-schema embed not supported)
    const orgIds = [...new Set((data || []).map((r: any) => r.organization_id))];
    let orgNameMap = new Map<string, string>();
    if (orgIds.length > 0) {
      const { data: orgData } = await supabase
        .schema('core').from("organizations").select("id, name").in("id", orgIds);
      for (const o of orgData || []) orgNameMap.set(o.id, o.name);
    }

    const mapped: Assignment[] = (data || []).map((r: any) => ({
      id: r.id,
      organization_id: r.organization_id,
      org_name: orgNameMap.get(r.organization_id) || "—",
      category_id: r.category_id,
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

  const fetchCategoryOptions = useCallback(async () => {
    // community_categories stays in public schema
    const { data } = await supabase
      .from("community_categories")
      .select("id, name, parent_id, sort_order")
      .order("sort_order", { ascending: true });

    if (data) {
      const byId = new Map(data.map((c: any) => [c.id, c]));
      const options: CategoryOption[] = data.map((c: any) => ({
        id: c.id,
        name: c.name,
        parent_name: c.parent_id ? (byId.get(c.parent_id) as any)?.name || null : null,
      }));
      setCategoryOptions(options);
    }
  }, []);

  const loadPartnerIds = useCallback(async () => {
    const { data } = await supabase
      .schema('core').from("org_types").select("org_id").eq("type", "Partner");
    partnerIdsRef.current = (data || []).map((r) => r.org_id);
  }, []);

  useEffect(() => {
    fetchAssignments();
    fetchCategoryOptions();
    loadPartnerIds();
  }, [fetchAssignments, fetchCategoryOptions, loadPartnerIds]);

  const searchOrgs = async (q: string) => {
    if (q.length < 1) { setOrgResults([]); return; }
    if (partnerIdsRef.current.length === 0) { setOrgResults([]); return; }
    const { data } = await supabase
      .schema('core').from("organizations")
      .select("id, name")
      .in("id", partnerIdsRef.current)
      .ilike("name", `%${q}%`)
      .order("name")
      .limit(10);
    setOrgResults(data || []);
  };

  const handleOrgSearchChange = (val: string) => {
    setOrgSearch(val);
    setSelectedOrg(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchOrgs(val), 250);
  };

  const handleAddAssignment = async () => {
    if (!selectedOrg || !selectedCategoryId) return;
    setSaving(true);
    // org_community_relationships stays in public schema
    const { error } = await supabase.from("org_community_relationships").insert({
      organization_id: selectedOrg.id,
      category_id: selectedCategoryId,
      status: addStatus,
    });
    if (!error) {
      setShowAdd(false);
      setSelectedOrg(null);
      setOrgSearch("");
      setSelectedCategoryId("");
      fetchAssignments();
    } else {
      alert(error.message.includes("unique") ? "This organization is already assigned to this category." : error.message);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("org_community_relationships").delete().eq("id", id);
    if (!error) fetchAssignments();
  };

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
            Partner organization assignments by category
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-sm">
            {filtered.length} assignments
          </Badge>
          <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
            {showAdd ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            {showAdd ? "Cancel" : "Add Assignment"}
          </Button>
        </div>
      </div>

      {/* Add assignment form */}
      {showAdd && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Org search */}
              <div className="relative">
                <label className="text-xs text-gray-500 mb-1 block">Partner Organization</label>
                {selectedOrg ? (
                  <div className="flex items-center gap-2 border rounded-md px-3 py-1.5 bg-white text-sm">
                    <Building2 className="h-3.5 w-3.5 text-gray-400" />
                    <span>{selectedOrg.name}</span>
                    <button onClick={() => { setSelectedOrg(null); setOrgSearch(""); }} className="ml-auto">
                      <X className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Input
                      value={orgSearch}
                      onChange={(e) => handleOrgSearchChange(e.target.value)}
                      placeholder="Search partner orgs…"
                      className="text-sm"
                    />
                    {orgResults.length > 0 && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {orgResults.map((o) => (
                          <button
                            key={o.id}
                            className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b last:border-0"
                            onClick={() => { setSelectedOrg(o); setOrgSearch(o.name); setOrgResults([]); }}
                          >
                            {o.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Category select */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Category</label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full border rounded-md px-2 py-1.5 text-sm"
                >
                  <option value="">Select category…</option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.parent_name ? `${c.parent_name} → ${c.name}` : c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status + submit */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Status</label>
                <div className="flex items-center gap-2">
                  <select
                    value={addStatus}
                    onChange={(e) => setAddStatus(e.target.value)}
                    className="border rounded-md px-2 py-1.5 text-sm flex-1"
                  >
                    <option value="active">Active</option>
                    <option value="target">Target</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <Button
                    size="sm"
                    onClick={handleAddAssignment}
                    disabled={!selectedOrg || !selectedCategoryId || saving}
                  >
                    {saving ? "Saving…" : "Add"}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
              No assignments found. Click &quot;Add Assignment&quot; to assign a partner organization to a category.
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
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    <tr key={a.id} className="border-b hover:bg-gray-50 transition-colors group">
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/soccer-orgs/${a.organization_id}`} className="text-blue-600 hover:underline">
                          {a.org_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{a.category_name}</td>
                      <td className="px-4 py-3 text-gray-600">{a.geography_name || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(a.status)}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{a.tier || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{a.owner || "—"}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDelete(a.id)}
                          className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove assignment"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
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
