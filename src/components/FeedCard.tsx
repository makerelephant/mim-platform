"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

/* eslint-disable @next/next/no-img-element */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CorrectionData {
  wrong_category?: string;
  wrong_priority?: string;
  wrong_card_type?: string;
  should_not_exist?: boolean;
  note?: string;
  resurface_hours?: number; // for hold/not_now
}

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
  onAction: (id: string, action: "do" | "no" | "not_now", correction?: CorrectionData) => Promise<void>;
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
  const [showNoPanel, setShowNoPanel] = useState(false);
  const [showHoldPanel, setShowHoldPanel] = useState(false);
  const [correctionType, setCorrectionType] = useState<string | null>(null);
  const [correctionCategory, setCorrectionCategory] = useState("");
  const [correctionPriority, setCorrectionPriority] = useState("");
  const [correctionNote, setCorrectionNote] = useState("");

  const isDecision = card.card_type === "decision";
  const isAction = card.card_type === "action";
  const isActed = card.status === "acted";
  const timeAgo = formatDistanceToNow(new Date(card.created_at), { addSuffix: false });

  // Extract email metadata if present
  const meta = card.metadata as Record<string, unknown> | null;
  const fromName = meta?.from_name as string | undefined;
  const fromEmail = meta?.from_email as string | undefined;
  const subject = meta?.subject as string | undefined;
  const toEmails = meta?.to as string[] | undefined;

  async function handleAction(action: "do" | "no" | "not_now", correction?: CorrectionData) {
    setActing(true);
    try {
      await onAction(card.id, action, correction);
      // Reset panels on success
      setShowNoPanel(false);
      setShowHoldPanel(false);
      setCorrectionType(null);
      setCorrectionCategory("");
      setCorrectionPriority("");
      setCorrectionNote("");
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

  function handleNoClick() {
    setShowNoPanel(true);
    setShowHoldPanel(false);
  }

  function handleHoldClick() {
    setShowHoldPanel(true);
    setShowNoPanel(false);
  }

  function handleCancelPanel() {
    setShowNoPanel(false);
    setShowHoldPanel(false);
    setCorrectionType(null);
    setCorrectionCategory("");
    setCorrectionPriority("");
    setCorrectionNote("");
  }

  function handleSubmitCorrection() {
    const correction: CorrectionData = {};
    if (correctionType === "wrong_category") {
      correction.wrong_category = correctionCategory || undefined;
    } else if (correctionType === "wrong_priority") {
      correction.wrong_priority = correctionPriority || undefined;
    } else if (correctionType === "shouldnt_exist") {
      correction.should_not_exist = true;
    }
    if (correctionNote) {
      correction.note = correctionNote;
    }
    handleAction("no", correction);
  }

  function handleHoldSelect(hours: number) {
    handleAction("not_now", { resurface_hours: hours });
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

      {/* ── Email Context ── */}
      {(fromName || fromEmail || subject) && (
        <div className="px-5 pt-3 pb-0 space-y-0.5">
          {(fromName || fromEmail) && (
            <p className="text-xs text-[#6e7b80]">
              <span className="font-semibold text-[#344054]">From:</span>{" "}
              {fromName && <span className="font-medium text-[#1e252a]">{fromName}</span>}
              {fromEmail && <span className="text-[#6e7b80]"> &lt;{fromEmail}&gt;</span>}
            </p>
          )}
          {toEmails && toEmails.length > 0 && (
            <p className="text-xs text-[#6e7b80]">
              <span className="font-semibold text-[#344054]">To:</span>{" "}
              {toEmails.join(", ")}
            </p>
          )}
          {subject && (
            <p className="text-xs text-[#6e7b80]">
              <span className="font-semibold text-[#344054]">Subject:</span>{" "}
              <span className="text-[#1e252a]">{subject}</span>
            </p>
          )}
        </div>
      )}

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
            onClick={handleHoldClick}
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
            onClick={handleNoClick}
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

      {/* ── Hold Panel (Decision cards) ── */}
      {showHoldPanel && (
        <div className="px-5 pt-2 pb-3">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Resurface in:</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleHoldSelect(1)}
                disabled={acting}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-md hover:bg-amber-50 hover:border-amber-300 transition-colors disabled:opacity-40"
              >
                1 hour
              </button>
              <button
                onClick={() => handleHoldSelect(4)}
                disabled={acting}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-md hover:bg-amber-50 hover:border-amber-300 transition-colors disabled:opacity-40"
              >
                4 hours
              </button>
              <button
                onClick={() => handleHoldSelect(24)}
                disabled={acting}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-md hover:bg-amber-50 hover:border-amber-300 transition-colors disabled:opacity-40"
              >
                Tomorrow
              </button>
              <button
                onClick={() => handleHoldSelect(168)}
                disabled={acting}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-md hover:bg-amber-50 hover:border-amber-300 transition-colors disabled:opacity-40"
              >
                Next Week
              </button>
            </div>
            <button
              onClick={handleCancelPanel}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── No / Correction Panel (Decision cards) ── */}
      {showNoPanel && (
        <div className="px-5 pt-2 pb-3">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">What was wrong?</p>

            {/* Quick-fix buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCorrectionType("wrong_category")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                  correctionType === "wrong_category"
                    ? "bg-red-50 border-red-300 text-red-700"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-red-50 hover:border-red-300"
                }`}
              >
                Wrong Category
              </button>
              <button
                onClick={() => setCorrectionType("wrong_priority")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                  correctionType === "wrong_priority"
                    ? "bg-red-50 border-red-300 text-red-700"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-red-50 hover:border-red-300"
                }`}
              >
                Wrong Priority
              </button>
              <button
                onClick={() => setCorrectionType("shouldnt_exist")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                  correctionType === "shouldnt_exist"
                    ? "bg-red-50 border-red-300 text-red-700"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-red-50 hover:border-red-300"
                }`}
              >
                Shouldn&apos;t Exist
              </button>
              <button
                onClick={() => setCorrectionType("other")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                  correctionType === "other"
                    ? "bg-red-50 border-red-300 text-red-700"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-red-50 hover:border-red-300"
                }`}
              >
                Other
              </button>
            </div>

            {/* Wrong Category — text input */}
            {correctionType === "wrong_category" && (
              <input
                type="text"
                placeholder="What should the category be?"
                value={correctionCategory}
                onChange={(e) => setCorrectionCategory(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-300"
              />
            )}

            {/* Wrong Priority — priority buttons */}
            {correctionType === "wrong_priority" && (
              <div className="flex flex-wrap gap-2">
                {(["critical", "high", "medium", "low"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setCorrectionPriority(p)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors capitalize ${
                      correctionPriority === p
                        ? "bg-red-50 border-red-300 text-red-700"
                        : "bg-white border-gray-300 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    Should be {p}
                  </button>
                ))}
              </div>
            )}

            {/* Note field */}
            <input
              type="text"
              placeholder="Optional note..."
              value={correctionNote}
              onChange={(e) => setCorrectionNote(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-300"
            />

            {/* Submit / Cancel */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleSubmitCorrection}
                disabled={acting}
                className="px-4 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-40"
              >
                Submit
              </button>
              <button
                onClick={handleCancelPanel}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
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
            {card.ceo_action === "do" ? "Done" : card.ceo_action === "no" ? "Declined" : "On Hold"}
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
          {(card.card_type === "briefing" || card.card_type === "snapshot") ? (
            <div
              className="text-sm text-[#4b5563] leading-relaxed prose prose-sm max-w-none prose-headings:text-[#1e252a] prose-strong:text-[#1e252a] prose-li:text-[#4b5563]"
              dangerouslySetInnerHTML={{
                __html: card.body
                  .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                  .replace(/^### (.+)$/gm, '<h4 class="text-sm font-bold mt-3 mb-1">$1</h4>')
                  .replace(/^## (.+)$/gm, '<h3 class="text-base font-bold mt-4 mb-1">$1</h3>')
                  .replace(/^# (.+)$/gm, '<h2 class="text-lg font-bold mt-4 mb-2">$1</h2>')
                  .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
                  .replace(/\n{2,}/g, "<br/><br/>")
                  .replace(/\n/g, "<br/>"),
              }}
            />
          ) : (
            <p className="text-sm text-[#4b5563] leading-relaxed">{card.body}</p>
          )}
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
