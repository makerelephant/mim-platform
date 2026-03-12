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
  ArrowUpRight,
  X,
  BookOpen,
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
          {
            label: "REVENUE",
            value: "$",
            subtitle: "Cumulative since (date)",
            icon: "revenue",
          },
          {
            label: "ITEMS SOLD",
            value: "...",
            subtitle: "individual products",
            icon: "items",
          },
          {
            label: "AOV",
            value: "$",
            subtitle: "Average Order Value",
            icon: "aov",
          },
          {
            label: "LINKS CREATED",
            value: "...",
            subtitle: "Drop Links Created",
            icon: "links",
          },
          {
            label: "CONVERT TO BUY",
            value: "%",
            subtitle: "% who visit and buy",
            icon: "convert",
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

      // If no active conversation, create one
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

  // ── KPI icon render ──
  function renderKpiIcon(icon: string) {
    switch (icon) {
      case "revenue":
        return (
          <Image
            src="/icons/pipelines.png"
            alt=""
            width={22}
            height={22}
            className="opacity-70"
          />
        );
      case "items":
        return (
          <svg
            className="w-5 h-5 text-slate-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
        );
      case "aov":
        return (
          <Image
            src="/icons/pipelines.png"
            alt=""
            width={22}
            height={22}
            className="opacity-70"
          />
        );
      case "links":
        return (
          <Image
            src="/icons/convert to buy.png"
            alt=""
            width={22}
            height={22}
            className="opacity-70"
          />
        );
      case "convert":
        return (
          <Image
            src="/icons/convert to buy.png"
            alt=""
            width={22}
            height={22}
            className="opacity-70"
          />
        );
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
      if (line.trim() === "") {
        return <div key={i} className="h-2" />;
      }
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

      {/* ── KPI Cards (always at top) ── */}
      {!loading && (
        <div className="grid grid-cols-5 gap-3 mb-4 shrink-0">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="bg-white rounded-xl border border-slate-200 px-3 py-3 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                  {kpi.label}
                </span>
                <div className="h-7 w-7 rounded-lg bg-slate-50 flex items-center justify-center">
                  {renderKpiIcon(kpi.icon)}
                </div>
              </div>
              <div className="mb-0.5">
                <span className="text-xl font-bold text-emerald-600">
                  {kpi.value}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">{kpi.subtitle}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Main content area ── */}
      <div className="flex-1 min-h-0 flex flex-col">
        {view === "main" ? (
          /* ═══ MAIN VIEW: Prior Conversations + Chat Prompt ═══ */
          <div className="flex gap-4 flex-1 min-h-0">
            {/* ── Prior Conversations Panel ── */}
            <div className="w-72 shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700">
                  Prior Conversations
                </h3>
                <button className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1">
                {conversations.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    No conversations yet. Ask the brain a question to get
                    started.
                  </p>
                ) : (
                  conversations.map((convo) => (
                    <button
                      key={convo.id}
                      onClick={() => handleSelectConversation(convo)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors truncate ${
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

            {/* ── Chat Prompt Area (with gradient background) ── */}
            <div
              className="flex-1 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center overflow-hidden relative"
              style={{
                backgroundImage: "url('/icons/Rectangle 4963.png')",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              {/* Semi-transparent overlay */}
              <div className="absolute inset-0 bg-white/60 pointer-events-none" />

              <div className="relative z-10 flex flex-col items-center w-full max-w-lg px-6">
                {/* Brain icon */}
                <Image
                  src="/icons/MiMbrain Icon.png"
                  alt=""
                  width={36}
                  height={36}
                  className="mb-3 opacity-60"
                />

                <h2 className="text-lg font-semibold text-slate-800 mb-4">
                  How can i help?
                </h2>

                {/* Input field */}
                <form onSubmit={handleSubmit} className="w-full">
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
                      <button
                        type="button"
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200/60 text-xs font-medium text-slate-700 hover:bg-blue-100 transition-colors"
                      >
                        <Image
                          src="/icons/gophers.png"
                          alt=""
                          width={16}
                          height={16}
                        />
                        Launch a Gopher
                      </button>

                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                          <Paperclip className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                          <Mic className="w-4 h-4" />
                        </button>
                        <button
                          type="submit"
                          disabled={isAsking || !chatInput.trim()}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-40"
                        >
                          {isAsking ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <ArrowUp className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        ) : (
          /* ═══ CHAT VIEW: Back button + Conversation + Bottom Input ═══ */
          <div className="flex gap-4 flex-1 min-h-0">
            {/* ── Prior Conversations Panel (still visible) ── */}
            <div className="w-72 shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700">
                  Prior Conversations
                </h3>
                <button
                  onClick={() => setActiveConversation(null)}
                  className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1">
                {conversations.map((convo) => (
                  <button
                    key={convo.id}
                    onClick={() => handleSelectConversation(convo)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors truncate ${
                      activeConversation?.id === convo.id
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {convo.title}
                  </button>
                ))}
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
                          <Image
                            src="/icons/gophers.png"
                            alt=""
                            width={14}
                            height={14}
                          />
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
                        <button
                          type="button"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                          <Paperclip className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                          <Mic className="w-4 h-4" />
                        </button>
                        <button
                          type="submit"
                          disabled={isAsking || !chatInput.trim()}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-40"
                        >
                          {isAsking ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <ArrowUp className="w-4 h-4" />
                          )}
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
