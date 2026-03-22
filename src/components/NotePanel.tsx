"use client";

/**
 * NotePanel — Right-side note-taking panel per Figma node 99:1314 / 102:1043
 *
 * Appears when user clicks "Write" button. Feed shifts left and gets overlay.
 * Panel: semi-transparent bg, "New Note" button, title, formatting toolbar,
 * textarea, previous notes list, action buttons (Add To Knowledge, Save Draft, Delete).
 */

import { useState, useEffect, useRef, useCallback } from "react";

/* eslint-disable @next/next/no-img-element */

const geist = "var(--font-geist-sans), 'Geist', sans-serif";

interface NoteData {
  id: string;
  title: string;
  content: string;
  source_type: string;
  created_at: string;
}

interface NotePanelProps {
  onClose: () => void;
  onNoteSaved?: () => void; // callback to refresh feed after saving to knowledge
}

export default function NotePanel({ onClose, onNoteSaved }: NotePanelProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [drafts, setDrafts] = useState<NoteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "drafts">("all");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [visible, setVisible] = useState(false);

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Load existing notes
  const loadNotes = useCallback(async () => {
    try {
      const [allRes, draftRes] = await Promise.all([
        fetch("/api/notes?status=published&limit=50"),
        fetch("/api/notes?status=draft&limit=50"),
      ]);
      const allData = await allRes.json();
      const draftData = await draftRes.json();
      setNotes(allData.notes || []);
      setDrafts(draftData.notes || []);
    } catch (err) {
      console.error("Failed to load notes:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // Save to Knowledge
  async function handleSaveToKnowledge() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || "Untitled Note",
          content: content.trim(),
          save_as: "knowledge",
          note_id: editingNoteId || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTitle("");
        setContent("");
        setEditingNoteId(null);
        await loadNotes();
        onNoteSaved?.();
      }
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }

  // Save as Draft
  async function handleSaveDraft() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || "Untitled Note",
          content: content.trim(),
          save_as: "draft",
          note_id: editingNoteId || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTitle("");
        setContent("");
        setEditingNoteId(null);
        await loadNotes();
      }
    } catch (err) {
      console.error("Draft save failed:", err);
    } finally {
      setSaving(false);
    }
  }

  // Delete note
  async function handleDelete() {
    if (editingNoteId) {
      try {
        await fetch("/api/notes", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note_id: editingNoteId }),
        });
        setTitle("");
        setContent("");
        setEditingNoteId(null);
        await loadNotes();
      } catch (err) {
        console.error("Delete failed:", err);
      }
    } else {
      // Just clear the editor
      setTitle("");
      setContent("");
    }
  }

  // Open a note for editing
  function openNote(note: NoteData) {
    setTitle(note.title);
    setContent(note.content);
    setEditingNoteId(note.id);
    textareaRef.current?.focus();
  }

  // Start a new note
  function handleNewNote() {
    setTitle("");
    setContent("");
    setEditingNoteId(null);
    textareaRef.current?.focus();
  }

  // Format helpers
  function insertFormat(prefix: string, suffix: string = prefix) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = content.substring(start, end);
    const newText = content.substring(0, start) + prefix + selected + suffix + content.substring(end);
    setContent(newText);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  }

  const displayNotes = activeTab === "all" ? notes : drafts;

  return (
    <div
      className="fixed z-50 flex flex-col overflow-y-auto transition-all duration-200 ease-out"
      style={{
        top: "264px",
        right: "24px",
        width: "506px",
        maxWidth: "calc(100vw - 48px)",
        maxHeight: "calc(100vh - 288px)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(20px)",
        background: "rgba(255,255,255,0.2)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: "0px 0px 40px 0px rgba(0,0,0,0.12)",
        borderRadius: "12px",
        padding: "12px",
      }}
    >
      {/* Inner container — matches Figma bg */}
      <div
        className="flex flex-col w-full rounded-[4px]"
        style={{ backgroundColor: "rgba(248,248,248,0.6)", padding: "12px" }}
      >
        {/* Note editor card */}
        <div
          className="flex flex-col gap-[14px] w-full rounded-[12px] px-[10px] py-[21px]"
          style={{
            backgroundColor: "rgba(238,243,240,0.2)",
            border: "0.5px solid #c7d2e5",
          }}
        >
          {/* New Note button */}
          <div className="flex items-center">
            <button
              onClick={handleNewNote}
              className="flex gap-[8px] h-[30px] items-center justify-center px-[18px] py-[10px] rounded-[8px] cursor-pointer hover:opacity-90 transition-opacity"
              style={{
                backgroundColor: "#3e4c60",
                boxShadow: "0px 1px 2px 0px rgba(16,24,40,0.05)",
              }}
            >
              <img
                src="/icons/intent/write.png"
                alt=""
                className="size-[20px]"
                style={{ filter: "brightness(0) invert(1)" }}
              />
              <span
                className="whitespace-nowrap"
                style={{
                  fontFamily: geist,
                  fontSize: "14px",
                  fontWeight: 500,
                  lineHeight: "16px",
                  color: "white",
                }}
              >
                New Note
              </span>
            </button>
          </div>

          {/* Title + formatting toolbar */}
          <div className="flex items-start justify-between w-full">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title..."
              className="bg-white h-[28px] rounded-[4px] px-[6px] flex-1 mr-[12px] focus:outline-none focus:ring-1 focus:ring-[#c7d2e5]"
              style={{
                fontFamily: geist,
                fontSize: "14px",
                fontWeight: 500,
                color: "#1e252a",
                letterSpacing: "-0.02px",
              }}
            />
            <div className="flex gap-[12px] items-center justify-center shrink-0">
              {/* Bold */}
              <button
                onClick={() => insertFormat("**")}
                className="bg-white flex items-center justify-center p-[4px] rounded-[6px] hover:bg-gray-50 transition-colors"
                style={{
                  border: "1px solid #d0d5dd",
                  boxShadow: "0px 1px 2px 0px rgba(16,24,40,0.05)",
                }}
                title="Bold"
              >
                <span className="size-[20px] flex items-center justify-center font-bold text-[14px] text-[#344054]">B</span>
              </button>
              {/* Italic */}
              <button
                onClick={() => insertFormat("*")}
                className="bg-white flex items-center justify-center p-[4px] rounded-[6px] hover:bg-gray-50 transition-colors"
                style={{
                  border: "1px solid #d0d5dd",
                  boxShadow: "0px 1px 2px 0px rgba(16,24,40,0.05)",
                }}
                title="Italic"
              >
                <span className="size-[20px] flex items-center justify-center italic text-[14px] text-[#344054]">I</span>
              </button>
              {/* Bullet list */}
              <button
                onClick={() => insertFormat("\n- ", "")}
                className="bg-white flex items-center justify-center p-[4px] rounded-[6px] hover:bg-gray-50 transition-colors"
                style={{
                  border: "1px solid #d0d5dd",
                  boxShadow: "0px 1px 2px 0px rgba(16,24,40,0.05)",
                }}
                title="Bullet list"
              >
                <span className="size-[20px] flex items-center justify-center text-[14px] text-[#344054]">☰</span>
              </button>
            </div>
          </div>

          {/* Text area */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Start writing your note"
            className="w-full rounded-[8px] px-[8px] py-[12px] resize-none focus:outline-none focus:ring-1 focus:ring-[#c7d2e5]"
            style={{
              fontFamily: geist,
              fontSize: "12px",
              fontWeight: 400,
              lineHeight: "14px",
              color: "#7b7f81",
              minHeight: "200px",
              border: "0.5px solid #d8d8d8",
              backgroundColor: "white",
            }}
          />

          {/* Tab badges — All Notes / Drafts */}
          <div className="flex gap-[14px] items-start">
            <button
              onClick={() => setActiveTab("all")}
              className="flex gap-[4px] items-center px-[6px] py-[2px] rounded-[6px] cursor-pointer transition-colors"
              style={{
                backgroundColor: activeTab === "all" ? "#e3fff5" : "transparent",
                border: activeTab === "all" ? "1px solid #a8fde8" : "1px solid #d8d8d8",
              }}
            >
              <span
                style={{
                  fontFamily: geist,
                  fontSize: "12px",
                  fontWeight: 500,
                  lineHeight: "18px",
                  color: "#3e4c60",
                }}
              >
                All Notes ({notes.length})
              </span>
            </button>
            <button
              onClick={() => setActiveTab("drafts")}
              className="flex gap-[4px] items-center px-[6px] py-[2px] rounded-[6px] cursor-pointer transition-colors"
              style={{
                backgroundColor: activeTab === "drafts" ? "#e6f1ff" : "transparent",
                border: activeTab === "drafts" ? "1px solid #b9cee8" : "1px solid #d8d8d8",
              }}
            >
              <span
                style={{
                  fontFamily: geist,
                  fontSize: "12px",
                  fontWeight: 500,
                  lineHeight: "18px",
                  color: "#3e4c60",
                }}
              >
                Drafts ({drafts.length})
              </span>
            </button>
          </div>

          {/* Previous notes list */}
          {!loading && displayNotes.length > 0 && (
            <div className="flex gap-[18px] items-start w-full overflow-x-auto">
              {displayNotes.slice(0, 4).map((note) => (
                <button
                  key={note.id}
                  onClick={() => openNote(note)}
                  className="flex flex-col items-start px-[8px] py-[6px] rounded-[8px] shrink-0 cursor-pointer hover:bg-[#f0f0f0] transition-colors text-left"
                  style={{
                    backgroundColor: "#f8f8f8",
                    border: "1px solid #d8d8d8",
                    minWidth: "156px",
                    maxWidth: "200px",
                  }}
                >
                  <span
                    className="overflow-hidden text-ellipsis whitespace-nowrap w-full"
                    style={{
                      fontFamily: geist,
                      fontSize: "14px",
                      fontWeight: 500,
                      color: "#1e252a",
                      letterSpacing: "-0.02px",
                    }}
                  >
                    {note.title || "Untitled"}
                  </span>
                  <span
                    className="overflow-hidden text-ellipsis whitespace-nowrap w-full"
                    style={{
                      fontFamily: geist,
                      fontSize: "12px",
                      fontWeight: 400,
                      lineHeight: "14px",
                      color: "#7b7f81",
                    }}
                  >
                    {note.content.slice(0, 60) || "Empty note"}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Bottom actions: Add To Knowledge | Save Draft | Delete */}
          <div className="flex items-start justify-between px-[6px] w-full">
            <button
              onClick={handleSaveToKnowledge}
              disabled={!content.trim() || saving}
              className="flex items-center gap-[6px] cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              <span
                style={{
                  fontFamily: geist,
                  fontSize: "12px",
                  fontWeight: 500,
                  lineHeight: "16px",
                  color: "#3e4c60",
                }}
              >
                {saving ? "Saving..." : "Add To Knowledge"}
              </span>
              {!saving && (
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="9" stroke="#22c55e" strokeWidth="1.5" />
                  <path d="M6 10l3 3 5-5" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <button
              onClick={handleSaveDraft}
              disabled={!content.trim() || saving}
              className="cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              <span
                style={{
                  fontFamily: geist,
                  fontSize: "12px",
                  fontWeight: 500,
                  lineHeight: "16px",
                  color: "#3e4c60",
                }}
              >
                Save Draft
              </span>
            </button>
            <button
              onClick={handleDelete}
              disabled={saving}
              className="cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              <span
                style={{
                  fontFamily: geist,
                  fontSize: "12px",
                  fontWeight: 500,
                  lineHeight: "16px",
                  color: "#3e4c60",
                }}
              >
                Delete
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
