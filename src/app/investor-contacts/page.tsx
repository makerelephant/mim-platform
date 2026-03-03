"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { labels } from "@/config/labels";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";

interface InvestorContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  organization: string | null;
  org_id: string | null;
  org_name: string | null;
  role: string | null;
  updated_at: string | null;
}

type SortField = "name" | "org_name" | "title" | "role";
type SortDir = "asc" | "desc";

export default function InvestorContactsPage() {
  const [contacts, setContacts] = useState<InvestorContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const fetchContacts = useCallback(async () => {
    setLoading(true);

    // Get contacts that are linked to investor-type organizations
    const { data: orgContacts, error } = await supabase
      .from("organization_contacts")
      .select(`
        role,
        contact:contacts!inner(id, name, email, phone, title, organization, updated_at),
        organization:organizations!inner(id, name, org_type)
      `)
      .contains("organizations.org_type", ["Investor"]);

    if (error) {
      console.error("Error fetching investor contacts:", error);
      setLoading(false);
      return;
    }

    // Flatten the joined data
    const flattened: InvestorContact[] = (orgContacts || []).map((oc: any) => ({
      id: oc.contact?.id,
      name: oc.contact?.name || "",
      email: oc.contact?.email,
      phone: oc.contact?.phone,
      title: oc.contact?.title,
      organization: oc.contact?.organization,
      org_id: oc.organization?.id,
      org_name: oc.organization?.name,
      role: oc.role,
      updated_at: oc.contact?.updated_at,
    }));

    // Deduplicate by contact id (a contact may be linked to multiple investor orgs)
    const seen = new Set<string>();
    const unique = flattened.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

    setContacts(unique);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const filtered = contacts
    .filter((c) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.org_name?.toLowerCase().includes(q) ||
        c.title?.toLowerCase().includes(q) ||
        c.role?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const av = (a[sortField] || "").toLowerCase();
      const bv = (b[sortField] || "").toLowerCase();
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3 inline ml-1" />
    ) : (
      <ChevronDown className="h-3 w-3 inline ml-1" />
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {labels.investorContactsPageTitle}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Contacts linked to investor organizations
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {filtered.length} contacts
        </Badge>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search by name, email, org, title…"
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

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No investor contacts found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th
                      className="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                      onClick={() => toggleSort("name")}
                    >
                      Name <SortIcon field="name" />
                    </th>
                    <th
                      className="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                      onClick={() => toggleSort("title")}
                    >
                      Title <SortIcon field="title" />
                    </th>
                    <th
                      className="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                      onClick={() => toggleSort("org_name")}
                    >
                      Organization <SortIcon field="org_name" />
                    </th>
                    <th
                      className="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                      onClick={() => toggleSort("role")}
                    >
                      Role <SortIcon field="role" />
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/contacts/${c.id}`}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.title || "—"}</td>
                      <td className="px-4 py-3">
                        {c.org_id ? (
                          <Link
                            href={`/investors/${c.org_id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {c.org_name}
                          </Link>
                        ) : (
                          <span className="text-gray-400">{c.organization || "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {c.role ? (
                          <Badge variant="outline" className="text-xs">
                            {c.role}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.email || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{c.phone || "—"}</td>
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
