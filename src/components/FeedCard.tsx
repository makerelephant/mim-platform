"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";

/* eslint-disable @next/next/no-img-element */

// ─── Lightweight Markdown Renderer ──────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let key = 0;

  function flushList() {
    if (listItems.length > 0) {
      elements.push(
        <ul key={key++} className="list-disc pl-[16px] space-y-[2px]">
          {listItems.map((item, i) => (
            <li key={i}>{inlineBold(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
  }

  function inlineBold(s: string): React.ReactNode {
    const parts = s.split(/\*\*(.*?)\*\*/g);
    if (parts.length === 1) return s;
    return parts.map((part, i) =>
      i % 2 === 1 ? <strong key={i}>{part}</strong> : part
    );
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      continue;
    }

    // Headings
    if (trimmed.startsWith("# ")) {
      flushList();
      elements.push(<p key={key++} className="font-semibold text-[14px] text-[#1e252a] mt-[8px] mb-[2px]">{inlineBold(trimmed.slice(2))}</p>);
    } else if (trimmed.startsWith("## ")) {
      flushList();
      elements.push(<p key={key++} className="font-semibold text-[13px] text-[#1e252a] mt-[6px] mb-[2px]">{inlineBold(trimmed.slice(3))}</p>);
    } else if (trimmed.startsWith("### ")) {
      flushList();
      elements.push(<p key={key++} className="font-medium text-[12px] text-[#344054] mt-[4px] mb-[1px]">{inlineBold(trimmed.slice(4))}</p>);
    } else if (trimmed.startsWith("---")) {
      flushList();
      elements.push(<hr key={key++} className="border-t border-[#e5e7eb] my-[6px]" />);
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      listItems.push(trimmed.slice(2));
    } else {
      flushList();
      elements.push(<p key={key++} className="mb-[2px]">{inlineBold(trimmed)}</p>);
    }
  }
  flushList();
  return <>{elements}</>;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ACUMEN_CATEGORIES = [
  "fundraising",
  "partnership",
  "product",
  "operations",
  "legal",
  "finance",
  "marketing",
  "hr",
  "customer",
  "competitor",
  "industry",
] as const;

const PRIORITY_OPTIONS = ["critical", "high", "medium", "low"] as const;

const CARD_TYPE_OPTIONS = [
  "decision",
  "action",
  "signal",
  "intelligence",
  "briefing",
  "reflection",
  "snapshot",
] as const;

// Card type badge config — all from Figma node 15:3592
// Decision: #d8e5dd, black text, gauge, gap 10px, resolved bg #f3f2ed
// Action:   #289bff, white text, rocket, gap 10px, resolved bg #ecfaff
// Signal:   #9c6ade, white text, satellite, gap 6px, resolved bg #f2e9fa
// Briefing: #3e4c60, white text, radar, gap 6px, resolved bg #e6e9ee
const CARD_TYPE_BADGES: Record<string, { bg: string; textColor: string; label: string; icon: string; gap: string; resolvedBg: string }> = {
  decision:     { bg: "#d8e5dd", textColor: "black",  label: "Decision",     icon: "/icons/gauge.svg",     gap: "10px", resolvedBg: "#f3f2ed" },
  action:       { bg: "#289bff", textColor: "white",  label: "Action",       icon: "/icons/rocket.svg",    gap: "6px",  resolvedBg: "#ecfaff" },
  signal:       { bg: "#9c6ade", textColor: "white",  label: "Signal",       icon: "/icons/satellite.svg", gap: "6px",  resolvedBg: "#f2e9fa" },
  intelligence: { bg: "#9c6ade", textColor: "white",  label: "Intelligence", icon: "/icons/satellite.svg", gap: "6px",  resolvedBg: "#f2e9fa" },
  briefing:     { bg: "#3e4c60", textColor: "white",  label: "Briefing",     icon: "/icons/radar.svg",     gap: "6px",  resolvedBg: "#e6e9ee" },
  reflection:   { bg: "#d8e5dd", textColor: "black",  label: "Reflection",   icon: "/icons/gauge.svg",     gap: "10px", resolvedBg: "#f3f2ed" },
  snapshot:     { bg: "#d8e5dd", textColor: "black",  label: "Snapshot",     icon: "/icons/gauge.svg",     gap: "10px", resolvedBg: "#f3f2ed" },
};

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
  message_count?: number | null;
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

function timeAgoShort(dateStr: string): string {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: false });
}

/** Build a URL to the original source (Gmail thread, etc.) */
function sourceUrl(card: FeedCardData): string | null {
  const meta = card.metadata as Record<string, unknown> | null;
  const threadId = meta?.thread_id as string | undefined;
  if (threadId && card.source_type?.toLowerCase().includes("email")) {
    return `https://mail.google.com/mail/u/0/#inbox/${threadId}`;
  }
  return null;
}

/** Build entity detail link based on entity_type */
function entityLink(entityId: string, entityType: string): string {
  if (entityType === "contacts" || entityType === "contact") {
    return `/contacts/${entityId}`;
  }
  // Organizations and other types — no detail page yet, link to contacts as fallback
  return `/contacts/${entityId}`;
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

  // Train modal state
  const [showTrainPanel, setShowTrainPanel] = useState(false);
  const [trainCategory, setTrainCategory] = useState("");
  const [trainPriority, setTrainPriority] = useState("");
  const [trainCardType, setTrainCardType] = useState("");
  const [trainShouldNotExist, setTrainShouldNotExist] = useState(false);
  const [trainNote, setTrainNote] = useState("");
  const [trainSubmitting, setTrainSubmitting] = useState(false);
  const [trainSuccess, setTrainSuccess] = useState(false);

  const isDecision = card.card_type === "decision";
  const isAction = card.card_type === "action";
  const isSignalOrIntel = card.card_type === "signal" || card.card_type === "intelligence";
  const isBriefing = card.card_type === "briefing";
  // Signal/Briefing use MiMbrain source pill (no gopher+gmail)
  const usesBrainSource = isSignalOrIntel || isBriefing || card.card_type === "reflection" || card.card_type === "snapshot";
  const isActed = card.status === "acted";
  const isResolved = isActed && !!card.ceo_action;
  const resolvedDo = isResolved && card.ceo_action === "do";
  const timeAgo = timeAgoShort(card.created_at);

  // Extract email metadata if present
  const meta = card.metadata as Record<string, unknown> | null;

  // Badge config
  const badge = CARD_TYPE_BADGES[card.card_type] || CARD_TYPE_BADGES.signal;

  // ─── Action handlers ───────────────────────────────────────────────────

  async function handleAction(action: "do" | "no" | "not_now", correction?: CorrectionData) {
    setActing(true);
    try {
      await onAction(card.id, action, correction);
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
    setShowTrainPanel(false);
  }

  function handleHoldClick() {
    setShowHoldPanel(true);
    setShowNoPanel(false);
    setShowTrainPanel(false);
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

  // ─── Train Modal ─────────────────────────────────────────────────────

  function handleTrainOpen() {
    setShowTrainPanel(true);
    setShowNoPanel(false);
    setShowHoldPanel(false);
    setTrainCategory(card.acumen_category || "");
    setTrainPriority(card.priority || "");
    setTrainCardType(card.card_type || "");
    setTrainShouldNotExist(false);
    setTrainNote("");
    setTrainSuccess(false);
  }

  function handleTrainCancel() {
    setShowTrainPanel(false);
    setTrainCategory("");
    setTrainPriority("");
    setTrainCardType("");
    setTrainShouldNotExist(false);
    setTrainNote("");
    setTrainSuccess(false);
  }

  async function handleTrainSubmit() {
    setTrainSubmitting(true);
    try {
      const correction: CorrectionData = {};
      if (trainCategory && trainCategory !== (card.acumen_category || "")) {
        correction.wrong_category = trainCategory;
      }
      if (trainPriority && trainPriority !== (card.priority || "")) {
        correction.wrong_priority = trainPriority;
      }
      if (trainCardType && trainCardType !== (card.card_type || "")) {
        correction.wrong_card_type = trainCardType;
      }
      if (trainShouldNotExist) {
        correction.should_not_exist = true;
      }
      if (trainNote) {
        correction.note = trainNote;
      }
      const hasCorrection =
        correction.wrong_category ||
        correction.wrong_priority ||
        correction.wrong_card_type ||
        correction.should_not_exist ||
        correction.note;
      if (!hasCorrection) {
        setTrainSubmitting(false);
        return;
      }
      const res = await fetch("/api/feed", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: card.id,
          ceo_action: "no",
          ceo_correction: correction,
          correction,
        }),
      });
      if (res.ok) {
        setTrainSuccess(true);
        setTimeout(() => {
          setShowTrainPanel(false);
          setTrainSuccess(false);
        }, 1500);
      }
    } finally {
      setTrainSubmitting(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────

  // Resolved state: bg changes per card type, entire card at opacity 60%, NO shadow
  const cardBg = isResolved ? badge.resolvedBg : "white";
  const cardOpacity = isResolved ? "opacity-60" : "";
  const cardShadow = isResolved ? "" : "shadow-[0px_0px_60px_0px_rgba(0,0,0,0.12)]";

  return (
    <div
      className={`flex flex-col gap-[6px] p-[12px] rounded-[12px] ${cardShadow} transition-all w-full overflow-hidden ${cardOpacity}`}
      style={{ backgroundColor: cardBg }}
    >
      {/* ══════════════════════════════════════════════════════════════════
          ZONE 1: HEADER ROW — Badge + Source Pill + Actions
          ══════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-[6px] w-full">
        <div className="flex items-center justify-between w-full">
          {/* ── Left: Badge + Source ── */}
          <div className="flex gap-[12px] items-center min-w-0 flex-1">
            {/* Card type badge */}
            <div
              className="flex items-center justify-center px-[12px] py-[6px] rounded-[4px] shrink-0"
              style={{ backgroundColor: badge.bg, gap: badge.gap }}
            >
              <img
                src={badge.icon}
                alt=""
                className="w-[16px] h-[16px] shrink-0"
              />
              <span
                className="text-[12px] font-medium leading-normal whitespace-nowrap"
                style={{
                  fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
                  color: badge.textColor,
                }}
              >
                {badge.label}
              </span>
            </div>

            {/* Source pill — per Figma: Decision/Action cards show gopher+gmail/slack;
                Signal/Briefing/etc show MiMbrain icon + time only */}
            <div
              className="flex gap-[6px] items-center px-[12px] py-[3px] rounded-[4px] min-w-0"
              style={{ border: "1px solid rgba(208, 213, 221, 0.6)" }}
            >
              {/* Red dot — high priority only, per Figma Dot.svg */}
              {!usesBrainSource && (card.priority === "high" || card.priority === "critical") && (
                <img src="/icons/dot-priority.svg" alt="" className="w-[6px] h-[6px] shrink-0" />
              )}

              {usesBrainSource ? (
                /* MiMbrain icon for Signal/Briefing/etc — per Figma 40:610 */
                <img
                  src="/icons/MiMbrain Icon.png"
                  alt=""
                  className="shrink-0"
                  style={{ width: "18px", height: "13px", opacity: 0.6 }}
                />
              ) : (
                /* Gopher avatar for Decision/Action — per Figma 37:735 */
                <img
                  src="/icons/gopher.svg"
                  alt=""
                  className="w-[18px] h-[20px] shrink-0"
                />
              )}

              {/* Time + source text */}
              <span
                className="text-[12px] text-[#6e7b80] leading-[18px] text-center whitespace-nowrap truncate"
                style={{ fontFamily: "var(--font-inter), 'Inter', sans-serif" }}
              >
                {timeAgo} Ago
                {!usesBrainSource && (
                  <>
                    {" from "}
                    <span className="font-bold text-[#1e252a]">{sourceLabel(card.source_type)}</span>
                  </>
                )}
              </span>

              {/* Source icon — only for Decision/Action cards */}
              {!usesBrainSource && (
                <>
                  {sourceLabel(card.source_type) === "Slack" ? (
                    <img src="/icons/slack.svg" alt="" className="w-[20px] h-[20px] shrink-0" />
                  ) : (
                    <img src="/icons/gmail.svg" alt="" className="w-[20px] h-[20px] shrink-0" />
                  )}

                  {/* External link — per Figma: 16x16, links back to source */}
                  {sourceUrl(card) ? (
                    <a href={sourceUrl(card)!} target="_blank" rel="noopener noreferrer" className="shrink-0">
                      <img src="/icons/external-link-figma.svg" alt="View source" className="w-[16px] h-[16px]" />
                    </a>
                  ) : (
                    <img src="/icons/external-link-figma.svg" alt="" className="w-[16px] h-[16px] shrink-0" />
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Right: Action buttons ── */}
          {/* Decision: Do / Hold / No */}
          {isDecision && !isActed && (
            <div className="flex gap-[20px] items-start px-[6px] shrink-0">
              <button
                onClick={() => handleAction("do")}
                disabled={acting}
                className="text-[12px] font-medium text-[#344054] leading-[18px] text-center whitespace-nowrap hover:text-emerald-700 transition-colors disabled:opacity-40"
                style={{ fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif" }}
              >
                Do
              </button>
              <button
                onClick={handleHoldClick}
                disabled={acting}
                className="text-[12px] font-medium text-[#344054] leading-[18px] text-center whitespace-nowrap hover:text-amber-700 transition-colors disabled:opacity-40"
                style={{ fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif" }}
              >
                Hold
              </button>
              <button
                onClick={handleNoClick}
                disabled={acting}
                className="text-[12px] font-medium text-[#344054] leading-[18px] text-center whitespace-nowrap hover:text-red-700 transition-colors disabled:opacity-40"
                style={{ fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif" }}
              >
                No
              </button>
            </div>
          )}

          {/* Action: Do / Dismiss */}
          {isAction && !isActed && (
            <div className="flex gap-[20px] items-start px-[6px] shrink-0">
              <button
                onClick={() => handleAction("do")}
                disabled={acting}
                className="text-[12px] font-medium text-[#344054] leading-[18px] text-center whitespace-nowrap hover:text-emerald-700 transition-colors disabled:opacity-40"
                style={{ fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif" }}
              >
                Do
              </button>
              <button
                onClick={() => handleDismiss()}
                disabled={acting}
                className="text-[12px] font-medium text-[#344054] leading-[18px] text-center whitespace-nowrap hover:text-slate-500 transition-colors disabled:opacity-40"
                style={{ fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif" }}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Signal/Intelligence: Create Task / Dismiss — per Figma 40:610 */}
          {isSignalOrIntel && !isActed && (
            <div className="flex gap-[20px] items-start px-[6px] shrink-0">
              <button
                onClick={() => handleAction("do")}
                disabled={acting}
                className="text-[12px] font-medium text-[#344054] leading-[18px] text-center whitespace-nowrap hover:text-emerald-700 transition-colors disabled:opacity-40"
                style={{ fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif" }}
              >
                Create Task
              </button>
              <button
                onClick={() => handleDismiss()}
                disabled={acting}
                className="text-[12px] font-medium text-[#344054] leading-[18px] text-center whitespace-nowrap hover:text-slate-500 transition-colors disabled:opacity-40"
                style={{ fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif" }}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Briefing: Share / Schedule / Dig In — per Figma 40:1106 */}
          {isBriefing && !isActed && (
            <div className="flex gap-[20px] items-start px-[6px] shrink-0">
              <button
                onClick={() => handleAction("do")}
                disabled={acting}
                className="text-[12px] font-medium text-[#344054] leading-[18px] text-center whitespace-nowrap hover:text-emerald-700 transition-colors disabled:opacity-40"
                style={{ fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif" }}
              >
                Share
              </button>
              <button
                onClick={handleHoldClick}
                disabled={acting}
                className="text-[12px] font-medium text-[#344054] leading-[18px] text-center whitespace-nowrap hover:text-amber-700 transition-colors disabled:opacity-40"
                style={{ fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif" }}
              >
                Schedule
              </button>
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-[12px] font-medium text-[#344054] leading-[18px] text-center whitespace-nowrap hover:text-blue-700 transition-colors"
                style={{ fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif" }}
              >
                Dig In
              </button>
            </div>
          )}

          {/* Snapshot/Reflection: Do / Hold / No */}
          {!isDecision && !isAction && !isSignalOrIntel && !isBriefing && !isActed && (
            <div className="flex gap-[20px] items-start px-[6px] shrink-0">
              <button
                onClick={() => handleAction("do")}
                disabled={acting}
                className="text-[12px] font-medium text-[#344054] leading-[18px] text-center whitespace-nowrap hover:text-emerald-700 transition-colors disabled:opacity-40"
                style={{ fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif" }}
              >
                Do
              </button>
              <button
                onClick={handleHoldClick}
                disabled={acting}
                className="text-[12px] font-medium text-[#344054] leading-[18px] text-center whitespace-nowrap hover:text-amber-700 transition-colors disabled:opacity-40"
                style={{ fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif" }}
              >
                Hold
              </button>
              <button
                onClick={handleNoClick}
                disabled={acting}
                className="text-[12px] font-medium text-[#344054] leading-[18px] text-center whitespace-nowrap hover:text-red-700 transition-colors disabled:opacity-40"
                style={{ fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif" }}
              >
                No
              </button>
            </div>
          )}

          {/* Acted indicator in header position */}
          {isActed && card.ceo_action && (
            <div className="flex items-start px-[6px]">
              <span
                className="text-[12px] font-medium leading-[18px]"
                style={{
                  fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif",
                  color: card.ceo_action === "do" ? "#16a34a" :
                         card.ceo_action === "no" ? "#ef4444" :
                         "#ffb20a",
                }}
              >
                {card.ceo_action === "do" ? "Done" : card.ceo_action === "no" ? "Declined" : "Hold"}
              </span>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            ZONE 2: TITLE
            ══════════════════════════════════════════════════════════════════ */}
        <div className="flex flex-col items-start w-full">
          <h2
            className="text-[18px] font-semibold leading-[22px]"
            style={{
              fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
              letterSpacing: "-0.36px",
              // Per Figma: Signal/Intelligence titles are muted #9CA5A9, all others are dark #1E252A
              color: isSignalOrIntel ? "#9CA5A9" : "#1E252A",
            }}
          >
            {card.title}
          </h2>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          ZONE 3: BODY CONTENT
          ══════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-[12px] items-start">
        {/* Entity name + body text */}
        <div className="flex flex-col gap-[6px] items-start w-full">
          {/* Entity name — dotted underline per Figma, links to entity detail */}
          {card.entity_name && (
            <a
              href={card.entity_id && card.entity_type ? entityLink(card.entity_id, card.entity_type) : "#"}
              className="text-[14px] font-medium text-[#1e252a] leading-[18px]"
              style={{
                fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
                textDecoration: "underline",
                textDecorationStyle: "dotted",
                textDecorationColor: "#1e252a",
              }}
            >
              {card.entity_name}
            </a>
          )}

          {/* Body text — markdown for snapshot/briefing, plain for others */}
          {card.body && (
            (card.card_type === "snapshot" || card.card_type === "briefing") ? (
              <div
                className="text-[12px] text-[#0c111d] leading-[16px] w-full"
                style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
              >
                {renderMarkdown(card.body)}
              </div>
            ) : (
              <p
                className="text-[12px] text-[#0c111d] leading-[16px] w-full"
                style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
              >
                {card.body}
              </p>
            )
          )}
        </div>

        {/* Action recommendation banner — amber, on Decision/Action cards when scanner provided one */}
        {(isDecision || isAction) && !!meta?.action_recommendation && !isActed && (
          <div
            className="flex items-start gap-[8px] px-[10px] py-[8px] rounded-[6px] w-full"
            style={{ backgroundColor: "rgba(255, 178, 10, 0.1)", border: "1px solid rgba(255, 178, 10, 0.3)" }}
          >
            <span className="text-[11px] shrink-0 mt-[1px]">💡</span>
            <p
              className="text-[11px] font-medium text-[#92710a] leading-[15px]"
              style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
            >
              {String(meta.action_recommendation)}
            </p>
          </div>
        )}


        {/* ══════════════════════════════════════════════════════════════════
            "More About This" / "Less" toggle — Figma expand trigger
            ══════════════════════════════════════════════════════════════════ */}
        {(card.reasoning || card.acumen_category || (card.related_entities && card.related_entities.length > 0)) && (
          <button
            onClick={() => setExpanded(!expanded)}
            className={`flex items-center px-[12px] py-[4px] rounded-[8px] ${expanded ? "gap-[6px]" : "gap-[12px]"}`}
            style={{ backgroundColor: expanded ? "#f4efea" : "rgba(244, 239, 234, 0.8)" }}
          >
            <span
              className="text-[12px] font-medium text-[#1e252a] leading-[14px] text-center whitespace-nowrap"
              style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
            >
              {expanded ? "Less" : isBriefing ? "See Full Briefing" : "More About This"}
            </span>
            <div
              className="flex items-center justify-center"
              style={{ transform: expanded ? "scaleY(-1)" : "none" }}
            >
              <img
                src="/icons/chevron-down-sm.svg"
                alt=""
                className="w-[10px] h-[5px]"
              />
            </div>
          </button>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            EXPANDED CONTENT — MOTION REASONING + Entity metadata
            ══════════════════════════════════════════════════════════════════ */}
        {expanded && (
          <>
            {/* Motion Reasoning section */}
            {card.reasoning && (
              <div className="flex flex-col gap-[6px] items-start">
                {/* Section label — Signal: "BACKGROUND" in gold, Decision/Action: "MOTION REASONING", Briefing: none */}
                {!isBriefing && (
                  <p
                    className="text-[12px] font-bold text-[#bba14f] leading-[16px] uppercase whitespace-nowrap"
                    style={{
                      fontFamily: "var(--font-inter), 'Inter', sans-serif",
                      letterSpacing: "1.2px",
                    }}
                  >
                    {isSignalOrIntel ? "background" : "motion reasoning"}
                  </p>
                )}
                {(card.card_type === "snapshot" || card.card_type === "briefing") ? (
                  <div
                    className="text-[12px] text-[#0c111d] leading-[16px]"
                    style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                  >
                    {renderMarkdown(card.reasoning)}
                  </div>
                ) : (
                  <p
                    className="text-[12px] text-[#0c111d] leading-[16px]"
                    style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                  >
                    {card.reasoning}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          ENTITY / CATEGORY METADATA LINE (expanded only)
          "This Fundraising conversation includes both Walt Doyle and David Brown"
          ══════════════════════════════════════════════════════════════════ */}
      {expanded && (card.acumen_category || (card.related_entities && card.related_entities.length > 0)) && (
        <p
          className="text-[12px] font-medium text-[#1e252a] leading-[18px] whitespace-nowrap"
          style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
        >
          {card.acumen_category && (
            <>
              {"This "}
              <span className="text-[#627c9e]">
                {card.acumen_category.charAt(0).toUpperCase() + card.acumen_category.slice(1)}
              </span>
              {" conversation"}
            </>
          )}
          {card.related_entities && card.related_entities.length > 0 && (
            <>
              {" includes "}
              {card.related_entities.length === 1 ? "" : "both "}
              {card.related_entities.map((e, i) => (
                <span key={e.id}>
                  {i > 0 && i === card.related_entities!.length - 1 ? " and " : i > 0 ? ", " : ""}
                  <a
                    href={entityLink(e.id, e.type)}
                    style={{
                      textDecoration: "underline",
                      textDecorationStyle: "dotted",
                    }}
                  >
                    {e.name}
                  </a>
                </span>
              ))}
            </>
          )}
        </p>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          HOLD PANEL
          ══════════════════════════════════════════════════════════════════ */}
      {showHoldPanel && (
        <div className="pt-[6px]">
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

      {/* ══════════════════════════════════════════════════════════════════
          NO / CORRECTION PANEL
          ══════════════════════════════════════════════════════════════════ */}
      {showNoPanel && (
        <div className="pt-[6px]">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">What was wrong?</p>

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

            {correctionType === "wrong_category" && (
              <input
                type="text"
                placeholder="What should the category be?"
                value={correctionCategory}
                onChange={(e) => setCorrectionCategory(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-300"
              />
            )}

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

            <input
              type="text"
              placeholder="Optional note..."
              value={correctionNote}
              onChange={(e) => setCorrectionNote(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-300"
            />

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

      {/* ══════════════════════════════════════════════════════════════════
          TRAIN PANEL
          ══════════════════════════════════════════════════════════════════ */}
      {showTrainPanel && (
        <div className="pt-[6px]">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
            {trainSuccess ? (
              <div className="flex items-center justify-center py-3">
                <span className="text-sm font-semibold text-emerald-600">Learned &#10003;</span>
              </div>
            ) : (
              <>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Train the Brain</p>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                  <select
                    value={trainCategory}
                    onChange={(e) => setTrainCategory(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                  >
                    <option value="">-- select --</option>
                    {ACUMEN_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
                  <select
                    value={trainPriority}
                    onChange={(e) => setTrainPriority(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                  >
                    <option value="">-- select --</option>
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Card Type</label>
                  <select
                    value={trainCardType}
                    onChange={(e) => setTrainCardType(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                  >
                    <option value="">-- select --</option>
                    {CARD_TYPE_OPTIONS.map((ct) => (
                      <option key={ct} value={ct}>{ct}</option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={trainShouldNotExist}
                    onChange={(e) => setTrainShouldNotExist(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-300"
                  />
                  <span className="text-sm text-slate-700">This card should not have been created</span>
                </label>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Note</label>
                  <input
                    type="text"
                    placeholder="Optional feedback..."
                    value={trainNote}
                    onChange={(e) => setTrainNote(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-300"
                  />
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={handleTrainSubmit}
                    disabled={trainSubmitting}
                    className="px-4 py-1.5 text-xs font-semibold bg-[#0ea5e9] text-white rounded-md hover:bg-[#0284c7] transition-colors disabled:opacity-40"
                  >
                    {trainSubmitting ? "Submitting..." : "Submit Correction"}
                  </button>
                  <button
                    onClick={handleTrainCancel}
                    className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TRAINING MODE FRAMING (bottom of card)
          ══════════════════════════════════════════════════════════════════ */}
      {!isActed && card.acumen_category && (
        <div className="pt-[2px]">
          <p
            className="text-[11px] text-[#94A3B8] italic leading-[16px]"
            style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
          >
            Brain classified as{" "}
            <span className="font-semibold text-[#64748B] not-italic">{card.acumen_category}</span>
            {card.priority && (
              <>
                {" / "}
                <span className="font-semibold text-[#64748B] not-italic">{card.priority}</span>
              </>
            )}
            {". "}
            <button
              onClick={handleTrainOpen}
              className="text-[#0ea5e9] hover:text-[#0284c7] font-medium not-italic"
            >
              Correct?
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
