"use client";

import { useState, useEffect, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import type { FeedCardData } from "./FeedCard";

/* eslint-disable @next/next/no-img-element */

// ─── Thread Status Types ─────────────────────────────────────────────────────

type ThreadStatus = "replied" | "drafted" | "forwarded" | "starred" | "archived" | "unactioned" | null;

const STATUS_CHIPS: Record<string, { label: string; color: string; bg: string; icon: string; iconPosition: "left" | "right" }> = {
  replied: { label: "Replied", color: "#289bff", bg: "#ecfaff", icon: "/icons/status/replied.png", iconPosition: "left" },
  drafted: { label: "Draft", color: "#9c6ade", bg: "#f9f3ff", icon: "/icons/status/draft.png", iconPosition: "left" },
  forwarded: { label: "Forwarded", color: "#5ad1b3", bg: "#e3fff5", icon: "/icons/status/forwarded.png", iconPosition: "right" },
  starred: { label: "Starred", color: "#7b7f81", bg: "transparent", icon: "/icons/status/star-on.png", iconPosition: "left" },
  archived: { label: "Archived", color: "#3e4c60", bg: "#f3f3f3", icon: "/icons/status/archived.png", iconPosition: "left" },
};

// ─── Gopher Icons (randomized per card) ──────────────────────────────────────

const GOPHER_COUNT = 17;

function gopherPath(cardId: string): string {
  // Deterministic "random" from card ID so it stays consistent across renders
  let hash = 0;
  for (let i = 0; i < cardId.length; i++) {
    hash = ((hash << 5) - hash + cardId.charCodeAt(i)) | 0;
  }
  const idx = (Math.abs(hash) % GOPHER_COUNT) + 1;
  return `/icons/gophers/gopher-${idx}.png`;
}

// ─── Intent Icon Logic ───────────────────────────────────────────────────────

type IntentType = "respond" | "read" | "write" | "schedule";

const INTENT_ICONS: Record<IntentType, string> = {
  respond: "/icons/intent/respond.png",
  read: "/icons/intent/read.png",
  write: "/icons/intent/write.png",
  schedule: "/icons/intent/schedule.png",
};

/**
 * Determine the suggested intent from card metadata.
 * The classifier already has action_recommendation, priority, and acumen_category —
 * we use simple heuristics to map to the 4 intent verbs.
 */
function inferIntent(card: FeedCardData): IntentType {
  const body = (card.body || "").toLowerCase();
  const title = (card.title || "").toLowerCase();
  const rec = (
    (card.metadata?.action_recommendation as string) || ""
  ).toLowerCase();
  const combined = `${title} ${body} ${rec}`;

  // Schedule signals
  if (
    combined.includes("meeting") ||
    combined.includes("schedule") ||
    combined.includes("calendar") ||
    combined.includes("call") ||
    combined.includes("google meet") ||
    combined.includes("zoom") ||
    combined.includes("when we speak") ||
    combined.includes("availability") ||
    combined.includes("book") ||
    combined.includes("reschedule")
  ) {
    return "schedule";
  }

  // Write signals — needs a written response/action
  if (
    combined.includes("sign") ||
    combined.includes("docusign") ||
    combined.includes("approve") ||
    combined.includes("review and sign") ||
    combined.includes("send") ||
    combined.includes("draft") ||
    combined.includes("submit") ||
    combined.includes("fill out") ||
    combined.includes("complete the form")
  ) {
    return "write";
  }

  // Respond signals — needs attention / reply
  if (
    card.priority === "critical" ||
    card.priority === "high" ||
    combined.includes("urgent") ||
    combined.includes("asap") ||
    combined.includes("please respond") ||
    combined.includes("action required") ||
    combined.includes("waiting on") ||
    combined.includes("follow up") ||
    combined.includes("reply") ||
    combined.includes("question") ||
    combined.includes("?")
  ) {
    return "respond";
  }

  // Default: read
  return "read";
}

// ─── Source URL builder ──────────────────────────────────────────────────────

function sourceUrl(card: FeedCardData): string | null {
  const meta = card.metadata as Record<string, unknown> | null;
  const threadId = meta?.thread_id as string | undefined;
  if (threadId && card.source_type?.toLowerCase().includes("email")) {
    return `https://mail.google.com/mail/u/0/#inbox/${threadId}`;
  }
  // Slack deep link could go here in future
  return null;
}

// ─── Source icon ─────────────────────────────────────────────────────────────

function sourceIcon(card: FeedCardData): string {
  const s = card.source_type?.toLowerCase() || "";
  if (s.includes("slack")) return "/icons/slack.svg";
  return "/icons/gmail.svg";
}

// ─── Entity Highlighter ──────────────────────────────────────────────────────

interface EntityMatch {
  name: string;
  id?: string;
  type?: string; // "contact" | "contacts" | "organization"
}

function highlightEntities(
  text: string,
  entities: EntityMatch[],
  onContactTap?: (contactId: string, contactName: string) => void,
): React.ReactNode {
  if (!entities.length) return text;

  const sorted = [...entities].sort((a, b) => b.name.length - a.name.length);
  const escaped = sorted.map((e) =>
    e.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(pattern);

  if (parts.length === 1) return text;

  return parts.map((part, i) => {
    const match = sorted.find(
      (e) => e.name.toLowerCase() === part.toLowerCase(),
    );
    if (match) {
      const isContact =
        match.type === "contacts" || match.type === "contact";
      if (isContact && onContactTap && match.id) {
        return (
          <button
            key={i}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onContactTap(match.id!, match.name);
            }}
            className="inline text-[#289bff] underline decoration-dotted cursor-pointer"
            style={{
              background: "none",
              border: "none",
              padding: 0,
              font: "inherit",
            }}
          >
            {part}
          </button>
        );
      }
      // Organization or unlinked entity — styled but not tappable (yet)
      return (
        <span
          key={i}
          className="text-[#289bff] underline decoration-dotted"
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

// ─── Time formatter ──────────────────────────────────────────────────────────

function timeAgoText(dateStr: string): string {
  const dist = formatDistanceToNow(new Date(dateStr), { addSuffix: false });
  return `${dist} ago...`;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface MessageCardProps {
  card: FeedCardData;
  onDismiss: (id: string) => Promise<void>;
  onContactTap?: (contactId: string, contactName: string) => void;
}

export default function MessageCard({
  card,
  onDismiss,
  onContactTap,
}: MessageCardProps) {
  const [dismissing, setDismissing] = useState(false);
  const [threadStatus, setThreadStatus] = useState<ThreadStatus>(
    (card.metadata as Record<string, unknown>)?.thread_status as ThreadStatus || null,
  );

  const intent = inferIntent(card);
  const url = sourceUrl(card);
  const threadId = (card.metadata as Record<string, unknown>)?.thread_id as string | undefined;

  // ── Thread status polling — check Gmail every 60s for status changes ──
  const isTerminal = threadStatus === "replied" || threadStatus === "archived";
  const pollStatus = useCallback(async () => {
    if (!threadId || isTerminal) return;
    try {
      const res = await fetch(`/api/gmail/actions?thread_id=${encodeURIComponent(threadId)}`);
      const data = await res.json();
      if (data.success && data.status && data.status !== "unactioned") {
        setThreadStatus(data.status as ThreadStatus);
      }
    } catch {
      // silent — polling is best-effort
    }
  }, [threadId, isTerminal]);

  useEffect(() => {
    if (!threadId || isTerminal) return;
    // Initial poll after 5s (gives time for card to render)
    const initialTimeout = setTimeout(pollStatus, 5000);
    // Then every 60s
    const interval = setInterval(pollStatus, 60000);
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [threadId, isTerminal, pollStatus]);

  // Build entity list from card data
  const entities: EntityMatch[] = [];
  if (card.entity_name) {
    entities.push({
      name: card.entity_name,
      id: card.entity_id || undefined,
      type: card.entity_type || "contact",
    });
  }
  if (card.related_entities) {
    for (const e of card.related_entities) {
      if (e.name) entities.push({ name: e.name, id: e.id, type: e.type });
    }
  }

  async function handleDismiss(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDismissing(true);
    try {
      await onDismiss(card.id);
    } finally {
      setDismissing(false);
    }
  }

  function handleCardClick() {
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  const meta = (card.metadata || {}) as Record<string, unknown>;
  const actionRec = meta.action_recommendation as string | null;
  const draftReply = meta.draft_reply as string | null;
  const reasoning = card.reasoning || (meta.primary_reason as string | null);
  const bodyText = card.body || card.title || "";

  // Extract actions from metadata if available
  const actions = (meta.actions as Array<{ description: string; owner?: string; due_date?: string }>) || [];
  const decisions = (meta.decisions as Array<{ description: string; urgency?: string }>) || [];

  return (
    <div
      className={`
        w-full bg-white rounded-[12px] overflow-hidden p-[12px]
        flex flex-col gap-[10px]
        shadow-[0px_1px_2px_rgba(0,0,0,0.04),0px_4px_12px_rgba(0,0,0,0.04)]
        transition-all duration-200
        ${dismissing ? "opacity-40 scale-[0.98]" : ""}
      `}
    >
      {/* ── Row 1: Gopher + Source Icon (left) | Intent Icon (right) ── */}
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-[6px]">
          <div className="w-[24px] h-[24px] rounded-full overflow-hidden shrink-0">
            <img
              src={gopherPath(card.id)}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
          <img
            src={sourceIcon(card)}
            alt=""
            className="w-[20px] h-[20px] shrink-0"
          />
        </div>
        <img
          src={INTENT_ICONS[intent]}
          alt={intent}
          className="w-[24px] h-[24px] shrink-0 opacity-70"
        />
      </div>

      {/* ── Row 2: Summary with entity highlighting ── */}
      <div
        className="text-[14px] font-light text-[#0c111d] leading-[18px] w-full"
        style={{
          fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
        }}
      >
        {highlightEntities(bodyText, entities, onContactTap)}
      </div>

      {/* ── Row 3: Brain's recommendation — the reason to care ── */}
      {actionRec && (
        <div
          className="text-[13px] font-medium text-[#1a1a1a] leading-[17px] w-full px-[10px] py-[8px] rounded-[8px]"
          style={{
            fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
            backgroundColor: "#f8f7f4",
          }}
        >
          {actionRec.replace(/^Recommended action:\s*/i, "")}
        </div>
      )}

      {/* ── Row 3b: Decisions requiring CEO input ── */}
      {decisions.length > 0 && !actionRec && (
        <div
          className="text-[13px] font-medium text-[#1a1a1a] leading-[17px] w-full px-[10px] py-[8px] rounded-[8px]"
          style={{
            fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
            backgroundColor: "#fef9ec",
          }}
        >
          {decisions[0].description}
        </div>
      )}

      {/* ── Row 3c: Brain reasoning — why this is in the feed ── */}
      {reasoning && !actionRec && decisions.length === 0 && (
        <div
          className="text-[12px] text-[#6e7b80] leading-[16px] w-full"
          style={{
            fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
          }}
        >
          {reasoning}
        </div>
      )}

      {/* ── Row 4: Draft reply preview — brain already wrote a response ── */}
      {draftReply && (
        <div
          className="text-[12px] italic text-[#627c9e] leading-[16px] w-full px-[10px] py-[6px] rounded-[8px] border border-[#e8eaed]"
          style={{
            fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
            backgroundColor: "#fbfbfa",
          }}
        >
          <span className="text-[11px] font-medium text-[#9c6ade] not-italic mr-[4px]">Draft reply:</span>
          {draftReply}
        </div>
      )}

      {/* ── Row 5: Status chip + Timestamp (left) | Open + Trash (right) ── */}
      <div className="flex items-center justify-between w-full gap-[8px]">
        <div className="flex items-center gap-[8px] min-w-0 flex-1">
          {/* Thread status chip */}
          {threadStatus && threadStatus !== "unactioned" && STATUS_CHIPS[threadStatus] && (
            <span
              className="flex items-center gap-[4px] text-[12px] font-medium pl-[6px] pr-[8px] py-[2px] rounded-[6px] shrink-0"
              style={{
                color: STATUS_CHIPS[threadStatus].color,
                backgroundColor: STATUS_CHIPS[threadStatus].bg,
                fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
              }}
            >
              {STATUS_CHIPS[threadStatus].iconPosition === "left" && (
                <img src={STATUS_CHIPS[threadStatus].icon} alt="" className="w-[12px] h-[12px]" />
              )}
              {STATUS_CHIPS[threadStatus].label}
              {STATUS_CHIPS[threadStatus].iconPosition === "right" && (
                <img src={STATUS_CHIPS[threadStatus].icon} alt="" className="w-[12px] h-[12px]" />
              )}
            </span>
          )}
          {(card.message_count ?? (meta.message_count as number)) > 1 && (
            <span
              className="text-[11px] font-medium text-[#7b7f81] leading-[18px] shrink-0"
              style={{ fontFamily: "var(--font-inter), 'Inter', sans-serif" }}
            >
              {(card.message_count ?? (meta.message_count as number))} messages
            </span>
          )}
          <span
            className="text-[12px] font-medium text-[#b0b8bb] leading-[18px] truncate"
            style={{
              fontFamily: "var(--font-inter), 'Inter', sans-serif",
            }}
          >
            {timeAgoText(card.thread_updated_at || card.created_at)}
          </span>
        </div>

        <div className="flex items-center gap-[6px] shrink-0">
          {url && (
            <button
              onClick={(e) => { e.stopPropagation(); window.open(url, "_blank", "noopener,noreferrer"); }}
              className="text-[11px] font-medium text-[#289bff] hover:text-[#1a7cd6] transition-colors px-[6px] py-[2px]"
              style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
            >
              Open
            </button>
          )}
          <button
            onClick={handleDismiss}
            disabled={dismissing}
            className="w-[24px] h-[24px] flex items-center justify-center opacity-40 hover:opacity-70 transition-opacity disabled:opacity-20"
            title="Dismiss"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#6e7b80"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

    </div>
  );
}
