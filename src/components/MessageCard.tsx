"use client";

import { useState, useEffect, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import type { FeedCardData } from "./FeedCard";

/* eslint-disable @next/next/no-img-element */

// ─── Thread Status ───────────────────────────────────────────────────────────

type ThreadStatus = "replied" | "drafted" | "forwarded" | "starred" | "archived" | "unactioned" | null;

// Status chips — Figma node 137-1453: 2px radius, px-6 py-3, tracking -0.24px, 12px Geist medium
// Icons from Assets/Icons/Chip Icons/
const STATUS_CHIPS: Record<string, { label: string; color: string; bg: string; icon: string; iconPosition: "left" | "right" }> = {
  replied: { label: "Replied", color: "#289bff", bg: "#ecfaff", icon: "/icons/chips/Replied.png", iconPosition: "left" },
  drafted: { label: "Draft", color: "#9c6ade", bg: "#f9f3ff", icon: "/icons/chips/Draft.png", iconPosition: "left" },
  forwarded: { label: "Forwarded", color: "#1bba92", bg: "#e3fff5", icon: "/icons/chips/Forward.png", iconPosition: "right" },
  starred: { label: "Starred", color: "#7b7f81", bg: "transparent", icon: "/icons/status/star-on.png", iconPosition: "left" },
  archived: { label: "Archived", color: "#3e4c60", bg: "#f3f3f3", icon: "/icons/chips/Archive.png", iconPosition: "left" },
};

// ─── Gopher Icons ────────────────────────────────────────────────────────────

const GOPHER_COUNT = 17;

function gopherPath(cardId: string): string {
  let hash = 0;
  for (let i = 0; i < cardId.length; i++) {
    hash = ((hash << 5) - hash + cardId.charCodeAt(i)) | 0;
  }
  const idx = (Math.abs(hash) % GOPHER_COUNT) + 1;
  return `/icons/gophers/gopher-${idx}.png`;
}

// ─── Action type for suggestion section ──────────────────────────────────────

type ActionType = "reply" | "schedule" | "add_to_tasks" | null;

function inferAction(card: FeedCardData, threadStatus: ThreadStatus): ActionType {
  if (threadStatus === "replied" || threadStatus === "forwarded") return null;

  const rec = ((card.metadata?.action_recommendation as string) || "").toLowerCase();
  const body = (card.body || "").toLowerCase();
  const combined = `${body} ${rec}`;

  if (
    combined.includes("schedule") || combined.includes("meeting") ||
    combined.includes("calendar") || combined.includes("availability") ||
    combined.includes("book a") || combined.includes("reschedule") ||
    combined.includes("set up a call") || combined.includes("set up a time")
  ) return "schedule";

  if (
    combined.includes("add to task") || combined.includes("complete") ||
    combined.includes("submit") || combined.includes("fill out") ||
    combined.includes("upload") || combined.includes("sign") ||
    combined.includes("docusign") || combined.includes("closing mechanic")
  ) return "add_to_tasks";

  if (
    combined.includes("reply") || combined.includes("respond") ||
    combined.includes("answer") || combined.includes("position on") ||
    combined.includes("confirm") || card.priority === "critical" ||
    card.priority === "high"
  ) return "reply";

  return null;
}

// Card buttons — Figma 137-1453: icons from Assets/Icons/Button Icons/
const ACTION_CONFIG: Record<string, { label: string; icon: string }> = {
  reply: { label: "Reply", icon: "/icons/buttons/Replied.png" },
  schedule: { label: "Schedule", icon: "/icons/buttons/calendar-plus.png" },
  add_to_tasks: { label: "Add To Tasks", icon: "/icons/buttons/Add Task.png" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sourceUrl(card: FeedCardData): string | null {
  const meta = card.metadata as Record<string, unknown> | null;
  const threadId = meta?.thread_id as string | undefined;
  if (threadId && card.source_type?.toLowerCase().includes("email")) {
    return `https://mail.google.com/mail/u/0/#inbox/${threadId}`;
  }
  return null;
}

function sourceIcon(card: FeedCardData): string {
  const s = card.source_type?.toLowerCase() || "";
  if (s.includes("slack")) return "/icons/slack.svg";
  return "/icons/gmail.svg";
}

interface EntityMatch { name: string; id?: string; type?: string; }

function highlightEntities(
  text: string, entities: EntityMatch[],
  onContactTap?: (contactId: string, contactName: string) => void,
): React.ReactNode {
  if (!entities.length) return text;
  const sorted = [...entities].sort((a, b) => b.name.length - a.name.length);
  const escaped = sorted.map((e) => e.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(pattern);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    const match = sorted.find((e) => e.name.toLowerCase() === part.toLowerCase());
    if (match) {
      const isContact = match.type === "contacts" || match.type === "contact";
      if (isContact && onContactTap && match.id) {
        return (
          <button key={i} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onContactTap(match.id!, match.name); }}
            className="inline underline decoration-dotted cursor-pointer"
            style={{ background: "none", border: "none", padding: 0, font: "inherit", color: "#1873de" }}>{part}</button>
        );
      }
      return <span key={i} className="underline decoration-dotted" style={{ color: "#1873de" }}>{part}</span>;
    }
    return part;
  });
}

function timeAgoText(dateStr: string): string {
  const dist = formatDistanceToNow(new Date(dateStr), { addSuffix: false });
  return dist.charAt(0).toUpperCase() + dist.slice(1) + " Ago";
}

function extractParticipants(card: FeedCardData): string[] {
  const meta = (card.metadata || {}) as Record<string, unknown>;
  const names: string[] = [];
  if (card.entity_name) names.push(card.entity_name);
  if (card.related_entities) {
    for (const e of card.related_entities) {
      if (e.name && !names.includes(e.name)) names.push(e.name);
    }
  }
  const from = meta.from as string | undefined;
  if (from) {
    const fromName = from.includes("<") ? from.split("<")[0].trim().replace(/"/g, "") : null;
    if (fromName && !names.some(n => n.toLowerCase() === fromName.toLowerCase())) names.push(fromName);
  }
  return names;
}

function getStateSuggestion(threadStatus: ThreadStatus, actionRec: string | null): string | null {
  if (threadStatus === "replied") return "Waiting on investor response. No action needed unless terms change.";
  if (threadStatus === "forwarded") return "Waiting on input from forwarded recipients before responding";
  return actionRec ? actionRec.replace(/^Recommended action:\s*/i, "") : null;
}

// ─── Thread message type ─────────────────────────────────────────────────────

interface ThreadMessage {
  id: string;
  sender_name: string;
  summary: string;
  email_date: string;
  direction: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface MessageCardProps {
  card: FeedCardData;
  onDismiss: (id: string) => Promise<void>;
  onContactTap?: (contactId: string, contactName: string) => void;
}

export default function MessageCard({ card, onDismiss, onContactTap }: MessageCardProps) {
  const [dismissing, setDismissing] = useState(false);
  const [threadStatus, setThreadStatus] = useState<ThreadStatus>(
    (card.metadata as Record<string, unknown>)?.thread_status as ThreadStatus || null,
  );
  const [threadExpanded, setThreadExpanded] = useState(false);
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);

  const url = sourceUrl(card);
  const threadId = (card.metadata as Record<string, unknown>)?.thread_id as string | undefined;
  const meta = (card.metadata || {}) as Record<string, unknown>;
  const messageCount = card.message_count ?? (meta.message_count as number) ?? 1;

  // Thread status polling
  const isTerminal = threadStatus === "replied" || threadStatus === "archived";
  const pollStatus = useCallback(async () => {
    if (!threadId || isTerminal) return;
    try {
      const res = await fetch(`/api/gmail/actions?thread_id=${encodeURIComponent(threadId)}`);
      const data = await res.json();
      if (data.success && data.status && data.status !== "unactioned") {
        setThreadStatus(data.status as ThreadStatus);
      }
    } catch { /* silent */ }
  }, [threadId, isTerminal]);

  useEffect(() => {
    if (!threadId || isTerminal) return;
    const t = setTimeout(pollStatus, 5000);
    const i = setInterval(pollStatus, 60000);
    return () => { clearTimeout(t); clearInterval(i); };
  }, [threadId, isTerminal, pollStatus]);

  // Thread expansion fetch
  useEffect(() => {
    if (!threadExpanded || !threadId || threadMessages.length > 0) return;
    setThreadLoading(true);
    fetch(`/api/feed/thread?thread_id=${encodeURIComponent(threadId)}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.messages) setThreadMessages(data.messages);
      })
      .catch(() => {})
      .finally(() => setThreadLoading(false));
  }, [threadExpanded, threadId, threadMessages.length]);

  // Build entity list
  const entities: EntityMatch[] = [];
  if (card.entity_name) entities.push({ name: card.entity_name, id: card.entity_id || undefined, type: card.entity_type || "contact" });
  if (card.related_entities) {
    for (const e of card.related_entities) {
      if (e.name) entities.push({ name: e.name, id: e.id, type: e.type });
    }
  }

  const actionRec = meta.action_recommendation as string | null;
  const action = inferAction(card, threadStatus);
  const suggestion = getStateSuggestion(threadStatus, actionRec);
  const participants = extractParticipants(card);
  let bodyText = card.body || card.title || "";
  bodyText = bodyText.replace(/^Email:\s*/i, "").trim();
  const titleText = card.title?.replace(/^Email:\s*/i, "").replace(/^Re:\s*/i, "").replace(/^Fwd:\s*/i, "").trim() || "";

  async function handleDismiss(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    setDismissing(true);
    try { await onDismiss(card.id); } finally { setDismissing(false); }
  }

  return (
    <div className={`w-full bg-white rounded-[12px] overflow-hidden p-[12px] flex flex-col gap-[12px] transition-all duration-200 ${dismissing ? "opacity-40 scale-[0.98]" : ""}`}>

      {/* ── Header: Gopher + Source icon | Status chip + Time + Trash ── */}
      <div className="flex items-center gap-[6px] w-full" style={{ backgroundColor: "#f8f8f8", padding: "4px" }}>
        <div className="flex items-center gap-[6px] shrink-0">
          <div className="w-[24px] h-[24px] rounded-full overflow-hidden shrink-0">
            <img src={gopherPath(card.id)} alt="" className="w-full h-full object-cover" />
          </div>
          <img src={sourceIcon(card)} alt="" className="w-[24px] h-[24px] shrink-0" />
        </div>
        <div className="flex flex-1 items-center justify-between min-w-0">
          <div className="flex items-center gap-[6px]">
            {threadStatus && threadStatus !== "unactioned" && STATUS_CHIPS[threadStatus] && (
              <span className="flex items-center gap-[4px] text-[12px] font-medium px-[6px] py-[3px] rounded-[2px] shrink-0"
                style={{ color: STATUS_CHIPS[threadStatus].color, backgroundColor: STATUS_CHIPS[threadStatus].bg, fontFamily: "var(--font-geist-sans), 'Geist', sans-serif", letterSpacing: "0px", lineHeight: "16px" }}>
                {STATUS_CHIPS[threadStatus].iconPosition === "left" && <img src={STATUS_CHIPS[threadStatus].icon} alt="" className="w-[12px] h-[12px]" />}
                {STATUS_CHIPS[threadStatus].label}
                {STATUS_CHIPS[threadStatus].iconPosition === "right" && <img src={STATUS_CHIPS[threadStatus].icon} alt="" className="w-[12px] h-[12px]" />}
              </span>
            )}
            <span className="text-[12px] font-medium text-[#b0b8bb] leading-[18px]" style={{ fontFamily: "'Inter', sans-serif" }}>
              {timeAgoText(card.thread_updated_at || card.created_at)}
            </span>
          </div>
          <button onClick={handleDismiss} disabled={dismissing}
            className="w-[20px] h-[20px] flex items-center justify-center opacity-50 hover:opacity-80 transition-opacity disabled:opacity-20 shrink-0" title="Remove from feed">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6e7b80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Participants ── */}
      {participants.length > 0 && (
        <div className="flex items-center gap-[4px] flex-wrap">
          <div className="flex items-center gap-[2px]">
            {participants.map((name, i) => (
              <span key={i} className="text-[10px] font-medium leading-[12px] underline decoration-dotted cursor-pointer"
                style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif", color: "#1873de" }}
                onClick={() => { const entity = entities.find(e => e.name === name); if (entity?.id && onContactTap) onContactTap(entity.id, name); }}>
                {name}{i < participants.length - 1 ? ", " : ""}
              </span>
            ))}
          </div>
          <span className="text-[10px] font-medium leading-[12px]"
            style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif", color: "#3e4c60" }}>
            {threadStatus && threadStatus !== "unactioned" ? "are in this thread" : "On Thread"}
          </span>
        </div>
      )}

      {/* ── Title ── */}
      {titleText && titleText !== bodyText && (
        <div className="text-[14px] font-medium text-black leading-[18px] w-full"
          style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}>
          {titleText}
        </div>
      )}

      {/* ── Body ── */}
      <div className="text-[12px] font-normal leading-[16px] w-full"
        style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif", color: "#0c111d" }}>
        {highlightEntities(bodyText, entities, onContactTap)}
      </div>

      {/* ── Suggestion section ── */}
      {suggestion && (
        <div className="flex items-end gap-[6px] w-full rounded-[12px] px-[6px] py-[6px]"
          style={{ backgroundColor: "rgba(255, 244, 224, 0.5)", border: "0.5px solid #ffb20a" }}>
          <div className="flex-1 text-[12px] font-normal leading-[18px] min-w-0 px-[6px]"
            style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif", color: "#b48b08", wordBreak: "break-word" }}>
            {suggestion}
          </div>
          {action && ACTION_CONFIG[action] && (
            <button onClick={(e) => { e.stopPropagation(); if (url) window.open(url, "_blank", "noopener,noreferrer"); }}
              className="flex items-center gap-[4px] px-[12px] py-[3px] rounded-[8px] shrink-0 self-end"
              style={{ backgroundColor: "#ffffff", boxShadow: "0px 0px 2px rgba(0,0,0,0.25)", fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}>
              <img src={ACTION_CONFIG[action].icon} alt="" className="w-[12px] h-[12px]" />
              <span className="text-[12px] font-medium leading-[16px] whitespace-nowrap" style={{ color: "#1e252a" }}>
                {ACTION_CONFIG[action].label}
              </span>
            </button>
          )}
        </div>
      )}

      {/* ── Thread toggle + expansion ── */}
      {messageCount > 1 && (
        <>
          <div className="flex justify-end">
            <button onClick={(e) => { e.stopPropagation(); setThreadExpanded(!threadExpanded); }}
              className="flex items-center gap-[6px] px-[12px] py-[4px] rounded-[8px]"
              style={{ backgroundColor: "#f3f2ed", fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}>
              <span className="text-[12px] font-medium leading-[14px]" style={{ color: "#1e252a" }}>
                {threadExpanded ? "Hide" : `View ${messageCount - 1} earlier messages`}
              </span>
              <svg width="6" height="3" viewBox="0 0 6 3" fill="none"
                style={{ transform: threadExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                <path d="M3 3L0 0H6L3 3Z" fill="#1e252a" />
              </svg>
            </button>
          </div>

          {/* ── Expanded thread panel — Figma node 148-2222 ── */}
          {threadExpanded && (
            <div className="w-full rounded-[4px] p-[12px] flex flex-col gap-[12px]"
              style={{ backgroundColor: "#f8f8f8" }}>
              <div className="text-[12px] font-medium leading-[16px]"
                style={{ fontFamily: "'Inter', sans-serif", color: "#1e252a" }}>
                Latest
              </div>

              {threadLoading && (
                <div className="text-[10px] text-[#b0b8bb] py-[8px]" style={{ fontFamily: "'Inter', sans-serif" }}>
                  Loading thread...
                </div>
              )}

              {!threadLoading && threadMessages.length === 0 && (
                <div className="text-[10px] text-[#b0b8bb] py-[4px]" style={{ fontFamily: "'Inter', sans-serif" }}>
                  No thread messages available
                </div>
              )}

              {threadMessages.map((msg) => (
                <div key={msg.id} className="flex flex-col gap-[6px] w-full">
                  <div className="flex items-start gap-[14px]" style={{ fontFamily: "'Inter', sans-serif" }}>
                    <span className="text-[12px] font-medium leading-[16px]" style={{ color: "#1873de" }}>
                      {msg.sender_name}
                    </span>
                    <span className="text-[12px] font-medium leading-[16px] text-[#b0b8bb]">
                      {timeAgoText(msg.email_date)}
                    </span>
                  </div>
                  <div className="text-[10px] font-normal leading-[12px] w-full"
                    style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif", color: "#0c111d" }}>
                    {msg.summary}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
