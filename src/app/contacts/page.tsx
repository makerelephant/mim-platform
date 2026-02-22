"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  segment: string | null;
  primary_category: string | null;
  subcategory: string | null;
  region: string | null;
}

type SortField = "name" | "segment" | "primary_category" | "region";
type SortDir = "asc" | "desc";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSegment, setFilterSegment] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterRegion, setFilterRegion] = useState("");
  const [filterHasEmail, setFilterHasEmail] = useState(false);
  const [filterHasPhone, setFilterHasPhone] = useState(false);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [segments, setSegments] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("contacts")
        .select("id, name, email, phone, title, segment, primary_category, subcategory, region")
        .order("name");

      if (data) {
        setContacts(data);
        const segs = [...new Set(data.map((c) => c.segment).filter(Boolean))] as string[];
        const cats = [...new Set(data.map((c) => c.primary_category).filter(Boolean))] as string[];
        setSegments(segs.sort());
        setCategories(cats.sort());
      }
      setLoading(false);
    }
    load();
  }, []);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  const filtered = contacts
    .filter((c) => {
      if (search) {
        const s = search.toLowerCase();
        if (
          !c.name?.toLowerCase().includes(s) &&
          !c.email?.toLowerCase().includes(s) &&
          !c.title?.toLowerCase().includes(s)
        )
          return false;
      }
      if (filterSegment && c.segment !== filterSegment) return false;
      if (filterCategory && c.primary_category !== filterCategory) return false;
      if (filterRegion && c.region !== filterRegion) return false;
      if (filterHasEmail && !c.email) return false;
      if (filterHasPhone && !c.phone) return false;
      return true;
    })
    .sort((a, b) => {
      const aVal = (a[sortField] || "").toLowerCase();
      const bVal = (b[sortField] || "").toLowerCase();
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });

  const activeFilters = [filterSegment, filterCategory, filterRegion, filterHasEmail, filterHasPhone].filter(Boolean).length;

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-10 bg-gray-200 rounded" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-12 bg-gray-200 rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-gray-500 text-sm mt-1">{filtered.length} of {contacts.length} contacts</p>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name, email, or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant={showFilters ? "default" : "outline"}
          onClick={() => setShowFilters(!showFilters)}
        >
          Filters {activeFilters > 0 && `(${activeFilters})`}
        </Button>
      </div>

      {showFilters && (
        <Card className="mb-4">
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Segment</label>
                <select
                  className="w-full border rounded-md px-2 py-1.5 text-sm"
                  value={filterSegment}
                  onChange={(e) => setFilterSegment(e.target.value)}
                >
                  <option value="">All</option>
                  {segments.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Category</label>
                <select
                  className="w-full border rounded-md px-2 py-1.5 text-sm"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <option value="">All</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Region</label>
                <select
                  className="w-full border rounded-md px-2 py-1.5 text-sm"
                  value={filterRegion}
                  onChange={(e) => setFilterRegion(e.target.value)}
                >
                  <option value="">All</option>
                  <option value="Massachusetts">Massachusetts</option>
                </select>
              </div>
              <div className="flex items-end gap-3">
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={filterHasEmail} onChange={(e) => setFilterHasEmail(e.target.checked)} />
                  Has Email
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={filterHasPhone} onChange={(e) => setFilterHasPhone(e.target.checked)} />
                  Has Phone
                </label>
              </div>
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setFilterSegment(""); setFilterCategory(""); setFilterRegion(""); setFilterHasEmail(false); setFilterHasPhone(false); }}
                >
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
                <th className="text-left px-4 py-3 font-medium text-gray-500 cursor-pointer" onClick={() => toggleSort("name")}>
                  <span className="flex items-center gap-1">Name <SortIcon field="name" /></span>
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Title</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 cursor-pointer" onClick={() => toggleSort("segment")}>
                  <span className="flex items-center gap-1">Segment <SortIcon field="segment" /></span>
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 cursor-pointer" onClick={() => toggleSort("primary_category")}>
                  <span className="flex items-center gap-1">Category <SortIcon field="primary_category" /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3">
                    <Link href={`/contacts/${c.id}`} className="text-blue-600 hover:underline font-medium">{c.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.email || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{c.phone || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{c.title || "—"}</td>
                  <td className="px-4 py-3">
                    {c.segment && <Badge variant="secondary">{c.segment}</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    {c.primary_category && (
                      <Badge
                        className={
                          c.primary_category === "Youth Sports" ? "bg-green-100 text-green-800" :
                          c.primary_category === "MiM" ? "bg-blue-100 text-blue-800" :
                          "bg-orange-100 text-orange-800"
                        }
                      >
                        {c.primary_category}
                      </Badge>
                    )}
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
