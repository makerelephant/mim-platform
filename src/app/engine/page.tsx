"use client";

import { useState, useEffect } from "react";

/* eslint-disable @next/next/no-img-element */

// ─── Types ──────────────────────────────────────────────────────────────────

interface HarnessFile {
  name: string;
  slug: string;
  content: string;
  section?: string;
}

interface HarnessSection {
  label: string;
  slugs: string[];
}

interface AccuracyCategory {
  category: string;
  accuracy: number | null;
  approved: number;
  rejected: number;
  held: number;
  total: number;
  needs_attention: boolean;
}

interface PriorityCalibrationRow {
  priority: string;
  justified_rate: number | null;
  target: number;
  total: number;
  calibrated: boolean | null;
}

interface AccuracyData {
  success: boolean;
  total_acted: number;
  dismissed_count: number;
  snr: number | null;
  priority_calibration: PriorityCalibrationRow[] | null;
  overall: {
    accuracy: number | null;
    total: number;
    approved: number;
    rejected: number;
    held: number;
  };
  categories: AccuracyCategory[];
  by_type: Array<{
    type: string;
    accuracy: number | null;
    approved: number;
    rejected: number;
    held: number;
    total: number;
  }>;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function EngineRoomPage() {
  const [activeTab, setActiveTab] = useState<"map" | "accuracy" | "metrics" | "gophers" | "integrations" | "autonomy" | "health">("map");
  const [harness, setHarness] = useState<HarnessFile[]>([]);
  const [harnessSections, setHarnessSections] = useState<HarnessSection[]>([]);
  const [integrations, setIntegrations] = useState<Array<{ name: string; icon: string; status: string; description: string }>>([]);
  const [accuracy, setAccuracy] = useState<AccuracyData | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load harness files and accuracy data
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Load harness files
        const harnessRes = await fetch("/api/brain/harness");
        if (harnessRes.ok) {
          const data = await harnessRes.json();
          setHarness(data.files || []);
          setHarnessSections(data.sections || []);
          if (data.files?.length > 0) setSelectedFile(data.files[0].slug);
        }
      } catch { /* ignore */ }

      try {
        // Load accuracy data
        const accRes = await fetch("/api/brain/accuracy");
        if (accRes.ok) {
          setAccuracy(await accRes.json());
        }
      } catch { /* ignore */ }

      try {
        // Load integration status
        const intRes = await fetch("/api/engine/integrations");
        if (intRes.ok) {
          const intData = await intRes.json();
          if (intData.success) setIntegrations(intData.integrations);
        }
      } catch { /* ignore */ }

      setLoading(false);
    }
    load();
  }, []);

  const selectedHarness = harness.find((h) => h.slug === selectedFile);

  return (
    <div className="h-full flex flex-col bg-[#f6f5f5]">
      {/* ── Header ── */}
      <div className="px-6 pt-6 pb-4">
        <h1
          className="text-2xl font-bold text-[#1e252a] tracking-tight"
          style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
        >
          Engine Room
        </h1>
        <p className="text-sm text-[#6e7b80] mt-0.5">
          How the brain thinks. What it knows. How well it&apos;s doing.
        </p>
      </div>

      {/* ── Tabs ── */}
      <div className="px-6 pb-4 flex gap-1">
        {[
          { key: "map" as const, label: "Motion Map" },
          { key: "accuracy" as const, label: "Brain Accuracy" },
          { key: "metrics" as const, label: "Metrics" },
          { key: "gophers" as const, label: "Gophers" },
          { key: "autonomy" as const, label: "Autonomy" },
          { key: "integrations" as const, label: "Integrations" },
          { key: "health" as const, label: "Health" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              activeTab === tab.key
                ? "bg-white text-[#1e252a] font-semibold shadow-sm"
                : "text-[#6e7b80] hover:text-[#1e252a] hover:bg-white/50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-[#94A3B8] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 bg-[#94A3B8] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 bg-[#94A3B8] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        ) : activeTab === "map" ? (
          /* ── Motion Map ── */
          <div className="flex gap-4 h-full">
            {/* File list */}
            <div className="w-52 shrink-0 space-y-1 overflow-y-auto">
              {harness.length === 0 ? (
                <p className="text-xs text-[#94A3B8]">No harness files loaded</p>
              ) : harnessSections.length > 0 ? (
                harnessSections.map((section) => (
                  <div key={section.label} className="mb-3">
                    <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-1 px-3">
                      {section.label}
                    </p>
                    {section.slugs.map((slug) => {
                      const file = harness.find((h) => h.slug === slug);
                      if (!file) return null;
                      return (
                        <button
                          key={file.slug}
                          onClick={() => setSelectedFile(file.slug)}
                          className={`w-full text-left text-sm px-3 py-1.5 rounded-lg transition-colors ${
                            selectedFile === file.slug
                              ? "bg-white text-[#1e252a] font-medium shadow-sm"
                              : "text-[#64748B] hover:text-[#1e252a] hover:bg-white/50"
                          }`}
                        >
                          {file.name}
                        </button>
                      );
                    })}
                  </div>
                ))
              ) : (
                harness.map((h) => (
                  <button
                    key={h.slug}
                    onClick={() => setSelectedFile(h.slug)}
                    className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                      selectedFile === h.slug
                        ? "bg-white text-[#1e252a] font-medium shadow-sm"
                        : "text-[#64748B] hover:text-[#1e252a] hover:bg-white/50"
                    }`}
                  >
                    {h.name}
                  </button>
                ))
              )}
            </div>

            {/* File content */}
            <div className="flex-1 bg-white rounded-xl shadow-sm p-6 overflow-y-auto">
              {selectedHarness ? (
                <>
                  <h2 className="text-lg font-bold text-[#1e252a] mb-4">{selectedHarness.name}</h2>
                  <div
                    className="prose prose-sm max-w-none text-[#4b5563]"
                    dangerouslySetInnerHTML={{
                      __html: selectedHarness.content
                        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                        .replace(/^### (.+)$/gm, '<h4 class="text-sm font-bold mt-3 mb-1 text-[#1e252a]">$1</h4>')
                        .replace(/^## (.+)$/gm, '<h3 class="text-base font-bold mt-4 mb-1 text-[#1e252a]">$1</h3>')
                        .replace(/^# (.+)$/gm, '<h2 class="text-lg font-bold mt-4 mb-2 text-[#1e252a]">$1</h2>')
                        .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-sm">$1</li>')
                        .replace(/\n{2,}/g, "<br/><br/>")
                        .replace(/\n/g, "<br/>"),
                    }}
                  />
                </>
              ) : (
                <p className="text-sm text-[#94A3B8]">Select a classifier to view its logic</p>
              )}
            </div>
          </div>
        ) : activeTab === "accuracy" ? (
          /* ── Brain Accuracy ── */
          <div className="space-y-6">
            {/* Overall stats */}
            {accuracy && (
              <>
                <div className="grid grid-cols-4 gap-4">
                  <StatCard label="Overall Accuracy" value={accuracy.overall.accuracy !== null ? `${accuracy.overall.accuracy}%` : "—"} />
                  <StatCard label="Cards Reviewed" value={String(accuracy.total_acted)} />
                  <StatCard label="Approved (Do)" value={String(accuracy.overall.approved)} color="text-emerald-600" />
                  <StatCard label="Rejected (No)" value={String(accuracy.overall.rejected)} color="text-red-500" />
                </div>

                {/* ── Signal-to-Noise Ratio ── */}
                {accuracy.snr !== null && (
                  <div className="bg-white rounded-xl shadow-sm p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-bold text-[#1e252a]">Signal Quality</h3>
                        <p className="text-xs text-[#94A3B8] mt-0.5">What % of surfaced cards deserved your attention</p>
                      </div>
                      <span
                        className={`text-2xl font-bold ${
                          accuracy.snr >= 80 ? "text-emerald-600" : accuracy.snr >= 60 ? "text-amber-500" : "text-red-500"
                        }`}
                      >
                        {accuracy.snr}%
                      </span>
                    </div>
                    <div className="h-2 bg-[#f0f0f0] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          accuracy.snr >= 80 ? "bg-emerald-400" : accuracy.snr >= 60 ? "bg-amber-400" : "bg-red-400"
                        }`}
                        style={{ width: `${accuracy.snr}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className="text-[10px] text-[#94A3B8]">
                        {accuracy.overall.approved + accuracy.overall.held} useful · {accuracy.overall.rejected + (accuracy.dismissed_count ?? 0)} noise
                      </span>
                      <span className={`text-[10px] font-medium ${accuracy.snr >= 80 ? "text-emerald-600" : accuracy.snr >= 60 ? "text-amber-500" : "text-red-500"}`}>
                        {accuracy.snr >= 80 ? "Clean feed" : accuracy.snr >= 60 ? "Noise building" : "Too much noise"}
                      </span>
                    </div>
                  </div>
                )}

                {/* ── Priority Calibration ── */}
                {accuracy.priority_calibration && accuracy.priority_calibration.some(p => p.total > 0) && (
                  <div className="bg-white rounded-xl shadow-sm p-5">
                    <div className="mb-3">
                      <h3 className="text-sm font-bold text-[#1e252a]">Priority Calibration</h3>
                      <p className="text-xs text-[#94A3B8] mt-0.5">When the brain says critical, is it actually critical?</p>
                    </div>
                    <div className="space-y-3">
                      {accuracy.priority_calibration.map((row) => {
                        const hasData = row.total > 0;
                        const isLow = row.priority === "low";
                        const good = row.calibrated === true;
                        const bad = row.calibrated === false;
                        return (
                          <div key={row.priority} className="flex items-center gap-3">
                            <span className="text-xs font-medium text-[#64748B] capitalize w-16">{row.priority}</span>
                            <div className="flex-1 h-2 bg-[#f0f0f0] rounded-full overflow-hidden">
                              {hasData && row.justified_rate !== null ? (
                                <div
                                  className={`h-full rounded-full ${good ? "bg-emerald-400" : bad ? "bg-red-400" : "bg-amber-400"}`}
                                  style={{ width: `${row.justified_rate}%` }}
                                />
                              ) : null}
                            </div>
                            <span className={`text-xs font-semibold w-10 text-right ${good ? "text-emerald-600" : bad ? "text-red-500" : "text-[#94A3B8]"}`}>
                              {hasData && row.justified_rate !== null ? `${row.justified_rate}%` : "—"}
                            </span>
                            <span className="text-[10px] text-[#94A3B8] w-24 text-right">
                              {hasData ? (
                                isLow
                                  ? `target <${row.target}% · ${row.total} cards`
                                  : `target ≥${row.target}% · ${row.total} cards`
                              ) : "no data yet"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* By card type */}
                {accuracy.by_type && accuracy.by_type.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm p-5">
                    <h3 className="text-sm font-bold text-[#1e252a] mb-3">By Card Type</h3>
                    <div className="space-y-2">
                      {accuracy.by_type.map((t) => (
                        <div key={t.type} className="flex items-center gap-3">
                          <span className="text-xs font-medium text-[#64748B] w-24 capitalize">{t.type}</span>
                          <div className="flex-1 h-2 bg-[#f0f0f0] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-400 rounded-full"
                              style={{ width: `${t.accuracy || 0}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-[#1e252a] w-12 text-right">
                            {t.accuracy !== null ? `${t.accuracy}%` : "—"}
                          </span>
                          <span className="text-[10px] text-[#94A3B8] w-16 text-right">{t.total} reviews</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Per category */}
                {accuracy.categories && accuracy.categories.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm p-5">
                    <h3 className="text-sm font-bold text-[#1e252a] mb-3">By Category</h3>
                    <div className="space-y-2">
                      {accuracy.categories.map((c) => (
                        <div key={c.category} className="flex items-center gap-3">
                          <span className={`text-xs font-medium w-40 truncate ${c.needs_attention ? "text-red-500" : "text-[#64748B]"}`}>
                            {c.category}
                            {c.needs_attention && " ⚠"}
                          </span>
                          <div className="flex-1 h-2 bg-[#f0f0f0] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${c.needs_attention ? "bg-red-400" : "bg-emerald-400"}`}
                              style={{ width: `${c.accuracy || 0}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-[#1e252a] w-12 text-right">
                            {c.accuracy !== null ? `${c.accuracy}%` : "—"}
                          </span>
                          <span className="text-[10px] text-[#94A3B8] w-16 text-right">{c.total} reviews</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {accuracy.total_acted === 0 && (
                  <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                    <img src="/icons/gophers.png" alt="" width={48} height={56} className="opacity-20 mx-auto mb-4" />
                    <p className="text-sm text-[#94A3B8]">
                      No cards reviewed yet. Act on cards in Your Motion (Do / Hold / No) to start training the brain.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        ) : activeTab === "metrics" ? (
          /* ── Metrics ── */
          <MetricsPanel />
        ) : activeTab === "gophers" ? (
          /* ── Gophers ── */
          <GophersPanel />
        ) : activeTab === "autonomy" ? (
          /* ── Autonomy ── */
          <AutonomyPanel />
        ) : activeTab === "integrations" ? (
          /* ── Integrations ── */
          <div className="grid grid-cols-2 gap-4">
            {integrations.length > 0
              ? integrations.map((i) => (
                  <IntegrationCard key={i.name} name={i.name} status={i.status} description={i.description} icon={i.icon} />
                ))
              : <>
                  <IntegrationCard name="Gmail" status="connected" description="Scanning every day at 6am EST" icon="📧" />
                  <IntegrationCard name="Slack" status="planned" description="Not yet connected" icon="💬" />
                  <IntegrationCard name="Google Drive" status="planned" description="Not yet connected" icon="📁" />
                  <IntegrationCard name="Stripe" status="planned" description="Not yet connected" icon="💳" />
                  <IntegrationCard name="Calendar" status="planned" description="Not yet connected" icon="📅" />
                  <IntegrationCard name="Notion" status="planned" description="Not yet connected" icon="📝" />
                </>
            }
          </div>
        ) : (
          /* ── Health ── */
          <HealthPanel />
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <p className="text-xs text-[#94A3B8] mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color || "text-[#1e252a]"}`}>{value}</p>
    </div>
  );
}

function AutonomyPanel() {
  const [data, setData] = useState<{
    autonomous_categories: Array<{ category: string; accuracy: number; reviews: number }>;
    approaching_categories: Array<{ category: string; accuracy: number; reviews: number }>;
    all_categories: Array<{ category: string; accuracy: number; reviews: number; qualifies: boolean }>;
    thresholds: { reviews: number; accuracy: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/brain/autonomy")
      .then((r) => r.json())
      .then((d) => { if (d.success) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-sm text-[#94A3B8]">Loading...</div>;
  if (!data) return <div className="text-sm text-[#94A3B8]">Could not load autonomy data.</div>;

  return (
    <div className="space-y-6">
      {/* Thresholds */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="text-sm font-bold text-[#1e252a] mb-2">Autonomy Thresholds</h3>
        <p className="text-xs text-[#6e7b80]">
          A category earns autonomous operation when it reaches <strong>{data.thresholds.reviews}+ reviews</strong> with <strong>{data.thresholds.accuracy}%+ accuracy</strong>.
          The brain will auto-approve cards in those categories without asking.
        </p>
      </div>

      {/* Autonomous */}
      {data.autonomous_categories.length > 0 && (
        <div className="bg-emerald-50 rounded-xl shadow-sm p-5 border border-emerald-100">
          <h3 className="text-sm font-bold text-emerald-800 mb-3">🟢 Autonomous Categories</h3>
          <div className="space-y-2">
            {data.autonomous_categories.map((c) => (
              <div key={c.category} className="flex items-center gap-3">
                <span className="text-xs font-medium text-emerald-700 w-40 truncate">{c.category}</span>
                <span className="text-xs font-semibold text-emerald-600">{c.accuracy}%</span>
                <span className="text-[10px] text-emerald-500">{c.reviews} reviews</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approaching */}
      {data.approaching_categories.length > 0 && (
        <div className="bg-amber-50 rounded-xl shadow-sm p-5 border border-amber-100">
          <h3 className="text-sm font-bold text-amber-800 mb-3">🟡 Approaching Autonomy</h3>
          <div className="space-y-2">
            {data.approaching_categories.map((c) => (
              <div key={c.category} className="flex items-center gap-3">
                <span className="text-xs font-medium text-amber-700 w-40 truncate">{c.category}</span>
                <span className="text-xs font-semibold text-amber-600">{c.accuracy}%</span>
                <span className="text-[10px] text-amber-500">{c.reviews} reviews — need {data.thresholds.reviews - c.reviews} more</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All categories */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="text-sm font-bold text-[#1e252a] mb-3">All Categories</h3>
        {data.all_categories.length === 0 ? (
          <p className="text-xs text-[#94A3B8]">No categories with CEO reviews yet. Act on cards in Motion to start training.</p>
        ) : (
          <div className="space-y-2">
            {data.all_categories.map((c) => (
              <div key={c.category} className="flex items-center gap-3">
                <span className={`text-xs font-medium w-40 truncate ${c.qualifies ? "text-emerald-600" : "text-[#64748B]"}`}>
                  {c.qualifies ? "✓ " : ""}{c.category}
                </span>
                <div className="flex-1 h-2 bg-[#f0f0f0] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${c.qualifies ? "bg-emerald-400" : c.accuracy >= 80 ? "bg-amber-400" : "bg-[#94A3B8]"}`}
                    style={{ width: `${c.accuracy}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-[#1e252a] w-12 text-right">{c.accuracy}%</span>
                <span className="text-[10px] text-[#94A3B8] w-20 text-right">{c.reviews} reviews</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Metrics Types ──────────────────────────────────────────────────────────

interface MetricsData {
  success: boolean;
  computed_at: string;
  snr: {
    current: number | null;
    should_not_exist: number;
    worth_seeing: number;
    noise: number;
    total: number;
    weekly: Array<{ week: string; snr: number | null; total: number }>;
    target: number;
    status: string;
  };
  priority_calibration: Array<{
    priority: string;
    do_rate: number | null;
    justified_rate: number | null;
    target: number;
    do_count: number;
    no_count: number;
    hold_count: number;
    total: number;
    calibrated: boolean | null;
  }>;
  category_accuracy: Array<{
    category: string;
    accuracy: number | null;
    approved: number;
    rejected: number;
    held: number;
    total: number;
    trend: Array<{ week: string; accuracy: number | null; total: number }>;
  }>;
  expansion: {
    rate: number | null;
    unique_expanded: number;
    total_expansions: number;
    total_cards: number;
    target: number;
    status: string;
    weekly: Array<{ week: string; rate: number | null; expansions: number }>;
  };
  volume: {
    total_30d: number;
    avg_per_day: number;
    review_rate: number | null;
    reviewed: number;
    daily: Array<{ date: string; count: number }>;
    by_category: Record<string, number>;
  };
  autonomy_readiness: Array<{
    category: string;
    reviews: number;
    accuracy: number;
    reviews_needed: number;
    accuracy_gap: number;
    qualifies: boolean;
    threshold_reviews: number;
    threshold_accuracy: number;
  }>;
}

function MetricsPanel() {
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/brain/metrics")
      .then((r) => r.json())
      .then((d) => { if (d.success) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-sm text-[#94A3B8]">Computing metrics...</div>;
  if (!data) return <div className="text-sm text-[#94A3B8]">Could not load metrics.</div>;

  const snrColor = (v: number | null) =>
    v === null ? "text-[#94A3B8]" : v >= 80 ? "text-emerald-600" : v >= 60 ? "text-amber-500" : "text-red-500";

  return (
    <div className="space-y-6">
      {/* ── Top-line Stats ── */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Signal-to-Noise" value={data.snr.current !== null ? `${data.snr.current}%` : "—"} color={snrColor(data.snr.current)} />
        <StatCard label="Cards / Day (avg)" value={String(data.volume.avg_per_day)} />
        <StatCard label="Review Rate" value={data.volume.review_rate !== null ? `${data.volume.review_rate}%` : "—"} />
        <StatCard label="Expansion Rate" value={data.expansion.rate !== null ? `${data.expansion.rate}%` : "—"} />
      </div>

      {/* ── SNR Trend ── */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="mb-3">
          <h3 className="text-sm font-bold text-[#1e252a]">Signal-to-Noise Ratio — Weekly Trend</h3>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            What % of surfaced cards deserved attention. Target: {">"}80%.
            {data.snr.status === "clean" ? " Feed is clean." : data.snr.status === "noisy" ? " Noise is building." : data.snr.status === "broken" ? " Too much noise." : ""}
          </p>
        </div>
        <div className="space-y-2">
          {data.snr.weekly.map((w, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-[#64748B] w-28 shrink-0">{w.week}</span>
              <div className="flex-1 h-2 bg-[#f0f0f0] rounded-full overflow-hidden">
                {w.snr !== null && (
                  <div
                    className={`h-full rounded-full ${w.snr >= 80 ? "bg-emerald-400" : w.snr >= 60 ? "bg-amber-400" : "bg-red-400"}`}
                    style={{ width: `${w.snr}%` }}
                  />
                )}
              </div>
              <span className={`text-xs font-semibold w-10 text-right ${snrColor(w.snr)}`}>
                {w.snr !== null ? `${w.snr}%` : "—"}
              </span>
              <span className="text-[10px] text-[#94A3B8] w-16 text-right">{w.total} cards</span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-[#f0f0f0] flex gap-4 text-[10px] text-[#94A3B8]">
          <span>{data.snr.worth_seeing} useful</span>
          <span>{data.snr.noise} noise</span>
          <span>{data.snr.should_not_exist} marked &quot;should not exist&quot;</span>
        </div>
      </div>

      {/* ── Priority Calibration ── */}
      {data.priority_calibration.some(p => p.total > 0) && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-[#1e252a]">Priority Calibration</h3>
            <p className="text-xs text-[#94A3B8] mt-0.5">When the brain says critical, is it actually critical? Do-rate and justified-rate by priority.</p>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[#94A3B8] border-b border-[#f0f0f0]">
                <th className="text-left py-2 font-medium">Priority</th>
                <th className="text-right py-2 font-medium">Do</th>
                <th className="text-right py-2 font-medium">Hold</th>
                <th className="text-right py-2 font-medium">No</th>
                <th className="text-right py-2 font-medium">Do Rate</th>
                <th className="text-right py-2 font-medium">Justified</th>
                <th className="text-right py-2 font-medium">Target</th>
                <th className="text-right py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.priority_calibration.map((row) => (
                <tr key={row.priority} className="border-b border-[#f8f8f8]">
                  <td className="py-2 font-medium text-[#1e252a] capitalize">{row.priority}</td>
                  <td className="py-2 text-right text-emerald-600">{row.do_count}</td>
                  <td className="py-2 text-right text-amber-500">{row.hold_count}</td>
                  <td className="py-2 text-right text-red-500">{row.no_count}</td>
                  <td className="py-2 text-right font-semibold">{row.do_rate !== null ? `${row.do_rate}%` : "—"}</td>
                  <td className="py-2 text-right font-semibold">{row.justified_rate !== null ? `${row.justified_rate}%` : "—"}</td>
                  <td className="py-2 text-right text-[#94A3B8]">
                    {row.priority === "low" ? `<${row.target}%` : `>${row.target}%`}
                  </td>
                  <td className="py-2 text-right">
                    {row.total === 0 ? (
                      <span className="text-[#94A3B8]">—</span>
                    ) : row.calibrated ? (
                      <span className="text-emerald-600 font-medium">Calibrated</span>
                    ) : (
                      <span className="text-red-500 font-medium">Off</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Volume Stats ── */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="mb-3">
          <h3 className="text-sm font-bold text-[#1e252a]">Volume — Last 30 Days</h3>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            {data.volume.total_30d} cards total, {data.volume.avg_per_day} avg/day, {data.volume.reviewed} reviewed ({data.volume.review_rate ?? 0}%)
          </p>
        </div>
        {/* Daily volume bars */}
        <div className="flex items-end gap-1 h-16">
          {data.volume.daily.map((d, i) => {
            const maxCount = Math.max(...data.volume.daily.map(x => x.count), 1);
            const heightPct = (d.count / maxCount) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.date}: ${d.count} cards`}>
                <div
                  className="w-full bg-[#289bff] rounded-t"
                  style={{ height: `${Math.max(heightPct, 2)}%`, minHeight: d.count > 0 ? "2px" : "0px" }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-[#94A3B8]">{data.volume.daily[0]?.date.slice(5)}</span>
          <span className="text-[10px] text-[#94A3B8]">{data.volume.daily[data.volume.daily.length - 1]?.date.slice(5)}</span>
        </div>

        {/* By category */}
        {Object.keys(data.volume.by_category).length > 0 && (
          <div className="mt-4 pt-3 border-t border-[#f0f0f0]">
            <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">By Category (30d)</p>
            <div className="grid grid-cols-3 gap-x-4 gap-y-1">
              {Object.entries(data.volume.by_category)
                .sort(([, a], [, b]) => b - a)
                .map(([cat, count]) => (
                  <div key={cat} className="flex justify-between text-xs">
                    <span className="text-[#64748B] truncate">{cat}</span>
                    <span className="text-[#1e252a] font-medium ml-2">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Expansion Rate ── */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="mb-3">
          <h3 className="text-sm font-bold text-[#1e252a]">Card Expansion Rate — Summary Quality Signal</h3>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            How often cards need expanding to be understood. Target: {"<"}25%.
            {data.expansion.status === "good" ? " Summaries are working." : data.expansion.status === "needs_improvement" ? " Summaries may need improvement." : ""}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-[10px] text-[#94A3B8]">Expansion Rate</p>
            <p className={`text-lg font-bold ${data.expansion.rate !== null && data.expansion.rate <= 25 ? "text-emerald-600" : data.expansion.rate !== null ? "text-amber-500" : "text-[#94A3B8]"}`}>
              {data.expansion.rate !== null ? `${data.expansion.rate}%` : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-[#94A3B8]">Cards Expanded</p>
            <p className="text-lg font-bold text-[#1e252a]">{data.expansion.unique_expanded}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#94A3B8]">Total Expansions</p>
            <p className="text-lg font-bold text-[#1e252a]">{data.expansion.total_expansions}</p>
          </div>
        </div>
        {/* Weekly trend */}
        <div className="space-y-2">
          {data.expansion.weekly.map((w, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-[#64748B] w-28 shrink-0">{w.week}</span>
              <div className="flex-1 h-2 bg-[#f0f0f0] rounded-full overflow-hidden">
                {w.rate !== null && (
                  <div
                    className={`h-full rounded-full ${w.rate <= 25 ? "bg-emerald-400" : "bg-amber-400"}`}
                    style={{ width: `${Math.min(w.rate, 100)}%` }}
                  />
                )}
              </div>
              <span className="text-xs font-semibold w-10 text-right text-[#1e252a]">
                {w.rate !== null ? `${w.rate}%` : "—"}
              </span>
              <span className="text-[10px] text-[#94A3B8] w-20 text-right">{w.expansions} clicks</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Autonomy Readiness ── */}
      {data.autonomy_readiness.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-[#1e252a]">Autonomy Readiness</h3>
            <p className="text-xs text-[#94A3B8] mt-0.5">Per-category: reviews count, accuracy, distance to autonomy threshold ({data.autonomy_readiness[0]?.threshold_reviews}+ reviews, {data.autonomy_readiness[0]?.threshold_accuracy}%+ accuracy).</p>
          </div>
          <div className="space-y-2">
            {data.autonomy_readiness.map((cat) => (
              <div key={cat.category} className="flex items-center gap-3">
                <span className={`text-xs font-medium w-32 truncate ${cat.qualifies ? "text-emerald-600" : "text-[#64748B]"}`}>
                  {cat.qualifies ? "* " : ""}{cat.category}
                </span>
                <div className="flex-1 h-2 bg-[#f0f0f0] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${cat.qualifies ? "bg-emerald-400" : cat.accuracy >= 80 ? "bg-amber-400" : "bg-[#cbd5e1]"}`}
                    style={{ width: `${cat.accuracy}%` }}
                  />
                </div>
                <span className="text-xs font-semibold w-10 text-right text-[#1e252a]">{cat.accuracy}%</span>
                <span className="text-[10px] text-[#94A3B8] w-28 text-right">
                  {cat.qualifies
                    ? "Autonomous"
                    : cat.reviews_needed > 0
                      ? `${cat.reviews} reviews (need ${cat.reviews_needed} more)`
                      : `${cat.reviews} reviews, need ${cat.accuracy_gap}% more`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Category Accuracy Trends ── */}
      {data.category_accuracy.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="mb-3">
            <h3 className="text-sm font-bold text-[#1e252a]">Category Accuracy — 4-Week Trend</h3>
            <p className="text-xs text-[#94A3B8] mt-0.5">Per-category accuracy over the last 4 weeks.</p>
          </div>
          <div className="space-y-3">
            {data.category_accuracy.filter(c => c.total >= 2).map((cat) => (
              <div key={cat.category}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-[#1e252a]">{cat.category}</span>
                  <span className="text-xs font-semibold text-[#1e252a]">
                    {cat.accuracy !== null ? `${cat.accuracy}%` : "—"} ({cat.total} reviews)
                  </span>
                </div>
                <div className="flex gap-1">
                  {cat.trend.map((w, i) => (
                    <div key={i} className="flex-1 text-center">
                      <div className="h-2 bg-[#f0f0f0] rounded-full overflow-hidden">
                        {w.accuracy !== null && (
                          <div
                            className={`h-full rounded-full ${w.accuracy >= 80 ? "bg-emerald-400" : w.accuracy >= 60 ? "bg-amber-400" : "bg-red-400"}`}
                            style={{ width: `${w.accuracy}%` }}
                          />
                        )}
                      </div>
                      <span className="text-[9px] text-[#94A3B8]">{w.week}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Gophers Panel ──────────────────────────────────────────────────────────

interface GopherConfig {
  id: string;
  name: string;
  icon: string;
  endpoint: string;
  promptId: string | null; // matches PROMPT_REGISTRY id
  cronPath: string;
  schedule: string; // current cron expression description
  scheduleOptions: { label: string; cron: string }[];
}

const GOPHER_CONFIGS: GopherConfig[] = [
  {
    id: "gmail",
    name: "Gmail Gopher",
    icon: "📧",
    endpoint: "/api/agents/gmail-scanner",
    promptId: null, // classifier prompt is in unified-classifier, not editable here
    cronPath: "/api/agents/gmail-scanner",
    schedule: "Daily at 6am EST",
    scheduleOptions: [
      { label: "Every 2 hours", cron: "0 */2 * * *" },
      { label: "Every 4 hours", cron: "0 */4 * * *" },
      { label: "Every 6 hours", cron: "0 */6 * * *" },
      { label: "Daily at 6am EST", cron: "0 11 * * *" },
      { label: "Twice daily (6am, 2pm EST)", cron: "0 11,19 * * *" },
    ],
  },
  {
    id: "daily-briefing",
    name: "Daily Briefing",
    icon: "📊",
    endpoint: "/api/agents/daily-briefing",
    promptId: "daily-briefing",
    cronPath: "/api/agents/daily-briefing",
    schedule: "Daily at 7am EST",
    scheduleOptions: [
      { label: "Daily at 6am EST", cron: "0 11 * * *" },
      { label: "Daily at 7am EST", cron: "0 12 * * *" },
      { label: "Daily at 8am EST", cron: "0 13 * * *" },
      { label: "Daily at 9am EST", cron: "0 14 * * *" },
      { label: "Twice daily (7am, 4pm EST)", cron: "0 12,21 * * *" },
    ],
  },
  {
    id: "weekly-synthesis",
    name: "Weekly Synthesis",
    icon: "🧠",
    endpoint: "/api/agents/synthesis",
    promptId: "weekly-synthesis",
    cronPath: "/api/agents/synthesis",
    schedule: "Sundays at 3am EST",
    scheduleOptions: [
      { label: "Sundays at 3am EST", cron: "0 8 * * 0" },
      { label: "Mondays at 6am EST", cron: "0 11 * * 1" },
      { label: "Fridays at 5pm EST", cron: "0 22 * * 5" },
      { label: "Twice weekly (Mon + Fri)", cron: "0 11 * * 1,5" },
    ],
  },
  {
    id: "monthly-report",
    name: "Monthly Report",
    icon: "📋",
    endpoint: "/api/agents/monthly-report",
    promptId: "monthly-report",
    cronPath: "/api/agents/monthly-report",
    schedule: "1st of month at 8am EST",
    scheduleOptions: [
      { label: "1st of month at 8am EST", cron: "0 13 1 * *" },
      { label: "1st of month at 6am EST", cron: "0 11 1 * *" },
      { label: "15th of month at 8am EST", cron: "0 13 15 * *" },
      { label: "1st and 15th at 8am EST", cron: "0 13 1,15 * *" },
    ],
  },
  {
    id: "web-intelligence",
    name: "Web Intelligence",
    icon: "🌐",
    endpoint: "/api/agents/web-intelligence",
    promptId: null,
    cronPath: "/api/agents/web-intelligence",
    schedule: "Daily at 9am EST",
    scheduleOptions: [
      { label: "Daily at 9am EST", cron: "0 14 * * *" },
      { label: "Daily at 6am EST", cron: "0 11 * * *" },
      { label: "Twice daily (6am, 2pm EST)", cron: "0 11,19 * * *" },
      { label: "Every 6 hours", cron: "0 */6 * * *" },
    ],
  },
  {
    id: "feed-resurface",
    name: "Feed Resurface",
    icon: "🔄",
    endpoint: "/api/feed/resurface",
    promptId: null,
    cronPath: "/api/feed/resurface",
    schedule: "Every 4 hours",
    scheduleOptions: [
      { label: "Every 2 hours", cron: "0 */2 * * *" },
      { label: "Every 4 hours", cron: "0 */4 * * *" },
      { label: "Every 6 hours", cron: "0 */6 * * *" },
      { label: "Every 12 hours", cron: "0 */12 * * *" },
    ],
  },
  {
    id: "autonomy",
    name: "Autonomy Engine",
    icon: "🤖",
    endpoint: "/api/brain/autonomy",
    promptId: null,
    cronPath: "/api/brain/autonomy",
    schedule: "Daily at 8am EST",
    scheduleOptions: [
      { label: "Daily at 8am EST", cron: "0 13 * * *" },
      { label: "Daily at 6am EST", cron: "0 11 * * *" },
      { label: "Twice daily", cron: "0 11,23 * * *" },
    ],
  },
];

interface PromptData {
  id: string;
  name: string;
  description: string;
  agent: string;
  default_text: string;
  override_text: string | null;
  is_overridden: boolean;
}

function GophersPanel() {
  const [prompts, setPrompts] = useState<PromptData[]>([]);
  const [expandedGopher, setExpandedGopher] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null);
  const [promptText, setPromptText] = useState("");
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [scheduleNote, setScheduleNote] = useState<string | null>(null);

  // Load prompts
  useEffect(() => {
    fetch("/api/engine/prompts")
      .then((r) => r.json())
      .then((d) => { if (d.success) setPrompts(d.prompts); })
      .catch(() => {});
  }, []);

  // Run gopher now
  async function runNow(gopher: GopherConfig) {
    setRunning(gopher.id);
    setRunResult(null);
    try {
      const res = await fetch(gopher.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gopher.id === "gmail" ? { scanHours: 8, rescan: true } : {}),
      });
      const data = await res.json();
      setRunResult({
        id: gopher.id,
        success: res.ok,
        message: res.ok ? (data.title || data.message || "Completed successfully") : (data.error || "Failed"),
      });
    } catch {
      setRunResult({ id: gopher.id, success: false, message: "Network error" });
    } finally {
      setRunning(null);
    }
  }

  // Save prompt override
  async function savePrompt(promptId: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/engine/prompts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptId, text: promptText }),
      });
      const data = await res.json();
      if (data.success) {
        // Update local state
        setPrompts((prev) =>
          prev.map((p) =>
            p.id === promptId
              ? { ...p, override_text: promptText || null, is_overridden: !!promptText }
              : p
          )
        );
        setEditingPrompt(null);
      }
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  // Revert to default
  async function revertPrompt(promptId: string) {
    setSaving(true);
    try {
      await fetch("/api/engine/prompts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptId, text: "" }),
      });
      setPrompts((prev) =>
        prev.map((p) =>
          p.id === promptId ? { ...p, override_text: null, is_overridden: false } : p
        )
      );
      setEditingPrompt(null);
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="text-sm font-bold text-[#1e252a] mb-1">Gopher Schedule & Prompts</h3>
        <p className="text-xs text-[#6e7b80] mb-4">
          Run any gopher on demand, adjust frequency, or edit the prompt that shapes its output.
          Schedule changes require a Vercel redeploy to take effect.
        </p>
      </div>

      {GOPHER_CONFIGS.map((g) => {
        const prompt = g.promptId ? prompts.find((p) => p.id === g.promptId) : null;
        const isExpanded = expandedGopher === g.id;
        const isRunning = running === g.id;
        const result = runResult?.id === g.id ? runResult : null;

        return (
          <div key={g.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Header row */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <span className="text-xl">{g.icon}</span>
                <div>
                  <h4 className="text-sm font-semibold text-[#1e252a]">{g.name}</h4>
                  <p className="text-[10px] text-[#94A3B8]">{g.schedule}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => runNow(g)}
                  disabled={isRunning}
                  className="px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-colors bg-[#ecfaff] text-[#1e252a] border border-[#b9e6ff] hover:bg-[#dbeafe] disabled:opacity-50"
                >
                  {isRunning ? "Running..." : "Run Now"}
                </button>
                <button
                  onClick={() => setExpandedGopher(isExpanded ? null : g.id)}
                  className="px-3 py-1.5 text-[11px] font-medium rounded-lg transition-colors text-[#6e7b80] hover:bg-[#f6f5f5]"
                >
                  {isExpanded ? "Close" : "Configure"}
                </button>
              </div>
            </div>

            {/* Run result */}
            {result && (
              <div className={`mx-4 mb-3 px-3 py-2 rounded-lg text-xs ${result.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {result.success ? "✓ " : "✗ "}{result.message}
              </div>
            )}

            {/* Expanded config */}
            {isExpanded && (
              <div className="border-t border-[#f0f0f0] p-4 space-y-4">
                {/* Schedule selector */}
                <div>
                  <label className="text-xs font-semibold text-[#1e252a] block mb-1.5">Frequency</label>
                  <select
                    className="w-full text-xs border border-[#e0e0e0] rounded-lg px-3 py-2 bg-white text-[#1e252a] focus:outline-none focus:border-[#a9d8ff]"
                    defaultValue={g.scheduleOptions.find((o) => o.label === g.schedule)?.cron || g.scheduleOptions[0].cron}
                    onChange={(e) => {
                      const selected = g.scheduleOptions.find((o) => o.cron === e.target.value);
                      if (selected) {
                        setScheduleNote(`To apply "${selected.label}" for ${g.name}, update vercel.json cron for ${g.cronPath} to: "${selected.cron}" and redeploy.`);
                      }
                    }}
                  >
                    {g.scheduleOptions.map((opt) => (
                      <option key={opt.cron} value={opt.cron}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {scheduleNote && scheduleNote.includes(g.name) && (
                    <p className="text-[10px] text-amber-600 mt-1.5 bg-amber-50 px-2 py-1 rounded">
                      {scheduleNote}
                    </p>
                  )}
                </div>

                {/* Prompt editor */}
                {prompt && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-[#1e252a]">
                        System Prompt
                        {prompt.is_overridden && (
                          <span className="ml-2 text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Customised</span>
                        )}
                      </label>
                      <div className="flex gap-2">
                        {editingPrompt === g.promptId ? (
                          <>
                            <button
                              onClick={() => savePrompt(g.promptId!)}
                              disabled={saving}
                              className="text-[10px] font-semibold text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                            >
                              {saving ? "Saving..." : "Save"}
                            </button>
                            <button
                              onClick={() => setEditingPrompt(null)}
                              className="text-[10px] font-medium text-[#94A3B8] hover:text-[#6e7b80]"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setEditingPrompt(g.promptId);
                                setPromptText(prompt.override_text || prompt.default_text);
                              }}
                              className="text-[10px] font-semibold text-[#289bff] hover:text-[#1a7fd4]"
                            >
                              Edit
                            </button>
                            {prompt.is_overridden && (
                              <button
                                onClick={() => revertPrompt(g.promptId!)}
                                disabled={saving}
                                className="text-[10px] font-medium text-red-500 hover:text-red-600 disabled:opacity-50"
                              >
                                Revert to Default
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {editingPrompt === g.promptId ? (
                      <textarea
                        value={promptText}
                        onChange={(e) => setPromptText(e.target.value)}
                        className="w-full h-64 text-xs text-[#1e252a] border border-[#e0e0e0] rounded-lg p-3 bg-[#fafafa] focus:outline-none focus:border-[#a9d8ff] resize-y font-mono leading-relaxed"
                        style={{ fontFamily: "'Geist Mono', monospace" }}
                      />
                    ) : (
                      <pre className="w-full max-h-48 overflow-y-auto text-[10px] text-[#64748B] bg-[#fafafa] rounded-lg p-3 whitespace-pre-wrap font-mono leading-relaxed border border-[#f0f0f0]">
                        {(prompt.override_text || prompt.default_text).slice(0, 500)}
                        {(prompt.override_text || prompt.default_text).length > 500 && "..."}
                      </pre>
                    )}
                    <p className="text-[10px] text-[#94A3B8] mt-1">{prompt.description}</p>
                  </div>
                )}

                {!prompt && g.promptId === null && (
                  <p className="text-[10px] text-[#94A3B8]">
                    This gopher uses a built-in prompt that cannot be edited from here.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HealthPanel() {
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/engine/health")
      .then((r) => r.json())
      .then((d) => { if (d.success) setHealth(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-sm text-[#94A3B8]">Checking systems...</div>;
  if (!health) return <div className="text-sm text-[#94A3B8]">Could not load health data.</div>;

  const checks = health.checks as Record<string, Record<string, unknown>>;
  const status = health.status as string;

  return (
    <div className="space-y-4">
      {/* Overall status */}
      <div className={`rounded-xl shadow-sm p-5 ${status === "healthy" ? "bg-emerald-50 border border-emerald-100" : "bg-amber-50 border border-amber-100"}`}>
        <h3 className={`text-sm font-bold mb-1 ${status === "healthy" ? "text-emerald-800" : "text-amber-800"}`}>
          {status === "healthy" ? "🟢 All Systems Operational" : "🟡 Some Systems Degraded"}
        </h3>
        <p className="text-xs text-[#6e7b80]">
          Checked in {String(health.duration_ms)}ms
        </p>
      </div>

      {/* Database */}
      {checks.database && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-[#1e252a] mb-2">Database</h3>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${(checks.database.status as string) === "ok" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
              {checks.database.status as string}
            </span>
            <span className="text-xs text-[#6e7b80]">
              {checks.database.feed_cards_total as number} feed cards total
            </span>
          </div>
        </div>
      )}

      {/* Automated Systems */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h3 className="text-sm font-bold text-[#1e252a] mb-3">Automated Systems</h3>
        <div className="space-y-3">
          {checks.gmail_scanner && (
            <HealthRow
              name="Gmail Scanner"
              status={(checks.gmail_scanner.status as string) || "unknown"}
              detail={checks.gmail_scanner.last_card_at
                ? `Last card: ${new Date(checks.gmail_scanner.last_card_at as string).toLocaleString()} (${checks.gmail_scanner.age_hours}h ago)`
                : "No cards yet"}
            />
          )}
          {checks.daily_briefing && (
            <HealthRow
              name="Daily Briefing"
              status={(checks.daily_briefing.status as string) || "unknown"}
              detail={checks.daily_briefing.last_briefing_at
                ? `"${(checks.daily_briefing.title as string || "").slice(0, 50)}" — ${checks.daily_briefing.age_hours}h ago`
                : "No briefings yet"}
            />
          )}
          {checks.synthesis && (
            <HealthRow
              name="Weekly Synthesis"
              status={(checks.synthesis.status as string) || "unknown"}
              detail={checks.synthesis.last_reflection_at
                ? `"${(checks.synthesis.title as string || "").slice(0, 50)}"`
                : "No reflections yet"}
            />
          )}
        </div>
      </div>

      {/* Feed Status */}
      {checks.feed_status && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-[#1e252a] mb-3">Feed Status</h3>
          <div className="grid grid-cols-4 gap-3">
            {Object.entries(checks.feed_status as Record<string, number>).map(([key, val]) => (
              <div key={key} className="text-center">
                <div className="text-lg font-bold text-[#1e252a]">{val}</div>
                <div className="text-[10px] text-[#94A3B8] capitalize">{key}</div>
              </div>
            ))}
          </div>
          {checks.pending_resurface !== undefined && (
            <p className="text-xs text-[#6e7b80] mt-3">
              {String(checks.pending_resurface)} cards pending resurface
            </p>
          )}
        </div>
      )}

      {/* Env vars */}
      {checks.env && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-[#1e252a] mb-3">Environment</h3>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(checks.env as Record<string, boolean>).map(([key, available]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${available ? "bg-emerald-400" : "bg-[#cbd5e1]"}`} />
                <span className="text-xs text-[#64748B] capitalize">{key}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HealthRow({ name, status, detail }: { name: string; status: string; detail: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${status === "ok" ? "bg-emerald-400" : status === "no_data" ? "bg-[#cbd5e1]" : "bg-red-400"}`} />
      <div>
        <p className="text-xs font-medium text-[#1e252a]">{name}</p>
        <p className="text-[10px] text-[#6e7b80]">{detail}</p>
      </div>
    </div>
  );
}

function IntegrationCard({ name, status, description, icon }: { name: string; status: string; description: string; icon: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 flex items-start gap-4">
      <span className="text-2xl">{icon}</span>
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-[#1e252a]">{name}</h3>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
            status === "connected" ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-[#94A3B8]"
          }`}>
            {status}
          </span>
        </div>
        <p className="text-xs text-[#6e7b80] mt-0.5">{description}</p>
      </div>
    </div>
  );
}
