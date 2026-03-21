"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import dynamic from "next/dynamic";
import { parseChartSpec, type ChartSpec } from "./FeedChart";

const FeedChart = dynamic(() => import("./FeedChart"), { ssr: false });

/* eslint-disable @next/next/no-img-element */

// ─── Lightweight Markdown Renderer (with chart block support) ────────────────

function renderMarkdown(text: string): React.ReactNode {
  // Extract ```chart blocks and replace with placeholders
  const chartSpecs: ChartSpec[] = [];
  const CHART_PLACEHOLDER = "\x00CHART_";
  const processed = text.replace(/```chart\s*\n([\s\S]*?)```/g, (_match, json: string) => {
    const spec = parseChartSpec(json.trim());
    if (spec) {
      const idx = chartSpecs.length;
      chartSpecs.push(spec);
      return `${CHART_PLACEHOLDER}${idx}`;
    }
    return "";
  });

  const lines = processed.split("\n");
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

    // Chart placeholder
    if (trimmed.startsWith(CHART_PLACEHOLDER)) {
      flushList();
      const idx = parseInt(trimmed.slice(CHART_PLACEHOLDER.length), 10);
      if (!isNaN(idx) && chartSpecs[idx]) {
        elements.push(<FeedChart key={key++} spec={chartSpecs[idx]} />);
      }
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

// Card type badge config
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
  resurface_hours?: number;
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
  onContactTap?: (contactId: string, contactName: string) => void;
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

function sourceUrl(card: FeedCardData): string | null {
  const meta = card.metadata as Record<string, unknown> | null;
  const threadId = meta?.thread_id as string | undefined;
  if (threadId && card.source_type?.toLowerCase().includes("email")) {
    return `https://mail.google.com/mail/u/0/#inbox/${threadId}`;
  }
  return null;
}

// ─── Contact Name Highlighter ────────────────────────────────────────────────

interface KnownContact {
  name: string;
  id?: string;
  type?: string;
}

function highlightContacts(
  text: string,
  contacts: KnownContact[],
  onTap?: (contactId: string, contactName: string) => void
): React.ReactNode {
  if (!contacts.length) return text;

  const sorted = [...contacts].sort((a, b) => b.name.length - a.name.length);
  const escaped = sorted.map((c) =>
    c.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(pattern);

  if (parts.length === 1) return text;

  return parts.map((part, i) => {
    const match = sorted.find(
      (c) => c.name.toLowerCase() === part.toLowerCase()
    );
    if (match) {
      if (onTap && match.id && (match.type === "contacts" || match.type === "contact")) {
        return (
          <button
            key={i}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTap(match.id!, match.name); }}
            className="inline cursor-pointer"
            style={{
              textDecoration: "underline",
              textDecorationStyle: "dotted",
              textDecorationColor: "#1e252a",
              background: "none",
              border: "none",
              padding: 0,
              font: "inherit",
              color: "inherit",
            }}
          >
            {part}
          </button>
        );
      }
      return (
        <span
          key={i}
          style={{
            textDecoration: "underline",
            textDecorationStyle: "dotted",
            textDecorationColor: "#1e252a",
          }}
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function FeedCard({ card, onAction, onDismiss, onContactTap }: FeedCardProps) {
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
  const usesBrainSource = isSignalOrIntel || isBriefing || card.card_type === "reflection" || card.card_type === "snapshot";
  const isActed = card.status === "acted";
  const isResolved = isActed && !!card.ceo_action;
  const timeAgo = timeAgoShort(card.created_at);

  const meta = card.metadata as Record<string, unknown> | null;

  // Build known contacts list for body text highlighting
  const knownContacts: KnownContact[] = [];
  if (card.entity_name && card.entity_id) {
    knownContacts.push({ name: card.entity_name, id: card.entity_id, type: card.entity_type || "contact" });
  }
  if (card.related_entities) {
    for (const e of card.related_entities) {
      if (e.name) knownContacts.push({ name: e.name, id: e.id, type: e.type });
    }
  }

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

  const cardBg = isResolved ? badge.resolvedBg : "white";
  const cardOpacity = isResolved ? "opacity-60" : "";
  const cardShadow = isResolved
    ? ""
    : "shadow-[0px_1px_2px_rgba(0,0,0,0.05),0px_4px_12px_rgba(0,0,0,0.06),0px_16px_40px_rgba(0,0,0,0.07)]";

  return (
    <div
      className={`w-full rounded-[12px] ${cardShadow} transition-all ${cardOpacity}`}
      style={{ backgroundColor: cardBg }}
    >
      <div className="flex w-full flex-col gap-[6px] overflow-hidden rounded-[12px] p-[12px]">

      {/* ══════════════════════════════════════════════════════════════════
          ROW 1: TITLE (left) + BADGE (right)
          ══════════════════════════════════════════════════════════════════ */}
      <div className="flex items-start justify-between w-full gap-[12px]">
        <h2
          className="text-[18px] font-semibold leading-[22px] flex-1 min-w-0"
          style={{
            fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
            letterSpacing: "-0.36px",
            color: isSignalOrIntel ? "#9CA5A9" : "#1E252A",
          }}
        >
          {card.title}
        </h2>
        <div
          className="flex items-center justify-center px-[12px] rounded-[4px] shrink-0"
          style={{ backgroundColor: badge.bg, gap: badge.gap, height: "26px" }}
        >
          <img src={badge.icon} alt="" className="w-[16px] h-[16px] shrink-0" />
          <span
            className="text-[12px] font-medium leading-normal whitespace-nowrap"
            style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif", color: badge.textColor }}
          >
            {badge.label}
          </span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          ROW 2: ENTITY NAME
          ══════════════════════════════════════════════════════════════════ */}
      {card.entity_name && (
        onContactTap && card.entity_id && (card.entity_type === "contacts" || card.entity_type === "contact") ? (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onContactTap(card.entity_id!, card.entity_name!); }}
            className="text-[14px] font-medium text-[#1e252a] leading-[18px] text-left cursor-pointer"
            style={{
              fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
              textDecoration: "underline",
              textDecorationStyle: "dotted",
              textDecorationColor: "#1e252a",
              background: "none",
              border: "none",
              padding: 0,
            }}
          >
            {card.entity_name}
          </button>
        ) : (
          <span
            className="text-[14px] font-medium text-[#1e252a] leading-[18px]"
            style={{
              fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
              textDecoration: "underline",
              textDecorationStyle: "dotted",
              textDecorationColor: "#1e252a",
            }}
          >
            {card.entity_name}
          </span>
        )
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ROW 3: BODY TEXT
          ══════════════════════════════════════════════════════════════════ */}
      {card.body && (
        (card.card_type === "snapshot" || card.card_type === "briefing" || card.card_type === "reflection") ? (
          <div
            className="text-[12px] text-[#0c111d] leading-[16px] w-full"
            style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
          >
            {renderMarkdown(card.body)}
          </div>
        ) : (
          <div
            className="text-[12px] text-[#0c111d] leading-[16px] w-full"
            style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
          >
            {highlightContacts(card.body, knownContacts, onContactTap)}
          </div>
        )
      )}

      {/* Action recommendation banner */}
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
          ROW 4: BOTTOM BAR — "More About This" + Source pill (left) | Actions (right)
          ══════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between w-full mt-[2px]" style={{ minHeight: "34px" }}>
        {/* ── Left group: More About This + Source pill ── */}
        <div className="flex gap-[8px] items-center min-w-0 flex-1">
          {(card.reasoning || card.acumen_category || (card.related_entities && card.related_entities.length > 0)) && (
            <button
              onClick={() => {
                const willExpand = !expanded;
                setExpanded(willExpand);
                if (willExpand && card.id) {
                  fetch("/api/brain/track", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ event: "card_expanded", card_id: card.id }),
                  }).catch(() => {});
                }
              }}
              className="flex items-center gap-[6px] px-[12px] rounded-[4px] shrink-0"
              style={{ backgroundColor: "rgba(244, 239, 234, 0.8)", height: "28px" }}
            >
              <span
                className="text-[12px] font-medium text-[#1e252a] leading-[14px] whitespace-nowrap"
                style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
              >
                {expanded ? "Less" : isBriefing ? "See Full Briefing" : "More About This"}
              </span>
              <div style={{ transform: expanded ? "scaleY(-1)" : "none" }}>
                <img src="/icons/chevron-down-sm.svg" alt="" className="w-[10px] h-[5px]" />
              </div>
            </button>
          )}

          {/* Source info pill */}
          <div
            className="flex gap-[6px] items-center px-[8px] rounded-[4px] min-w-0"
            style={{ backgroundColor: "#f3f3f3", height: "28px" }}
          >
            {!usesBrainSource && (card.priority === "high" || card.priority === "critical") && (
              <img src="/icons/dot-priority.svg" alt="" className="w-[6px] h-[6px] shrink-0" />
            )}
            {usesBrainSource ? (
              <img src="/icons/MiMbrain Icon.png" alt="" className="shrink-0" style={{ width: "18px", height: "13px", opacity: 0.6 }} />
            ) : (
              <img src="/icons/gopher.svg" alt="" className="w-[16px] h-[18px] shrink-0" />
            )}
            <span
              className="text-[12px] text-[#6e7b80] leading-[18px] whitespace-nowrap truncate"
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
            {!usesBrainSource && (
              <>
                {sourceLabel(card.source_type) === "Slack" ? (
                  <img src="/icons/slack.svg" alt="" className="w-[16px] h-[16px] shrink-0" />
                ) : (
                  <img src="/icons/gmail.svg" alt="" className="w-[16px] h-[16px] shrink-0" />
                )}
                {sourceUrl(card) ? (
                  <a href={sourceUrl(card)!} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    <img src="/icons/external-link-figma.svg" alt="View source" className="w-[14px] h-[14px]" />
                  </a>
                ) : (
                  <img src="/icons/external-link-figma.svg" alt="" className="w-[14px] h-[14px] shrink-0" />
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Right group: Action buttons ── */}
        {isDecision && !isActed && (
          <div className="flex gap-[20px] items-center shrink-0">
            <button onClick={() => handleAction("do")} disabled={acting}
              className="text-[12px] font-medium text-[#344054] leading-[18px] whitespace-nowrap hover:text-emerald-700 transition-colors disabled:opacity-40"
              style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}>Do</button>
            <button onClick={handleHoldClick} disabled={acting}
              className="text-[12px] font-medium text-[#344054] leading-[18px] whitespace-nowrap hover:text-amber-700 transition-colors disabled:opacity-40"
              style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}>Hold</button>
            <button onClick={handleNoClick} disabled={acting}
              className="text-[12px] font-medium text-[#344054] leading-[18px] whitespace-nowrap hover:text-red-700 transition-colors disabled:opacity-40"
              style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}>No</button>
          </div>
        )}

        {isAction && !isActed && (
          <div className="flex gap-[20px] items-center shrink-0">
            <button onClick={() => handleAction("do")} disabled={acting}
              className="text-[12px] font-medium text-[#344054] leading-[18px] whitespace-nowrap hover:text-emerald-700 transition-colors disabled:opacity-40"
              style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}>Do</button>
            <button onClick={() => handleDismiss()} disabled={acting}
              className="text-[12px] font-medium text-[#344054] leading-[18px] whitespace-nowrap hover:text-slate-500 transition-colors disabled:opacity-40"
              style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}>Dismiss</button>
          </div>
        )}

        {isSignalOrIntel && !isActed && (
          <div className="flex gap-[20px] items-center shrink-0">
            <button onClick={() => handleAction("do")} disabled={acting}
              className="text-[12px] font-medium text-[#344054] leading-[18px] whitespace-nowrap hover:text-emerald-700 transition-colors disabled:opacity-40"
              style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}>Create Task</button>
            <button onClick={() => handleDismiss()} disabled={acting}
              className="text-[12px] font-medium text-[#344054] leading-[18px] whitespace-nowrap hover:text-slate-500 transition-colors disabled:opacity-40"
              style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}>Dismiss</button>
          </div>
        )}

        {isBriefing && !isActed && (
          <div className="flex gap-[20px] items-center shrink-0">
            <button onClick={() => handleAction("do")} disabled={acting}
              className="text-[12px] font-medium text-[#344054] leading-[18px] whitespace-nowrap hover:text-emerald-700 transition-colors disabled:opacity-40"
              style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}>Share</button>
            <button onClick={handleHoldClick} disabled={acting}
              className="text-[12px] font-medium text-[#344054] leading-[18px] whitespace-nowrap hover:text-amber-700 transition-colors disabled:opacity-40"
              style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}>Schedule</button>
            <button onClick={() => handleDismiss()} disabled={acting}
              className="text-[12px] font-medium text-[#344054] leading-[18px] whitespace-nowrap hover:text-slate-500 transition-colors disabled:opacity-40"
              style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}>Dismiss</button>
          </div>
        )}

        {!isDecision && !isAction && !isSignalOrIntel && !isBriefing && !isActed && (
          <div className="flex gap-[20px] items-center shrink-0">
            <button onClick={() => handleAction("do")} disabled={acting}
              className="text-[12px] font-medium text-[#344054] leading-[18px] whitespace-nowrap hover:text-emerald-700 transition-colors disabled:opacity-40"
              style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}>Do</button>
            <button onClick={handleHoldClick} disabled={acting}
              className="text-[12px] font-medium text-[#344054] leading-[18px] whitespace-nowrap hover:text-amber-700 transition-colors disabled:opacity-40"
              style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}>Hold</button>
            <button onClick={handleNoClick} disabled={acting}
              className="text-[12px] font-medium text-[#344054] leading-[18px] whitespace-nowrap hover:text-red-700 transition-colors disabled:opacity-40"
              style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}>No</button>
          </div>
        )}

        {isActed && card.ceo_action && (
          <span
            className="text-[12px] font-medium leading-[18px] shrink-0"
            style={{
              fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
              color: card.ceo_action === "do" ? "#16a34a" : card.ceo_action === "no" ? "#ef4444" : "#ffb20a",
            }}
          >
            {card.ceo_action === "do" ? "Done" : card.ceo_action === "no" ? "Declined" : "Hold"}
          </span>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          EXPANDED CONTENT
          ══════════════════════════════════════════════════════════════════ */}
      {expanded && (
        <div className="flex flex-col gap-[8px] pt-[4px]">
          {card.reasoning && (
            <div className="flex flex-col gap-[6px] items-start">
              {!isBriefing && (
                <p
                  className="text-[12px] font-bold text-[#bba14f] leading-[16px] uppercase whitespace-nowrap"
                  style={{ fontFamily: "var(--font-inter), 'Inter', sans-serif", letterSpacing: "1.2px" }}
                >
                  {isSignalOrIntel ? "background" : "motion reasoning"}
                </p>
              )}
              {(card.card_type === "snapshot" || card.card_type === "briefing" || card.card_type === "reflection") ? (
                <div className="text-[12px] text-[#0c111d] leading-[16px]" style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}>
                  {renderMarkdown(card.reasoning)}
                </div>
              ) : (
                <p className="text-[12px] text-[#0c111d] leading-[16px]" style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}>
                  {card.reasoning}
                </p>
              )}
            </div>
          )}

          {(card.acumen_category || (card.related_entities && card.related_entities.length > 0)) && (
            <div className="text-[12px] font-medium text-[#1e252a] leading-[18px]" style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}>
              {card.acumen_category && (
                <>
                  {"This "}
                  <span className="text-[#627c9e]">{card.acumen_category.charAt(0).toUpperCase() + card.acumen_category.slice(1)}</span>
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
                      {onContactTap && (e.type === "contacts" || e.type === "contact") ? (
                        <button
                          onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); onContactTap(e.id, e.name); }}
                          className="inline cursor-pointer"
                          style={{ textDecoration: "underline", textDecorationStyle: "dotted", background: "none", border: "none", padding: 0, font: "inherit", color: "inherit" }}
                        >{e.name}</button>
                      ) : (
                        <span style={{ textDecoration: "underline", textDecorationStyle: "dotted" }}>{e.name}</span>
                      )}
                    </span>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          HOLD PANEL
          ══════════════════════════════════════════════════════════════════ */}
      {showHoldPanel && (
        <div className="pt-[6px]">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Resurface in:</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => handleHoldSelect(1)} disabled={acting}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-md hover:bg-amber-50 hover:border-amber-300 transition-colors disabled:opacity-40">1 hour</button>
              <button onClick={() => handleHoldSelect(4)} disabled={acting}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-md hover:bg-amber-50 hover:border-amber-300 transition-colors disabled:opacity-40">4 hours</button>
              <button onClick={() => handleHoldSelect(24)} disabled={acting}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-md hover:bg-amber-50 hover:border-amber-300 transition-colors disabled:opacity-40">Tomorrow</button>
              <button onClick={() => handleHoldSelect(168)} disabled={acting}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-md hover:bg-amber-50 hover:border-amber-300 transition-colors disabled:opacity-40">Next Week</button>
            </div>
            <button onClick={handleCancelPanel} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Cancel</button>
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
              <button onClick={() => setCorrectionType("wrong_category")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${correctionType === "wrong_category" ? "bg-red-50 border-red-300 text-red-700" : "bg-white border-gray-300 text-gray-700 hover:bg-red-50 hover:border-red-300"}`}>Wrong Category</button>
              <button onClick={() => setCorrectionType("wrong_priority")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${correctionType === "wrong_priority" ? "bg-red-50 border-red-300 text-red-700" : "bg-white border-gray-300 text-gray-700 hover:bg-red-50 hover:border-red-300"}`}>Wrong Priority</button>
              <button onClick={() => setCorrectionType("shouldnt_exist")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${correctionType === "shouldnt_exist" ? "bg-red-50 border-red-300 text-red-700" : "bg-white border-gray-300 text-gray-700 hover:bg-red-50 hover:border-red-300"}`}>Shouldn&apos;t Exist</button>
              <button onClick={() => setCorrectionType("other")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${correctionType === "other" ? "bg-red-50 border-red-300 text-red-700" : "bg-white border-gray-300 text-gray-700 hover:bg-red-50 hover:border-red-300"}`}>Other</button>
            </div>

            {correctionType === "wrong_category" && (
              <input type="text" placeholder="What should the category be?" value={correctionCategory}
                onChange={(e) => setCorrectionCategory(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-300" />
            )}

            {correctionType === "wrong_priority" && (
              <div className="flex flex-wrap gap-2">
                {(["critical", "high", "medium", "low"] as const).map((p) => (
                  <button key={p} onClick={() => setCorrectionPriority(p)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors capitalize ${correctionPriority === p ? "bg-red-50 border-red-300 text-red-700" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-100"}`}>Should be {p}</button>
                ))}
              </div>
            )}

            <input type="text" placeholder="Optional note..." value={correctionNote}
              onChange={(e) => setCorrectionNote(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-300" />

            <div className="flex items-center gap-3">
              <button onClick={handleSubmitCorrection} disabled={acting}
                className="px-4 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-40">Submit</button>
              <button onClick={handleCancelPanel} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Cancel</button>
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
                  <select value={trainCategory} onChange={(e) => setTrainCategory(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-300">
                    <option value="">-- select --</option>
                    {ACUMEN_CATEGORIES.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
                  <select value={trainPriority} onChange={(e) => setTrainPriority(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-300">
                    <option value="">-- select --</option>
                    {PRIORITY_OPTIONS.map((p) => (<option key={p} value={p}>{p}</option>))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Card Type</label>
                  <select value={trainCardType} onChange={(e) => setTrainCardType(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-300">
                    <option value="">-- select --</option>
                    {CARD_TYPE_OPTIONS.map((ct) => (<option key={ct} value={ct}>{ct}</option>))}
                  </select>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={trainShouldNotExist} onChange={(e) => setTrainShouldNotExist(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-300" />
                  <span className="text-sm text-slate-700">This card should not have been created</span>
                </label>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Note</label>
                  <input type="text" placeholder="Optional feedback..." value={trainNote} onChange={(e) => setTrainNote(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-300" />
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button onClick={handleTrainSubmit} disabled={trainSubmitting}
                    className="px-4 py-1.5 text-xs font-semibold bg-[#0ea5e9] text-white rounded-md hover:bg-[#0284c7] transition-colors disabled:opacity-40">
                    {trainSubmitting ? "Submitting..." : "Submit Correction"}
                  </button>
                  <button onClick={handleTrainCancel} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TRAINING MODE FRAMING
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
    </div>
  );
}
