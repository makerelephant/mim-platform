"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import FeedCard, { FeedCardData } from "@/components/FeedCard";

// ─── Component ──────────────────────────────────────────────────────────────

export default function MotionFeedPage() {
  const [cards, setCards] = useState<FeedCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
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

  // ── Card actions ──
  async function handleAction(id: string, action: "do" | "no" | "not_now") {
    const res = await fetch("/api/feed", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ceo_action: action }),
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

  // ─── RENDER ──────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-[#f3f3f3] -m-6">
      {/* ── Header ── */}
      <div className="bg-white px-4 sm:px-6 py-4 sm:py-5 shrink-0 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.06)]">
        <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--mim-text-primary)] tracking-tight">
          Your Motion
        </h1>
        <p className="text-sm text-[var(--mim-text-secondary)] tracking-tight mt-0.5">
          {total > 0 ? `${total} items in your feed` : "Your operational life stream"}
        </p>
      </div>

      {/* ── Feed ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            </div>
          ) : cards.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-lg font-medium text-slate-400">No cards yet</p>
              <p className="text-sm text-slate-300 mt-2">
                Run the Gmail scanner to populate your feed, then reload.
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
    </div>
  );
}
