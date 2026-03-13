"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, AlertTriangle, ChevronDown, RefreshCw, Loader2 } from "lucide-react";

interface Decision {
  id: string;
  source: string;
  source_message_id: string;
  from_email: string | null;
  subject: string | null;
  classification_result: {
    summary?: string;
    sentiment?: string;
    tags?: string[];
    action_count?: number;
  } | null;
  acumen_category: string;
  importance_level: string;
  acumen_reasoning: string | null;
  ceo_review_status: string;
  ceo_correct_category: string | null;
  ceo_correct_importance: string | null;
  ceo_reviewed_at: string | null;
  created_at: string;
}

interface Stats {
  total_reviewed: number;
  total_correct: number;
  overall_accuracy: number | null;
  pending_review: number;
  by_category: Record<string, { total: number; correct: number; incorrect: number; partial: number }>;
}

const ACUMEN_CATEGORIES = [
  { id: "legal", label: "Legal" },
  { id: "customer-partner-ops", label: "Customer / Partner Ops" },
  { id: "accounting-finance", label: "Accounting & Finance" },
  { id: "scheduling", label: "Scheduling" },
  { id: "fundraising", label: "Fundraising" },
  { id: "product-engineering", label: "Product / Engineering" },
  { id: "ux-design", label: "UX & Design" },
  { id: "marketing", label: "Marketing" },
  { id: "ai", label: "AI" },
  { id: "family", label: "Family" },
  { id: "administration", label: "Administration" },
];

const IMPORTANCE_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-orange-100 text-orange-700",
  low: "bg-gray-100 text-gray-700",
};

const CATEGORY_COLORS: Record<string, string> = {
  fundraising: "bg-green-100 text-green-700",
  legal: "bg-purple-100 text-purple-700",
  "customer-partner-ops": "bg-blue-100 text-blue-700",
  "accounting-finance": "bg-yellow-100 text-yellow-700",
  scheduling: "bg-cyan-100 text-cyan-700",
  "product-engineering": "bg-indigo-100 text-indigo-700",
  "ux-design": "bg-pink-100 text-pink-700",
  marketing: "bg-teal-100 text-teal-700",
  ai: "bg-violet-100 text-violet-700",
  family: "bg-amber-100 text-amber-700",
  administration: "bg-slate-100 text-slate-700",
};

function getCategoryLabel(id: string): string {
  return ACUMEN_CATEGORIES.find((c) => c.id === id)?.label || id;
}

export default function DecisionsPage() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [correctionTarget, setCorrectionTarget] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("pending");

  const fetchDecisions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/decisions?status=${statusFilter}&limit=20`);
      const data = await res.json();
      if (data.success) {
        setDecisions(data.decisions);
        setStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to fetch decisions:", err);
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    fetchDecisions();
  }, [fetchDecisions]);

  const submitReview = async (
    id: string,
    reviewStatus: string,
    correctCategory?: string,
    correctImportance?: string,
  ) => {
    setReviewingId(id);
    try {
      const body: Record<string, string> = {
        classification_log_id: id,
        review_status: reviewStatus,
      };
      if (correctCategory) body.correct_category = correctCategory;
      if (correctImportance) body.correct_importance = correctImportance;

      const res = await fetch("/api/decisions/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        // Remove from list
        setDecisions((prev) => prev.filter((d) => d.id !== id));
        setCorrectionTarget(null);
        // Refresh stats
        fetchDecisions();
      }
    } catch (err) {
      console.error("Failed to submit review:", err);
    }
    setReviewingId(null);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Decision Review</h1>
          <p className="text-sm text-gray-500 mt-1">
            Score the brain&apos;s email classifications to improve accuracy
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDecisions} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.pending_review}</div>
              <div className="text-xs text-gray-500">Pending Review</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.total_reviewed}</div>
              <div className="text-xs text-gray-500">Total Reviewed</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.total_correct}</div>
              <div className="text-xs text-gray-500">Correct</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className={`text-2xl font-bold ${(stats.overall_accuracy || 0) >= 80 ? "text-green-600" : (stats.overall_accuracy || 0) >= 50 ? "text-orange-600" : "text-red-600"}`}>
                {stats.overall_accuracy !== null ? `${stats.overall_accuracy}%` : "—"}
              </div>
              <div className="text-xs text-gray-500">Accuracy</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {["pending", "correct", "incorrect", "partial", "all"].map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Button>
        ))}
      </div>

      {/* Decision Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : decisions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            {statusFilter === "pending"
              ? "No decisions pending review. Run the scanner to generate classifications."
              : "No decisions match this filter."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {decisions.map((d) => (
            <Card key={d.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                {/* Email info */}
                <div>
                  <div className="text-sm font-medium text-gray-900 line-clamp-1">
                    {d.subject || "(no subject)"}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    From: {d.from_email || "unknown"} &middot;{" "}
                    {new Date(d.created_at).toLocaleDateString()}
                  </div>
                  {d.classification_result?.summary && (
                    <div className="text-sm text-gray-600 mt-1">
                      {d.classification_result.summary}
                    </div>
                  )}
                </div>

                {/* Brain's classification */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={CATEGORY_COLORS[d.acumen_category] || "bg-gray-100 text-gray-700"}>
                    {getCategoryLabel(d.acumen_category)}
                  </Badge>
                  <Badge className={IMPORTANCE_COLORS[d.importance_level] || "bg-gray-100"}>
                    {d.importance_level}
                  </Badge>
                  {d.classification_result?.tags?.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>

                {/* Brain's reasoning */}
                {d.acumen_reasoning && (
                  <div className="text-xs text-gray-500 italic bg-gray-50 rounded px-3 py-2">
                    Brain: &quot;{d.acumen_reasoning}&quot;
                  </div>
                )}

                {/* Review actions */}
                {d.ceo_review_status === "pending" && (
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-700 border-green-300 hover:bg-green-50"
                      onClick={() => submitReview(d.id, "correct")}
                      disabled={reviewingId === d.id}
                    >
                      {reviewingId === d.id ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <Check className="w-3 h-3 mr-1" />
                      )}
                      Correct
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-700 border-red-300 hover:bg-red-50"
                      onClick={() => setCorrectionTarget(correctionTarget === d.id ? null : d.id)}
                      disabled={reviewingId === d.id}
                    >
                      <X className="w-3 h-3 mr-1" />
                      Wrong
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-orange-700 border-orange-300 hover:bg-orange-50"
                      onClick={() => setCorrectionTarget(correctionTarget === d.id ? null : d.id)}
                      disabled={reviewingId === d.id}
                    >
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Partial
                    </Button>
                  </div>
                )}

                {/* Correction dropdown */}
                {correctionTarget === d.id && (
                  <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
                    <div className="text-xs font-medium text-gray-700">
                      What should it be?
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ACUMEN_CATEGORIES.filter((c) => c.id !== d.acumen_category).map((cat) => (
                        <Button
                          key={cat.id}
                          size="sm"
                          variant="outline"
                          className="text-xs h-7"
                          onClick={() => submitReview(d.id, "incorrect", cat.id)}
                          disabled={reviewingId === d.id}
                        >
                          {cat.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Already reviewed indicator */}
                {d.ceo_review_status !== "pending" && (
                  <div className="flex items-center gap-2 text-xs">
                    <Badge
                      className={
                        d.ceo_review_status === "correct"
                          ? "bg-green-100 text-green-700"
                          : d.ceo_review_status === "incorrect"
                            ? "bg-red-100 text-red-700"
                            : "bg-orange-100 text-orange-700"
                      }
                    >
                      {d.ceo_review_status}
                    </Badge>
                    {d.ceo_correct_category && (
                      <span className="text-gray-500">
                        → {getCategoryLabel(d.ceo_correct_category)}
                      </span>
                    )}
                    {d.ceo_reviewed_at && (
                      <span className="text-gray-400">
                        {new Date(d.ceo_reviewed_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Category Accuracy Breakdown */}
      {stats && Object.keys(stats.by_category).length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Accuracy by Category</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(stats.by_category).map(([cat, data]) => (
              <Card key={cat}>
                <CardContent className="p-3">
                  <div className="text-xs font-medium text-gray-700">{getCategoryLabel(cat)}</div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className={`text-lg font-bold ${data.total > 0 && (data.correct / data.total) >= 0.8 ? "text-green-600" : "text-orange-600"}`}>
                      {data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0}%
                    </span>
                    <span className="text-xs text-gray-400">
                      {data.correct}/{data.total} correct
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
