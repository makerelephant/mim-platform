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
  const limit = 30;

  // ── Load feed cards ──
  const loadCards = useCallback(async (newOffset: number, append: boolean) => {
    try {
      const res = await fetch(`/api/feed?status=unread,read&limit=${limit}&offset=${newOffset}`);
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
  }, []);

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
      <div className="mx-auto py-6 space-y-4" style={{ width: "500px" }}>

        {/* ══════════════════════════════════════════════════════════════════
            HEADER — Avatar + Name + Title + Scanner
            ══════════════════════════════════════════════════════════════════ */}
        <div className="flex flex-col gap-[6px] mb-[8px]">
          {/* Avatar + Name */}
          <div className="flex items-center gap-[10px]">
            <img
              src="/icons/mark-avatar.png"
              alt="Mark Slater"
              className="w-[36px] h-[36px] rounded-full object-cover"
            />
            <span
              className="text-[14px] font-medium text-[#6e7b80] leading-[18px]"
              style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
            >
              Mark Slater, CEO.
            </span>
          </div>

          {/* Title + Updated + Refresh */}
          <div className="flex items-center gap-[8px]">
            <h1
              className="text-[22px] font-bold text-[#1e252a] leading-[28px]"
              style={{
                fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
                letterSpacing: "-0.44px",
              }}
            >
              Important Conversations
            </h1>
            {lastUpdated && (
              <span
                className="text-[11px] text-[#9ca3af] leading-[14px]"
                style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
              >
                ...updated {updatedAgoText()}
              </span>
            )}
            <button
              onClick={handleScan}
              disabled={scanning}
              className="ml-auto shrink-0"
              title="Run Gmail scanner"
            >
              <img
                src="/icons/refresh-2.svg"
                alt="Refresh"
                className={`w-[20px] h-[20px] ${scanning ? "animate-spin" : ""}`}
                style={{ filter: "invert(45%) sepia(80%) saturate(400%) hue-rotate(175deg) brightness(95%)" }}
              />
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            SEARCH BAR — "Ask Anything about the business."
            ══════════════════════════════════════════════════════════════════ */}
        <div
          className="flex items-center gap-[8px] px-[16px] py-[10px] rounded-[12px] bg-white mb-[8px]"
          style={{ border: "1px solid rgba(208, 213, 221, 0.4)" }}
        >
          <span
            className="flex-1 text-[13px] text-[#9ca3af] leading-[18px]"
            style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
          >
            Ask Anything about the business.
          </span>
          <div className="flex items-center gap-[12px]">
            <img src="/icons/calendar-plus.svg" alt="" className="w-[18px] h-[18px] opacity-40" />
            <img src="/icons/paperclip.svg" alt="" className="w-[18px] h-[18px] opacity-40" />
            <img src="/icons/mic.svg" alt="" className="w-[18px] h-[18px] opacity-40" />
            <img src="/icons/arrow-up-circle.svg" alt="" className="w-[18px] h-[18px] opacity-40" />
          </div>
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
