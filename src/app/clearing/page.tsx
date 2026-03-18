"use client";

/**
 * Your Clearing — Pixel-perfect Figma match (node 41:3869)
 *
 * Layout:
 * - Chat Header at top: Avatar + "Mark Slater, CEO" + "A Thinking Space" + subtitle
 * - Main content area (semi-transparent white card):
 *   - Top bar: Back button | "Last Conversation was X ago" | Share button
 *   - Left panel: Prior Conversations list (257px)
 *   - Right panel: Chat messages (user right-aligned in white cards, brain left-aligned plain text)
 *   - Bottom: Input bar with icons + "Launch a Gopher" + "Add To Knowledge" pills
 */

import { useState, useRef, useCallback, useEffect } from "react";

/* eslint-disable @next/next/no-img-element */

// ─── Types ──────────────────────────────────────────────────────────────────

interface ClearingMessage {
  id: string;
  role: "user" | "brain";
  content: string;
  timestamp: Date;
  type: "thought" | "query" | "response" | "ingestion";
}

interface ClearingSession {
  id: string;
  title: string;
  messages: ClearingMessage[];
  created_at: Date;
  status: "active" | "dissolved";
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ClearingPage() {
  const [sessions, setSessions] = useState<ClearingSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [showGopherMenu, setShowGopherMenu] = useState(false);
  const [showConversations, setShowConversations] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Load sessions from DB on mount ──
  useEffect(() => {
    async function loadSessions() {
      try {
        const res = await fetch("/api/clearing/sessions");
        const data = await res.json();
        if (data.success && data.sessions?.length > 0) {
          const loaded: ClearingSession[] = data.sessions.map(
            (s: { id: string; title: string; status: string; created_at: string; messages: Array<{ id: string; role: string; content: string; message_type: string; created_at: string }> }) => ({
              id: s.id,
              title: s.title || "Thought Stream",
              status: s.status,
              created_at: new Date(s.created_at),
              messages: (s.messages || []).map(
                (m: { id: string; role: string; content: string; message_type: string; created_at: string }) => ({
                  id: m.id,
                  role: m.role as "user" | "brain",
                  content: m.content,
                  type: m.message_type as ClearingMessage["type"],
                  timestamp: new Date(m.created_at),
                })
              ),
            })
          );
          setSessions(loaded);
          setActiveSessionId(loaded[0].id);
        } else {
          // No sessions — create one
          await createSessionInDB("Thought Stream");
        }
      } catch {
        // API failed — create a local fallback session
        const fallbackId = crypto.randomUUID();
        setSessions([{ id: fallbackId, title: "Thought Stream", messages: [], created_at: new Date(), status: "active" }]);
        setActiveSessionId(fallbackId);
      } finally {
        setLoadingSessions(false);
      }
    }
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  // ── Persist a message to DB (fire-and-forget) ──
  async function persistMessage(sessionId: string, role: string, content: string, messageType: string) {
    try {
      await fetch("/api/clearing/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, role, content, message_type: messageType }),
      });
    } catch {
      // Silent — don't break UX if persistence fails
    }
  }

  // ── Create session in DB ──
  async function createSessionInDB(title: string): Promise<string | null> {
    try {
      const res = await fetch("/api/clearing/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = await res.json();
      if (data.success && data.session) {
        const newSession: ClearingSession = {
          id: data.session.id,
          title: data.session.title || title,
          messages: [],
          created_at: new Date(data.session.created_at),
          status: "active",
        };
        setSessions((prev) => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
        return newSession.id;
      }
    } catch {
      // Fall through
    }
    return null;
  }

  const addMessage = useCallback(
    (msg: Omit<ClearingMessage, "id" | "timestamp">) => {
      const newMsg = { ...msg, id: crypto.randomUUID(), timestamp: new Date() };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
            ? { ...s, messages: [...s.messages, newMsg] }
            : s
        )
      );
      // Persist to DB
      if (activeSessionId) {
        persistMessage(activeSessionId, msg.role, msg.content, msg.type);
      }
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    },
    [activeSessionId]
  );

  // ── Send thought or query to brain ──
  async function handleSend() {
    if (!input.trim() || !activeSessionId) return;

    const text = input.trim();
    setInput("");

    const isQuery = text.endsWith("?") || text.toLowerCase().startsWith("help me") ||
      text.toLowerCase().startsWith("show me") || text.toLowerCase().startsWith("what") ||
      text.toLowerCase().startsWith("who") || text.toLowerCase().startsWith("how") ||
      text.toLowerCase().startsWith("why") || text.toLowerCase().startsWith("prepare") ||
      text.toLowerCase().startsWith("think through");

    addMessage({
      role: "user",
      content: text,
      type: isQuery ? "query" : "thought",
    });

    // Auto-title session from first message
    if (activeSession && activeSession.messages.length === 0) {
      const autoTitle = text.slice(0, 40) + (text.length > 40 ? "..." : "");
      setSessions((prev) =>
        prev.map((s) => (s.id === activeSessionId ? { ...s, title: autoTitle } : s))
      );
      // Persist title update
      fetch("/api/clearing/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activeSessionId, title: autoTitle }),
      }).catch(() => {});
    }

    if (isQuery) {
      setThinking(true);
      try {
        const res = await fetch("/api/brain/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: text }),
        });
        const data = await res.json();
        addMessage({
          role: "brain",
          content: data.answer || data.error || "No response from brain.",
          type: "response",
        });
      } catch {
        addMessage({
          role: "brain",
          content: "Failed to reach the brain. Try again.",
          type: "response",
        });
      } finally {
        setThinking(false);
      }
    } else {
      try {
        await fetch("/api/brain/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            title: text.slice(0, 60),
            source_type: "clearing",
            uploaded_by: "ceo",
            tags: ["thought-stream", "clearing"],
          }),
        });
        addMessage({
          role: "brain",
          content: "Absorbed. I'll reference this when it's relevant.",
          type: "response",
        });
      } catch {
        // Silent — thought capture shouldn't feel transactional
      }
    }
  }

  // ── File ingestion ──
  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      addMessage({
        role: "user",
        content: `Ingesting: ${file.name}`,
        type: "ingestion",
      });

      setThinking(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("source_type", "clearing");
        formData.append("uploaded_by", "ceo");
        formData.append("tags", JSON.stringify(["clearing", "ingestion"]));

        const res = await fetch("/api/brain/ingest", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();

        addMessage({
          role: "brain",
          content: data.success
            ? `Absorbed ${file.name}. ${data.summary || ""}`
            : `Failed to process ${file.name}: ${data.error}`,
          type: "response",
        });
      } catch {
        addMessage({
          role: "brain",
          content: `Failed to ingest ${file.name}. Try again.`,
          type: "response",
        });
      } finally {
        setThinking(false);
      }
    }
  }

  // ── New session ──
  async function newSession() {
    const title = `Session ${sessions.length + 1}`;
    const dbId = await createSessionInDB(title);
    if (!dbId) {
      // Fallback to local
      const id = crypto.randomUUID();
      setSessions((prev) => [
        { id, title, messages: [], created_at: new Date(), status: "active" },
        ...prev,
      ]);
      setActiveSessionId(id);
    }
  }

  // ── Dissolve session ──
  async function dissolveSession(sessionId: string) {
    try {
      await fetch("/api/clearing/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sessionId, status: "dissolved" }),
      });
    } catch {
      // Silent
    }
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (activeSessionId === sessionId) {
      const remaining = sessions.filter((s) => s.id !== sessionId && s.status === "active");
      if (remaining.length > 0) {
        setActiveSessionId(remaining[0].id);
      } else {
        newSession();
      }
    }
  }

  // ── Launch a gopher (background agent) ──
  async function launchGopher(name: string, endpoint: string) {
    setShowGopherMenu(false);
    addMessage({ role: "user", content: `Launching gopher: ${name}`, type: "thought" });
    try {
      const res = await fetch(endpoint);
      const data = await res.json();
      addMessage({
        role: "brain",
        content: data.success
          ? `Gopher "${name}" completed successfully.${data.title ? ` Result: ${data.title}` : ""}${data.cards_analyzed ? ` (${data.cards_analyzed} cards analyzed)` : ""}`
          : `Gopher "${name}" failed: ${data.error || "Unknown error"}`,
        type: "response",
      });
    } catch {
      addMessage({ role: "brain", content: `Failed to launch "${name}". Try again.`, type: "response" });
    }
  }

  // ── Add current input to knowledge ──
  async function addToKnowledge() {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    addMessage({ role: "user", content: `Adding to knowledge: ${text}`, type: "ingestion" });
    try {
      await fetch("/api/brain/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          title: text.slice(0, 60),
          source_type: "clearing",
          uploaded_by: "ceo",
          tags: ["knowledge", "clearing", "manual"],
        }),
      });
      addMessage({ role: "brain", content: "Added to knowledge base. I'll reference this going forward.", type: "response" });
    } catch {
      addMessage({ role: "brain", content: "Failed to add to knowledge. Try again.", type: "response" });
    }
  }

  // ── Drag & drop ──
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }
  function handleDragLeave() {
    setDragOver(false);
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  }

  const activeSessions = sessions.filter((s) => s.status === "active");

  // ── Last conversation time ──
  function lastConversationText(): string {
    if (loadingSessions) return "Loading...";
    if (!activeSession || activeSession.messages.length === 0) return "No conversations yet";
    const last = activeSession.messages[activeSession.messages.length - 1];
    const diffMs = Date.now() - last.timestamp.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Last Conversation was just now";
    if (diffMin < 60) return `Last Conversation was ${diffMin} minutes ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `Last Conversation was ${diffHrs} hour${diffHrs > 1 ? "s" : ""} ago`;
    const diffDays = Math.floor(diffHrs / 24);
    return `Last Conversation was ${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  }

  return (
    <div
      className="min-h-full relative px-6"
      style={{
        backgroundImage: "url('/icons/chat-background.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* ── Drag overlay ── */}
      {dragOver && (
        <div className="absolute inset-0 bg-blue-50/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-xl border-2 border-dashed border-blue-300">
          <div className="text-center">
            <p className="text-lg font-semibold text-blue-600">Drop to ingest</p>
            <p className="text-sm text-blue-400 mt-1">Files will be absorbed into the brain</p>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          HEADER — Centered, max 548px, same as Motion per Figma 61:413
          ══════════════════════════════════════════════════════════════════ */}
      <div
        className="mx-auto flex flex-col gap-[12px] items-start p-[12px] rounded-[12px] shadow-[0px_0px_40px_0px_rgba(0,0,0,0.08)] w-full"
        style={{ backgroundColor: "rgba(236,250,255,0.6)", maxWidth: "548px", marginTop: "52px" }}
      >
        <div className="flex gap-[6px] items-end pr-[6px] w-full">
          <img
            src="/icons/mark-avatar.png"
            alt="Mark Slater"
            className="w-[34px] h-[34px] rounded-full object-cover shrink-0"
          />
          <span
            className="text-[16px] font-medium text-[#3e4c60] leading-[20px] text-center whitespace-nowrap"
            style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif", letterSpacing: "-0.32px" }}
          >
            Mark Slater, CEO.
          </span>
        </div>
        <div className="flex items-start justify-between pr-[6px] w-full">
          <div className="flex gap-[6px] items-center">
            <span
              className="text-[18px] font-semibold text-[#1e252a] leading-[20px] text-center whitespace-nowrap"
              style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif", letterSpacing: "-0.36px" }}
            >
              Important Conversations{" "}
            </span>
            <span
              className="text-[10px] font-medium text-[#9ca5a9] leading-[10px] whitespace-nowrap self-end pb-[2px]"
              style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
            >
              {lastConversationText().replace("Last Conversation was ", "...updated ")}
            </span>
          </div>
          <img src="/icons/refresh-2.svg" alt="" className="w-[20px] h-[20px] shrink-0" />
        </div>
        <p
          className="text-[12px] font-medium leading-[14px] w-full"
          style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif", color: "#627c9e" }}
        >
          My personal and company execution feed. no more email bitches...
        </p>
      </div>

      {/* Conversations panel is now toggled via button in the chat card top bar */}

      {/* ══════════════════════════════════════════════════════════════════
          MAIN CHAT CARD — Centered, max 551px, responsive
          bg rgba(255,255,255,0.6), rounded-12, shadow 60px
          ══════════════════════════════════════════════════════════════════ */}
      <div
        className="mx-auto rounded-[12px] flex flex-col w-full relative"
        style={{
          backgroundColor: "rgba(255,255,255,0.6)",
          maxWidth: "551px",
          height: "838px",
          marginTop: "24px",
          boxShadow: "0px 0px 60px 0px rgba(0,0,0,0.12)",
        }}
      >
        <div className="flex flex-col gap-[24px] items-start p-[12px] pt-[16px] flex-1 overflow-hidden">
          {/* ── Top bar: Conversations toggle + Last Conversation + Share ── */}
          <div className="flex items-center justify-between w-full">
            <div className="flex gap-[8px] items-center">
              <button
                className="flex gap-[6px] items-center px-[12px] py-[5px] rounded-[16px] transition-colors"
                style={{
                  backgroundColor: showConversations ? "#dbeafe" : "#eef2f5",
                  border: showConversations ? "1px solid #93c5fd" : "1px solid #b0b8bb",
                }}
                onClick={() => setShowConversations(!showConversations)}
              >
                <span
                  className="text-[11px] font-semibold text-[#1e252a] leading-[14px] tracking-[-0.22px] whitespace-nowrap"
                  style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                >
                  {activeSessions.length > 1 ? `Conversations (${activeSessions.length})` : "Conversations"}
                </span>
              </button>
              <span
                className="text-[10px] font-medium text-[#9ca5a9] leading-[10px] whitespace-nowrap"
                style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
              >
                {lastConversationText()}
              </span>
            </div>
            <button className="flex gap-[6px] items-center px-[12px] py-[6px] rounded-[16px] mix-blend-multiply">
              <img src="/icons/share.svg" alt="" className="w-[16px] h-[16px]" />
              <span
                className="text-[14px] font-semibold text-[#1e252a] leading-[18px] tracking-[-0.28px] whitespace-nowrap"
                style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
              >
                Share
              </span>
            </button>
          </div>

          {/* ── Floating Conversations panel (toggled) ── */}
          {showConversations && (
            <div
              className="absolute left-[12px] top-[48px] z-40 flex flex-col gap-[8px] pb-[12px] rounded-[12px] bg-white"
              style={{ width: "200px", maxHeight: "350px", boxShadow: "0px 0px 40px 0px rgba(0,0,0,0.18)" }}
            >
              <div
                className="flex items-center justify-between p-[6px] rounded-t-[12px]"
                style={{ borderBottom: "0.5px solid #c7d2e5" }}
              >
                <span
                  className="text-[12px] font-medium text-[#1e252a] leading-[14px] tracking-[-0.12px] whitespace-nowrap"
                  style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                >
                  Conversations
                </span>
                <button onClick={() => setShowConversations(false)} className="text-[#9ca5a9] hover:text-[#1e252a] text-[14px] px-1">×</button>
              </div>
              <div className="flex flex-col gap-[10px] items-start px-[6px] overflow-y-auto flex-1 w-full">
                {loadingSessions ? (
                  <span className="text-[12px] text-[#9ca5a9]" style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}>Loading...</span>
                ) : activeSessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between w-full group">
                    <button
                      onClick={() => { setActiveSessionId(s.id); setShowConversations(false); }}
                      className="text-left flex-1 min-w-0"
                      style={{
                        fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
                        fontSize: "12px",
                        fontWeight: s.id === activeSessionId ? 600 : 500,
                        lineHeight: "16px",
                        letterSpacing: "-0.24px",
                        color: "#1e252a",
                      }}
                    >
                      <span className="block truncate">{s.title}</span>
                    </button>
                    {activeSessions.length > 1 && (
                      <button
                        onClick={() => dissolveSession(s.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-[#9ca5a9] hover:text-[#627c9e] text-[12px] ml-1 shrink-0"
                        title="Dissolve"
                      >×</button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => { newSession(); setShowConversations(false); }}
                  className="text-[12px] text-[#627c9e] font-medium"
                  style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                >
                  + New Conversation
                </button>
              </div>
            </div>
          )}

          {/* ── Messages area ── */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-[16px] w-full">
            {activeSession && activeSession.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full w-full text-center pt-[100px]">
                <p
                  className="text-[#9ca5a9] text-[14px] max-w-md leading-relaxed"
                  style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                >
                  Ask the brain anything, capture a thought, or drop a file to ingest.
                </p>
              </div>
            ) : (
              <>
                {activeSession?.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "user" ? (
                      /* User: right-aligned white card, rounded-8, shadow per Figma */
                      <div
                        className="bg-white rounded-[8px] p-[12px]"
                        style={{ maxWidth: "489px", boxShadow: "0px 1px 4px 0px rgba(0,0,0,0.08)" }}
                      >
                        <p
                          className="text-[14px] text-black leading-[18px]"
                          style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                        >
                          {msg.content}
                        </p>
                      </div>
                    ) : (
                      /* Brain: left-aligned plain text, 14px, leading-16 */
                      <div style={{ width: "100%" }}>
                        <div
                          className="text-[14px] text-[#1e252a] leading-[16px]"
                          style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                          dangerouslySetInnerHTML={{
                            __html: msg.content
                              .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                              .split("\n\n").join("<br/><br/>")
                              .split("\n").join("<br/>"),
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
                {thinking && (
                  <div className="flex justify-start w-full">
                    <div className="flex gap-1 py-2">
                      <span className="w-2 h-2 bg-[#9ca5a9] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-[#9ca5a9] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-[#9ca5a9] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          INPUT BAR + ACTION PILLS — Centered, 550px, per Figma 61:479
          ══════════════════════════════════════════════════════════════════ */}
      <div className="mx-auto w-full" style={{ maxWidth: "550px", marginTop: "16px", marginBottom: "24px" }}>
        {/* Input bar */}
        <div
          className="flex items-center justify-between bg-white rounded-[12px] shadow-[0px_0px_6px_0px_rgba(0,0,0,0.18)] px-[14px] py-[18px] w-full"
          style={{ border: "0.5px solid #a9d8ff", height: "48px" }}
        >
          <div className="flex flex-1 items-center pl-[12px]">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask anything about the business...."
              className="flex-1 text-[12px] text-black placeholder:text-[#b0b8bb] focus:outline-none bg-transparent leading-[24px]"
              style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
            />
          </div>
          <div className="flex gap-[24px] items-center w-[143px] h-[21px]">
            <img src="/icons/calendar-plus.svg" alt="" className="w-[16px] h-[16px] shrink-0" />
            <img
              src="/icons/paperclip.svg"
              alt=""
              className="w-[16px] h-[16px] shrink-0 cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            />
            <img src="/icons/mic.svg" alt="" className="w-[16px] h-[16px] shrink-0" />
            <img
              src="/icons/arrow-up-circle.svg"
              alt=""
              className="w-[16px] h-[16px] shrink-0 cursor-pointer"
              onClick={handleSend}
            />
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files)}
        />

        {/* Action pills */}
        <div className="flex items-center mt-[20px]" style={{ gap: "0px" }}>
          {/* Launch a Gopher */}
          <div className="relative">
            <button
              onClick={() => setShowGopherMenu(!showGopherMenu)}
              className="flex gap-[6px] items-center px-[12px] py-[4px] rounded-[16px]"
              style={{ backgroundColor: "#ecfaff", border: "1px solid #b9e6ff" }}
            >
              <img src="/icons/gopher.svg" alt="" className="shrink-0" style={{ width: "18px", height: "20px" }} />
              <span
                className="text-[12px] font-semibold text-[#1e252a] leading-[18px] tracking-[-0.24px] whitespace-nowrap"
                style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
              >
                Launch a Gopher
              </span>
            </button>
            {showGopherMenu && (
              <div className="absolute bottom-full mb-2 left-0 bg-white rounded-[8px] shadow-[0px_0px_20px_0px_rgba(0,0,0,0.15)] p-[6px] min-w-[200px] z-50">
                {[
                  { name: "Scan Gmail", endpoint: "/api/agents/gmail-scanner", icon: "📧" },
                  { name: "Daily Briefing", endpoint: "/api/agents/daily-briefing", icon: "📊" },
                  { name: "Weekly Synthesis", endpoint: "/api/agents/synthesis", icon: "🧠" },
                  { name: "Monthly Report", endpoint: "/api/agents/monthly-report", icon: "📋" },
                ].map((g) => (
                  <button
                    key={g.name}
                    onClick={() => launchGopher(g.name, g.endpoint)}
                    className="flex items-center gap-[8px] w-full px-[8px] py-[6px] rounded-[4px] hover:bg-[#f6f5f5] transition-colors text-left"
                  >
                    <span className="text-[14px]">{g.icon}</span>
                    <span className="text-[12px] font-medium text-[#1e252a]" style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}>
                      {g.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Add To Knowledge */}
          <button
            onClick={addToKnowledge}
            className="flex gap-[6px] items-center px-[12px] py-[4px] rounded-[16px]"
            style={{ backgroundColor: "#f2e9fa", border: "1px solid #e8d7ff", marginLeft: "0px" }}
          >
            <img src="/icons/brain.svg" alt="" className="w-[20px] h-[20px] shrink-0" />
            <span
              className="text-[12px] font-semibold text-[#1e252a] leading-[18px] tracking-[-0.24px] whitespace-nowrap"
              style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
            >
              Add To Knowledge
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
