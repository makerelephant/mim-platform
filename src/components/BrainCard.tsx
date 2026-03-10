"use client";

import { Badge } from "@/components/ui/badge";
import { Target } from "lucide-react";
import Link from "next/link";
import { timeAgo } from "@/lib/timeAgo";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BrainCardItem {
  org_id: string;
  org_name: string;
  org_status: string | null;
  summary: string;
  date: string;
  suggested_action: string | null;
  suggested_deadline: string | null;
  priority?: string | null;
  sentiment?: string | null;
  goal_relevance?: number | null;
  tags?: string[];
  recommended_action?: string | null;
}

interface BrainCardRowProps {
  item: BrainCardItem;
  linkPrefix: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PRIORITY_DOTS: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-blue-500",
  low: "bg-gray-400",
};

const SENTIMENT_INDICATOR: Record<string, { symbol: string; color: string }> = {
  positive: { symbol: "+", color: "text-green-500" },
  neutral: { symbol: "~", color: "text-gray-300" },
  negative: { symbol: "-", color: "text-red-500" },
  urgent: { symbol: "!", color: "text-red-600 font-bold" },
};

const GOAL_COLORS = (score: number): string => {
  if (score >= 9) return "bg-red-100 text-red-700";
  if (score >= 7) return "bg-orange-100 text-orange-700";
  if (score >= 4) return "bg-blue-100 text-blue-700";
  return "bg-gray-100 text-gray-600";
};

// ─── Sort Helper ────────────────────────────────────────────────────────────

const PRIORITY_RANK: Record<string, number> = { critical: 3, high: 2, medium: 1, low: 0 };

export function sortBrainItems(items: BrainCardItem[]): BrainCardItem[] {
  return [...items].sort((a, b) => {
    // Priority first
    const pa = PRIORITY_RANK[a.priority || "medium"] ?? 1;
    const pb = PRIORITY_RANK[b.priority || "medium"] ?? 1;
    if (pa !== pb) return pb - pa;
    // Then goal_relevance
    const ga = a.goal_relevance ?? 0;
    const gb = b.goal_relevance ?? 0;
    if (ga !== gb) return gb - ga;
    // Then date
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}

// ─── Component ──────────────────────────────────────────────────────────────

export function BrainCardRow({ item, linkPrefix }: BrainCardRowProps) {
  const sentimentInfo = SENTIMENT_INDICATOR[item.sentiment || "neutral"] || SENTIMENT_INDICATOR.neutral;
  const hasMeta = item.priority || item.goal_relevance || (item.tags && item.tags.length > 0);

  return (
    <div className="flex items-start gap-2 py-2 border-b last:border-0 text-xs group">
      {/* Priority dot */}
      {item.priority && (
        <div
          className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${PRIORITY_DOTS[item.priority] || "bg-gray-400"}`}
          title={item.priority}
        />
      )}

      {/* Sentiment indicator */}
      {item.sentiment && item.sentiment !== "neutral" && (
        <span className={`mt-0.5 text-[10px] font-bold shrink-0 ${sentimentInfo.color}`} title={`Sentiment: ${item.sentiment}`}>
          {sentimentInfo.symbol}
        </span>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Link href={`${linkPrefix}/${item.org_id}`} className="font-medium text-gray-900 hover:text-blue-600 truncate">
            {item.org_name}
          </Link>
          {item.goal_relevance != null && item.goal_relevance >= 7 && (
            <Badge className={`text-[9px] px-1 py-0 h-3.5 shrink-0 ${GOAL_COLORS(item.goal_relevance)}`}>
              <Target className="h-2 w-2 mr-0.5" />
              {item.goal_relevance}
            </Badge>
          )}
        </div>

        {/* Summary */}
        <span className="text-gray-500 line-clamp-2 text-[11px]" title={item.summary}>
          {item.summary}
        </span>

        {/* Recommended action (if high-value) */}
        {item.recommended_action && (item.priority === "critical" || item.priority === "high") && (
          <p className="text-[10px] text-blue-600 mt-0.5 line-clamp-1">
            → {item.recommended_action}
          </p>
        )}

        {/* Tags (compact) */}
        {hasMeta && item.tags && item.tags.length > 0 && (
          <div className="flex gap-0.5 mt-0.5 flex-wrap">
            {item.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[9px] text-gray-400 bg-gray-50 rounded px-1">
                {tag}
              </span>
            ))}
            {item.tags.length > 3 && (
              <span className="text-[9px] text-gray-300">+{item.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>

      {/* Time */}
      <span className="text-gray-400 shrink-0 text-[10px] mt-0.5">{timeAgo(item.date)}</span>
    </div>
  );
}
