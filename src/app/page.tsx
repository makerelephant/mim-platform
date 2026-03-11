"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import { Paperclip, Mic, ArrowUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ─── Types ──────────────────────────────────────────────────────────────────

interface KpiCard {
  label: string;
  value: string;
  subtitle: string;
  icon: string; // lucide icon name or emoji
  color: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function MyBrainPage() {
  const [lastVisit, setLastVisit] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [kpis, setKpis] = useState<KpiCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        // Get last visit timestamp
        const { data: lastActivity } = await supabase.schema("brain")
          .from("activity")
          .select("created_at")
          .eq("actor", "ceo")
          .order("created_at", { ascending: false })
          .limit(1);

        if (lastActivity && lastActivity.length > 0) {
          setLastVisit(formatDistanceToNow(new Date(lastActivity[0].created_at), { addSuffix: true }));
        } else {
          setLastVisit("23 hours ago");
        }

        // Build KPI data — placeholder values that will be wired to real data
        setKpis([
          {
            label: "REVENUE",
            value: "$",
            subtitle: "Cumulative since (date)",
            icon: "dollar",
            color: "text-emerald-600",
          },
          {
            label: "ITEMS SOLD",
            value: "...",
            subtitle: "individual products",
            icon: "cart",
            color: "text-emerald-600",
          },
          {
            label: "AOV",
            value: "$",
            subtitle: "Average Order Value",
            icon: "building",
            color: "text-emerald-600",
          },
          {
            label: "LINKS CREATED",
            value: "...",
            subtitle: "Drop Links Created",
            icon: "link",
            color: "text-emerald-600",
          },
          {
            label: "CONVERT TO BUY",
            value: "%",
            subtitle: "% who visit and buy",
            icon: "convert",
            color: "text-emerald-600",
          },
        ]);
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    // TODO: Wire to ask_brain API route
    console.log("Brain query:", chatInput);
    setChatInput("");
  }

  // KPI icon render
  function renderKpiIcon(icon: string) {
    switch (icon) {
      case "dollar":
        return <span className="text-2xl font-bold text-emerald-600">$</span>;
      case "cart":
        return (
          <svg className="w-6 h-6 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
        );
      case "building":
        return <span className="text-2xl font-bold text-emerald-600">$</span>;
      case "link":
        return (
          <Image src="/icons/convert to buy.png" alt="" width={28} height={28} className="opacity-80" />
        );
      case "convert":
        return <span className="text-2xl font-bold text-emerald-600">%</span>;
      default:
        return null;
    }
  }

  return (
    <div className="min-h-full flex flex-col">
      {/* ── Header ── */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">My Brain</h1>
        <div className="flex items-center gap-3 mt-1">
          <p className="text-sm text-slate-500">Hello Mark, Welcome Back.</p>
          {lastVisit && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white border border-slate-200 text-slate-500">
              Last Visit: {lastVisit}
            </span>
          )}
        </div>
      </div>

      {/* ── Chat prompt ── */}
      <div className="flex flex-col items-center mb-10">
        <h2 className="text-xl font-semibold text-slate-800 mb-4">How can i help?</h2>

        <form onSubmit={handleSubmit} className="w-full max-w-2xl">
          <div className="relative bg-white rounded-2xl border border-slate-200 shadow-sm px-4 pt-3 pb-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask Anything about the business."
              className="w-full text-sm text-slate-700 placeholder:text-slate-400 bg-transparent outline-none pb-8"
            />

            {/* Bottom toolbar */}
            <div className="flex items-center justify-between">
              {/* Launch a Gopher button */}
              <button
                type="button"
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-sm font-medium text-slate-700 hover:bg-blue-100 transition-colors"
              >
                <Image src="/icons/gophers.png" alt="" width={18} height={18} />
                Launch a Gopher
              </button>

              {/* Action buttons */}
              <div className="flex items-center gap-1">
                <button type="button" className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                  <Paperclip className="w-4.5 h-4.5" />
                </button>
                <button type="button" className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                  <Mic className="w-4.5 h-4.5" />
                </button>
                <button
                  type="submit"
                  className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  <ArrowUp className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* ── KPI Cards ── */}
      {!loading && (
        <div className="grid grid-cols-5 gap-4 mb-8">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                  {kpi.label}
                </span>
                <div className="h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center">
                  {renderKpiIcon(kpi.icon)}
                </div>
              </div>
              <div className="mb-1">
                {renderKpiIcon(kpi.icon === "convert" ? "" : kpi.icon)}
                <span className="text-lg font-bold text-emerald-600">{kpi.value}</span>
              </div>
              <p className="text-[11px] text-slate-400">{kpi.subtitle}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Subtle gradient background decoration ── */}
      <div
        className="fixed inset-0 pointer-events-none -z-10"
        style={{
          background: "linear-gradient(135deg, rgba(248,250,252,1) 0%, rgba(241,245,249,1) 40%, rgba(237,233,254,0.15) 70%, rgba(248,250,252,1) 100%)",
        }}
      />
    </div>
  );
}
