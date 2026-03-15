"use client";

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
    },
    [activeSessionId]
  );

  // ── Send thought or query to brain ──
  async function handleSend() {
    if (!input.trim()) return;

    const text = input.trim();
    setInput("");

    // Is this a question/query or a thought fragment?
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
      // Ask the brain
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
      // Thought capture — ingest into brain memory
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
        content: `📄 Ingesting: ${file.name}`,
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
            ? `Absorbed **${file.name}**. ${data.summary || ""}\n\nTags: ${(data.tags || []).join(", ") || "none"}\nCategories: ${(data.categories || []).join(", ") || "none"}`
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

  // ── Dissolve session ──
  function dissolveSession(sessionId: string) {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, status: "dissolved" as const } : s))
    );
    const remaining = sessions.filter((s) => s.id !== sessionId && s.status === "active");
    if (remaining.length > 0) {
      setActiveSessionId(remaining[0].id);
    } else {
      newSession();
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

  return (
    <div
      className="h-full flex flex-col bg-[#f6f5f5]"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* ── Header ── */}
      <div className="px-6 pt-6 pb-3 flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold text-[#1e252a] tracking-tight"
            style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
          >
            Your Clearing
          </h1>
          <p className="text-sm text-[#6e7b80] mt-0.5">
            Think. Prepare. Ingest. Then step back into motion.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeSessions.length > 1 && (
            <button
              onClick={() => dissolveSession(activeSessionId)}
              className="text-xs text-[#6e7b80] hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg border border-[#e5e7eb] hover:border-red-200"
            >
              Dissolve
            </button>
          )}
          <button
            onClick={newSession}
            className="text-xs font-medium text-[#0ea5e9] hover:text-[#0284c7] transition-colors px-3 py-1.5 rounded-lg border border-[#0ea5e9]/20 hover:border-[#0ea5e9]/40"
          >
            + New Session
          </button>
        </div>
      </div>

      {/* ── Session Tabs ── */}
      {activeSessions.length > 1 && (
        <div className="px-6 pb-2 flex gap-2 overflow-x-auto">
          {activeSessions.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSessionId(s.id)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors whitespace-nowrap ${
                s.id === activeSessionId
                  ? "bg-white text-[#1e252a] font-semibold shadow-sm"
                  : "text-[#6e7b80] hover:text-[#1e252a] hover:bg-white/50"
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>
      )}

      {/* ── Message Area ── */}
      <div className="flex-1 overflow-y-auto px-6 pb-4">
        {activeSession && activeSession.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <img
              src="/icons/gophers.png"
              alt=""
              width={48}
              height={56}
              className="opacity-30 mb-4"
            />
            <p className="text-[#94A3B8] text-sm max-w-md leading-relaxed">
              Capture thoughts, ask the brain for help, or drop files to ingest.
              <br />
              <span className="text-xs mt-2 block text-[#94A3B8]/70">
                Thoughts are absorbed into memory. Questions get answers. Files become institutional knowledge.
              </span>
            </p>
          </div>
        ) : (
          <div className="space-y-4 pt-4">
            {activeSession?.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? msg.type === "ingestion"
                        ? "bg-blue-50 text-blue-800 border border-blue-100"
                        : msg.type === "query"
                        ? "bg-[#1e252a] text-white"
                        : "bg-[#e8e8e8] text-[#1e252a]"
                      : "bg-white text-[#344054] shadow-sm border border-[#f0f0f0]"
                  }`}
                >
                  <div
                    className="text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: msg.content
                        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                        .replace(/\n/g, "<br/>"),
                    }}
                  />
                  <p className="text-[10px] opacity-40 mt-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex justify-start">
                <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-[#f0f0f0]">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-[#94A3B8] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-[#94A3B8] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-[#94A3B8] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Drag overlay ── */}
      {dragOver && (
        <div className="absolute inset-0 bg-blue-50/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-xl border-2 border-dashed border-blue-300">
          <div className="text-center">
            <p className="text-lg font-semibold text-blue-600">Drop to ingest</p>
            <p className="text-sm text-blue-400 mt-1">Files will be absorbed into the brain</p>
          </div>
        </div>
      )}

      {/* ── Input ── */}
      <div className="px-6 pb-6 pt-2">
        <div className="bg-white rounded-2xl shadow-sm border border-[#e5e7eb] flex items-end gap-2 px-4 py-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-[#94A3B8] hover:text-[#64748B] transition-colors pb-0.5"
            title="Ingest file"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M17 10V13C17 15.2091 15.2091 17 13 17H7C4.79086 17 3 15.2091 3 13V7C3 4.79086 4.79086 3 7 3H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M14 3L14 9M14 3L11 6M14 3L17 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFileUpload(e.target.files)}
          />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Capture a thought, ask a question, or drop a file..."
            rows={1}
            className="flex-1 resize-none text-sm text-[#1e252a] placeholder:text-[#94A3B8] focus:outline-none bg-transparent"
            style={{ fontFamily: "var(--font-geist-sans), 'Geist', sans-serif" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || thinking}
            className="text-[#0ea5e9] hover:text-[#0284c7] disabled:text-[#d1d5db] transition-colors pb-0.5"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 10L16 4L10 16L9 11L4 10Z" fill="currentColor" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-[#94A3B8] text-center mt-2">
          Thoughts are absorbed into memory &middot; Questions get answers &middot; Files become knowledge
        </p>
      </div>
    </div>
  );
}
