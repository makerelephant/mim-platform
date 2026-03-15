"use client";

import { useState, useEffect } from "react";

/* eslint-disable @next/next/no-img-element */

// ─── Types ──────────────────────────────────────────────────────────────────

interface HarnessFile {
  name: string;
  slug: string;
  content: string;
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

interface AccuracyData {
  success: boolean;
  total_acted: number;
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
  const [activeTab, setActiveTab] = useState<"map" | "accuracy" | "integrations" | "autonomy">("map");
  const [harness, setHarness] = useState<HarnessFile[]>([]);
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
          { key: "autonomy" as const, label: "Autonomy" },
          { key: "integrations" as const, label: "Integrations" },
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
            <div className="w-48 shrink-0 space-y-1">
              <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">
                Harness Classifiers
              </p>
              {harness.length === 0 ? (
                <p className="text-xs text-[#94A3B8]">No harness files loaded</p>
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
        ) : activeTab === "autonomy" ? (
          /* ── Autonomy ── */
          <AutonomyPanel />
        ) : (
          /* ── Integrations ── */
          <div className="grid grid-cols-2 gap-4">
            <IntegrationCard name="Gmail" status="connected" description="Scanning every day at 6am EST" icon="📧" />
            <IntegrationCard name="Slack" status="planned" description="Not yet connected" icon="💬" />
            <IntegrationCard name="Google Drive" status="planned" description="Not yet connected" icon="📁" />
            <IntegrationCard name="Stripe" status="planned" description="Not yet connected" icon="💳" />
            <IntegrationCard name="Calendar" status="planned" description="Not yet connected" icon="📅" />
            <IntegrationCard name="Notion" status="planned" description="Not yet connected" icon="📝" />
          </div>
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
