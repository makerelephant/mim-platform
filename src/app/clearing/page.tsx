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

import { useState, useRef, useCallback } from "react";

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
  const [sessions, setSessions] = useState<ClearingSession[]>([
    {
      id: "default",
      title: "Thought Stream",
      messages: [],
      created_at: new Date(),
      status: "active",
    },
  ]);
  const [activeSessionId, setActiveSessionId] = useState("default");
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  const addMessage = useCallback(
    (msg: Omit<ClearingMessage, "id" | "timestamp">) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
            ? {
                ...s,
                messages: [
                  ...s.messages,
                  { ...msg, id: crypto.randomUUID(), timestamp: new Date() },
                ],
              }
            : s
        )
      );
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    },
    [activeSessionId]
  );

  // ── Send thought or query to brain ──
  async function handleSend() {
    if (!input.trim()) return;

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
  function newSession() {
    const id = crypto.randomUUID();
    setSessions((prev) => [
      ...prev,
      {
        id,
        title: `Session ${prev.length + 1}`,
        messages: [],
        created_at: new Date(),
        status: "active",
      },
    ]);
    setActiveSessionId(id);
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
      className="min-h-full relative"
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

      <div className="mx-auto flex flex-col items-center" style={{ maxWidth: "960px" }}>
        {/* ══════════════════════════════════════════════════════════════════
            CHAT HEADER — Same pattern as Motion but "A Thinking Space"
            ══════════════════════════════════════════════════════════════════ */}
        <div
          className="flex flex-col gap-[6px] items-start p-[12px] rounded-[12px] shadow-[0px_0px_60px_0px_rgba(0,0,0,0.12)] w-[526px] mt-[47px]"
          style={{ backgroundColor: "rgba(255,244,224,0.2)" }}
        >
          {/* Avatar + Name */}
          <div className="flex flex-col gap-[12px] items-start w-full">
            <div className="flex gap-[6px] items-end pr-[6px] w-full">
              <img
                src="/icons/mark-avatar.png"
                alt="Mark Slater"
                className="w-[34px] h-[34px] rounded-full object-cover shrink-0"
              />
              <span
                className="text-[18px] font-medium text-[#9ca5a9] leading-[20px] text-center whitespace-nowrap"
                style={{
                  fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
                  letterSpacing: "-0.36px",
                }}
              >
                Mark Slater, CEO
              </span>
            </div>

            {/* Title */}
            <div className="flex items-start justify-between pr-[6px] w-full">
              <span
                className="text-[18px] font-semibold text-[#1e252a] leading-[20px] text-center whitespace-nowrap"
                style={{
                  fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
                  letterSpacing: "-0.36px",
                }}
              >
                A Thinking Space
              </span>
            </div>
          </div>

          {/* Subtitle */}
          <p
            className="text-[12px] font-medium leading-[14px] w-full"
            style={{
              fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
              color: "#627c9e",
            }}
          >
            Where thoughtful reflection and calm decision making can occur free from the clutter...
          </p>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            MAIN CONTENT AREA — Semi-transparent white card
            ══════════════════════════════════════════════════════════════════ */}
        <div
          className="rounded-[12px] shadow-[0px_0px_60px_0px_rgba(0,0,0,0.12)] mt-[46px] mb-[24px] flex flex-col"
          style={{
            backgroundColor: "rgba(255,255,255,0.5)",
            width: "933px",
            minHeight: "700px",
          }}
        >
          <div className="flex flex-col gap-[18px] items-start p-[12px] flex-1">
            {/* ── Top bar: Back + Last Conversation + Share ── */}
            <div className="flex items-center justify-between w-full h-[30px]">
              {/* Back button */}
              <button
                className="flex gap-[6px] items-center px-[24px] py-[6px] rounded-[16px] mix-blend-multiply"
                style={{
                  backgroundColor: "#eef2f5",
                  border: "1px solid #b0b8bb",
                }}
                onClick={() => window.history.back()}
              >
                <img src="/icons/arrow-left.svg" alt="" className="w-[16px] h-[16px]" />
                <span
                  className="text-[14px] font-semibold text-[#1e252a] leading-[18px] tracking-[-0.28px] whitespace-nowrap"
                  style={{ fontFamily: "var(--font-inter), 'Inter', sans-serif" }}
                >
                  Back
                </span>
              </button>

              {/* Right side: last conversation + share */}
              <div className="flex gap-[12px] items-center justify-end">
                <span
                  className="text-[10px] font-medium text-[#9ca5a9] leading-[10px] whitespace-nowrap"
                  style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                >
                  {lastConversationText()}
                </span>
                <button className="flex gap-[6px] items-center px-[24px] py-[6px] rounded-[16px] mix-blend-multiply">
                  <img src="/icons/share.svg" alt="" className="w-[16px] h-[16px]" />
                  <span
                    className="text-[14px] font-semibold text-[#1e252a] leading-[18px] tracking-[-0.28px] whitespace-nowrap"
                    style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                  >
                    Share
                  </span>
                </button>
              </div>
            </div>

            {/* ── Two-column layout: Prior Chats + Messages ── */}
            <div className="flex gap-[18px] items-start flex-1 w-full">
              {/* ── Left panel: Prior Conversations ── */}
              <div
                className="flex flex-col gap-[24px] items-start pb-[24px] rounded-[8px] shadow-[0px_0px_60px_0px_rgba(0,0,0,0.12)] shrink-0"
                style={{
                  width: "257px",
                  minHeight: "600px",
                  backgroundColor: "rgba(243,242,237,0.3)",
                }}
              >
                {/* Header */}
                <div
                  className="flex items-center justify-between p-[6px] rounded-[4px] shadow-[0px_1px_6px_0px_rgba(0,0,0,0.12)] w-full bg-white"
                  style={{ height: "28px" }}
                >
                  <span
                    className="text-[12px] font-semibold text-[#1e252a] leading-[14px] tracking-[-0.24px] whitespace-nowrap"
                    style={{ fontFamily: "var(--font-inter), 'Inter', sans-serif" }}
                  >
                    Prior Conversations
                  </span>
                  <img src="/icons/more-horizontal.svg" alt="" className="w-[24px] h-[24px]" />
                </div>

                {/* Session list */}
                <div className="flex flex-col gap-[12px] items-start pl-[6px]">
                  {activeSessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setActiveSessionId(s.id)}
                      className="text-left w-[229px]"
                      style={{
                        fontFamily: "var(--font-geist-sans), 'Geist', sans-serif",
                        fontSize: "14px",
                        fontWeight: s.id === activeSessionId ? 500 : 400,
                        lineHeight: "16px",
                        color: "#1e252a",
                      }}
                    >
                      {s.title}
                      {s.messages.length > 0 && (
                        <span className="text-[#9ca5a9]"> ({s.messages.length})</span>
                      )}
                    </button>
                  ))}
                  {/* New conversation button */}
                  <button
                    onClick={newSession}
                    className="text-[14px] text-[#627c9e] font-medium"
                    style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                  >
                    + New Conversation
                  </button>
                </div>
              </div>

              {/* ── Right panel: Messages ── */}
              <div className="flex flex-col flex-1 min-h-0" style={{ gap: "18px" }}>
                {/* Messages area */}
                <div className="flex-1 overflow-y-auto flex flex-col gap-[24px] items-end pr-[4px]" style={{ minHeight: "400px" }}>
                  {activeSession && activeSession.messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full w-full text-center pt-[100px]">
                      <img
                        src="/icons/gophers.png"
                        alt=""
                        className="opacity-20 mb-4"
                        style={{ width: "48px", height: "56px" }}
                      />
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
                            /* User messages: right-aligned, white card, rounded-8 */
                            <div
                              className="bg-white rounded-[8px] p-[12px]"
                              style={{ maxWidth: "593px" }}
                            >
                              <p
                                className="text-[14px] text-black leading-[18px]"
                                style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                              >
                                {msg.content}
                              </p>
                            </div>
                          ) : (
                            /* Brain messages: left-aligned, plain text */
                            <div style={{ maxWidth: "617px", width: "100%" }}>
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

                {/* ── Bottom: Input + Action pills ── */}
                <div className="flex flex-col gap-[15px] items-start w-full">
                  {/* Input bar */}
                  <div
                    className="flex items-center justify-between bg-white rounded-[12px] shadow-[0px_0px_6px_0px_rgba(0,0,0,0.18)] px-[14px] py-[18px] w-full"
                    style={{
                      border: "0.5px solid #a9d8ff",
                      height: "48px",
                    }}
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
                        placeholder="Ask MiM Brain anything about the business...."
                        className="flex-1 text-[14px] text-black placeholder:text-[#b0b8bb] focus:outline-none bg-transparent leading-[24px]"
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
                  <div className="flex gap-[15px] items-center">
                    {/* Launch a Gopher */}
                    <button
                      className="flex gap-[6px] items-center px-[12px] py-[4px] rounded-[16px]"
                      style={{
                        backgroundColor: "#ecfaff",
                        border: "1px solid #b9e6ff",
                      }}
                    >
                      <img
                        src="/icons/gophers.png"
                        alt=""
                        className="shrink-0"
                        style={{ width: "18px", height: "20px" }}
                      />
                      <span
                        className="text-[12px] font-semibold text-[#1e252a] leading-[18px] tracking-[-0.24px] whitespace-nowrap"
                        style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
                      >
                        Launch a Gopher
                      </span>
                    </button>

                    {/* Add To Knowledge */}
                    <button
                      className="flex gap-[6px] items-center px-[12px] py-[4px] rounded-[16px]"
                      style={{
                        backgroundColor: "#f2e9fa",
                        border: "1px solid #e8d7ff",
                      }}
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
