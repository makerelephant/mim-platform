"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import FeedCard, { FeedCardData, CorrectionData } from "@/components/FeedCard";
import ContactPanel from "@/components/ContactPanel";
import { usePageBackground } from "@/components/PageBackgroundContext";
import { MOTION_TEXTURE_BACKGROUND } from "@/lib/page-backgrounds";

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
  usePageBackground(MOTION_TEXTURE_BACKGROUND);
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
      const res = await fetch(feedUrl);
      const data = await res.json();
      if (data.cards) {
        setCards((prev) => append ? [...prev, ...data.cards] : data.cards);
        setTotal(data.total || 0);
        setOffset(newOffset + data.cards.length);
        if (!append) setLastUpdated(new Date());
      }
    } catch (err) {
      console.error("Feed load error:", err);
    }
  }, [activeFilter]);

  useEffect(() => {
    async function init() {
      await loadCards(0, false);
      setLoading(false);
    }
    init();
  }, [loadCards]);

  // ── Load more ──
  async function handleLoadMore() {
    setLoadingMore(true);
    await loadCards(offset, true);
    setLoadingMore(false);
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
    <>
      {/* ── Feed container ── */}
      <div className="mx-auto flex min-h-full flex-col items-center gap-[24px] py-6" style={{ width: "550px" }}>

        {/* ══════════════════════════════════════════════════════════════════
            CHAT HEADER — Card container per Figma (node 9:3665)
            bg: rgba(255,244,224,0.2), p-12, rounded-12, shadow
            ══════════════════════════════════════════════════════════════════ */}
        <div
          className="w-full rounded-[12px] shadow-[0px_1px_2px_rgba(0,0,0,0.05),0px_4px_12px_rgba(0,0,0,0.06),0px_16px_40px_rgba(0,0,0,0.07)]"
          style={{ backgroundColor: "rgba(236,250,255,0.6)" }}
        >
          <div className="flex w-full flex-col items-start gap-[12px] p-[12px]">
          {/* Top row: same horizontal inset as search bar (px-14) so edges line up */}
          <div className="flex w-full min-w-0 items-center justify-between gap-[12px] px-[14px]">
            <div className="flex min-w-0 items-center gap-[6px]">
              <img
                src="/icons/mark-avatar.png"
                alt="Mark Slater"
                className="h-[34px] w-[34px] shrink-0 rounded-full object-cover"
              />
              <span
                className="truncate text-[16px] font-medium leading-[20px] text-[#3e4c60]"
                style={{
                  fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
                  letterSpacing: "-0.32px",
                }}
              >
                Mark Slater, CEO.
              </span>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-[12px]">
              <span
                className="whitespace-nowrap text-[10px] font-medium leading-[10px] text-[#9ca5a9]"
                style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
              >
                ...updated {updatedAgoText() || "just now"}
              </span>
              <button
                type="button"
                onClick={handleScan}
                disabled={scanning}
                className="shrink-0 p-0 leading-none"
                title="Run Gmail scanner"
              >
                <img
                  src="/icons/refresh-2.svg"
                  alt="Refresh"
                  className={`h-[20px] w-[20px] ${scanning ? "animate-spin" : ""}`}
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
            {cards.map((card) => (
              <FeedCard
                key={card.id}
                card={card}
                onAction={handleAction}
                onDismiss={handleDismiss}
                onContactTap={(contactId) => setContactPanelId(contactId)}
              />
            ))}

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

      {/* ── Contact Panel Overlay ── */}
      {contactPanelId && (
        <ContactPanel
          contactId={contactPanelId}
          onDismiss={() => setContactPanelId(null)}
        />
      )}
    </>
  );
}
