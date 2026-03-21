"use client";

import { useState, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import type { FeedCardData } from "./FeedCard";

/* eslint-disable @next/next/no-img-element */

// ─── Thread Status Types ─────────────────────────────────────────────────────

type ThreadStatus = "replied" | "drafted" | "forwarded" | "starred" | "archived" | "unactioned" | null;

const STATUS_CHIPS: Record<string, { label: string; color: string; bg: string }> = {
  replied: { label: "Replied", color: "#16a34a", bg: "rgba(22, 163, 74, 0.08)" },
  drafted: { label: "Drafted", color: "#d97706", bg: "rgba(217, 119, 6, 0.08)" },
  forwarded: { label: "Forwarded", color: "#7c3aed", bg: "rgba(124, 58, 237, 0.08)" },
  starred: { label: "Starred", color: "#eab308", bg: "rgba(234, 179, 8, 0.08)" },
  archived: { label: "Archived", color: "#6b7280", bg: "rgba(107, 114, 128, 0.08)" },
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
  const [acting, setActing] = useState<string | null>(null);
  const [threadStatus, setThreadStatus] = useState<ThreadStatus>(
    (card.metadata as Record<string, unknown>)?.thread_status as ThreadStatus || null,
  );
  const [showReplyCompose, setShowReplyCompose] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [draftBody, setDraftBody] = useState<string | null>(null);

  const intent = inferIntent(card);
  const url = sourceUrl(card);
  const threadId = (card.metadata as Record<string, unknown>)?.thread_id as string | undefined;

  // ── Gmail action handler ──
  const handleGmailAction = useCallback(async (
    action: "reply" | "draft" | "archive" | "star",
    message?: string,
  ) => {
    if (!threadId) return;
    setActing(action);
    try {
      const res = await fetch("/api/gmail/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          card_id: card.id,
          thread_id: threadId,
          message,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setThreadStatus(data.thread_status as ThreadStatus);
        if (action === "draft" && data.draft_body) {
          setDraftBody(data.draft_body);
        }
        if (action === "reply") {
          setShowReplyCompose(false);
          setReplyText("");
        }
      }
    } catch (err) {
      console.error(`Gmail ${action} failed:`, err);
    } finally {
      setActing(null);
    }
  }, [threadId, card.id]);

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

  const bodyText = card.body || card.title || "";

  return (
    <div
      onClick={handleCardClick}
      className={`
        w-full bg-white rounded-[12px] overflow-hidden p-[12px]
        flex flex-col gap-[12px]
        shadow-[0px_1px_2px_rgba(0,0,0,0.04),0px_4px_12px_rgba(0,0,0,0.04)]
        transition-all duration-200
        ${url ? "cursor-pointer hover:shadow-[0px_2px_4px_rgba(0,0,0,0.06),0px_8px_20px_rgba(0,0,0,0.08)] hover:translate-y-[-1px]" : ""}
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

      {/* ── Row 2: Natural language body with entity highlighting ── */}
      <div
        className="text-[14px] font-light text-[#0c111d] leading-[18px] w-full"
        style={{
          fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
        }}
      >
        {highlightEntities(bodyText, entities, onContactTap)}
      </div>

      {/* ── Row 3: Status chip + Timestamp (left) | Actions + Trash (right) ── */}
      <div className="flex items-center justify-between w-full gap-[8px]">
        <div className="flex items-center gap-[8px] min-w-0 flex-1">
          {/* Thread status chip */}
          {threadStatus && threadStatus !== "unactioned" && STATUS_CHIPS[threadStatus] && (
            <span
              className="text-[11px] font-medium px-[8px] py-[2px] rounded-full shrink-0"
              style={{
                color: STATUS_CHIPS[threadStatus].color,
                backgroundColor: STATUS_CHIPS[threadStatus].bg,
                fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
              }}
            >
              {STATUS_CHIPS[threadStatus].label}
            </span>
          )}
          <span
            className="text-[12px] font-medium text-[#b0b8bb] leading-[18px] truncate"
            style={{
              fontFamily: "var(--font-inter), 'Inter', sans-serif",
            }}
          >
            {timeAgoText(card.created_at)}
          </span>
        </div>

        <div className="flex items-center gap-[4px] shrink-0">
          {/* Gmail action buttons — only show if we have a thread_id and no terminal status */}
          {threadId && threadStatus !== "replied" && threadStatus !== "archived" && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setShowReplyCompose((v) => !v); }}
                disabled={!!acting}
                className="text-[11px] font-medium text-[#627c9e] px-[8px] py-[3px] rounded-[4px] hover:bg-[#f0f4f8] transition-colors disabled:opacity-30"
                style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                title="Reply in Gmail"
              >
                {acting === "reply" ? "..." : "Reply"}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleGmailAction("draft"); }}
                disabled={!!acting}
                className="text-[11px] font-medium text-[#627c9e] px-[8px] py-[3px] rounded-[4px] hover:bg-[#f0f4f8] transition-colors disabled:opacity-30"
                style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                title="Create draft reply in Gmail"
              >
                {acting === "draft" ? "..." : "Draft"}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleGmailAction("archive"); }}
                disabled={!!acting}
                className="text-[11px] font-medium text-[#627c9e] px-[8px] py-[3px] rounded-[4px] hover:bg-[#f0f4f8] transition-colors disabled:opacity-30"
                style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                title="Archive in Gmail"
              >
                {acting === "archive" ? "..." : "Archive"}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleGmailAction("star"); }}
                disabled={!!acting}
                className="text-[11px] font-medium text-[#627c9e] px-[8px] py-[3px] rounded-[4px] hover:bg-[#f0f4f8] transition-colors disabled:opacity-30"
                style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                title="Star in Gmail"
              >
                {acting === "star" ? "..." : "Star"}
              </button>
            </>
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

      {/* ── Reply compose panel ── */}
      {showReplyCompose && (
        <div
          className="flex flex-col gap-[8px] pt-[4px]"
          onClick={(e) => e.stopPropagation()}
        >
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Type your reply..."
            className="w-full px-[10px] py-[8px] text-[13px] border border-[#e0e0e0] rounded-[8px] resize-none focus:outline-none focus:ring-1 focus:ring-[#289bff] focus:border-[#289bff]"
            style={{
              fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
              minHeight: "80px",
            }}
            autoFocus
          />
          <div className="flex items-center gap-[8px]">
            <button
              onClick={() => handleGmailAction("reply", replyText)}
              disabled={!replyText.trim() || !!acting}
              className="text-[12px] font-medium text-white px-[14px] py-[5px] rounded-[6px] transition-colors disabled:opacity-40"
              style={{
                backgroundColor: acting === "reply" ? "#94a3b8" : "#289bff",
                fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
              }}
            >
              {acting === "reply" ? "Sending..." : "Send Reply"}
            </button>
            <button
              onClick={() => { setShowReplyCompose(false); setReplyText(""); }}
              className="text-[12px] text-[#94a3b8] hover:text-[#64748b] transition-colors"
              style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Brain draft preview ── */}
      {draftBody && threadStatus === "drafted" && (
        <div
          className="flex flex-col gap-[6px] pt-[4px] px-[10px] py-[8px] rounded-[8px]"
          style={{ backgroundColor: "rgba(217, 119, 6, 0.06)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <span
            className="text-[11px] font-medium text-[#d97706]"
            style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
          >
            Draft saved to Gmail
          </span>
          <p
            className="text-[12px] text-[#6b7280] leading-[16px]"
            style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
          >
            {draftBody.slice(0, 200)}{draftBody.length > 200 ? "..." : ""}
          </p>
        </div>
      )}
    </div>
  );
}
