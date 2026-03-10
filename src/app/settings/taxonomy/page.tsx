"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { TagInput } from "@/components/TagInput";
import {
  Brain, Plus, Trash2, GripVertical, ChevronDown, ChevronRight,
  Save, Loader2, AlertCircle, Check,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

// ─── Types ──────────────────────────────────────────────────────────────────

interface TaxonomyRow {
  id: string;
  category: string;
  slug: string;
  description: string | null;
  signal_keywords: string[];
  org_type_match: string | null;
  dashboard_card_key: string | null;
  prompt_fragment: string | null;
  priority_rules: { condition: string; priority: string }[];
  actions: { create_task: boolean; route_to_card: boolean; send_alert: boolean };
  icon: string | null;
  color: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const ORG_TYPE_OPTIONS = ["Investor", "Partner", "Customer", "Vendor", "Competitor", "Community"];
const CARD_KEY_OPTIONS = [
  { value: "investors", label: "Fundraising (Investors)" },
  { value: "partners", label: "Partnerships (Partners)" },
  { value: "customers", label: "Communities (Customers)" },
  { value: "sentiment", label: "Sentiment (News & Articles)" },
  { value: "knowledge", label: "Knowledge Base" },
  { value: "tasks", label: "Tasks" },
  { value: "activity", label: "Activity Log" },
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function TaxonomySettingsPage() {
  const [rows, setRows] = useState<TaxonomyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [successId, setSuccessId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from("inference_taxonomy")
      .select("*")
      .order("sort_order", { ascending: true });
    setRows(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Update a field ─────────────────────────────────────────────────

  const updateField = async (id: string, field: string, value: unknown) => {
    setSaving(id);
    const { error } = await supabase
      .from("inference_taxonomy")
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (!error) {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
      );
      setSuccessId(id);
      setTimeout(() => setSuccessId(null), 1500);
    }
    setSaving(null);
  };

  // ── Add category ──────────────────────────────────────────────────

  const addCategory = async () => {
    if (!newCategory.trim()) return;
    const slug = newCategory.trim().toLowerCase().replace(/\s+/g, "-");
    const maxSort = rows.reduce((max, r) => Math.max(max, r.sort_order), 0);

    const { data, error } = await supabase
      .from("inference_taxonomy")
      .insert({
        category: newCategory.trim(),
        slug,
        description: newDescription.trim() || null,
        signal_keywords: [],
        sort_order: maxSort + 1,
        active: true,
      })
      .select()
      .single();

    if (!error && data) {
      setRows((prev) => [...prev, data]);
      setNewCategory("");
      setNewDescription("");
      setAddOpen(false);
      setExpandedId(data.id);
    }
  };

  // ── Delete category ───────────────────────────────────────────────

  const deleteCategory = async (id: string) => {
    const { error } = await supabase
      .from("inference_taxonomy")
      .delete()
      .eq("id", id);

    if (!error) {
      setRows((prev) => prev.filter((r) => r.id !== id));
      if (expandedId === id) setExpandedId(null);
    }
  };

  // ── Loading state ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-64" />
        <div className="h-64 bg-gray-200 rounded" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-600" />
            Inference Taxonomy
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Define the categories, signal keywords, and rules that drive all AI classification decisions.
            Changes here immediately affect how the scanners classify inbound data.
          </p>
        </div>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-purple-600 hover:bg-purple-700 text-white">
              <Plus className="h-4 w-4 mr-1" /> Add Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Taxonomy Category</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <label className="text-sm font-medium text-gray-700">Category Name</label>
                <Input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="e.g., Recruiting, Legal, Marketing"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Description</label>
                <Input
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Brief description of what this category covers"
                  className="mt-1"
                />
              </div>
              <Button onClick={addCategory} disabled={!newCategory.trim()} className="w-full">
                Create Category
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info banner */}
      <div className="mb-4 bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 flex items-start gap-3">
        <AlertCircle className="h-4 w-4 text-purple-600 mt-0.5 shrink-0" />
        <div className="text-sm text-purple-800">
          <strong>How this works:</strong> When an email or Slack message arrives, the AI classifier uses these
          categories to determine intent. Signal keywords help route unlinked activity to the right dashboard card.
          The prompt fragment tells Claude how to interpret each category.
        </div>
      </div>

      {/* Category rows */}
      <div className="space-y-3">
        {rows.map((row) => {
          const isExpanded = expandedId === row.id;
          const isSaving = saving === row.id;
          const isSuccess = successId === row.id;

          return (
            <Card key={row.id} className={`transition-all ${!row.active ? "opacity-60" : ""}`}>
              {/* Row header */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedId(isExpanded ? null : row.id)}
              >
                <GripVertical className="h-4 w-4 text-gray-300 shrink-0" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{row.category}</span>
                    <Badge variant="outline" className="text-[10px]">{row.slug}</Badge>
                    {row.org_type_match && (
                      <Badge className="text-[10px] bg-blue-100 text-blue-800">{row.org_type_match}</Badge>
                    )}
                    {row.dashboard_card_key && (
                      <Badge className="text-[10px] bg-green-100 text-green-800">
                        {CARD_KEY_OPTIONS.find((o) => o.value === row.dashboard_card_key)?.label || row.dashboard_card_key}
                      </Badge>
                    )}
                    {!row.active && (
                      <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{row.description || "No description"}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-gray-400">
                    {row.signal_keywords.length} keywords
                  </span>
                  {isSaving && <Loader2 className="h-3.5 w-3.5 text-purple-500 animate-spin" />}
                  {isSuccess && <Check className="h-3.5 w-3.5 text-green-500" />}
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded editor */}
              {isExpanded && (
                <CardContent className="border-t pt-4 space-y-4">
                  {/* Row 1: Category name + description */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-600">Category Name</label>
                      <Input
                        defaultValue={row.category}
                        onBlur={(e) => {
                          if (e.target.value !== row.category) {
                            updateField(row.id, "category", e.target.value);
                          }
                        }}
                        className="mt-1 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600">Description</label>
                      <Input
                        defaultValue={row.description || ""}
                        onBlur={(e) => {
                          if (e.target.value !== (row.description || "")) {
                            updateField(row.id, "description", e.target.value || null);
                          }
                        }}
                        className="mt-1 text-sm"
                      />
                    </div>
                  </div>

                  {/* Row 2: Signal Keywords */}
                  <div>
                    <label className="text-xs font-medium text-gray-600">
                      Signal Keywords
                      <span className="text-gray-400 font-normal ml-1">
                        (tags that trigger this category — type and press Enter to add)
                      </span>
                    </label>
                    <TagInput
                      value={row.signal_keywords}
                      onChange={(tags) => updateField(row.id, "signal_keywords", tags)}
                      placeholder="Add keyword..."
                      className="mt-1"
                    />
                  </div>

                  {/* Row 3: Org Type Match + Dashboard Card */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-600">Org Type Match</label>
                      <select
                        value={row.org_type_match || ""}
                        onChange={(e) => updateField(row.id, "org_type_match", e.target.value || null)}
                        className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-white"
                      >
                        <option value="">None</option>
                        {ORG_TYPE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600">Dashboard Card</label>
                      <select
                        value={row.dashboard_card_key || ""}
                        onChange={(e) => updateField(row.id, "dashboard_card_key", e.target.value || null)}
                        className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-white"
                      >
                        <option value="">None</option>
                        {CARD_KEY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <label className="text-xs font-medium text-gray-600">Status</label>
                        <button
                          onClick={() => updateField(row.id, "active", !row.active)}
                          className={`mt-1 w-full border rounded-md px-3 py-2 text-sm text-left ${
                            row.active
                              ? "bg-green-50 border-green-200 text-green-700"
                              : "bg-gray-50 border-gray-200 text-gray-500"
                          }`}
                        >
                          {row.active ? "Active" : "Inactive"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Row 4: Prompt Fragment */}
                  <div>
                    <label className="text-xs font-medium text-gray-600">
                      Prompt Fragment
                      <span className="text-gray-400 font-normal ml-1">
                        (this text is injected into the AI classifier&apos;s instructions for this category)
                      </span>
                    </label>
                    <textarea
                      defaultValue={row.prompt_fragment || ""}
                      onBlur={(e) => {
                        if (e.target.value !== (row.prompt_fragment || "")) {
                          updateField(row.id, "prompt_fragment", e.target.value || null);
                        }
                      }}
                      rows={3}
                      className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-white resize-y"
                      placeholder="Describe how the AI should understand and classify content in this category..."
                    />
                  </div>

                  {/* Actions row */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={row.actions?.create_task ?? true}
                          onChange={(e) =>
                            updateField(row.id, "actions", {
                              ...row.actions,
                              create_task: e.target.checked,
                            })
                          }
                          className="rounded"
                        />
                        Create tasks
                      </label>
                      <label className="flex items-center gap-2 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={row.actions?.route_to_card ?? true}
                          onChange={(e) =>
                            updateField(row.id, "actions", {
                              ...row.actions,
                              route_to_card: e.target.checked,
                            })
                          }
                          className="rounded"
                        />
                        Route to dashboard card
                      </label>
                      <label className="flex items-center gap-2 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={row.actions?.send_alert ?? false}
                          onChange={(e) =>
                            updateField(row.id, "actions", {
                              ...row.actions,
                              send_alert: e.target.checked,
                            })
                          }
                          className="rounded"
                        />
                        Send alert
                      </label>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs"
                      onClick={() => {
                        if (confirm(`Delete "${row.category}" category?`)) {
                          deleteCategory(row.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}

        {rows.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Brain className="h-10 w-10 mx-auto mb-3" />
            <p className="text-sm">No taxonomy categories defined yet.</p>
            <p className="text-xs mt-1">Click &ldquo;Add Category&rdquo; to create your first classification category.</p>
          </div>
        )}
      </div>
    </div>
  );
}
