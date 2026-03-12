"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import {
  Paperclip,
  Mic,
  ArrowUp,
  Loader2,
  ArrowLeft,
  ArrowRight,
  X,
  BookOpen,
  RefreshCw,
  Plus,
  Tag,
  Eye,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ─── Types ──────────────────────────────────────────────────────────────────

interface KpiCard {
  label: string;
  value: string;
  subtitle: string;
  icon: string;
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
  source: string; // 'gmail' | 'slack' | 'scanner'
  priority: string; // 'critical' | 'high' | 'medium' | 'low'
  title: string;
  body: string;
  suggestedAction: string | null;
  entityId: string | null;
  createdAt: Date;
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
  const [importantConvos, setImportantConvos] = useState<ImportantConversation[]>([]);
  const [importantLoading, setImportantLoading] = useState(false);
  const [importantLastUpdated, setImportantLastUpdated] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

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
            }),
          );
        } else {
          setLastVisit("23 hours ago");
        }

        // Load prior conversations from brain activity
        const { data: priorQueries } = await supabase
          .schema("brain")
          .from("activity")
          .select("id, metadata, created_at")
          .eq("action", "brain_query")
          .order("created_at", { ascending: false })
          .limit(10);

        if (priorQueries && priorQueries.length > 0) {
          const convos: Conversation[] = priorQueries.map(
            (q: { id: string; metadata: { question?: string }; created_at: string }) => ({
              id: q.id,
              title:
                (q.metadata?.question || "Untitled conversation").slice(0, 45) +
                ((q.metadata?.question || "").length > 45 ? "..." : ""),
              messages: [],
              createdAt: new Date(q.created_at),
            }),
          );
          setConversations(convos);
        }

        setKpis([
          { label: "REVENUE", value: "$", subtitle: "Cumulative since (date)", icon: "revenue" },
          { label: "ITEMS SOLD", value: "...", subtitle: "individual products", icon: "items" },
          { label: "AOV", value: "$", subtitle: "Average Order Value", icon: "aov" },
          { label: "LINKS CREATED", value: "...", subtitle: "Drop Links Created", icon: "links" },
          { label: "CONVERT TO BUY", value: "%", subtitle: "% who visit and buy", icon: "convert" },
        ]);

        // Load important conversations
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

  // ── Load important conversations from ceo_context + correspondence ──
  const loadImportantConversations = useCallback(async () => {
    setImportantLoading(true);
    try {
      const items: ImportantConversation[] = [];

      // 1. Try brain.ceo_context first (scanner-flagged items)
      const { data: ceoItems } = await supabase
        .schema("brain")
        .from("ceo_context")
        .select("id, source, context_type, title, content, priority, entity_id, metadata, created_at")
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
            suggestedAction: (item.metadata as Record<string, string>)?.suggested_action || null,
            entityId: item.entity_id,
            createdAt: new Date(item.created_at),
          });
        }
      }

      // 2. Fill with recent correspondence if ceo_context is sparse
      if (items.length < 5) {
        const { data: corr } = await supabase
          .schema("brain")
          .from("correspondence")
          .select("id, channel, direction, subject, body, from_address, entity_id, sent_at, created_at")
          .order("sent_at", { ascending: false })
          .limit(15);

        if (corr && corr.length > 0) {
          for (const c of corr) {
            // Skip if already represented via ceo_context
            if (items.some((i) => i.title === c.subject)) continue;
            items.push({
              id: c.id,
              source: c.channel || "email",
              priority: "medium",
              title: c.subject || `Message from ${c.from_address || "unknown"}`,
              body: (c.body || "").slice(0, 200),
              suggestedAction: null,
              entityId: c.entity_id,
              createdAt: new Date(c.sent_at || c.created_at),
            });
          }
        }
      }

      // Sort by date descending
      items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setImportantConvos(items.slice(0, 20));
      setImportantLastUpdated(
        formatDistanceToNow(new Date(), { addSuffix: true }),
      );
    } catch (err) {
      console.error("Important conversations load error:", err);
    } finally {
      setImportantLoading(false);
    }
  }, []);

  // Scroll to bottom when messages change
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
          title: question.slice(0, 45) + (question.length > 45 ? "..." : ""),
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
          prev ? { ...prev, messages: [...prev.messages, brainMsg] } : null,
        );
      } catch {
        const brainMsg: ChatMessage = {
          role: "brain",
          content: "Sorry, I couldn't connect to the brain. Please try again.",
          timestamp: new Date(),
        };
        setActiveConversation((prev) =>
          prev ? { ...prev, messages: [...prev.messages, brainMsg] } : null,
        );
      } finally {
        setIsAsking(false);
      }
    },
    [chatInput, isAsking, activeConversation],
  );

  function handleBack() {
    setView("main");
    setActiveConversation(null);
  }

  function handleSelectConversation(convo: Conversation) {
    setActiveConversation(convo);
    setView("chat");
  }

  // ── Source badge helpers ──
  function sourceIcon(source: string) {
    const s = source.toLowerCase();
    if (s.includes("slack")) return { label: "Slack", color: "text-blue-600", bg: "bg-blue-50" };
    if (s.includes("gmail") || s.includes("email")) return { label: "Gmail", color: "text-green-600", bg: "bg-green-50" };
    return { label: source, color: "text-slate-600", bg: "bg-slate-50" };
  }

  function priorityBadge(priority: string) {
    switch (priority) {
      case "critical": return { label: "Critical", classes: "bg-red-100 text-red-700" };
      case "high": return { label: "High", classes: "bg-orange-100 text-orange-700" };
      case "medium": return { label: "Medium", classes: "bg-slate-100 text-slate-600" };
      case "low": return { label: "Low", classes: "bg-slate-50 text-slate-400" };
      default: return { label: priority, classes: "bg-slate-100 text-slate-600" };
    }
  }

  // ── Filtered important conversations ──
  const filteredImportant = activeFilter
    ? importantConvos.filter((c) => {
        if (activeFilter === "slack") return c.source.toLowerCase().includes("slack");
        if (activeFilter === "gmail") return c.source.toLowerCase().includes("gmail") || c.source.toLowerCase().includes("email");
        return true;
      })
    : importantConvos;

  // ── KPI icon render ──
  function renderKpiIcon(icon: string) {
    switch (icon) {
      case "revenue":
      case "aov":
        return <Image src="/icons/pipelines.png" alt="" width={22} height={22} className="opacity-70" />;
      case "items":
        return (
          <svg className="w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
        );
      case "links":
      case "convert":
        return <Image src="/icons/convert to buy.png" alt="" width={22} height={22} className="opacity-70" />;
      default:
        return null;
    }
  }

  // ── Format brain response (basic markdown) ──
  function formatBrainResponse(text: string) {
    return text.split("\n").map((line, i) => {
      const boldFormatted = line.replace(
        /\*\*(.*?)\*\*/g,
        '<strong class="font-semibold text-slate-800">$1</strong>',
      );
      if (line.startsWith("## ")) {
        return <h3 key={i} className="text-sm font-semibold text-slate-800 mt-3 mb-1">{line.slice(3)}</h3>;
      }
      if (line.startsWith("- ") || line.startsWith("* ")) {
        return (
          <div key={i} className="flex gap-2 text-sm text-slate-600 ml-2 mb-0.5">
            <span className="text-slate-400 shrink-0">&#8226;</span>
            <span dangerouslySetInnerHTML={{ __html: boldFormatted.slice(2) }} />
          </div>
        );
      }
      if (line.trim() === "") return <div key={i} className="h-2" />;
      return <p key={i} className="text-sm text-slate-600 mb-0.5" dangerouslySetInnerHTML={{ __html: boldFormatted }} />;
    });
  }

  // ─── RENDER ──────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col">
      {/* ── Header ── */}
      <div className="mb-4 shrink-0">
        <h1 className="text-2xl font-bold text-slate-900">My Brain</h1>
        <div className="flex items-center gap-3 mt-0.5">
          <p className="text-sm text-slate-500">Hello Mark, Welcome Back.</p>
          {lastVisit && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white border border-slate-200 text-slate-500">
              Last Visit: {lastVisit}
            </span>
          )}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      {!loading && (
        <div className="grid grid-cols-5 gap-3 mb-4 shrink-0">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-xl border border-slate-200 px-3 py-3 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">{kpi.label}</span>
                <div className="h-7 w-7 rounded-lg bg-slate-50 flex items-center justify-center">{renderKpiIcon(kpi.icon)}</div>
              </div>
              <div className="mb-0.5"><span className="text-xl font-bold text-emerald-600">{kpi.value}</span></div>
              <p className="text-[10px] text-slate-400">{kpi.subtitle}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Main content area ── */}
      <div className="flex-1 min-h-0 flex flex-col">
        {view === "main" ? (
          /* ═══ MAIN VIEW: Chat Prompt (left) + Important Conversations (right) ═══ */
          <div className="flex gap-4 flex-1 min-h-0">
            {/* ── Chat Prompt Area (left, with gradient background) ── */}
            <div
              className="w-[340px] shrink-0 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center overflow-hidden relative"
              style={{
                backgroundImage: "url('/icons/Rectangle 4963.png')",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div className="absolute inset-0 bg-white/60 pointer-events-none" />

              <div className="relative z-10 flex flex-col items-center w-full max-w-sm px-6">
                <Image src="/icons/MiMbrain Icon.png" alt="" width={36} height={36} className="mb-3 opacity-60" />
                <h2 className="text-lg font-semibold text-slate-800 mb-4">How can i help?</h2>

                <form onSubmit={handleSubmit} className="w-full">
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 pt-3 pb-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask The MiMbrain Anything about the business..."
                      disabled={isAsking}
                      className="w-full text-sm text-slate-700 placeholder:text-slate-400 bg-transparent outline-none pb-6"
                    />
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200/60 text-xs font-medium text-slate-700 hover:bg-blue-100 transition-colors"
                      >
                        <Image src="/icons/gophers.png" alt="" width={16} height={16} />
                        Launch a Gopher
                      </button>
                      <div className="flex items-center gap-0.5">
                        <button type="button" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                          <Paperclip className="w-4 h-4" />
                        </button>
                        <button type="button" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                          <Mic className="w-4 h-4" />
                        </button>
                        <button
                          type="submit"
                          disabled={isAsking || !chatInput.trim()}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-40"
                        >
                          {isAsking ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </form>

                {/* See Old Conversations link */}
                <button
                  onClick={() => setView("chat")}
                  className="mt-4 flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                >
                  See Old Conversations
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* ── Important Conversations Panel (right) ── */}
            <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-0">
              {/* Header */}
              <div className="shrink-0 px-4 pt-4 pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-800">Important Conversations</h3>
                  <div className="flex items-center gap-2">
                    {importantLastUpdated && (
                      <span className="text-[10px] text-slate-400">Last updated: {importantLastUpdated}</span>
                    )}
                    <button
                      onClick={loadImportantConversations}
                      disabled={importantLoading}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-200 text-[10px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      <RefreshCw className={`w-3 h-3 ${importantLoading ? "animate-spin" : ""}`} />
                      Update
                    </button>
                  </div>
                </div>
                {/* Filter pills */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setActiveFilter(activeFilter === "slack" ? null : "slack")}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors border ${
                      activeFilter === "slack"
                        ? "bg-blue-50 border-blue-200 text-blue-700"
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    Slack
                  </button>
                  <button
                    onClick={() => setActiveFilter(activeFilter === "gmail" ? null : "gmail")}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors border ${
                      activeFilter === "gmail"
                        ? "bg-green-50 border-green-200 text-green-700"
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Gmail
                  </button>
                </div>
              </div>

              {/* Scrollable conversation list */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {importantLoading && filteredImportant.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                  </div>
                ) : filteredImportant.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-sm text-slate-400">No important conversations yet.</p>
                    <p className="text-xs text-slate-300 mt-1">Run the Gmail or Slack scanner to populate this feed.</p>
                  </div>
                ) : (
                  filteredImportant.map((item) => {
                    const src = sourceIcon(item.source);
                    const pri = priorityBadge(item.priority);
                    return (
                      <div key={item.id} className="bg-white rounded-lg border border-slate-200 p-3 hover:shadow-sm transition-shadow">
                        {/* Meta line: time, source, priority */}
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] text-slate-400">
                            {formatDistanceToNow(item.createdAt, { addSuffix: true })}
                          </span>
                          <span className="text-[10px] text-slate-300">from</span>
                          <span className={`text-[10px] font-semibold ${src.color}`}>{src.label}</span>
                          <span className="w-1 h-1 rounded-full bg-slate-300" />
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium ${pri.classes}`}>
                            {pri.label}
                          </span>
                          <div className="ml-auto">
                            <button className="p-0.5 rounded text-slate-300 hover:text-slate-500 transition-colors">
                              <Eye className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Title + body */}
                        <h4 className="text-sm font-medium text-slate-800 mb-1">{item.title}</h4>
                        <p className="text-xs text-slate-500 leading-relaxed mb-2 line-clamp-2">{item.body}</p>

                        {/* Suggested action */}
                        {item.suggestedAction && (
                          <div className="mb-2 px-2 py-1.5 bg-green-50 rounded border border-green-100">
                            <span className="text-[10px] font-medium text-green-700">
                              Suggested Action:{" "}
                            </span>
                            <span className="text-[10px] text-green-600">{item.suggestedAction}</span>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5">
                          {item.suggestedAction && (
                            <button className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-medium hover:bg-emerald-600 transition-colors">
                              Execute
                            </button>
                          )}
                          <button className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-200 text-[10px] font-medium text-slate-500 hover:bg-slate-50 transition-colors">
                            <Plus className="w-2.5 h-2.5" />
                            Add To Tasks
                          </button>
                          <button className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-200 text-[10px] font-medium text-slate-500 hover:bg-slate-50 transition-colors">
                            <Tag className="w-2.5 h-2.5" />
                            Add Tags
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Load More */}
                {filteredImportant.length >= 10 && (
                  <div className="text-center py-2">
                    <button className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                      Load More...
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ═══ CHAT VIEW: Prior Conversations (left) + Chat Thread (right) ═══ */
          <div className="flex gap-4 flex-1 min-h-0">
            {/* ── Prior Conversations Panel ── */}
            <div className="w-60 shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700">Prior Conversations</h3>
                <button
                  onClick={() => setActiveConversation(null)}
                  className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1">
                {conversations.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No conversations yet.</p>
                ) : (
                  conversations.map((convo) => (
                    <button
                      key={convo.id}
                      onClick={() => handleSelectConversation(convo)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors truncate ${
                        activeConversation?.id === convo.id
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {convo.title}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* ── Chat thread area ── */}
            <div className="flex-1 flex flex-col min-h-0">
              {/* Back button */}
              <div className="shrink-0 mb-3">
                <button
                  onClick={handleBack}
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-3">
                {activeConversation?.messages.map((msg, i) => (
                  <div key={i}>
                    {msg.role === "user" ? (
                      <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
                        <p className="text-sm text-slate-700">{msg.content}</p>
                      </div>
                    ) : (
                      <div className="pl-2">
                        <div>{formatBrainResponse(msg.content)}</div>
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="mt-2">
                            <p className="text-[10px] text-slate-400">Sources: {msg.sources.join(", ")}</p>
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

              {/* Bottom chat input bar */}
              <div className="shrink-0">
                <form onSubmit={handleSubmit}>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 pt-3 pb-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask Anything about the business."
                      disabled={isAsking}
                      className="w-full text-sm text-slate-700 placeholder:text-slate-400 bg-transparent outline-none pb-6"
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200/60 text-xs font-medium text-slate-700 hover:bg-blue-100 transition-colors"
                        >
                          <Image src="/icons/gophers.png" alt="" width={14} height={14} />
                          Launch a Gopher
                        </button>
                        <button
                          type="button"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          Add To Knowledge
                        </button>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button type="button" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                          <Paperclip className="w-4 h-4" />
                        </button>
                        <button type="button" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                          <Mic className="w-4 h-4" />
                        </button>
                        <button
                          type="submit"
                          disabled={isAsking || !chatInput.trim()}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-40"
                        >
                          {isAsking ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
