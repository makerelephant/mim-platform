"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Check,
  X,
  Pencil,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Target,
  Mail,
  Hash,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface PendingTask {
  id: string;
  title: string;
  summary: string | null;
  recommended_action: string | null;
  draft_reply: string | null;
  priority: string;
  entity_type: string | null;
  entity_id: string | null;
  goal_relevance_score: number | null;
  taxonomy_category: string | null;
  source: string | null;
  tags: string[];
  sentiment: string | null;
  created_at: string;
  // resolved from joins
  entity_name?: string;
}

interface ApprovalQueueProps {
  tasks: PendingTask[];
  onTaskUpdate: (taskId: string, updates: Partial<PendingTask> & { status?: string }) => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

const PRIORITY_DOTS: Record<string, string> = {
  low: "bg-gray-400",
  medium: "bg-blue-500",
  high: "bg-orange-500",
  critical: "bg-red-500",
};

const SENTIMENT_ICONS: Record<string, { emoji: string; color: string }> = {
  positive: { emoji: "+", color: "text-green-600" },
  neutral: { emoji: "~", color: "text-gray-400" },
  negative: { emoji: "-", color: "text-red-500" },
  urgent: { emoji: "!", color: "text-red-600" },
};

const GOAL_COLORS = (score: number): string => {
  if (score >= 9) return "bg-red-100 text-red-700";
  if (score >= 7) return "bg-orange-100 text-orange-700";
  if (score >= 4) return "bg-blue-100 text-blue-700";
  return "bg-gray-100 text-gray-600";
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ApprovalQueue({ tasks, onTaskUpdate }: ApprovalQueueProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAction, setEditAction] = useState("");
  const [editDraft, setEditDraft] = useState("");
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  // Sort: critical first, then by goal_relevance desc, then date desc
  const sorted = [...tasks].sort((a, b) => {
    const priorityRank: Record<string, number> = { critical: 3, high: 2, medium: 1, low: 0 };
    const pa = priorityRank[a.priority] ?? 1;
    const pb = priorityRank[b.priority] ?? 1;
    if (pa !== pb) return pb - pa;
    const ga = a.goal_relevance_score ?? 0;
    const gb = b.goal_relevance_score ?? 0;
    if (ga !== gb) return gb - ga;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const handleApprove = async (task: PendingTask) => {
    setLoading((prev) => ({ ...prev, [task.id]: true }));
    const { error } = await supabase
      .schema("brain")
      .from("tasks")
      .update({ status: "todo" })
      .eq("id", task.id);
    if (!error) onTaskUpdate(task.id, { status: "todo" });
    setLoading((prev) => ({ ...prev, [task.id]: false }));
  };

  const handleDismiss = async (task: PendingTask) => {
    setLoading((prev) => ({ ...prev, [task.id]: true }));
    const { error } = await supabase
      .schema("brain")
      .from("tasks")
      .update({ status: "dismissed" })
      .eq("id", task.id);
    if (!error) onTaskUpdate(task.id, { status: "dismissed" });
    setLoading((prev) => ({ ...prev, [task.id]: false }));
  };

  const startEditing = (task: PendingTask) => {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditAction(task.recommended_action || "");
    setEditDraft(task.draft_reply || "");
    setExpandedId(task.id);
  };

  const saveEdit = async (task: PendingTask) => {
    setLoading((prev) => ({ ...prev, [task.id]: true }));
    const updates: Record<string, unknown> = {
      title: editTitle,
      recommended_action: editAction || null,
      draft_reply: editDraft || null,
      manually_edited: true,
    };
    const { error } = await supabase
      .schema("brain")
      .from("tasks")
      .update(updates)
      .eq("id", task.id);
    if (!error) {
      onTaskUpdate(task.id, {
        title: editTitle,
        recommended_action: editAction || null,
        draft_reply: editDraft || null,
      });
    }
    setEditingId(null);
    setLoading((prev) => ({ ...prev, [task.id]: false }));
  };

  const cancelEdit = () => setEditingId(null);

  if (tasks.length === 0) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-amber-600" />
            Approval Queue
            <Badge variant="outline" className="ml-1 bg-amber-100 text-amber-700 border-amber-300">
              {tasks.length}
            </Badge>
          </CardTitle>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          AI-generated tasks awaiting your review. Approve, edit, or dismiss.
        </p>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {sorted.map((task) => {
          const isExpanded = expandedId === task.id;
          const isEditing = editingId === task.id;
          const isLoading = loading[task.id];
          const sentimentInfo = SENTIMENT_ICONS[task.sentiment || "neutral"] || SENTIMENT_ICONS.neutral;
          const sourceIcon = task.source?.includes("gmail") ? (
            <Mail className="h-3 w-3 text-gray-400" />
          ) : task.source?.includes("slack") ? (
            <Hash className="h-3 w-3 text-gray-400" />
          ) : null;

          return (
            <div
              key={task.id}
              className={`rounded-lg border bg-white p-3 transition-all ${
                task.priority === "critical"
                  ? "border-red-300 shadow-sm"
                  : task.priority === "high"
                    ? "border-orange-200"
                    : "border-gray-200"
              }`}
            >
              {/* ── Main row ── */}
              <div className="flex items-start gap-3">
                {/* Priority dot */}
                <div className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${PRIORITY_DOTS[task.priority] || "bg-gray-400"}`} />

                {/* Sentiment indicator */}
                <span className={`mt-0.5 text-xs font-bold shrink-0 ${sentimentInfo.color}`}>
                  {sentimentInfo.emoji}
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="text-sm font-medium text-gray-900 border rounded px-2 py-0.5 flex-1 min-w-[200px]"
                      />
                    ) : (
                      <span className="text-sm font-medium text-gray-900">{task.title}</span>
                    )}
                  </div>

                  {/* Entity + taxonomy + meta line */}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {sourceIcon}
                    {task.entity_name && (
                      <span className="text-xs text-gray-500">{task.entity_name}</span>
                    )}
                    {task.taxonomy_category && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                        {task.taxonomy_category}
                      </Badge>
                    )}
                    <Badge className={`text-[10px] px-1.5 py-0 h-4 ${PRIORITY_COLORS[task.priority]}`}>
                      {task.priority}
                    </Badge>
                    {task.goal_relevance_score != null && (
                      <Badge className={`text-[10px] px-1.5 py-0 h-4 ${GOAL_COLORS(task.goal_relevance_score)}`}>
                        <Target className="h-2.5 w-2.5 mr-0.5" />
                        {task.goal_relevance_score}/10
                      </Badge>
                    )}
                    <span className="text-[10px] text-gray-400">{relativeTime(task.created_at)}</span>
                  </div>

                  {/* Summary (always visible) */}
                  {task.summary && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.summary}</p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => handleApprove(task)}
                    disabled={isLoading}
                    title="Approve → To Do"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                    onClick={() => startEditing(task)}
                    disabled={isLoading}
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() => handleDismiss(task)}
                    disabled={isLoading}
                    title="Dismiss"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
                    onClick={() => setExpandedId(isExpanded ? null : task.id)}
                    title={isExpanded ? "Collapse" : "Expand"}
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* ── Expanded details ── */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                  {/* Recommended action */}
                  {isEditing ? (
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Recommended Action</label>
                      <Textarea
                        value={editAction}
                        onChange={(e) => setEditAction(e.target.value)}
                        className="text-xs min-h-[60px]"
                        placeholder="What should be done..."
                      />
                    </div>
                  ) : task.recommended_action ? (
                    <div>
                      <span className="text-xs font-medium text-gray-500">Recommended Action</span>
                      <p className="text-xs text-gray-700 mt-0.5">{task.recommended_action}</p>
                    </div>
                  ) : null}

                  {/* Draft reply */}
                  {isEditing ? (
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Draft Reply</label>
                      <Textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        className="text-xs min-h-[80px]"
                        placeholder="Suggested reply to send..."
                      />
                    </div>
                  ) : task.draft_reply ? (
                    <div className="bg-blue-50 rounded-md p-2 border border-blue-100">
                      <span className="text-xs font-medium text-blue-600">Draft Reply</span>
                      <p className="text-xs text-gray-700 mt-0.5 whitespace-pre-wrap">{task.draft_reply}</p>
                    </div>
                  ) : null}

                  {/* Tags */}
                  {task.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {task.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-gray-500">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Edit save/cancel buttons */}
                  {isEditing && (
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" onClick={() => saveEdit(task)} disabled={isLoading}>
                        Save & Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelEdit}>
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
