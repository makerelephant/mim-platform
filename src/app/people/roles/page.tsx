"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { labels } from "@/config/labels";
import { Search, X } from "lucide-react";

interface ContactRole {
  id: string;
  contact_id: string;
  contact_name: string;
  organization_id: string;
  org_name: string;
  role: string | null;
  created_at: string | null;
}

export default function RolesPage() {
  const [roles, setRoles] = useState<ContactRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchRoles = useCallback(async () => {
    setLoading(true);

    // core.relationships (was organization_contacts) — cross-schema embed not supported
    const { data: rels, error } = await supabase
      .schema('core').from("relationships")
      .select("id, contact_id, org_id, relationship_type, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching roles:", error);
      setLoading(false);
      return;
    }

    // Load contact and org names separately
    const contactIds = [...new Set((rels || []).map((r) => r.contact_id))];
    const orgIds = [...new Set((rels || []).map((r) => r.org_id))];

    const [contactResult, orgResult] = await Promise.all([
      contactIds.length > 0
        ? supabase.schema('core').from("contacts").select("id, first_name, last_name").in("id", contactIds)
        : { data: [] },
      orgIds.length > 0
        ? supabase.schema('core').from("organizations").select("id, name").in("id", orgIds)
        : { data: [] },
    ]);

    const contactNameMap = new Map<string, string>();
    for (const c of contactResult.data || []) {
      contactNameMap.set(c.id, [c.first_name, c.last_name].filter(Boolean).join(" ") || "(unnamed)");
    }

    const orgNameMap = new Map<string, string>();
    for (const o of orgResult.data || []) orgNameMap.set(o.id, o.name);

    const mapped: ContactRole[] = (rels || []).map((r: any) => ({
      id: r.id,
      contact_id: r.contact_id,
      contact_name: contactNameMap.get(r.contact_id) || "—",
      organization_id: r.org_id,
      org_name: orgNameMap.get(r.org_id) || "—",
      role: r.relationship_type,
      created_at: r.created_at,
    }));

    setRoles(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const filtered = roles.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.contact_name.toLowerCase().includes(q) ||
      r.org_name.toLowerCase().includes(q) ||
      r.role?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {labels.rolesPageTitle}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Contact-to-organization role assignments
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {filtered.length} roles
        </Badge>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search by contact, organization, or role…"
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
            <div className="p-8 text-center text-gray-500">No contact roles found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Contact</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Organization</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/contacts/${r.contact_id}`}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          {r.contact_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/investors/${r.organization_id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {r.org_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {r.role ? (
                          <Badge variant="outline" className="text-xs">
                            {r.role}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
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
