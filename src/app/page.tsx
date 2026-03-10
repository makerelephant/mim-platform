"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  TrendingUp, Handshake, FileText, Loader2, ChevronDown, ChevronUp,
  Download, X, Copy, Check, DollarSign, ShoppingCart, BarChart3, Link2,
  Percent, Smartphone, ImageIcon, Activity, Clock, Newspaper,
  Bookmark, Send, Calendar, ChevronRight,
  AlertCircle, Users,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { labels } from "@/config/labels";
import { timeAgo } from "@/lib/timeAgo";
import { loadTaxonomy, getSignalKeywords, tagsMatchKeywords } from "@/lib/taxonomy-loader";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ActivityEntry {
  id: string;
  agent_name: string;
  action_type: string;
  summary: string;
  created_at: string;
  entity_type?: string;
  entity_id?: string;
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

interface OrgActivityRow {
  org_id: string;
  org_name: string;
  org_status: string | null;
  summary: string;
  date: string;
  suggested_action: string | null;
  suggested_deadline: string | null;
}

type PeriodType = "day" | "week" | "month";

// ─── Simple Markdown Renderer ───────────────────────────────────────────────

function renderMarkdown(md: string): string {
  let cleaned = md.replace(/^# .+\n*/m, "");
  let html = cleaned
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-gray-800 mt-5 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-gray-900 mt-6 mb-3 pb-1 border-b">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-gray-900 mb-4">$1</h1>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-sm text-gray-700 py-0.5">$1</li>')
    .replace(/^---$/gm, '<hr class="my-4 border-gray-200" />')
    .replace(/^(?!<[hlu]|<li|<hr)(.+)$/gm, '<p class="text-sm text-gray-700 mb-2">$1</p>');
  html = html.replace(/(<li[^>]*>[^]*?<\/li>\n?)+/g, (match) => {
    return `<ul class="list-disc space-y-0.5 mb-3">${match}</ul>`;
  });
  return html;
}

function renderMarkdownForPrint(md: string): string {
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

function exportToPDF(report: Report) {
  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${report.title}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1a1a1a; max-width: 800px; margin: 0 auto; }
        .report-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #e5e7eb; }
        .report-header img { height: 60px; width: 60px; border-radius: 12px; }
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
        <img src="${window.location.origin}/mim-icon.png" alt="MiM" />
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
    setTimeout(() => printWindow.print(), 300);
  }
}

// ─── Ticker Messages (placeholder data) ────────────────────────────────────

const TICKER_MESSAGES = [
  "New investor lead: Acme Capital added to pipeline",
  "Gmail scanner processed 12 new messages",
  "Weekly report generated for Mar 1 - Mar 7",
  "3 new community organizations onboarded this week",
  "Partnership pipeline: 2 deals moved to In Closing",
  "Task scanner found 5 new action items from emails",
];

// ─── News Article Type (from knowledge_base) ─────────────────────────────

interface NewsArticle {
  id: string;
  title: string;
  summary: string | null;
  source_ref: string | null;
  created_at: string;
  taxonomy_categories: string[] | null;
  metadata: {
    rss_source?: string;
    rss_categories?: string[];
    published_date?: string;
    thumbnail_url?: string | null;
    sentiment?: "positive" | "negative" | "neutral" | "mixed";
    sentiment_score?: number;
    relevance_to_mim?: "high" | "medium" | "low";
    relevance_reasoning?: string;
  } | null;
}

// ─── Dashboard Component ────────────────────────────────────────────────────

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<Report[]>([]);
  const [partnerActivity, setPartnerActivity] = useState<OrgActivityRow[]>([]);
  const [investorActivity, setInvestorActivity] = useState<OrgActivityRow[]>([]);
  const [customerActivity, setCustomerActivity] = useState<OrgActivityRow[]>([]);

  // Report generation state
  const [generating, setGenerating] = useState(false);
  const [periodType, setPeriodType] = useState<PeriodType>("week");
  const [genError, setGenError] = useState<string | null>(null);

  // Report viewer state
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAllReports, setShowAllReports] = useState(false);

  // Sentiment state
  const [sentimentCategory, setSentimentCategory] = useState("all");
  const [sentimentArticles, setSentimentArticles] = useState<NewsArticle[]>([]);
  const [sentimentLastUpdated, setSentimentLastUpdated] = useState<string | null>(null);

  // Scanner loading states
  const [scanningPartners, setScanningPartners] = useState(false);
  const [scanningInvestors, setScanningInvestors] = useState(false);
  const [scanningCustomers, setScanningCustomers] = useState(false);
  const [scanningSentiment, setScanningSentiment] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Ticker
  const [tickerOffset, setTickerOffset] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTickerOffset((prev) => prev - 1);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const loadData = useCallback(async () => {
    // Fetch reports
    const { data: reportsData } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    // Fetch orgs + types + statuses in parallel (multi-schema)
    const [orgResult, typeResult, pipelineResult, partnerProfileResult, relResult] = await Promise.all([
      supabase.schema('core').from("organizations").select("id, name").order("updated_at", { ascending: false }).limit(500),
      supabase.schema('core').from("org_types").select("org_id, type"),
      supabase.schema('crm').from("pipeline").select("org_id, status"),
      supabase.schema('intel').from("partner_profile").select("org_id, partner_status"),
      supabase.schema('core').from("relationships").select("contact_id, org_id"),
    ]);

    // Build type map
    const typeMap = new Map<string, string[]>();
    for (const t of typeResult.data || []) {
      if (!typeMap.has(t.org_id)) typeMap.set(t.org_id, []);
      typeMap.get(t.org_id)!.push(t.type);
    }

    // Build status maps
    const pipelineMap = new Map<string, string>();
    for (const p of pipelineResult.data || []) if (p.status) pipelineMap.set(p.org_id, p.status);

    const partnerStatusMap = new Map<string, string>();
    for (const p of partnerProfileResult.data || []) if (p.partner_status) partnerStatusMap.set(p.org_id, p.partner_status);

    // Build org maps by type
    type OrgEntry = { id: string; name: string; pipeline_status: string | null; partner_status: string | null };
    const investorMap = new Map<string, OrgEntry>();
    const partnerMap = new Map<string, OrgEntry>();
    const customerMap = new Map<string, OrgEntry>();
    const allOrgMap = new Map<string, OrgEntry>();

    for (const o of orgResult.data ?? []) {
      const entry: OrgEntry = {
        id: o.id,
        name: o.name,
        pipeline_status: pipelineMap.get(o.id) || null,
        partner_status: partnerStatusMap.get(o.id) || null,
      };
      allOrgMap.set(o.id, entry);
      const types = typeMap.get(o.id) || [];
      if (types.includes("Investor")) investorMap.set(o.id, entry);
      if (types.includes("Partner")) partnerMap.set(o.id, entry);
      if (types.includes("Customer")) customerMap.set(o.id, entry);
    }

    // Build contact_id → org_ids lookup (core.relationships)
    const contactToOrgIds = new Map<string, string[]>();
    for (const link of relResult.data ?? []) {
      const list = contactToOrgIds.get(link.contact_id) || [];
      list.push(link.org_id);
      contactToOrgIds.set(link.contact_id, list);
    }

    // Get recent activity entries (brain schema)
    const { data: recentActivity } = await supabase
      .schema('brain').from("activity")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);

    const investorRows: OrgActivityRow[] = [];
    const partnerRows: OrgActivityRow[] = [];
    const customerRows: OrgActivityRow[] = [];
    const seenKeys = new Set<string>(); // Prevent duplicates

    // Load taxonomy from database (falls back to defaults if table missing)
    const taxonomy = await loadTaxonomy(supabase);
    const INVESTOR_TAGS = getSignalKeywords(taxonomy, "investors");
    const PARTNER_TAGS = getSignalKeywords(taxonomy, "partners");
    const CUSTOMER_TAGS = getSignalKeywords(taxonomy, "customers");

    // Only these action_types represent actual business activity worth routing
    const ACTIVITY_ACTION_TYPES = new Set(["email_scanned", "slack_scanned"]);

    for (const a of recentActivity ?? []) {
      // Only process actual correspondence activity — skip scan logs,
      // knowledge ingestions, report generations, news scans, etc.
      if (!ACTIVITY_ACTION_TYPES.has(a.action_type)) continue;

      // Allow entries with null entity_id to reach tag-based routing
      // (e.g. emails from unknown senders with investor/partner/customer tags)
      const rawTags_early: string[] = Array.isArray(a.raw_data?.tags) ? a.raw_data.tags : [];
      if (!a.entity_id && rawTags_early.length === 0) continue;

      // Collect all org IDs this activity might belong to:
      // 1. Direct org match (entity_id IS an org id)
      // 2. Contact → org resolution (entity_id is a contact linked to orgs)
      const candidateOrgIds: string[] = [];

      if (allOrgMap.has(a.entity_id)) {
        candidateOrgIds.push(a.entity_id);
      }

      // If entity_type is "contacts", resolve to linked orgs
      if (a.entity_type === "contacts" || !allOrgMap.has(a.entity_id)) {
        const linkedOrgs = contactToOrgIds.get(a.entity_id) || [];
        for (const orgId of linkedOrgs) {
          if (!candidateOrgIds.includes(orgId)) {
            candidateOrgIds.push(orgId);
          }
        }
      }

      // Extract tags from raw_data for intent-based routing
      const rawTags: string[] = Array.isArray(a.raw_data?.tags) ? a.raw_data.tags : [];

      if (candidateOrgIds.length > 0) {
        // ── Org-type routing: activity linked to known orgs ──
        for (const orgId of candidateOrgIds) {
          const dedupKey = `${a.id}:${orgId}`;
          if (seenKeys.has(dedupKey)) continue;
          seenKeys.add(dedupKey);

          if (investorMap.has(orgId)) {
            const org = investorMap.get(orgId)!;
            investorRows.push({
              org_id: org.id,
              org_name: org.name,
              org_status: org.pipeline_status,
              summary: a.summary,
              date: a.created_at,
              suggested_action: null,
              suggested_deadline: null,
            });
          }
          if (partnerMap.has(orgId)) {
            const org = partnerMap.get(orgId)!;
            partnerRows.push({
              org_id: org.id,
              org_name: org.name,
              org_status: org.partner_status,
              summary: a.summary,
              date: a.created_at,
              suggested_action: null,
              suggested_deadline: null,
            });
          }
          if (customerMap.has(orgId)) {
            const org = customerMap.get(orgId)!;
            customerRows.push({
              org_id: org.id,
              org_name: org.name,
              org_status: org.partner_status,
              summary: a.summary,
              date: a.created_at,
              suggested_action: null,
              suggested_deadline: null,
            });
          }
        }
      } else if (rawTags.length > 0) {
        // ── Tag-based intent routing: no org match, use NLP tags ──
        // This catches emails from unknown contacts about fundraising, partnerships, etc.
        const dedupKey = `${a.id}:tag-intent`;
        if (seenKeys.has(dedupKey)) continue;
        seenKeys.add(dedupKey);

        const fromLabel = a.raw_data?.from || a.summary?.split(" ").slice(0, 3).join(" ") || "Unknown";
        const intentRow: OrgActivityRow = {
          org_id: a.entity_id,
          org_name: `📨 ${fromLabel}`,
          org_status: null,
          summary: a.summary,
          date: a.created_at,
          suggested_action: null,
          suggested_deadline: null,
        };

        if (tagsMatchKeywords(rawTags, INVESTOR_TAGS)) {
          investorRows.push(intentRow);
        } else if (tagsMatchKeywords(rawTags, PARTNER_TAGS)) {
          partnerRows.push(intentRow);
        } else if (tagsMatchKeywords(rawTags, CUSTOMER_TAGS)) {
          customerRows.push(intentRow);
        }
      }
    }

    setReports(reportsData ?? []);
    setInvestorActivity(investorRows.slice(0, 10));
    setPartnerActivity(partnerRows.slice(0, 10));
    setCustomerActivity(customerRows.slice(0, 10));
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Load News Articles from knowledge_base ──────────────────────────────

  const loadNewsArticles = useCallback(async () => {
    const { data } = await supabase
      .from("knowledge_base")
      .select("id, title, summary, source_ref, created_at, taxonomy_categories, metadata")
      .eq("source_type", "news")
      .eq("processed", true)
      .order("created_at", { ascending: false })
      .limit(10);

    if (data && data.length > 0) {
      setSentimentArticles(data as NewsArticle[]);
      setSentimentLastUpdated(data[0].created_at);
    }
  }, []);

  useEffect(() => { loadNewsArticles(); }, [loadNewsArticles]);

  // ─── Generate Report ────────────────────────────────────────────────────

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
        await loadData();
        if (data.reportId) setExpandedReportId(data.reportId);
      }
    } catch (err) {
      setGenError(String(err));
    } finally {
      setGenerating(false);
    }
  };

  // ─── Run Partnership Scanner ──────────────────────────────────────────

  const runPartnershipScanner = async () => {
    setScanningPartners(true);
    setScanError(null);
    try {
      const res = await fetch("/api/agents/partnership-scanner", { method: "POST" });
      const data = await res.json();
      if (data.success && data.activity) {
        setPartnerActivity(data.activity);
      } else if (!data.success) {
        setScanError(`Partners: ${data.error || "Scanner failed"}`);
      }
      await loadData();
    } catch (err) {
      setScanError(`Partners: ${err instanceof Error ? err.message : "Network error"}`);
    } finally {
      setScanningPartners(false);
    }
  };

  // ─── Run Fundraising Scanner ──────────────────────────────────────────

  const runFundraisingScanner = async () => {
    setScanningInvestors(true);
    setScanError(null);
    try {
      const res = await fetch("/api/agents/fundraising-scanner", { method: "POST" });
      const data = await res.json();
      if (data.success && data.activity) {
        setInvestorActivity(data.activity);
      } else if (!data.success) {
        setScanError(`Investors: ${data.error || "Scanner failed"}`);
      }
      await loadData();
    } catch (err) {
      setScanError(`Investors: ${err instanceof Error ? err.message : "Network error"}`);
    } finally {
      setScanningInvestors(false);
    }
  };

  // ─── Run Customer Scanner ───────────────────────────────────────────

  const runCustomerScanner = async () => {
    setScanningCustomers(true);
    setScanError(null);
    try {
      const res = await fetch("/api/agents/customer-scanner", { method: "POST" });
      const data = await res.json();
      if (data.success && data.activity) {
        setCustomerActivity(data.activity);
      } else if (!data.success) {
        setScanError(`Customers: ${data.error || "Scanner failed"}`);
      }
      await loadData();
    } catch (err) {
      setScanError(`Customers: ${err instanceof Error ? err.message : "Network error"}`);
    } finally {
      setScanningCustomers(false);
    }
  };

  // ─── Run Sentiment Scanner ────────────────────────────────────────────

  const runSentimentScanner = async () => {
    setScanningSentiment(true);
    setScanError(null);
    try {
      const res = await fetch("/api/agents/sentiment-scanner", { method: "POST" });
      const data = await res.json();
      if (!data.success) {
        setScanError(`Sentiment: ${data.error || "Scanner failed"}`);
      }
      await loadNewsArticles();
    } catch (err) {
      setScanError(`Sentiment: ${err instanceof Error ? err.message : "Network error"}`);
    } finally {
      setScanningSentiment(false);
    }
  };

  // ─── Period Labels ──────────────────────────────────────────────────────

  const periodLabels: Record<PeriodType, string> = {
    day: "Day",
    week: "Week",
    month: "Month",
  };

  // ─── Sentiment filter ──────────────────────────────────────────────────

  const filteredArticles = sentimentCategory === "all"
    ? sentimentArticles
    : sentimentArticles.filter((a) => {
        const cats = a.metadata?.rss_categories || a.taxonomy_categories || [];
        return cats.some((c) => c.toLowerCase() === sentimentCategory.toLowerCase());
      });

  const allNewsCategories = new Set<string>();
  for (const a of sentimentArticles) {
    for (const c of a.metadata?.rss_categories || a.taxonomy_categories || []) {
      allNewsCategories.add(c);
    }
  }
  const sentimentCategories = ["all", ...Array.from(allNewsCategories)];

  // ─── Reports pagination ─────────────────────────────────────────────────

  const visibleReports = showAllReports ? reports : reports.slice(0, 6);

  if (loading) {
    return (
      <div>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-10 bg-gray-200 rounded" />
          <div className="grid grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{labels.dashboard}</h1>
          <p className="text-gray-500 text-sm mt-1">Welcome back, Mark</p>
        </div>
      </div>

      {/* ── Ticker Row ── */}
      <div className="mb-6 bg-gray-900 text-white rounded-lg overflow-hidden">
        <div className="flex items-center h-10">
          <div className="shrink-0 bg-blue-600 px-3 h-full flex items-center gap-1.5 z-10">
            <AlertCircle className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold tracking-wide uppercase">Live</span>
          </div>
          <div className="flex-1 overflow-hidden relative">
            <div
              className="flex items-center gap-12 whitespace-nowrap absolute"
              style={{ transform: `translateX(${tickerOffset}px)` }}
            >
              {[...TICKER_MESSAGES, ...TICKER_MESSAGES].map((msg, i) => (
                <span key={i} className="text-sm text-gray-300">
                  <span className="text-blue-400 mr-2">&bull;</span>
                  {msg}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Row 1 ── */}
      <div className="grid grid-cols-5 gap-4 mb-4">
        {[
          { label: "Revenue", value: "—", icon: DollarSign, color: "text-green-600", sub: "TBD" },
          { label: "Items Sold", value: "—", icon: ShoppingCart, color: "text-blue-600", sub: "TBD" },
          { label: "Avg Order Value", value: "—", icon: BarChart3, color: "text-purple-600", sub: "TBD" },
          { label: "Drop Links Created", value: "—", icon: Link2, color: "text-indigo-600", sub: "TBD" },
          { label: "Convert-to-Buy", value: "—", icon: Percent, color: "text-orange-600", sub: "% visits / % purchased" },
        ].map(({ label, value, icon: Icon, color, sub }) => (
          <Card key={label} className="relative overflow-hidden">
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500">{label}</span>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <div className="text-2xl font-bold text-gray-900">{value}</div>
              <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── KPI Row 2 ── */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-500">New Creators</span>
              <Smartphone className="h-4 w-4 text-teal-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">—</div>
            <p className="text-[10px] text-gray-400 mt-0.5">Cumulative App Downloads &middot; TBD</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-500">Latest Products Created</span>
              <ImageIcon className="h-4 w-4 text-pink-600" />
            </div>
            <div className="flex items-center gap-2 mt-1">
              {/* Placeholder image carousel */}
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center">
                  <ImageIcon className="h-5 w-5 text-gray-300" />
                </div>
              ))}
              <span className="text-xs text-gray-400 ml-1">TBD</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scanner error banner */}
      {scanError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <p className="text-xs text-red-700">Scanner error: {scanError}</p>
          <button onClick={() => setScanError(null)} className="text-red-400 hover:text-red-600 ml-2">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* ── Partnership, Fundraising & Customer Activity (3-col) ── */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Partnership Activity */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Handshake className="h-4 w-4 text-emerald-600" />
              Partners
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={runPartnershipScanner}
                disabled={scanningPartners}
              >
                {scanningPartners ? (
                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Updating...</>
                ) : (
                  <><Activity className="h-3 w-3 mr-1" /> Update</>
                )}
              </Button>
              <Link href="/channel-partners">
                <Button variant="ghost" size="sm" className="text-xs h-7 px-1">
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {partnerActivity.length === 0 ? (
              <div className="text-center py-6 text-gray-400">
                <Handshake className="h-6 w-6 mx-auto mb-2" />
                <p className="text-sm">No recent partner activity</p>
              </div>
            ) : (
              <div className="space-y-0">
                {partnerActivity.slice(0, 6).map((row, idx) => (
                  <div key={idx} className="flex items-start gap-2 py-2 border-b last:border-0 text-xs">
                    <div className="flex-1 min-w-0">
                      <Link href={`/soccer-orgs/${row.org_id}`} className="font-medium text-gray-900 hover:text-blue-600 truncate block">
                        {row.org_name}
                      </Link>
                      <span className="text-gray-500 line-clamp-2 text-[11px]" title={row.summary}>
                        {row.summary}
                      </span>
                    </div>
                    <span className="text-gray-400 shrink-0 text-[10px] mt-0.5">{timeAgo(row.date)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fundraising Activity */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Investors
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={runFundraisingScanner}
                disabled={scanningInvestors}
              >
                {scanningInvestors ? (
                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Updating...</>
                ) : (
                  <><Activity className="h-3 w-3 mr-1" /> Update</>
                )}
              </Button>
              <Link href="/fundraising-activity">
                <Button variant="ghost" size="sm" className="text-xs h-7 px-1">
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {investorActivity.length === 0 ? (
              <div className="text-center py-6 text-gray-400">
                <TrendingUp className="h-6 w-6 mx-auto mb-2" />
                <p className="text-sm">No recent investor activity</p>
              </div>
            ) : (
              <div className="space-y-0">
                {investorActivity.slice(0, 6).map((row, idx) => (
                  <div key={idx} className="flex items-start gap-2 py-2 border-b last:border-0 text-xs">
                    <div className="flex-1 min-w-0">
                      <Link href={`/investors/${row.org_id}`} className="font-medium text-gray-900 hover:text-blue-600 truncate block">
                        {row.org_name}
                      </Link>
                      <span className="text-gray-500 line-clamp-2 text-[11px]" title={row.summary}>
                        {row.summary}
                      </span>
                    </div>
                    <span className="text-gray-400 shrink-0 text-[10px] mt-0.5">{timeAgo(row.date)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer Activity */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              Customers
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={runCustomerScanner}
                disabled={scanningCustomers}
              >
                {scanningCustomers ? (
                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Updating...</>
                ) : (
                  <><Activity className="h-3 w-3 mr-1" /> Update</>
                )}
              </Button>
              <Link href="/all-orgs">
                <Button variant="ghost" size="sm" className="text-xs h-7 px-1">
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {customerActivity.length === 0 ? (
              <div className="text-center py-6 text-gray-400">
                <Users className="h-6 w-6 mx-auto mb-2" />
                <p className="text-sm">No recent customer activity</p>
              </div>
            ) : (
              <div className="space-y-0">
                {customerActivity.slice(0, 6).map((row, idx) => (
                  <div key={idx} className="flex items-start gap-2 py-2 border-b last:border-0 text-xs">
                    <div className="flex-1 min-w-0">
                      <Link href={`/soccer-orgs/${row.org_id}`} className="font-medium text-gray-900 hover:text-blue-600 truncate block">
                        {row.org_name}
                      </Link>
                      <span className="text-gray-500 line-clamp-2 text-[11px]" title={row.summary}>
                        {row.summary}
                      </span>
                    </div>
                    <span className="text-gray-400 shrink-0 text-[10px] mt-0.5">{timeAgo(row.date)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Periodic Updates (50%) + Sentiment (50%) side by side ── */}
      <div className="grid grid-cols-2 gap-4">

        {/* ── Periodic Updates ── */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{labels.periodicUpdates}</CardTitle>
              <div className="flex items-center gap-2">
                <select
                  value={periodType}
                  onChange={(e) => setPeriodType(e.target.value as PeriodType)}
                  className="border rounded px-1.5 py-1 text-xs text-gray-700 bg-white"
                >
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                </select>
                <Button
                  onClick={runReport}
                  disabled={generating}
                  size="sm"
                  className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {generating ? (
                    <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Generating...</>
                  ) : (
                    <><FileText className="h-3 w-3 mr-1" /> Run Report</>
                  )}
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" disabled>
                <Calendar className="h-3 w-3 mr-1" /> Set Schedule
              </Button>
              <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" disabled>
                <Send className="h-3 w-3 mr-1" /> Send Report
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Generation error */}
            {genError && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                <p className="text-xs text-red-700">{genError}</p>
                <button onClick={() => setGenError(null)} className="text-red-400 hover:text-red-600">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {reports.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <FileText className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">No reports yet. Click &ldquo;Run Report&rdquo; to generate your first update.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {visibleReports.map((report) => {
                  const isExpanded = expandedReportId === report.id;
                  return (
                    <div key={report.id} className="border rounded-lg overflow-hidden">
                      {/* Report row header */}
                      <button
                        onClick={() => setExpandedReportId(isExpanded ? null : report.id)}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-900 truncate">{report.title}</p>
                            <p className="text-[10px] text-gray-400">
                              {report.period_type} &middot; {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(report.markdown_content);
                              setCopiedId(report.id);
                              setTimeout(() => setCopiedId(null), 2000);
                            }}
                            className="h-6 text-[10px] px-1.5 text-gray-500 hover:text-gray-700"
                          >
                            {copiedId === report.id ? (
                              <><Check className="h-3 w-3 mr-0.5 text-green-500" /> Copied</>
                            ) : (
                              <><Copy className="h-3 w-3 mr-0.5" /> MD</>
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); exportToPDF(report); }}
                            className="h-6 text-[10px] px-1.5 text-gray-500 hover:text-gray-700"
                          >
                            <Download className="h-3 w-3 mr-0.5" /> PDF
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); }}
                            className="h-6 text-[10px] px-1.5 text-gray-500 hover:text-gray-700"
                            disabled
                          >
                            <Send className="h-3 w-3 mr-0.5" /> Publish
                          </Button>
                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                          )}
                        </div>
                      </button>

                      {/* Expanded report content */}
                      {isExpanded && (
                        <div className="border-t px-4 py-4 bg-white">
                          <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-gray-200">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/mim-icon.png" alt="MiM" className="h-[48px] w-[48px] rounded-xl" />
                            <div>
                              <h2 className="text-sm font-bold text-gray-900 m-0">{report.title}</h2>
                              <p className="text-xs text-gray-400 m-0">Mark Slater</p>
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

                {/* Load More / Show Less */}
                {reports.length > 6 && (
                  <div className="text-center pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-gray-500"
                      onClick={() => setShowAllReports(!showAllReports)}
                    >
                      {showAllReports ? (
                        <><ChevronUp className="h-3 w-3 mr-1" /> Show Less</>
                      ) : (
                        <><ChevronDown className="h-3 w-3 mr-1" /> Load More ({reports.length - 6} more)</>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Sentiment ── */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Newspaper className="h-4 w-4 text-amber-600" />
                Sentiment
              </CardTitle>
              <div className="flex items-center gap-2">
                <select
                  value={sentimentCategory}
                  onChange={(e) => setSentimentCategory(e.target.value)}
                  className="border rounded px-1.5 py-1 text-xs text-gray-700 bg-white"
                >
                  {sentimentCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat === "all" ? "All Categories" : cat}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={runSentimentScanner}
                  disabled={scanningSentiment}
                >
                  {scanningSentiment ? (
                    <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Updating...</>
                  ) : (
                    <><Activity className="h-3 w-3 mr-1" /> Update</>
                  )}
                </Button>
                <span className="text-[10px] text-gray-400">
                  <Clock className="h-3 w-3 inline mr-0.5" />
                  {sentimentLastUpdated
                    ? `Updated ${timeAgo(sentimentLastUpdated)}`
                    : "Not yet scanned"}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredArticles.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Newspaper className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">
                  {sentimentArticles.length === 0
                    ? "No news articles yet — click Update to scan"
                    : "No articles found for this category"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredArticles.map((article) => {
                  const meta = article.metadata;
                  const sentimentColor: Record<string, string> = {
                    positive: "text-green-600",
                    negative: "text-red-600",
                    neutral: "text-gray-500",
                    mixed: "text-yellow-600",
                  };
                  const sentimentIcon: Record<string, React.ReactNode> = {
                    positive: <TrendingUp className="h-3 w-3" />,
                    negative: <span className="inline-block rotate-180"><TrendingUp className="h-3 w-3" /></span>,
                    neutral: <span className="text-[10px]">—</span>,
                    mixed: <span className="text-[10px]">~</span>,
                  };
                  const relevanceColors: Record<string, string> = {
                    high: "bg-purple-100 text-purple-700",
                    medium: "bg-blue-50 text-blue-600",
                    low: "bg-gray-100 text-gray-500",
                  };

                  return (
                    <div key={article.id} className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
                      <div className="flex gap-3">
                        {/* Thumbnail or fallback */}
                        {meta?.thumbnail_url ? (
                          <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-gray-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={meta.thumbnail_url}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                                (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-50 to-amber-100"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-400"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg></div>';
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
                            <Newspaper className="h-6 w-6 text-amber-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h4 className="text-xs font-semibold text-gray-900 leading-tight truncate">
                                {article.title}
                              </h4>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-[10px] text-gray-500">{meta?.rss_source || "News"}</span>
                                {meta?.sentiment && (
                                  <>
                                    <span className="text-[10px] text-gray-400">&middot;</span>
                                    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${sentimentColor[meta.sentiment] || "text-gray-500"}`}>
                                      {sentimentIcon[meta.sentiment]}
                                      {meta.sentiment}
                                      {meta.sentiment_score !== undefined && (
                                        <span className="text-gray-400 font-normal ml-0.5">
                                          ({(meta.sentiment_score * 100).toFixed(0)}%)
                                        </span>
                                      )}
                                    </span>
                                  </>
                                )}
                                {meta?.relevance_to_mim && (
                                  <Badge variant="outline" className={`text-[9px] h-4 px-1 border-0 ${relevanceColors[meta.relevance_to_mim] || ""}`}>
                                    {meta.relevance_to_mim === "high" ? "⚡ " : ""}{meta.relevance_to_mim}
                                  </Badge>
                                )}
                                {meta?.published_date && (
                                  <span className="text-[10px] text-gray-400">
                                    {timeAgo(meta.published_date)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">
                            {article.summary || "Processing..."}
                          </p>
                          {/* Action buttons */}
                          <div className="flex items-center gap-1 mt-1.5">
                            {article.source_ref && (
                              <a href={article.source_ref} target="_blank" rel="noopener noreferrer">
                                <Button variant="ghost" size="sm" className="h-5 text-[9px] px-1.5 text-gray-400 hover:text-blue-600">
                                  <Link2 className="h-3 w-3 mr-0.5" /> Read
                                </Button>
                              </a>
                            )}
                            <Link href="/knowledge">
                              <Button variant="ghost" size="sm" className="h-5 text-[9px] px-1.5 text-gray-400 hover:text-purple-600">
                                <Bookmark className="h-3 w-3 mr-0.5" /> Knowledge
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="text-center pt-3 border-t mt-3">
              <Link href="/knowledge">
                <Button variant="ghost" size="sm" className="text-xs text-gray-500">
                  View All in Knowledge Base <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
