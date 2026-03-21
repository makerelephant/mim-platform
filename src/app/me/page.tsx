"use client";

import { useState, useEffect } from "react";

/* eslint-disable @next/next/no-img-element */

/**
 * Me Page — CEO personal dashboard
 * Shows brain training stats, engagement metrics, and platform health
 */

interface BrainStats {
  total_acted: number;
  overall: {
    accuracy: number | null;
    total: number;
    approved: number;
    rejected: number;
    held: number;
  };
  categories: Array<{
    category: string;
    accuracy: number | null;
    total: number;
  }>;
}

interface AutonomyData {
  success: boolean;
  autonomous_categories: Array<{ category: string; accuracy: number; reviews: number }>;
  approaching_categories: Array<{ category: string; accuracy: number; reviews: number }>;
  all_categories: Array<{ category: string; accuracy: number; reviews: number; qualifies: boolean }>;
  thresholds: { reviews: number; accuracy: number };
}

export default function MePage() {
  const [accuracy, setAccuracy] = useState<BrainStats | null>(null);
  const [autonomy, setAutonomy] = useState<AutonomyData | null>(null);
  const [feedStats, setFeedStats] = useState<{ total: number; unread: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [accRes, autoRes, feedRes] = await Promise.all([
          fetch("/api/brain/accuracy").then((r) => r.json()).catch(() => null),
          fetch("/api/brain/autonomy").then((r) => r.json()).catch(() => null),
          fetch("/api/feed?status=unread&limit=1").then((r) => r.json()).catch(() => null),
        ]);
        if (accRes?.success !== false) setAccuracy(accRes);
        if (autoRes?.success) setAutonomy(autoRes);
        if (feedRes) setFeedStats({ total: feedRes.total || 0, unread: feedRes.total || 0 });
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, []);

  const overallAccuracy = accuracy?.overall?.accuracy;
  const totalReviewed = accuracy?.overall?.total || 0;
  const autonomousCount = autonomy?.autonomous_categories?.length || 0;
  const totalCategories = autonomy?.all_categories?.length || 0;

  return (
    <div
      className="min-h-full"
      style={{
        backgroundColor: "#f6f5f5",
        backgroundImage: "url('/icons/background.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="mx-auto py-6 flex flex-col gap-[24px] items-center" style={{ maxWidth: "550px", width: "100%" }}>
        {/* Header card */}
        <div
          className="w-full rounded-[12px] shadow-[0px_0px_60px_0px_rgba(0,0,0,0.12)]"
          style={{ backgroundColor: "rgba(255,244,224,0.2)" }}
        >
          <div className="flex w-full flex-col items-start gap-[12px] p-[12px]">
            <div className="flex min-w-0 items-center gap-[12px]">
              <img
                src="/icons/mark-avatar.png"
                alt="Mark Slater"
                className="h-[34px] w-[34px] shrink-0 rounded-full object-cover"
              />
              <span
                className="truncate text-[16px] font-semibold leading-[20px] text-[#3e4c60]"
                style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif", letterSpacing: "-0.32px" }}
              >
                Your Brain Training
              </span>
            </div>
            <p
              className="text-[12px] font-medium leading-[14px] w-full"
              style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif", color: "#627c9e" }}
            >
              Every action you take in Motion teaches the brain. Here&apos;s how it&apos;s learning.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ── Stats Grid ── */}
            <div className="grid grid-cols-3 gap-[12px] w-full">
              <StatCard
                label="Brain Accuracy"
                value={overallAccuracy != null ? `${Math.round(overallAccuracy)}%` : "—"}
                color={overallAccuracy != null && overallAccuracy >= 80 ? "#10b981" : overallAccuracy != null ? "#f59e0b" : "#9ca5a9"}
              />
              <StatCard
                label="Cards Reviewed"
                value={totalReviewed.toString()}
                color="#1e252a"
              />
              <StatCard
                label="Unread in Feed"
                value={feedStats?.unread?.toString() || "0"}
                color="#627c9e"
              />
            </div>

            {/* ── Autonomy Progress ── */}
            <div className="w-full rounded-[12px] bg-white shadow-[0px_0px_60px_0px_rgba(0,0,0,0.12)] p-[16px]">
              <h3
                className="text-[14px] font-semibold text-[#1e252a] mb-[12px]"
                style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
              >
                Autonomy Progress
              </h3>
              {totalCategories === 0 ? (
                <p className="text-[12px] text-[#9ca5a9]" style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}>
                  Review cards in Motion to start training the brain. Each Do/Hold/No action teaches it.
                </p>
              ) : (
                <>
                  <p className="text-[12px] text-[#6e7b80] mb-[16px]" style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}>
                    {autonomousCount} of {totalCategories} categories operating autonomously.
                    {autonomy?.thresholds && ` Need ${autonomy.thresholds.reviews}+ reviews at ${autonomy.thresholds.accuracy}%+ accuracy.`}
                  </p>
                  <div className="space-y-[10px]">
                    {autonomy?.all_categories?.map((cat) => (
                      <div key={cat.category} className="flex items-center gap-[8px]">
                        <span
                          className="text-[11px] font-medium w-[120px] truncate"
                          style={{
                            fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
                            color: cat.qualifies ? "#10b981" : "#64748b",
                          }}
                        >
                          {cat.qualifies ? "✓ " : ""}{cat.category}
                        </span>
                        <div className="flex-1 h-[6px] bg-[#f0f0f0] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, cat.accuracy)}%`,
                              backgroundColor: cat.qualifies ? "#10b981" : cat.accuracy >= 80 ? "#f59e0b" : "#cbd5e1",
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-[#1e252a] w-[36px] text-right" style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}>
                          {cat.accuracy}%
                        </span>
                        <span className="text-[9px] text-[#9ca5a9] w-[50px] text-right" style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}>
                          {cat.reviews} reviews
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* ── Action Breakdown ── */}
            {accuracy?.overall && accuracy.overall.total > 0 && (
              <div className="w-full rounded-[12px] bg-white shadow-[0px_0px_60px_0px_rgba(0,0,0,0.12)] p-[16px]">
                <h3
                  className="text-[14px] font-semibold text-[#1e252a] mb-[12px]"
                  style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                >
                  Your Actions
                </h3>
                <div className="flex gap-[16px]">
                  <ActionStat label="Approved" count={accuracy.overall.approved} total={accuracy.overall.total} color="#10b981" />
                  <ActionStat label="Held" count={accuracy.overall.held} total={accuracy.overall.total} color="#f59e0b" />
                  <ActionStat label="Rejected" count={accuracy.overall.rejected} total={accuracy.overall.total} color="#ef4444" />
                </div>
              </div>
            )}

            {/* ── Generate Report ── */}
            <ReportGenerator />

            {/* ── Quick Actions ── */}
            <div className="w-full rounded-[12px] bg-white shadow-[0px_0px_60px_0px_rgba(0,0,0,0.12)] p-[16px]">
              <h3
                className="text-[14px] font-semibold text-[#1e252a] mb-[12px]"
                style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
              >
                Quick Actions
              </h3>
              <div className="flex flex-col gap-[8px]">
                <QuickAction label="Run Gmail Scanner" href="/api/agents/gmail-scanner" icon="📧" />
                <QuickAction label="Generate Daily Briefing" href="/api/agents/daily-briefing" icon="📊" />
                <QuickAction label="Run Weekly Synthesis" href="/api/agents/synthesis" icon="🧠" />
                <QuickAction label="Generate Monthly Report" href="/api/agents/monthly-report" icon="📋" />
                <LinkAction label="Bulk Data Import Gopher" href="/engine/import" icon="📥" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-[12px] bg-white shadow-[0px_0px_60px_0px_rgba(0,0,0,0.12)] p-[12px] flex flex-col items-center">
      <span
        className="text-[24px] font-bold leading-[28px]"
        style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif", color }}
      >
        {value}
      </span>
      <span
        className="text-[10px] font-medium text-[#9ca5a9] mt-[4px]"
        style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
      >
        {label}
      </span>
    </div>
  );
}

function ActionStat({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex-1 text-center">
      <div className="text-[20px] font-bold" style={{ color, fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}>
        {count}
      </div>
      <div className="text-[10px] text-[#9ca5a9] mt-1" style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}>
        {label} ({pct}%)
      </div>
    </div>
  );
}

function LinkAction({ label, href, icon }: { label: string; href: string; icon: string }) {
  return (
    <a
      href={href}
      className="flex items-center gap-[8px] px-[12px] py-[8px] rounded-[8px] hover:bg-[#f6f5f5] transition-colors text-left"
    >
      <span className="text-[16px]">{icon}</span>
      <span
        className="text-[12px] font-medium text-[#1e252a] flex-1"
        style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
      >
        {label}
      </span>
      <span className="text-[10px] text-[#9ca5a9]" style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}>→</span>
    </a>
  );
}

function ReportGenerator() {
  const [generating, setGenerating] = useState(false);
  const [reportType, setReportType] = useState<"weekly" | "monthly" | "custom" | null>(null);
  const [customFocus, setCustomFocus] = useState("");
  const [customPeriod, setCustomPeriod] = useState(30);
  const [reportResult, setReportResult] = useState<{ title: string; markdown: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate(type: "weekly" | "monthly" | "custom") {
    setGenerating(true);
    setReportType(type);
    setReportResult(null);
    setError(null);

    try {
      const payload: Record<string, unknown> = { type };
      if (type === "custom") {
        if (!customFocus.trim()) {
          setError("Enter a focus area for the custom report.");
          setGenerating(false);
          return;
        }
        payload.focus = customFocus.trim();
        payload.period_days = customPeriod;
      }

      const res = await fetch("/api/agents/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        setReportResult({ title: data.title, markdown: data.report_markdown });
      } else {
        setError(data.error || "Report generation failed.");
      }
    } catch {
      setError("Network error generating report.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="w-full rounded-[12px] bg-white shadow-[0px_0px_60px_0px_rgba(0,0,0,0.12)] p-[16px]">
      <h3
        className="text-[14px] font-semibold text-[#1e252a] mb-[12px]"
        style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
      >
        Generate Report
      </h3>
      <p
        className="text-[11px] text-[#6e7b80] mb-[12px]"
        style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
      >
        Reports are emitted as briefing cards in Your Motion.
      </p>

      {/* Quick buttons */}
      <div className="flex gap-[8px] mb-[12px]">
        <button
          onClick={() => generate("weekly")}
          disabled={generating}
          className="flex-1 px-[12px] py-[8px] rounded-[8px] text-[12px] font-medium transition-colors disabled:opacity-50"
          style={{
            fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
            backgroundColor: generating && reportType === "weekly" ? "#e2e8f0" : "#f0f9ff",
            color: "#1e40af",
            border: "1px solid #bfdbfe",
          }}
        >
          {generating && reportType === "weekly" ? "Generating..." : "Weekly Report"}
        </button>
        <button
          onClick={() => generate("monthly")}
          disabled={generating}
          className="flex-1 px-[12px] py-[8px] rounded-[8px] text-[12px] font-medium transition-colors disabled:opacity-50"
          style={{
            fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
            backgroundColor: generating && reportType === "monthly" ? "#e2e8f0" : "#f0fdf4",
            color: "#166534",
            border: "1px solid #bbf7d0",
          }}
        >
          {generating && reportType === "monthly" ? "Generating..." : "Monthly Report"}
        </button>
      </div>

      {/* Custom report */}
      <div
        className="rounded-[8px] p-[10px] mb-[8px]"
        style={{ backgroundColor: "#fafafa", border: "1px solid #e5e7eb" }}
      >
        <label
          className="text-[11px] font-medium text-[#64748b] block mb-[6px]"
          style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
        >
          Custom Report
        </label>
        <input
          type="text"
          placeholder="Focus area (e.g. partnerships, fundraising, customer pipeline)"
          value={customFocus}
          onChange={(e) => setCustomFocus(e.target.value)}
          disabled={generating}
          className="w-full px-[8px] py-[6px] rounded-[6px] text-[12px] border border-[#d1d5db] mb-[8px] outline-none focus:border-[#93c5fd] transition-colors"
          style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
        />
        <div className="flex gap-[8px] items-center">
          <select
            value={customPeriod}
            onChange={(e) => setCustomPeriod(Number(e.target.value))}
            disabled={generating}
            className="px-[8px] py-[6px] rounded-[6px] text-[12px] border border-[#d1d5db] outline-none focus:border-[#93c5fd] bg-white"
            style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
          <button
            onClick={() => generate("custom")}
            disabled={generating || !customFocus.trim()}
            className="flex-1 px-[12px] py-[6px] rounded-[6px] text-[12px] font-medium transition-colors disabled:opacity-40"
            style={{
              fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
              backgroundColor: generating && reportType === "custom" ? "#e2e8f0" : "#f5f3ff",
              color: "#5b21b6",
              border: "1px solid #ddd6fe",
            }}
          >
            {generating && reportType === "custom" ? "Generating..." : "Generate"}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {generating && (
        <div className="flex items-center gap-[8px] py-[12px]">
          <div className="w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
          <span
            className="text-[11px] text-[#9ca5a9]"
            style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
          >
            Generating {reportType} report... this may take 30-60 seconds.
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="mt-[8px] px-[10px] py-[8px] rounded-[6px] text-[11px]"
          style={{
            fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
            backgroundColor: "#fef2f2",
            color: "#991b1b",
            border: "1px solid #fecaca",
          }}
        >
          {error}
        </div>
      )}

      {/* Report result */}
      {reportResult && (
        <div className="mt-[12px]">
          <div className="flex items-center justify-between mb-[8px]">
            <span
              className="text-[12px] font-semibold text-[#1e252a]"
              style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
            >
              {reportResult.title}
            </span>
            <button
              onClick={() => setReportResult(null)}
              className="text-[10px] text-[#9ca5a9] hover:text-[#64748b] transition-colors"
              style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
            >
              Dismiss
            </button>
          </div>
          <div
            className="rounded-[8px] p-[12px] text-[11px] leading-[16px] max-h-[400px] overflow-y-auto whitespace-pre-wrap"
            style={{
              fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
              color: "#334155",
            }}
          >
            {reportResult.markdown}
          </div>
          <p
            className="mt-[6px] text-[10px] text-[#9ca5a9]"
            style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
          >
            This report has also been emitted as a briefing card in Your Motion.
          </p>
        </div>
      )}
    </div>
  );
}

function QuickAction({ label, href, icon }: { label: string; href: string; icon: string }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch(href);
      const data = await res.json();
      setResult(data.success ? "Done ✓" : data.error || "Failed");
    } catch {
      setResult("Error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <button
      onClick={run}
      disabled={running}
      className="flex items-center gap-[8px] px-[12px] py-[8px] rounded-[8px] hover:bg-[#f6f5f5] transition-colors text-left disabled:opacity-50"
    >
      <span className="text-[16px]">{icon}</span>
      <span
        className="text-[12px] font-medium text-[#1e252a] flex-1"
        style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
      >
        {label}
      </span>
      {running ? (
        <div className="w-3 h-3 border border-slate-300 border-t-transparent rounded-full animate-spin" />
      ) : result ? (
        <span className="text-[10px] text-[#9ca5a9]" style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}>
          {result}
        </span>
      ) : null}
    </button>
  );
}
