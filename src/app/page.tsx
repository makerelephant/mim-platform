"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Users, TrendingUp, Building2, Handshake, CheckSquare, Plus,
  Activity, FileText, Loader2, ChevronDown, ChevronUp, Download, X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { labels } from "@/config/labels";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Stats {
  contacts: number;
  investors: number;
  communities: number;
  partners: number;
  openTasks: number;
}

interface ActivityEntry {
  id: string;
  agent_name: string;
  action_type: string;
  summary: string;
  created_at: string;
}

interface Report {
  id: string;
  title: string;
  period_type: string;
  period_start: string;
  period_end: string;
  markdown_content: string;
  created_at: string;
}

type PeriodType = "day" | "week" | "month";

// ─── Simple Markdown Renderer ───────────────────────────────────────────────

function renderMarkdown(md: string): string {
  // Strip the top-level title (# ...) since we render it in the header
  let cleaned = md.replace(/^# .+\n*/m, "");
  let html = cleaned
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-gray-800 mt-5 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-gray-900 mt-6 mb-3 pb-1 border-b">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-gray-900 mb-4">$1</h1>')
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Bullet lists
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-sm text-gray-700 py-0.5">$1</li>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="my-4 border-gray-200" />')
    // Paragraphs (lines that aren't already HTML)
    .replace(/^(?!<[hlu]|<li|<hr)(.+)$/gm, '<p class="text-sm text-gray-700 mb-2">$1</p>');

  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li[^>]*>[^]*?<\/li>\n?)+/g, (match) => {
    return `<ul class="list-disc space-y-0.5 mb-3">${match}</ul>`;
  });

  return html;
}

// ─── PDF Export ─────────────────────────────────────────────────────────────

function exportToPDF(report: Report) {
  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${report.title}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1a1a1a; max-width: 800px; margin: 0 auto; }
        .report-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #e5e7eb; }
        .report-header img { height: 40px; width: auto; }
        .report-header .header-text h1 { font-size: 20px; font-weight: 700; margin: 0 0 4px 0; color: #111; }
        .report-header .header-text .author { font-size: 13px; color: #9ca3af; margin: 0; }
        h2 { font-size: 17px; font-weight: 700; margin-top: 28px; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #e5e7eb; color: #111; }
        h3 { font-size: 14px; font-weight: 600; margin-top: 20px; margin-bottom: 8px; color: #333; }
        p { font-size: 13px; line-height: 1.6; color: #374151; margin-bottom: 8px; }
        ul { margin: 0 0 16px 20px; padding: 0; }
        li { font-size: 13px; line-height: 1.6; color: #374151; margin-bottom: 4px; }
        hr { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
        strong { font-weight: 600; }
        em { font-style: italic; }
        .meta { font-size: 11px; color: #9ca3af; margin-bottom: 20px; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="report-header">
        <img src="/mim-logo.png" alt="MiM" />
        <div class="header-text">
          <h1>${report.title}</h1>
          <p class="author">Mark Slater</p>
        </div>
      </div>
      <div class="meta">Generated ${new Date(report.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</div>
      ${renderMarkdownForPrint(report.markdown_content)}
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(printContent);
    printWindow.document.close();
    // Small delay to let styles render
    setTimeout(() => printWindow.print(), 300);
  }
}

function renderMarkdownForPrint(md: string): string {
  // Strip the top-level title since it's in the header
  const cleaned = md.replace(/^# .+\n*/m, "");
  return cleaned
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^---$/gm, '<hr />')
    .replace(/^(?!<[hlu]|<li|<hr)(.+)$/gm, '<p>$1</p>')
    .replace(/(<li>[^]*?<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);
}

// ─── Dashboard Component ────────────────────────────────────────────────────

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ contacts: 0, investors: 0, communities: 0, partners: 0, openTasks: 0 });
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  // Report generation state
  const [generating, setGenerating] = useState(false);
  const [periodType, setPeriodType] = useState<PeriodType>("week");
  const [genError, setGenError] = useState<string | null>(null);

  // Report viewer state
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [
      { count: contacts },
      { count: investors },
      { count: communities },
      { count: partners },
      { count: openTasks },
      { data: activityData },
      { data: reportsData },
    ] = await Promise.all([
      supabase.from("contacts").select("*", { count: "exact", head: true }),
      supabase.from("investors").select("*", { count: "exact", head: true }),
      supabase.from("soccer_orgs").select("*", { count: "exact", head: true }),
      supabase.from("soccer_orgs").select("*", { count: "exact", head: true }).not("partner_status", "is", null),
      supabase.from("tasks").select("*", { count: "exact", head: true }).in("status", ["todo", "in_progress"]),
      supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(10),
    ]);

    setStats({
      contacts: contacts ?? 0,
      investors: investors ?? 0,
      communities: communities ?? 0,
      partners: partners ?? 0,
      openTasks: openTasks ?? 0,
    });
    setActivities(activityData ?? []);
    setReports(reportsData ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Generate Report ──────────────────────────────────────────────────────

  const runReport = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/agents/weekly-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodType }),
      });
      const data = await res.json();
      if (!data.success) {
        setGenError(data.error || "Report generation failed");
      } else {
        // Reload to show the new report
        await loadData();
        // Auto-expand the new report
        if (data.reportId) setExpandedReportId(data.reportId);
      }
    } catch (err) {
      setGenError(String(err));
    } finally {
      setGenerating(false);
    }
  };

  // ─── Cards ────────────────────────────────────────────────────────────────

  const cards = [
    { label: "Contacts", value: stats.contacts, icon: Users, href: "/contacts", color: "text-blue-600" },
    { label: "Investors", value: stats.investors, icon: TrendingUp, href: "/investors", color: "text-green-600" },
    { label: "Communities", value: stats.communities, icon: Building2, href: "/soccer-orgs", color: "text-orange-600" },
    { label: "Channel Partners", value: stats.partners, icon: Handshake, href: "/channel-partners", color: "text-emerald-600" },
    { label: "Open Tasks", value: stats.openTasks, icon: CheckSquare, href: "/tasks", color: "text-purple-600" },
  ];

  // ─── Period Label ─────────────────────────────────────────────────────────

  const periodLabels: Record<PeriodType, string> = {
    day: "Previous Day",
    week: "Previous Week",
    month: "Previous Month",
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{labels.dashboard}</h1>
          <p className="text-gray-500 text-sm mt-1">Welcome back, Mark</p>
        </div>
        <div className="flex gap-2">
          {/* Period selector + Run Weekly Report button */}
          <select
            value={periodType}
            onChange={(e) => setPeriodType(e.target.value as PeriodType)}
            className="border rounded-md px-2 py-1.5 text-sm text-gray-700 bg-white"
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
          <Button
            onClick={runReport}
            disabled={generating}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Generating...</>
            ) : (
              <><FileText className="h-4 w-4 mr-1" /> {labels.runWeeklyReport}</>
            )}
          </Button>
          <Link href="/contacts?new=true">
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" /> Add Contact
            </Button>
          </Link>
          <Link href="/tasks?new=true">
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" /> Add Task
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Generation error ── */}
      {genError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <p className="text-sm text-red-700">{genError}</p>
          <button onClick={() => setGenError(null)} className="text-red-400 hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {cards.map(({ label, value, icon: Icon, href, color }) => (
          <Link key={label} href={href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">{label}</CardTitle>
                <Icon className={`h-5 w-5 ${color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{value.toLocaleString()}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* ── Periodic Updates Section ── */}
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{labels.periodicUpdates}</CardTitle>
          {reports.length > 0 && (
            <span className="text-xs text-gray-400">{reports.length} report{reports.length !== 1 ? "s" : ""}</span>
          )}
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <FileText className="h-8 w-8 mx-auto mb-2" />
              <p>No reports yet. Click &ldquo;{labels.runWeeklyReport}&rdquo; to generate your first update.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reports.map((report) => {
                const isExpanded = expandedReportId === report.id;
                return (
                  <div key={report.id} className="border rounded-lg overflow-hidden">
                    {/* Report row header */}
                    <button
                      onClick={() => setExpandedReportId(isExpanded ? null : report.id)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-4 w-4 text-indigo-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{report.title}</p>
                          <p className="text-xs text-gray-400">
                            {report.period_type} &middot; {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); exportToPDF(report); }}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <Download className="h-4 w-4 mr-1" /> Save PDF
                        </Button>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                    </button>

                    {/* Expanded report content */}
                    {isExpanded && (
                      <div className="border-t px-6 py-6 bg-white">
                        {/* Report header with logo */}
                        <div className="flex items-center gap-4 mb-6 pb-4 border-b-2 border-gray-200">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src="/mim-logo.png" alt="MiM" className="h-10 w-auto" />
                          <div>
                            <h2 className="text-lg font-bold text-gray-900 m-0">{report.title}</h2>
                            <p className="text-sm text-gray-400 m-0">Mark Slater</p>
                          </div>
                        </div>
                        <div
                          className="prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(report.markdown_content) }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Recent Activity ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Activity</CardTitle>
          <Link href="/activity">
            <Button variant="ghost" size="sm">View All</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Activity className="h-8 w-8 mx-auto mb-2" />
              <p>No activity yet. Agents will log actions here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((a) => (
                <div key={a.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">{a.summary}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {a.agent_name} &middot; {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
