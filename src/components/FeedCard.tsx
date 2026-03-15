"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

/* eslint-disable @next/next/no-img-element */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FeedCardData {
  id: string;
  card_type: string;
  title: string;
  body?: string | null;
  reasoning?: string | null;
  source_type: string;
  source_ref?: string | null;
  acumen_family?: string | null;
  acumen_category?: string | null;
  priority?: string | null;
  confidence?: number | null;
  visibility_scope?: string | null;
  entity_id?: string | null;
  entity_type?: string | null;
  entity_name?: string | null;
  related_entities?: Array<{ id: string; type: string; name: string }>;
  metadata?: Record<string, unknown>;
  status: string;
  ceo_action?: string | null;
  ceo_action_note?: string | null;
  created_at: string;
}

interface FeedCardProps {
  card: FeedCardData;
  onAction: (id: string, action: "do" | "no" | "not_now") => Promise<void>;
  onDismiss: (id: string) => Promise<void>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sourceLabel(source: string): string {
  const s = source.toLowerCase();
  if (s.includes("slack")) return "Slack";
  if (s.includes("email") || s.includes("gmail")) return "Email";
  if (s.includes("document")) return "Document";
  if (s.includes("webhook")) return "Webhook";
  if (s.includes("manual")) return "Manual";
  if (s.includes("synthesis")) return "Brain";
  return source;
}

function titleStyle(priority: string | null | undefined): string {
  switch (priority) {
    case "critical":
    case "high":
      return "text-[32px] leading-[1.15] font-bold text-[#1a1a1a]";
    case "low":
      return "text-[20px] leading-[1.2] font-semibold text-[#94A3B8]";
    default: // medium
      return "text-[24px] leading-[1.2] font-semibold text-[#64748B]";
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function FeedCard({ card, onAction, onDismiss }: FeedCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [acting, setActing] = useState(false);
  const isDecision = card.card_type === "decision";
  const isAction = card.card_type === "action";
  const isActed = card.status === "acted";
  const timeAgo = formatDistanceToNow(new Date(card.created_at), { addSuffix: false });

  async function handleAction(action: "do" | "no" | "not_now") {
    setActing(true);
    try {
      await onAction(card.id, action);
    } finally {
      setActing(false);
    }
  }

  async function handleDismiss() {
    setActing(true);
    try {
      await onDismiss(card.id);
    } finally {
      setActing(false);
    }
  }

  return (
    <div className={`bg-white rounded-xl shadow-[0px_1px_4px_0px_rgba(0,0,0,0.08)] overflow-hidden transition-all ${isActed ? "opacity-50" : ""}`}>

      {/* ── Header Pill ── */}
      <div className="px-5 pt-5 pb-0">
        <div className="inline-flex items-center gap-2.5 bg-[#f4f5f6] rounded-full px-4 py-2">
          <img
            src="/icons/gophers.png"
            alt=""
            width={24}
            height={28}
            className="shrink-0"
          />
          <span className="text-sm text-[#6e7b80]" style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}>
            {timeAgo} Ago from{" "}
            <span className="font-bold text-[#1e252a]">{sourceLabel(card.source_type)}</span>
          </span>
        </div>
      </div>

      {/* ── Title ── */}
      <div className="px-5 pt-4 pb-1">
        <h2
          className={`tracking-tight ${titleStyle(card.priority)}`}
          style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
        >
          {card.title}
        </h2>
      </div>

      {/* ── Action Buttons (Decision cards) ── */}
      {isDecision && !isActed && (
        <div className="px-5 pt-2 pb-1 flex items-center gap-6">
          <button
            onClick={() => handleAction("do")}
            disabled={acting}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#344054] hover:text-emerald-700 transition-colors disabled:opacity-40"
          >
            Do
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="shrink-0">
              <circle cx="11" cy="11" r="10" stroke="#16a34a" strokeWidth="1.5" fill="none" />
              <path d="M7 11l3 3 5-5" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </button>
          <button
            onClick={() => handleAction("not_now")}
            disabled={acting}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#344054] hover:text-amber-700 transition-colors disabled:opacity-40"
          >
            Hold
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="shrink-0">
              <circle cx="11" cy="11" r="10" stroke="#d97706" strokeWidth="1.5" fill="none" />
              <path d="M8 8.5C8.5 7 10 6.5 11 7.5c1 1-0.5 2-1 3s-0.5 2 0.5 3c1 1 2.5 0.5 3-0.5" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            </svg>
          </button>
          <button
            onClick={() => handleAction("no")}
            disabled={acting}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#344054] hover:text-red-700 transition-colors disabled:opacity-40"
          >
            No
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="shrink-0">
              <circle cx="11" cy="11" r="10" stroke="#dc2626" strokeWidth="1.5" fill="none" />
              <rect x="7" y="7" width="8" height="8" rx="1.5" stroke="#dc2626" strokeWidth="1.5" fill="none" />
              <circle cx="11" cy="11" r="2" fill="#dc2626" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Action Buttons (Action cards) ── */}
      {isAction && !isActed && (
        <div className="px-5 pt-2 pb-1 flex items-center gap-6">
          <button
            onClick={() => handleAction("do")}
            disabled={acting}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#344054] hover:text-emerald-700 transition-colors disabled:opacity-40"
          >
            Do
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="shrink-0">
              <circle cx="11" cy="11" r="10" stroke="#16a34a" strokeWidth="1.5" fill="none" />
              <path d="M7 11l3 3 5-5" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </button>
          <button
            onClick={() => handleDismiss()}
            disabled={acting}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#344054] hover:text-slate-500 transition-colors disabled:opacity-40"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Acted indicator ── */}
      {isActed && card.ceo_action && (
        <div className="px-5 pt-2 pb-1">
          <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
            card.ceo_action === "do" ? "text-emerald-600" :
            card.ceo_action === "no" ? "text-red-500" :
            "text-amber-600"
          }`}>
            {card.ceo_action === "do" ? "✓ Done" : card.ceo_action === "no" ? "✗ Declined" : "⏸ On Hold"}
          </span>
        </div>
      )}

      {/* ── Entity Name ── */}
      {card.entity_name && (
        <div className="px-5 pt-3 pb-0">
          <p className="text-base font-bold text-[#1e252a]">{card.entity_name}</p>
        </div>
      )}

      {/* ── Body ── */}
      {card.body && (
        <div className="px-5 pt-2 pb-3">
          <p className="text-sm text-[#4b5563] leading-relaxed">{card.body}</p>
        </div>
      )}

      {/* ── More about this ── */}
      {(card.reasoning || card.metadata || card.acumen_category || (card.related_entities && card.related_entities.length > 0)) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 px-5 pb-4 pt-1 text-sm font-medium text-[#0ea5e9] hover:text-[#0284c7] transition-colors"
        >
          {expanded ? "Less" : "More about this"}
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      )}

      {/* ── Expanded Content ── */}
      {expanded && (
        <div className="px-5 pb-5 space-y-3 border-t border-slate-100 pt-3">
          {card.reasoning && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Brain&apos;s Reasoning</p>
              <p className="text-sm text-slate-600">{card.reasoning}</p>
            </div>
          )}
          {card.acumen_category && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Category</p>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                {card.acumen_category}
              </span>
            </div>
          )}
          {card.related_entities && card.related_entities.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Related</p>
              <div className="flex flex-wrap gap-1.5">
                {card.related_entities.map((e) => (
                  <span key={e.id} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                    {e.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
