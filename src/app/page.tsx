"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import FeedCard, { FeedCardData, CorrectionData } from "@/components/FeedCard";
import MessageCard from "@/components/MessageCard";
import ContactPanel from "@/components/ContactPanel";
import NotePanel from "@/components/NotePanel";

// Message-source cards use the new simplified MessageCard
function isMessageCard(card: FeedCardData): boolean {
  const src = (card.source_type || "").toLowerCase();
  return src.includes("email") || src.includes("gmail") || src.includes("slack");
}

/* eslint-disable @next/next/no-img-element */

// ─── Component ──────────────────────────────────────────────────────────────

export default function MotionFeedPage() {
  const [cards, setCards] = useState<FeedCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanStage, setScanStage] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [contactPanelId, setContactPanelId] = useState<string | null>(null);
  const [contactPanelName, setContactPanelName] = useState<string | null>(null);
  const [showNotePanel, setShowNotePanel] = useState(false);
  const limit = 12;
  const scanStages = [
    "Connecting to Gmail...",
    "Fetching new messages...",
    "Classifying with Acumen...",
    "Resolving entities...",
    "Generating feed cards...",
    "Updating feed...",
  ];

  // ── Load feed cards ──
  const loadCards = useCallback(async (newOffset: number, append: boolean, filterType?: string | null) => {
    try {
      const typeParam = filterType !== undefined ? filterType : activeFilter;
      const statusFilter = activeFilter === "old" ? "acted" : "unread,read";
      let feedUrl = `/api/feed?status=${statusFilter}&limit=${limit}&offset=${newOffset}`;
      if (typeParam && typeParam !== "old") feedUrl += `&card_type=${typeParam}`;
      const res = await fetch(feedUrl, { cache: "no-store" });
      const data = await res.json();
      if (data.cards) {
        const allCards = append ? [...cards, ...data.cards] : data.cards;
        setCards(allCards);
        setTotal(data.total || 0);
        setOffset(newOffset + data.cards.length);
      }
    } catch (err) {
      console.error("Feed load error:", err);
    }
  }, [activeFilter]);

  useEffect(() => {
    async function init() {
      await loadCards(0, false);
      setLastUpdated(new Date());
      setLoading(false);
    }
    init();
  }, [loadCards]);

  // ── Re-render every 60s so "updated X ago" stays current ──
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  // ── Load more ──
  async function handleLoadMore() {
    setLoadingMore(true);
    await loadCards(offset, true);
    setLoadingMore(false);
  }

  // ── Refresh feed (instant reload) ──
  async function handleRefresh() {
    setLoading(true);
    await loadCards(0, false);
    setLastUpdated(new Date());
    setLoading(false);
  }

  // ── Run scanner with progress stages ──
  async function handleScan() {
    setScanning(true);
    setScanStage(0);

    // Cycle through visual stages while the scan runs
    const stageInterval = setInterval(() => {
      setScanStage((prev) => (prev < scanStages.length - 1 ? prev + 1 : prev));
    }, 4000);

    try {
      await fetch("/api/agents/gmail-scanner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanHours: 8, rescan: true }),
      });
      // Show final stage briefly
      setScanStage(scanStages.length - 1);
      // Reload feed after scan
      await loadCards(0, false);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Scanner error:", err);
    } finally {
      clearInterval(stageInterval);
      setScanning(false);
      setScanStage(0);
    }
  }

  // ── Filter by card type ──
  async function handleFilter(type: string | null) {
    setActiveFilter(type);
    setLoading(true);
    await loadCards(0, false, type);
    setLoading(false);
  }

  // ── Search / Snapshot ──
  async function handleSearch() {
    if (!searchQuery.trim()) return;
    const query = searchQuery.trim();
    setSearching(true);
    try {
      // Use the snapshot endpoint to generate an on-demand data view
      const res = await fetch("/api/brain/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (data.success) {
        // Reload feed to show the new snapshot card at top
        await loadCards(0, false);
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setSearching(false);
      setSearchQuery("");
    }
  }

  // ── Card actions ──
  async function handleAction(id: string, action: "do" | "no" | "not_now", correction?: CorrectionData) {
    const res = await fetch("/api/feed", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ceo_action: action, correction }),
    });
    const data = await res.json();
    if (data.card) {
      // Remove actioned card from feed (it moves to "Old")
      setCards((prev) => prev.filter((c) => c.id !== id));
    }
  }

  async function handleDismiss(id: string) {
    const res = await fetch("/api/feed", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "dismissed" }),
    });
    const data = await res.json();
    if (data.card) {
      setCards((prev) => prev.filter((c) => c.id !== id));
    }
  }

  // ── Format "updated X ago" ──
  function updatedAgoText(): string {
    if (!lastUpdated) return "";
    const diffMs = Date.now() - lastUpdated.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin} minutes ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs} hour${diffHrs > 1 ? "s" : ""} ago`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  }

  // ─── RENDER ──────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-full"
      style={{
        minHeight: "100%",
      }}
    >
      {/* ── Feed container — left-aligned to leave room for side panels (contacts, notes) ── */}
      <div className="flex min-h-full flex-col items-center gap-[24px] py-6 px-4 lg:px-0 lg:ml-[40px] xl:ml-[80px]" style={{ maxWidth: "550px", width: "100%" }}>

        {/* ══════════════════════════════════════════════════════════════════
            CHAT HEADER — Card container per Figma (node 9:3665)
            bg: rgba(255,244,224,0.2), p-12, rounded-12, shadow
            ══════════════════════════════════════════════════════════════════ */}
        <div
          className="w-full rounded-[12px] shadow-[0px_0px_60px_0px_rgba(0,0,0,0.12)]"
          style={{ backgroundColor: "rgba(255,244,224,0.2)" }}
        >
          <div className="flex w-full flex-col items-start gap-[12px] p-[12px]">
          {/* Top row: avatar + name left, updated + refresh right */}
          <div className="flex w-full min-w-0 items-center justify-between pr-[6px]">
            <div className="flex min-w-0 items-center gap-[12px]">
              <img
                src="/icons/mark-avatar.png"
                alt="Mark Slater"
                className="h-[34px] w-[34px] shrink-0 rounded-full object-cover"
              />
              <span
                className="truncate text-[16px] font-semibold leading-[20px] text-[#3e4c60]"
                style={{
                  fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
                  letterSpacing: "-0.32px",
                }}
              >
                Mark Slater&apos;s Motion Space.
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-[18px] h-[20px]">
              <span
                className="whitespace-nowrap text-[10px] font-medium leading-[10px] text-[#9ca5a9]"
                style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
              >
                ...updated {updatedAgoText() || "just now"}
              </span>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading || scanning}
                className="shrink-0 p-0 leading-none"
                title="Refresh feed"
              >
                <img
                  src="/icons/refresh-2.svg"
                  alt="Refresh"
                  className={`h-[20px] w-[20px] ${loading || scanning ? "animate-spin" : ""}`}
                />
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div
            className="flex items-center justify-between overflow-hidden px-[14px] py-[10px] rounded-[12px] bg-white w-full"
            style={{ border: "1px solid #e9e9e9" }}
          >
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              placeholder="Ask Anything about the business."
              disabled={searching}
              className="flex-1 text-[12px] font-medium text-black placeholder:text-[#b0b8bb] leading-[24px] bg-transparent focus:outline-none"
              style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
            />
            <div className="flex gap-[18px] items-end h-[21px] w-[118px]">
              <img src="/icons/calendar-plus.svg" alt="" className="w-[16px] h-[16px] shrink-0" />
              <img src="/icons/paperclip.svg" alt="" className="w-[16px] h-[16px] shrink-0" />
              <img src="/icons/mic.svg" alt="" className="w-[16px] h-[16px] shrink-0" />
              <img
                src="/icons/arrow-up-circle.svg"
                alt=""
                className={`w-[16px] h-[16px] shrink-0 cursor-pointer ${searching ? "animate-spin" : ""}`}
                onClick={handleSearch}
              />
            </div>
          </div>
          </div>
        </div>

        {/* ── Action buttons: Write, Plan, Add — per Figma 99:1314 ── */}
        <div className="flex gap-[6px] items-center w-full">
          <button
            onClick={() => setShowNotePanel(true)}
            className="flex gap-[6px] h-[28px] items-center justify-center px-[12px] py-[6px] rounded-[8px] bg-white cursor-pointer hover:bg-gray-50 transition-colors"
            style={{ boxShadow: "0px 0px 2px 0px rgba(0,0,0,0.25)" }}
          >
            <img src="/icons/intent/write.png" alt="" className="size-[20px]" />
            <span
              className="whitespace-nowrap"
              style={{
                fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
                fontSize: "14px",
                fontWeight: 500,
                lineHeight: "16px",
                letterSpacing: "-0.14px",
                color: "#3e4c60",
              }}
            >
              Write
            </span>
          </button>
          <button
            className="flex gap-[6px] h-[28px] items-center justify-center px-[12px] py-[6px] rounded-[8px] bg-white cursor-pointer hover:bg-gray-50 transition-colors"
            style={{ boxShadow: "0px 0px 2px 0px rgba(0,0,0,0.25)" }}
          >
            <img src="/icons/calendar-plus.svg" alt="" className="size-[20px]" />
            <span
              className="whitespace-nowrap"
              style={{
                fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
                fontSize: "14px",
                fontWeight: 500,
                lineHeight: "16px",
                letterSpacing: "-0.14px",
                color: "#3e4c60",
              }}
            >
              Plan
            </span>
          </button>
          <button
            className="flex gap-[6px] h-[28px] items-center justify-center px-[12px] py-[6px] rounded-[8px] bg-white cursor-pointer hover:bg-gray-50 transition-colors"
            style={{ boxShadow: "0px 0px 2px 0px rgba(0,0,0,0.25)" }}
          >
            <img src="/icons/arrow-up-circle.svg" alt="" className="size-[16px]" />
            <span
              className="whitespace-nowrap"
              style={{
                fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
                fontSize: "14px",
                fontWeight: 500,
                lineHeight: "16px",
                letterSpacing: "-0.14px",
                color: "#3e4c60",
              }}
            >
              Add
            </span>
          </button>
        </div>

        {/* ── Filter pills ── */}
        <div className="flex gap-[8px] items-center w-full overflow-x-auto">
          {[
            { key: null, label: "All" },
            { key: "decision", label: "Decisions" },
            { key: "action", label: "Actions" },
            { key: "signal", label: "Signals" },
            { key: "intelligence", label: "Intel" },
            { key: "briefing", label: "Briefings" },
            { key: "old", label: "Old" },
          ].map((f) => (
            <button
              key={f.key || "all"}
              onClick={() => handleFilter(f.key)}
              className="px-[12px] py-[4px] rounded-[14px] text-[11px] font-medium whitespace-nowrap transition-colors"
              style={{
                fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
                backgroundColor: activeFilter === f.key ? "#3e4c60" : "rgba(255,255,255,0.6)",
                color: activeFilter === f.key ? "#ffffff" : "#6e7b80",
                border: activeFilter === f.key ? "none" : "1px solid #e0e0e0",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            FEED CARDS
            ══════════════════════════════════════════════════════════════════ */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : scanning ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 w-full">
            {/* Half-width progress bar — visible blue */}
            <div className="w-1/2 max-w-[275px] rounded-full overflow-hidden" style={{ height: "3px", backgroundColor: "rgba(59,130,246,0.15)" }}>
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${((scanStage + 1) / scanStages.length) * 100}%`,
                  background: "linear-gradient(90deg, #3b82f6, #2563eb)",
                }}
              />
            </div>
            {/* Current stage text */}
            <p
              className="text-[13px] font-medium text-[#627c9e] transition-opacity duration-300"
              style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
            >
              {scanStages[scanStage]}
            </p>
          </div>
        ) : cards.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-lg font-medium text-slate-400">No cards yet</p>
            <p className="text-sm text-slate-300 mt-2">
              Tap the refresh icon above to scan your email.
            </p>
          </div>
        ) : (
          <>
            {cards.map((card) =>
              isMessageCard(card) ? (
                <MessageCard
                  key={card.id}
                  card={card}
                  onDismiss={handleDismiss}
                  onContactTap={(contactId, name) => { setContactPanelId(contactId); setContactPanelName(name || null); }}
                />
              ) : (
                <FeedCard
                  key={card.id}
                  card={card}
                  onAction={handleAction}
                  onDismiss={handleDismiss}
                  onContactTap={(contactId, name) => { setContactPanelId(contactId); setContactPanelName(name || null); }}
                />
              )
            )}

            {/* Load more */}
            {cards.length < total && (
              <div className="text-center py-4">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  {loadingMore ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : null}
                  Load More
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Feed overlay when note panel or contact panel is open ── */}
      {(showNotePanel || contactPanelId) && (
        <div
          className="fixed inset-0 z-40 transition-opacity duration-200"
          style={{ backgroundColor: "rgba(62, 76, 96, 0.4)" }}
          onClick={() => {
            if (showNotePanel) setShowNotePanel(false);
            if (contactPanelId) { setContactPanelId(null); setContactPanelName(null); }
          }}
        />
      )}

      {/* ── Contact Panel ── */}
      {contactPanelId && (
        <ContactPanel
          contactId={contactPanelId}
          entityName={contactPanelName || undefined}
          onDismiss={() => { setContactPanelId(null); setContactPanelName(null); }}
        />
      )}

      {/* ── Note Panel ── */}
      {showNotePanel && (
        <NotePanel
          onClose={() => setShowNotePanel(false)}
          onNoteSaved={() => {
            loadCards(0, false);
            setLastUpdated(new Date());
          }}
        />
      )}
    </div>
  );
}
