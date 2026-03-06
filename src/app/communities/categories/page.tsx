"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { labels } from "@/config/labels";
import Link from "next/link";
import {
  Search, X, ChevronRight, ChevronDown, Plus, Pencil, Trash2,
  Building2, Users,
} from "lucide-react";

interface OrgLink {
  link_id: string;
  org_id: string;
  org_name: string;
  status: string;
}

interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  description: string | null;
  sort_order: number;
  children: Category[];
  org_count: number;
  orgs: OrgLink[];
}

export default function CommunityCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showOrgsFor, setShowOrgsFor] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [addingParent, setAddingParent] = useState(false);
  const [addingChildOf, setAddingChildOf] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  // Assign org state
  const [assigningTo, setAssigningTo] = useState<string | null>(null);
  const [orgSearch, setOrgSearch] = useState("");
  const [orgResults, setOrgResults] = useState<{ id: string; name: string }[]>([]);
  const [orgSearching, setOrgSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchCategories = useCallback(async () => {
    setLoading(true);

    const { data: cats, error } = await supabase
      .from("community_categories")
      .select("id, name, parent_id, description, sort_order")
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Error fetching categories:", error);
      setLoading(false);
      return;
    }

    // Fetch all org-category relationships with org names
    const { data: rels } = await supabase
      .from("org_community_relationships")
      .select("id, category_id, status, organization:organizations!inner(id, name)")
      .order("created_at", { ascending: false });

    // Build org lists per category
    const orgsByCategory: Record<string, OrgLink[]> = {};
    (rels || []).forEach((r: any) => {
      const catId = r.category_id;
      if (!orgsByCategory[catId]) orgsByCategory[catId] = [];
      orgsByCategory[catId].push({
        link_id: r.id,
        org_id: r.organization?.id,
        org_name: r.organization?.name || "—",
        status: r.status || "active",
      });
    });

    // Build tree
    const all = (cats || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      parent_id: c.parent_id,
      description: c.description,
      sort_order: c.sort_order || 0,
      children: [] as Category[],
      org_count: (orgsByCategory[c.id] || []).length,
      orgs: orgsByCategory[c.id] || [],
    }));

    const byId = new Map<string, Category>();
    all.forEach((c) => byId.set(c.id, c));

    const roots: Category[] = [];
    all.forEach((c) => {
      if (c.parent_id && byId.has(c.parent_id)) {
        byId.get(c.parent_id)!.children.push(c);
      } else {
        roots.push(c);
      }
    });

    roots.forEach((r) => r.children.sort((a, b) => a.sort_order - b.sort_order));

    setCategories(roots);
    setExpanded(new Set(roots.map((r) => r.id)));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleShowOrgs = (id: string) => {
    setShowOrgsFor((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const totalCategories = categories.reduce(
    (sum, c) => sum + 1 + c.children.length,
    0
  );

  const handleAdd = async (parentId: string | null) => {
    if (!newName.trim()) return;
    const maxSort = parentId
      ? Math.max(0, ...categories.flatMap((c) => c.children.map((ch) => ch.sort_order)))
      : Math.max(0, ...categories.map((c) => c.sort_order));

    const { error } = await supabase.from("community_categories").insert({
      name: newName.trim(),
      parent_id: parentId,
      sort_order: maxSort + 1,
    });
    if (!error) {
      setNewName("");
      setAddingParent(false);
      setAddingChildOf(null);
      fetchCategories();
    }
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    const { error } = await supabase
      .from("community_categories")
      .update({ name: editName.trim() })
      .eq("id", id);
    if (!error) {
      setEditingId(null);
      setEditName("");
      fetchCategories();
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This will also remove any sub-categories and org assignments.`)) return;
    // Delete relationships for this category and its children
    await supabase.from("org_community_relationships").delete().eq("category_id", id);
    // Delete children relationships
    const children = categories.flatMap((c) => c.children).filter((ch) => ch.id === id || categories.some((p) => p.id === id && p.children.some((x) => x.id === ch.id)));
    for (const ch of children) {
      await supabase.from("org_community_relationships").delete().eq("category_id", ch.id);
    }
    await supabase.from("community_categories").delete().eq("parent_id", id);
    await supabase.from("community_categories").delete().eq("id", id);
    fetchCategories();
  };

  // Org search for assignment
  const searchOrgs = async (q: string) => {
    if (q.length < 1) { setOrgResults([]); return; }
    setOrgSearching(true);
    const { data } = await supabase
      .from("organizations")
      .select("id, name")
      .ilike("name", `%${q}%`)
      .order("name")
      .limit(10);
    setOrgResults(data || []);
    setOrgSearching(false);
  };

  const handleOrgSearchChange = (val: string) => {
    setOrgSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchOrgs(val), 250);
  };

  const assignOrg = async (categoryId: string, orgId: string) => {
    const { error } = await supabase.from("org_community_relationships").insert({
      organization_id: orgId,
      category_id: categoryId,
      status: "active",
    });
    if (!error) {
      setAssigningTo(null);
      setOrgSearch("");
      setOrgResults([]);
      fetchCategories();
    }
  };

  const unassignOrg = async (linkId: string) => {
    const { error } = await supabase.from("org_community_relationships").delete().eq("id", linkId);
    if (!error) fetchCategories();
  };

  const filtered = search
    ? categories.filter((c) => {
        const q = search.toLowerCase();
        return c.name.toLowerCase().includes(q) || c.children.some((ch) => ch.name.toLowerCase().includes(q));
      })
    : categories;

  // Render org list for a category
  const renderOrgList = (cat: Category) => {
    const existingOrgIds = new Set(cat.orgs.map((o) => o.org_id));

    return (
      <div className="border-t border-gray-200 bg-white">
        {cat.orgs.length === 0 && assigningTo !== cat.id ? (
          <div className="px-4 py-2 text-xs text-gray-400 flex items-center justify-between">
            <span>No organizations assigned</span>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-6"
              onClick={() => { setAssigningTo(cat.id); setOrgSearch(""); setOrgResults([]); }}
            >
              <Plus className="h-3 w-3 mr-1" /> Assign org
            </Button>
          </div>
        ) : (
          <div className="px-4 py-2 space-y-1">
            {cat.orgs.map((o) => (
              <div key={o.link_id} className="flex items-center justify-between py-0.5 group/org">
                <Link
                  href={`/soccer-orgs/${o.org_id}`}
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1.5"
                >
                  <Building2 className="h-3 w-3 text-gray-400" />
                  {o.org_name}
                </Link>
                <button
                  onClick={() => unassignOrg(o.link_id)}
                  className="text-gray-300 hover:text-red-500 opacity-0 group-hover/org:opacity-100 transition-opacity"
                  title="Remove from category"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {assigningTo !== cat.id && (
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-6 mt-1"
                onClick={() => { setAssigningTo(cat.id); setOrgSearch(""); setOrgResults([]); }}
              >
                <Plus className="h-3 w-3 mr-1" /> Assign org
              </Button>
            )}
          </div>
        )}

        {/* Org search for this category */}
        {assigningTo === cat.id && (
          <div className="px-4 py-2 bg-blue-50 border-t border-blue-100 relative">
            <div className="flex items-center gap-2">
              <Input
                value={orgSearch}
                onChange={(e) => handleOrgSearchChange(e.target.value)}
                placeholder="Search organizations…"
                className="h-8 text-sm flex-1"
                autoFocus
              />
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setAssigningTo(null)}>Cancel</Button>
            </div>
            {(orgResults.length > 0 || orgSearching) && (
              <div className="mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {orgSearching && <div className="px-3 py-2 text-xs text-gray-400">Searching…</div>}
                {orgResults
                  .filter((o) => !existingOrgIds.has(o.id))
                  .map((o) => (
                    <button
                      key={o.id}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b last:border-0"
                      onClick={() => assignOrg(cat.id, o.id)}
                    >
                      <Building2 className="h-3 w-3 inline mr-1.5 text-gray-400" />
                      {o.name}
                    </button>
                  ))}
                {!orgSearching && orgSearch.length > 0 && orgResults.filter((o) => !existingOrgIds.has(o.id)).length === 0 && (
                  <div className="px-3 py-2 text-xs text-gray-400">No organizations found</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Community Categories
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage categories, sub-categories, and organization assignments
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-sm">
            {totalCategories} categories
          </Badge>
          <Button
            size="sm"
            onClick={() => { setAddingParent(true); setNewName(""); }}
          >
            <Plus className="h-4 w-4 mr-1" /> Add Category
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search categories…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 pr-8"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
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
              No categories found. Add a category to get started.
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((cat) => (
                <div key={cat.id}>
                  {/* Parent category row */}
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 group">
                    <button
                      onClick={() => toggleExpand(cat.id)}
                      className="shrink-0 text-gray-400 hover:text-gray-600"
                    >
                      {cat.children.length > 0 ? (
                        expanded.has(cat.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )
                      ) : (
                        <span className="w-4" />
                      )}
                    </button>

                    {editingId === cat.id ? (
                      <form
                        onSubmit={(e) => { e.preventDefault(); handleRename(cat.id); }}
                        className="flex items-center gap-2 flex-1"
                      >
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 text-sm" autoFocus />
                        <Button size="sm" type="submit" className="h-8">Save</Button>
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingId(null)}>Cancel</Button>
                      </form>
                    ) : (
                      <>
                        <span className="font-semibold text-gray-900 text-sm">{cat.name}</span>
                        {cat.children.length > 0 && (
                          <Badge variant="outline" className="text-[10px] text-gray-500">
                            {cat.children.length} sub
                          </Badge>
                        )}
                        {/* Org count badge — clickable to show/hide orgs */}
                        {cat.children.length === 0 && (
                          <button onClick={() => toggleShowOrgs(cat.id)}>
                            <Badge variant="secondary" className="text-[10px] cursor-pointer hover:bg-gray-200">
                              <Users className="h-2.5 w-2.5 mr-0.5" />
                              {cat.org_count} orgs
                            </Badge>
                          </button>
                        )}
                        <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setAddingChildOf(cat.id); setNewName(""); }} title="Add sub-category">
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditingId(cat.id); setEditName(cat.name); }} title="Rename">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => handleDelete(cat.id, cat.name)} title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Orgs for leaf parent (no children) */}
                  {cat.children.length === 0 && showOrgsFor.has(cat.id) && renderOrgList(cat)}

                  {/* Sub-categories */}
                  {expanded.has(cat.id) && cat.children.length > 0 && (
                    <div className="bg-gray-50/50">
                      {cat.children
                        .filter((ch) =>
                          !search || ch.name.toLowerCase().includes(search.toLowerCase()) || cat.name.toLowerCase().includes(search.toLowerCase())
                        )
                        .map((child) => (
                          <div key={child.id}>
                            <div className="flex items-center gap-3 pl-12 pr-4 py-2.5 hover:bg-gray-100 group border-t border-gray-100">
                              {editingId === child.id ? (
                                <form
                                  onSubmit={(e) => { e.preventDefault(); handleRename(child.id); }}
                                  className="flex items-center gap-2 flex-1"
                                >
                                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 text-sm" autoFocus />
                                  <Button size="sm" type="submit" className="h-8">Save</Button>
                                  <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingId(null)}>Cancel</Button>
                                </form>
                              ) : (
                                <>
                                  <span className="text-sm text-gray-700">{child.name}</span>
                                  <button onClick={() => toggleShowOrgs(child.id)}>
                                    <Badge variant="secondary" className="text-[10px] cursor-pointer hover:bg-gray-200">
                                      <Users className="h-2.5 w-2.5 mr-0.5" />
                                      {child.org_count} orgs
                                    </Badge>
                                  </button>
                                  <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditingId(child.id); setEditName(child.name); }} title="Rename">
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => handleDelete(child.id, child.name)} title="Delete">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>

                            {/* Orgs for this sub-category */}
                            {showOrgsFor.has(child.id) && (
                              <div className="pl-12">
                                {renderOrgList(child)}
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Add sub-category input */}
                  {addingChildOf === cat.id && (
                    <div className="flex items-center gap-2 pl-12 pr-4 py-2 bg-blue-50 border-t border-blue-100">
                      <form onSubmit={(e) => { e.preventDefault(); handleAdd(cat.id); }} className="flex items-center gap-2 flex-1">
                        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Sub-category name…" className="h-8 text-sm" autoFocus />
                        <Button size="sm" type="submit" className="h-8">Add</Button>
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => setAddingChildOf(null)}>Cancel</Button>
                      </form>
                    </div>
                  )}
                </div>
              ))}

              {/* Add parent category input */}
              {addingParent && (
                <div className="flex items-center gap-2 px-4 py-3 bg-blue-50">
                  <form onSubmit={(e) => { e.preventDefault(); handleAdd(null); }} className="flex items-center gap-2 flex-1">
                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Category name…" className="h-8 text-sm" autoFocus />
                    <Button size="sm" type="submit" className="h-8">Add</Button>
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => setAddingParent(false)}>Cancel</Button>
                  </form>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
