"use client";

import { useState } from "react";
import { Trash2, ArrowUpRight, ChevronDown, ChevronUp, CheckCircle2, Clock, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Image from "next/image";

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

function priorityConfig(priority: string | null | undefined) {
  switch (priority) {
    case "critical":
      return { label: "Critical", color: "bg-red-500" };
    case "high":
      return { label: "High", color: "bg-red-500" };
    case "medium":
      return { label: "Medium", color: "bg-amber-500" };
    case "low":
      return { label: "Low", color: "bg-slate-400" };
    default:
      return { label: "Medium", color: "bg-amber-500" };
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function FeedCard({ card, onAction, onDismiss }: FeedCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [acting, setActing] = useState(false);
  const pri = priorityConfig(card.priority);
  const isDecision = card.card_type === "decision";
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
    <div className={`bg-white rounded-xl shadow-[0px_1px_4px_0px_rgba(0,0,0,0.1)] overflow-hidden transition-all ${isActed ? "opacity-60" : ""}`}>
      {/* ── Header Bar ── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[rgba(238,242,245,0.6)]">
        <div className="flex items-center gap-3 min-w-0">
          <Image
            src="/icons/gophers.png"
            alt=""
            width={22}
            height={26}
            className="shrink-0"
          />
          <span className="text-xs text-[#6e7b80]" style={{ fontFamily: "'Inter', sans-serif" }}>
            {timeAgo} Ago from{" "}
            <span className="font-bold text-[#1e252a]">{sourceLabel(card.source_type)}</span>
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`w-2 h-2 rounded-full ${pri.color}`} />
            <span className="text-xs font-medium text-[#344054]">{pri.label}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <button
            onClick={handleDismiss}
            disabled={acting || isActed}
            className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-30"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ArrowUpRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Title ── */}
      <div className="px-5 pt-4 pb-2">
        <h2 className="text-2xl font-bold text-[#111928] leading-tight tracking-tight">
          {card.title}
        </h2>

        {/* Entity name as subtitle */}
        {card.entity_name && (
          <p className="text-sm font-semibold text-[#344054] mt-1">
            {card.entity_name}
          </p>
        )}
      </div>

      {/* ── Body ── */}
      {card.body && (
        <div className="px-5 pb-3">
          <p className="text-sm text-[#4b5563] leading-relaxed">
            {card.body}
          </p>
        </div>
      )}

      {/* ── Expand Trigger ── */}
      {(card.reasoning || card.metadata) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 px-5 pb-3 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? "Less" : "More..."}
        </button>
      )}

      {/* ── Expanded Content ── */}
      {expanded && (
        <div className="px-5 pb-4 space-y-3 border-t border-slate-100 pt-3">
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
          {card.ceo_action && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Your Action</p>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                card.ceo_action === "do" ? "bg-emerald-50 text-emerald-700" :
                card.ceo_action === "no" ? "bg-red-50 text-red-700" :
                "bg-amber-50 text-amber-700"
              }`}>
                {card.ceo_action === "do" ? "Done" : card.ceo_action === "no" ? "Declined" : "Deferred"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Actions (Decision cards only, not yet acted) ── */}
      {isDecision && !isActed && (
        <div className="px-5 pb-4 flex items-center gap-3">
          <button
            onClick={() => handleAction("do")}
            disabled={acting}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            DO
          </button>
          <button
            onClick={() => handleAction("not_now")}
            disabled={acting}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-50"
          >
            <Clock className="w-4 h-4" />
            NOT NOW
          </button>
          <button
            onClick={() => handleAction("no")}
            disabled={acting}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            <XCircle className="w-4 h-4" />
            DON&apos;T
          </button>
        </div>
      )}

      {/* ── Actions for action cards ── */}
      {!isDecision && !isActed && card.card_type === "action" && (
        <div className="px-5 pb-4 flex items-center gap-3">
          <button
            onClick={() => handleAction("do")}
            disabled={acting}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            DO
          </button>
          <button
            onClick={() => handleAction("no")}
            disabled={acting}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
