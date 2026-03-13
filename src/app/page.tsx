"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import {
  Paperclip,
  Mic,
  ArrowUpCircle,
  Loader2,
  ArrowLeft,
  ArrowRight,
  X,
  BookOpen,
  RefreshCw,
  CheckCircle2,
  Circle,
  Trash2,
  Maximize2,
  ThumbsUp,
  ThumbsDown,
  CalendarPlus,
  Cable,
  MoreHorizontal,
  ExternalLink,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ─── Types ──────────────────────────────────────────────────────────────────

interface KpiCard {
  label: string;
  value: string;
  subtitle: string;
  icon: string;
  valueColor: string;
}

interface ChatMessage {
  role: "user" | "brain";
  content: string;
  sources?: string[];
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
}

interface ImportantConversation {
  id: string;
  source: string;
  priority: string;
  title: string;
  body: string;
  suggestedAction: string | null;
  entityId: string | null;
  createdAt: Date;
  dismissed?: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function MyBrainPage() {
  const [lastVisit, setLastVisit] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [kpis, setKpis] = useState<KpiCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAsking, setIsAsking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Conversation state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null);
  const [view, setView] = useState<"main" | "chat">("main");

  // Important conversations state
  const [importantConvos, setImportantConvos] = useState<
    ImportantConversation[]
  >([]);
  const [importantLoading, setImportantLoading] = useState(false);
  const [importantLastUpdated, setImportantLastUpdated] = useState<
    string | null
  >(null);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  // ── Load dashboard data ──
  useEffect(() => {
    async function loadDashboard() {
      try {
        const { data: lastActivity } = await supabase
          .schema("brain")
          .from("activity")
          .select("created_at")
          .eq("actor", "ceo")
          .order("created_at", { ascending: false })
          .limit(1);

        if (lastActivity && lastActivity.length > 0) {
          setLastVisit(
            formatDistanceToNow(new Date(lastActivity[0].created_at), {
              addSuffix: true,
            })
          );
        } else {
          setLastVisit("23 hours ago");
        }

        const { data: priorQueries } = await supabase
          .schema("brain")
          .from("activity")
          .select("id, metadata, created_at")
          .eq("action", "brain_query")
          .order("created_at", { ascending: false })
          .limit(10);

        if (priorQueries && priorQueries.length > 0) {
          const convos: Conversation[] = priorQueries.map(
            (q: {
              id: string;
              metadata: { question?: string };
              created_at: string;
            }) => ({
              id: q.id,
              title:
                (q.metadata?.question || "Untitled conversation").slice(0, 45) +
                ((q.metadata?.question || "").length > 45 ? "..." : ""),
              messages: [],
              createdAt: new Date(q.created_at),
            })
          );
          setConversations(convos);
        }

        setKpis([
          {
            label: "REVENUE",
            value: "$",
            subtitle: "Cumulative since {date}",
            icon: "revenue",
            valueColor: "text-emerald-600",
          },
          {
            label: "ITEMS SOLD",
            value: "...",
            subtitle: "individual products",
            icon: "items",
            valueColor: "text-[#98bfd5]",
          },
          {
            label: "AOV",
            value: "$",
            subtitle: "Average Order Value",
            icon: "aov",
            valueColor: "text-emerald-600",
          },
          {
            label: "LINKS CREATED",
            value: "...",
            subtitle: "Drop Links Created",
            icon: "links",
            valueColor: "text-[#98bfd5]",
          },
          {
            label: "CONVERT TO BUY",
            value: "%",
            subtitle: "% who visit and buy",
            icon: "convert",
            valueColor: "text-[#98bfd5]",
          },
        ]);

        await loadImportantConversations();
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load important conversations ──
  const loadImportantConversations = useCallback(async () => {
    setImportantLoading(true);
    try {
      const items: ImportantConversation[] = [];

      const { data: ceoItems } = await supabase
        .schema("brain")
        .from("ceo_context")
        .select(
          "id, source, context_type, title, content, priority, entity_id, metadata, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(15);

      if (ceoItems && ceoItems.length > 0) {
        for (const item of ceoItems) {
          items.push({
            id: item.id,
            source: item.source || "scanner",
            priority: item.priority || "medium",
            title: item.title || "Untitled",
            body: (item.content || "").slice(0, 200),
            suggestedAction:
              (item.metadata as Record<string, string>)?.suggested_action ||
              null,
            entityId: item.entity_id,
            createdAt: new Date(item.created_at),
          });
        }
      }

      if (items.length < 5) {
        const { data: corr } = await supabase
          .schema("brain")
          .from("correspondence")
          .select(
            "id, channel, direction, subject, body, from_address, entity_id, sent_at, created_at"
          )
          .order("sent_at", { ascending: false })
          .limit(15);

        if (corr && corr.length > 0) {
          for (const c of corr) {
            if (items.some((i) => i.title === c.subject)) continue;
            items.push({
              id: c.id,
              source: c.channel || "email",
              priority: "medium",
              title:
                c.subject || `Message from ${c.from_address || "unknown"}`,
              body: (c.body || "").slice(0, 200),
              suggestedAction: null,
              entityId: c.entity_id,
              createdAt: new Date(c.sent_at || c.created_at),
            });
          }
        }
      }

      items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setImportantConvos(items.slice(0, 20));
      setImportantLastUpdated(
        formatDistanceToNow(new Date(), { addSuffix: true })
      );
    } catch (err) {
      console.error("Important conversations load error:", err);
    } finally {
      setImportantLoading(false);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages]);

  // ── Submit question ──
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const question = chatInput.trim();
      if (!question || isAsking) return;

      const userMsg: ChatMessage = {
        role: "user",
        content: question,
        timestamp: new Date(),
      };

      let convo = activeConversation;
      if (!convo) {
        convo = {
          id: crypto.randomUUID(),
          title:
            question.slice(0, 45) + (question.length > 45 ? "..." : ""),
          messages: [userMsg],
          createdAt: new Date(),
        };
        setConversations((prev) => [convo!, ...prev]);
      } else {
        convo = { ...convo, messages: [...convo.messages, userMsg] };
      }

      setActiveConversation(convo);
      setView("chat");
      setChatInput("");
      setIsAsking(true);

      try {
        const res = await fetch("/api/brain/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
        });

        const data = await res.json();
        const brainMsg: ChatMessage = {
          role: "brain",
          content: data.success
            ? data.answer
            : `Sorry, I encountered an error: ${data.error}`,
          sources: data.sources,
          timestamp: new Date(),
        };

        setActiveConversation((prev) =>
          prev ? { ...prev, messages: [...prev.messages, brainMsg] } : null
        );
      } catch {
        const brainMsg: ChatMessage = {
          role: "brain",
          content:
            "Sorry, I couldn't connect to the brain. Please try again.",
          timestamp: new Date(),
        };
        setActiveConversation((prev) =>
          prev ? { ...prev, messages: [...prev.messages, brainMsg] } : null
        );
      } finally {
        setIsAsking(false);
      }
    },
    [chatInput, isAsking, activeConversation]
  );

  function handleBack() {
    setView("main");
    setActiveConversation(null);
  }

  function handleSelectConversation(convo: Conversation) {
    setActiveConversation(convo);
    setView("chat");
  }

  // ── Helpers ──
  function sourceLabel(source: string) {
    const s = source.toLowerCase();
    if (s.includes("slack")) return "Slack";
    if (s.includes("gmail") || s.includes("email")) return "Gmail";
    return source;
  }

  function priorityDot(priority: string) {
    switch (priority) {
      case "critical":
        return { label: "Critical", color: "bg-red-500" };
      case "high":
        return { label: "High", color: "bg-red-500" };
      case "medium":
        return { label: "Medium", color: "bg-amber-500" };
      case "low":
        return { label: "Low", color: "bg-slate-400" };
      default:
        return { label: priority, color: "bg-slate-400" };
    }
  }

  function toggleFilter(filter: string) {
    setActiveFilters((prev) =>
      prev.includes(filter)
        ? prev.filter((f) => f !== filter)
        : [...prev, filter]
    );
  }

  const filteredImportant =
    activeFilters.length > 0
      ? importantConvos.filter((c) => {
          const s = c.source.toLowerCase();
          if (activeFilters.includes("slack") && s.includes("slack"))
            return true;
          if (
            activeFilters.includes("gmail") &&
            (s.includes("gmail") || s.includes("email"))
          )
            return true;
          return false;
        })
      : importantConvos;

  // ── KPI icon ──
  function renderKpiIcon(icon: string) {
    const map: Record<string, string> = {
      revenue: "/icons/revenue.png",
      items: "/icons/items-sold.png",
      aov: "/icons/aov.png",
      links: "/icons/links-created.png",
      convert: "/icons/convert-to-buy.png",
    };
    const src = map[icon];
    if (!src) return null;
    return <Image src={src} alt="" width={40} height={40} />;
  }

  // ── Format brain response ──
  function formatBrainResponse(text: string) {
    return text.split("\n").map((line, i) => {
      const boldFormatted = line.replace(
        /\*\*(.*?)\*\*/g,
        '<strong class="font-semibold text-slate-800">$1</strong>'
      );
      if (line.startsWith("## ")) {
        return (
          <h3
            key={i}
            className="text-sm font-semibold text-slate-800 mt-3 mb-1"
          >
            {line.slice(3)}
          </h3>
        );
      }
      if (line.startsWith("- ") || line.startsWith("* ")) {
        return (
          <div
            key={i}
            className="flex gap-2 text-sm text-slate-600 ml-2 mb-0.5"
          >
            <span className="text-slate-400 shrink-0">&#8226;</span>
            <span
              dangerouslySetInnerHTML={{ __html: boldFormatted.slice(2) }}
            />
          </div>
        );
      }
      if (line.trim() === "") return <div key={i} className="h-2" />;
      return (
        <p
          key={i}
          className="text-sm text-slate-600 mb-0.5"
          dangerouslySetInnerHTML={{ __html: boldFormatted }}
        />
      );
    });
  }

  // ─── RENDER ──────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-[#f3f3f3] -m-6 p-4 sm:p-6">
      {/* ── Header ── */}
      <div className="bg-white -mx-6 -mt-6 px-4 sm:px-6 py-4 sm:py-5 mb-4 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-3">
          <div>
            <h1 className="text-2xl sm:text-4xl font-semibold text-[var(--mim-text-primary)] tracking-tight">
              My Brain
            </h1>
            <p className="text-sm text-[var(--mim-text-secondary)] tracking-tight">
              Hello Mark, Welcome Back.
            </p>
          </div>
          {lastVisit && (
            <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-normal bg-[#f3f8ff] border border-[#c5ddff] text-[var(--mim-system)] mb-1">
              Last Visit: {lastVisit}
            </span>
          )}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-6 mb-4 shrink-0 px-3">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="bg-white rounded-lg border border-gray-100 p-3.5 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.2)] flex flex-col justify-between h-[115px]"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-[1.2px] text-gray-400 uppercase">
                  {kpi.label}
                </span>
                <div className="shrink-0">{renderKpiIcon(kpi.icon)}</div>
              </div>
              <div>
                <p
                  className={`text-3xl font-bold ${kpi.valueColor}`}
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {kpi.value}
                </p>
                <p className="text-xs text-gray-500 tracking-tight">
                  {kpi.subtitle}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Main content area ── */}
      <div className="flex-1 min-h-0 flex flex-col">
        {view === "main" ? (
          <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
            {/* ── Chat Prompt Area (left) ── */}
            <div className="w-full lg:w-[524px] lg:shrink-0">
              <div className="bg-white rounded-lg shadow-[0px_0px_4px_0px_rgba(0,0,0,0.12)] p-4 sm:p-6 h-auto lg:h-[340px] flex flex-col">
                <div className="bg-[rgba(238,242,245,0.6)] rounded-lg shadow-[0px_0px_4px_0px_rgba(0,0,0,0.12)] flex-1 flex flex-col items-center justify-between p-3">
                  {/* Top: Logo + title */}
                  <div className="flex flex-col items-center gap-1.5 pt-2">
                    <Image
                      src="/icons/mimbrain-logo.png"
                      alt=""
                      width={37}
                      height={26}
                    />
                    <h2 className="text-[26px] font-medium text-[var(--mim-text-primary)] tracking-tight text-center">
                      How can i help?
                    </h2>
                  </div>

                  {/* Input area */}
                  <form onSubmit={handleSubmit} className="w-full max-w-[455px]">
                    <div className="bg-white rounded-[18px] border border-[var(--mim-info-border)]/50 shadow-[0px_0.5px_6px_0px_rgba(0,0,0,0.12)] px-3.5 pt-2.5 pb-2.5 h-[89px] flex flex-col justify-between">
                      <div className="flex items-start pl-3">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder="Ask The MiMBrain Anything about the business."
                          disabled={isAsking}
                          className="w-full text-sm text-slate-700 placeholder:text-[var(--mim-text-placeholder)] bg-transparent outline-none"
                        />
                      </div>
                      <div className="flex items-center justify-end gap-6">
                        <button
                          type="button"
                          className="text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          <CalendarPlus className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          <Paperclip className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          <Mic className="w-4 h-4" />
                        </button>
                        <button
                          type="submit"
                          disabled={isAsking || !chatInput.trim()}
                          className="text-slate-400 hover:text-blue-500 transition-colors disabled:opacity-40"
                        >
                          {isAsking ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <ArrowUpCircle className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* Bottom action buttons */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <button
                      type="button"
                      className="flex items-center gap-1.5 px-3 py-1.5 h-8 rounded-full bg-[var(--mim-info-bg)] border border-[var(--mim-suggestion-border)] text-xs font-semibold text-[var(--mim-text-primary)] tracking-tight mix-blend-multiply"
                    >
                      <Image
                        src="/icons/gophers.png"
                        alt=""
                        width={20}
                        height={23}
                        className="shrink-0"
                      />
                      Launch a Gopher
                    </button>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 px-3 py-1.5 h-8 rounded-full bg-[var(--mim-info-bg)] border border-[var(--mim-suggestion-border)] text-xs font-semibold text-[var(--mim-text-primary)] tracking-tight mix-blend-multiply"
                    >
                      <Image
                        src="/icons/gophers.png"
                        alt=""
                        width={20}
                        height={23}
                        className="shrink-0"
                      />
                      Schedule a Meeting
                    </button>
                    <button
                      onClick={() => setView("chat")}
                      className="flex items-center gap-1.5 text-xs font-medium text-[var(--mim-primary-hover)]"
                    >
                      See Old Convos
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Important Conversations Panel (right) ── */}
            <div className="flex-1 bg-white rounded-lg shadow-[0px_0px_4px_0px_rgba(0,0,0,0.12)] flex flex-col min-h-0 min-w-0">
              {/* Header */}
              <div className="shrink-0 p-3 rounded-t-lg shadow-[0px_1px_6px_0px_rgba(0,0,0,0.12)]">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <h3 className="text-sm sm:text-base font-semibold text-[var(--mim-text-primary)] tracking-tight">
                      Important Conversations
                    </h3>
                    {importantLastUpdated && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-normal bg-[#f3f8ff] text-[var(--mim-system)]">
                        Last updated: {importantLastUpdated}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={loadImportantConversations}
                    disabled={importantLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--mim-system)] text-xs font-semibold text-white"
                  >
                    Update
                    <Cable
                      className={`w-3.5 h-3.5 ${importantLoading ? "animate-spin" : ""}`}
                    />
                  </button>
                </div>

                {/* Filter pills */}
                <div className="flex items-center gap-3">
                  {activeFilters.includes("slack") && (
                    <button
                      onClick={() => toggleFilter("slack")}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#fdf2fa] border border-[#fcceee] text-[#c11574] mix-blend-multiply"
                    >
                      <X className="w-3 h-3" />
                      Slack
                    </button>
                  )}
                  {activeFilters.includes("gmail") && (
                    <button
                      onClick={() => toggleFilter("gmail")}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#f0f9ff] border border-[#b9e6fe] text-[#026aa2] mix-blend-multiply"
                    >
                      <X className="w-3 h-3" />
                      Gmail
                    </button>
                  )}
                  {activeFilters.length === 0 && (
                    <>
                      <button
                        onClick={() => toggleFilter("slack")}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#fdf2fa] border border-[#fcceee] text-[#c11574] mix-blend-multiply"
                      >
                        Filter 1
                      </button>
                      <button
                        onClick={() => toggleFilter("gmail")}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#f0f9ff] border border-[#b9e6fe] text-[#026aa2] mix-blend-multiply"
                      >
                        Filter 2
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Scrollable conversation list */}
              <div className="flex-1 overflow-y-auto px-3 py-3">
                {importantLoading && filteredImportant.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                  </div>
                ) : filteredImportant.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-sm text-slate-400">
                      No important conversations yet.
                    </p>
                    <p className="text-xs text-slate-300 mt-1">
                      Run the Gmail or Slack scanner to populate this feed.
                    </p>
                  </div>
                ) : (
                  filteredImportant.map((item, idx) => {
                    const pri = priorityDot(item.priority);
                    const isResolved =
                      item.priority === "low" || item.dismissed;
                    return (
                      <div key={item.id}>
                        <div className="py-1.5">
                          {/* Card header bar */}
                          <div className="bg-[rgba(238,242,245,0.6)] shadow-[0px_0px_4px_0px_rgba(0,0,0,0.15)] flex flex-wrap items-center justify-between gap-1 px-1.5 py-1 min-h-9">
                            <div className="flex items-center gap-1.5">
                              {isResolved ? (
                                <CheckCircle2 className="w-[22px] h-[22px] text-emerald-500" />
                              ) : (
                                <Circle className="w-6 h-6 text-slate-300" />
                              )}
                              <div className="bg-white rounded px-3 h-6 flex items-center gap-1.5">
                                <Image
                                  src="/icons/gophers.png"
                                  alt=""
                                  width={17}
                                  height={20}
                                />
                                <span className="text-xs text-[var(--mim-text-secondary)]">
                                  {formatDistanceToNow(item.createdAt, {
                                    addSuffix: false,
                                  })}{" "}
                                  Ago from{" "}
                                  <span className="font-bold text-[var(--mim-text-primary)]">
                                    {sourceLabel(item.source)}
                                  </span>
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span
                                  className={`w-2 h-2 rounded-full ${pri.color}`}
                                />
                                <span className="text-xs font-medium text-[#344054]">
                                  {pri.label}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-6 pr-1">
                              <button className="text-slate-400 hover:text-slate-600">
                                <Trash2 className="w-5 h-5" />
                              </button>
                              <button className="text-slate-400 hover:text-slate-600">
                                <Maximize2 className="w-5 h-5" />
                              </button>
                            </div>
                          </div>

                          {/* Title + body */}
                          <div className="px-1.5 mt-2">
                            <h4 className="text-sm font-medium text-[#111928] leading-6">
                              {item.title}
                            </h4>
                            <p className="text-xs text-black leading-4 line-clamp-2">
                              {item.body}
                            </p>
                          </div>

                          {/* Suggested action box */}
                          {item.suggestedAction && (
                            <div className="mt-2 mx-1.5 bg-[rgba(236,250,255,0.2)] border border-[var(--mim-info-border)] rounded-lg px-1.5 py-2">
                              <p className="text-xs text-[var(--mim-core-blue)] leading-4">
                                <span className="font-bold">
                                  Suggested Action
                                </span>
                                :{" "}
                                <span className="font-normal">
                                  {item.suggestedAction}
                                </span>
                              </p>
                              <div className="flex items-center gap-1.5 mt-3">
                                <button className="inline-flex items-center gap-1 px-3 h-5 rounded-md bg-white border border-gray-200/60 text-xs font-medium text-[var(--mim-text-primary)]">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Add To Tasks
                                </button>
                                <button className="inline-flex items-center gap-1 px-3 h-5 rounded-md bg-white border border-gray-200/60 text-xs font-medium text-[var(--mim-text-primary)]">
                                  <span className="text-[var(--mim-system-border)]">+</span>
                                  MiM Brain
                                </button>
                                <div className="flex items-center gap-1 ml-auto">
                                  <button className="text-slate-400 hover:text-slate-600">
                                    <ThumbsUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button className="text-slate-400 hover:text-slate-600">
                                    <ThumbsDown className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* No suggested action: show default action bar */}
                          {!item.suggestedAction && (
                            <div className="flex items-center gap-1.5 mt-2 px-1.5">
                              <button className="inline-flex items-center gap-1 px-3 h-5 rounded-md bg-white border border-gray-200/60 text-xs font-medium text-[var(--mim-text-primary)]">
                                <CheckCircle2 className="w-3 h-3" />
                                Add To Tasks
                              </button>
                              <button className="inline-flex items-center gap-1 px-3 h-5 rounded-md bg-white border border-gray-200/60 text-xs font-medium text-[var(--mim-text-primary)]">
                                <span className="text-[var(--mim-system-border)]">+</span>
                                MiM Brain
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Divider */}
                        {idx < filteredImportant.length - 1 && (
                          <div className="flex items-center justify-center py-2">
                            <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                {/* Load More */}
                {filteredImportant.length >= 5 && (
                  <div className="text-center py-3">
                    <button className="text-xs font-medium text-[#9ba9ba] hover:text-slate-600 tracking-tight">
                      Load More
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ═══ CHAT VIEW ═══ */
          <div className="bg-white rounded-xl shadow-[0px_0px_6px_0px_rgba(0,0,0,0.12)] flex-1 min-h-0 flex flex-col">
            {/* ── Top bar: Back + Share ── */}
            <div className="shrink-0 flex items-center justify-between px-5 pt-4 pb-3">
              <button
                onClick={handleBack}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-slate-200 bg-white text-sm font-medium text-[var(--mim-text-primary)] hover:bg-slate-50 transition-colors shadow-sm"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
              <button className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--mim-core-blue)] hover:text-blue-600 transition-colors">
                Share this Conversation
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* ── Body: Prior Conversations sidebar + Chat thread ── */}
            <div className="flex flex-1 min-h-0">
              {/* Prior Conversations Panel */}
              <div className="hidden md:flex w-[287px] shrink-0 bg-[#f3f2ed] flex-col min-h-0 rounded-bl-xl">
                <div className="shrink-0 bg-white px-4 py-3 flex items-center justify-between shadow-[0px_1px_3px_0px_rgba(0,0,0,0.06)]">
                  <h3 className="text-sm font-semibold text-[var(--mim-text-primary)]">
                    Prior Conversations
                  </h3>
                  <button className="text-slate-400 hover:text-slate-600">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
                  {conversations.length === 0 ? (
                    <p className="text-xs text-slate-400 italic px-2 py-2">
                      No conversations yet.
                    </p>
                  ) : (
                    conversations.map((convo) => (
                      <button
                        key={convo.id}
                        onClick={() => handleSelectConversation(convo)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors truncate ${
                          activeConversation?.id === convo.id
                            ? "bg-white text-[var(--mim-text-primary)] font-medium shadow-sm"
                            : "text-[var(--mim-text-secondary)] hover:bg-white/60"
                        }`}
                      >
                        {convo.title}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Chat thread + input */}
              <div className="flex-1 flex flex-col min-h-0">
                {/* Messages area */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                  {activeConversation?.messages.map((msg, i) => (
                    <div key={i}>
                      {msg.role === "user" ? (
                        <div className="bg-[#f1eff3] rounded-xl px-4 py-3 max-w-[85%]">
                          <p className="text-sm text-[var(--mim-text-primary)]">{msg.content}</p>
                        </div>
                      ) : (
                        <div className="pl-2 max-w-[90%]">
                          <div>{formatBrainResponse(msg.content)}</div>
                          {msg.sources && msg.sources.length > 0 && (
                            <div className="mt-2">
                              <p className="text-[10px] text-slate-400">
                                Sources: {msg.sources.join(", ")}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {isAsking && (
                    <div className="flex items-center gap-2 pl-2">
                      <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                      <span className="text-sm text-slate-500">Thinking...</span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Bottom chat input */}
                <div className="shrink-0 px-5 pb-4">
                  <form onSubmit={handleSubmit}>
                    <div className="bg-white rounded-[18px] border border-[var(--mim-info-border)]/50 shadow-[0px_0.5px_6px_0px_rgba(0,0,0,0.12)] px-3.5 pt-2.5 pb-2.5 h-[89px] flex flex-col justify-between">
                      <div className="flex items-start pl-3">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder="Ask Anything about the business."
                          disabled={isAsking}
                          className="w-full text-sm text-slate-700 placeholder:text-[var(--mim-text-placeholder)] bg-transparent outline-none"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="flex items-center gap-1.5 px-3 py-1.5 h-8 rounded-full bg-[var(--mim-info-bg)] border border-[var(--mim-suggestion-border)] text-xs font-semibold text-[var(--mim-text-primary)] mix-blend-multiply"
                          >
                            <Image
                              src="/icons/gophers.png"
                              alt=""
                              width={18}
                              height={20}
                              className="shrink-0"
                            />
                            Launch a Gopher
                          </button>
                          <button
                            type="button"
                            className="flex items-center gap-1.5 px-3 py-1.5 h-8 rounded-full bg-[#f2e9fa] border border-[#e8d7ff] text-xs font-semibold text-[var(--mim-text-primary)] mix-blend-multiply"
                          >
                            <Image
                              src="/icons/mimbrain-logo.png"
                              alt=""
                              width={18}
                              height={13}
                              className="shrink-0"
                            />
                            Add To Knowledge
                          </button>
                        </div>
                        <div className="flex items-center gap-6">
                          <button
                            type="button"
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <Paperclip className="w-[18px] h-[18px]" />
                          </button>
                          <button
                            type="button"
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <Mic className="w-[18px] h-[18px]" />
                          </button>
                          <button
                            type="submit"
                            disabled={isAsking || !chatInput.trim()}
                            className="text-slate-400 hover:text-blue-500 transition-colors disabled:opacity-40"
                          >
                            {isAsking ? (
                              <Loader2 className="w-[18px] h-[18px] animate-spin" />
                            ) : (
                              <ArrowUpCircle className="w-[18px] h-[18px]" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
