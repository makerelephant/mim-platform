"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import FeedCard, { FeedCardData, CorrectionData } from "@/components/FeedCard";

/* eslint-disable @next/next/no-img-element */

// ─── Component ──────────────────────────────────────────────────────────────

export default function MotionFeedPage() {
  const [cards, setCards] = useState<FeedCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const limit = 30;

  // ── Load feed cards ──
  const loadCards = useCallback(async (newOffset: number, append: boolean, filterType?: string | null) => {
    try {
      const typeParam = filterType !== undefined ? filterType : activeFilter;
      let feedUrl = `/api/feed?status=unread,read,acted&limit=${limit}&offset=${newOffset}`;
      if (typeParam) feedUrl += `&card_type=${typeParam}`;
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

  // ── Run scanner ──
  async function handleScan() {
    setScanning(true);
    try {
      await fetch("/api/agents/gmail-scanner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanHours: 168 }),
      });
      // Reload feed after scan
      await loadCards(0, false);
    } catch (err) {
      console.error("Scanner error:", err);
    } finally {
      setScanning(false);
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
      setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...data.card } : c)));
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
    <div className="min-h-full" style={{ backgroundImage: "url('/icons/background.png')", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }}>
      {/* ── Feed container ── */}
      <div className="mx-auto py-6 flex flex-col gap-[24px] items-center" style={{ width: "499px" }}>

        {/* ══════════════════════════════════════════════════════════════════
            CHAT HEADER — Card container per Figma (node 9:3665)
            bg: rgba(255,244,224,0.2), p-12, rounded-12, shadow
            ══════════════════════════════════════════════════════════════════ */}
        <div
          className="flex flex-col gap-[12px] items-start p-[12px] rounded-[12px] shadow-[0px_0px_60px_0px_rgba(0,0,0,0.12)] w-full"
          style={{ backgroundColor: "rgba(255,244,224,0.2)" }}
        >
          {/* Avatar + Name */}
          <div className="flex flex-col gap-[12px] items-start w-full">
            <div className="flex gap-[6px] items-end pr-[6px] w-full">
              <img
                src="/icons/mark-avatar.png"
                alt="Mark Slater"
                className="w-[34px] h-[34px] rounded-full object-cover shrink-0"
              />
              <span
                className="text-[18px] font-medium text-[#9ca5a9] leading-[20px] text-center whitespace-nowrap"
                style={{
                  fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
                  letterSpacing: "-0.36px",
                }}
              >
                Mark Slater, CEO.
              </span>
            </div>

            {/* Title + Updated + Refresh */}
            <div className="flex items-start justify-between pr-[6px] w-full">
              <div className="flex gap-[6px] items-center">
                <span
                  className="text-[18px] font-semibold text-[#1e252a] leading-[20px] text-center whitespace-nowrap"
                  style={{
                    fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
                    letterSpacing: "-0.36px",
                  }}
                >
                  Important Conversations{" "}
                </span>
                <div className="flex items-end h-full pb-[2px]">
                  <span
                    className="text-[10px] font-medium text-[#9ca5a9] leading-[10px] text-center whitespace-nowrap"
                    style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                  >
                    ...updated {updatedAgoText() || "just now"}
                  </span>
                </div>
              </div>
              <button
                onClick={handleScan}
                disabled={scanning}
                className="shrink-0"
                title="Run Gmail scanner"
              >
                <img
                  src="/icons/refresh-2.svg"
                  alt="Refresh"
                  className={`w-[20px] h-[20px] ${scanning ? "animate-spin" : ""}`}
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
            <div className="flex gap-[24px] items-end h-[21px] w-[143px]">
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

        {/* ── Filter pills ── */}
        <div className="flex gap-[8px] items-center w-full overflow-x-auto">
          {[
            { key: null, label: "All" },
            { key: "decision", label: "Decisions" },
            { key: "action", label: "Actions" },
            { key: "signal", label: "Signals" },
            { key: "intelligence", label: "Intel" },
            { key: "briefing", label: "Briefings" },
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
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
            <p className="text-sm text-slate-400">Scanning emails...</p>
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
    </div>
  );
}
